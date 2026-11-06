import assert from 'node:assert/strict';
import test from 'node:test';
import type { CombatEntity } from '../contracts';
import { TERRITORY_FRONT_Y } from '../content/battlefieldCoordinates';
import { getCharacterAnchor } from '../content/characterAnchors';
import { demoContent } from '../content/demo';
import { createInitialState } from '../runtime/initial';
import { stepBattle } from './index';
import { advanceEnemies } from './waves';

function wallBattle(wave = 2) {
  const state = createInitialState();
  state.phase = 'battle';
  state.wave = wave;
  state.waveSpawnRemaining = 0;
  return state;
}
function wallEnemy(id: string, x: number): CombatEntity {
  return { id, definitionId: 'enemy-basic', kind: 'enemy', faction: 'enemy',
    movementMode: 'straight', x, y: 92, hp: 18, maxHp: 18, damage: 2,
    speed: 10, moveSpeed: 10, moveRampMs: 0, range: 4,
    cooldownMs: 1000, attackRemainingMs: 0 };
}

test('left and right wall attackers advance continuously while still attacking the wall', () => {
  const state = wallBattle();
  state.entities = [wallEnemy('left', 0), wallEnemy('right', 100)];
  const seed = state.rngState;
  const attacks: string[] = [];
  advanceEnemies(state, 50, (type, data) => {
    if (type === 'territoryAttacked') attacks.push(String(data.enemyId));
  });
  assert.equal(state.entities[0].x, 0.5);
  assert.equal(state.entities[1].x, 99.5);
  assert.ok(state.entities.every(entity => entity.y === TERRITORY_FRONT_Y));
  assert.deepEqual(attacks, ['left', 'right']);
  assert.equal(state.territory.shield, 46);
  assert.equal(state.rngState, seed, 'approach consumes no random draws');
});

test('wall attackers choose the nearest current defender, including legacy enemies and roster changes', () => {
  const state = wallBattle();
  state.characters.push({ ...structuredClone(state.characters[0]), id: 'other', wandIds: [] });
  const left = wallEnemy('left', 0), right = wallEnemy('right', 100);
  delete left.movementMode; // already-stalled legacy save, no migration required
  state.entities = [left, right];
  for (let i = 0; i < 100; i++) advanceEnemies(state, 50, () => {});
  assert.equal(left.x, getCharacterAnchor(state.characters, state.characters[0].id)!.x);
  assert.equal(right.x, getCharacterAnchor(state.characters, 'other')!.x);
  state.characters.pop();
  advanceEnemies(state, 50, () => {});
  assert.equal(left.x, 38.5);
  assert.equal(right.x, 61.5);
  state.characters = [];
  const before = state.entities.map(entity => entity.x);
  advanceEnemies(state, 50, () => {});
  assert.deepEqual(state.entities.map(entity => entity.x), before);
});

test('pause and backpack freeze an already-stalled wall attacker', () => {
  for (const flag of ['paused', 'backpackOpen'] as const) {
    const state = wallBattle();
    state.entities = [wallEnemy('left', 0)];
    state[flag] = true;
    const before = structuredClone(state);
    advanceEnemies(state, 50, () => {});
    assert.deepEqual(state, before);
  }
});

test('starter spark really hits and clears both edge attackers beyond the first wave', () => {
  for (const wave of [2, 30]) {
    let state = wallBattle(wave);
    state.entities = [wallEnemy('left', 0), wallEnemy('right', 100)];
    delete state.entities[1].movementMode;
    const kills = new Set<string>();
    const contacts = new Set<string>();
    const spellBefore = structuredClone(demoContent.spells.spark);
    for (let tick = 0; tick < 600 && state.phase === 'battle'; tick++) {
      const result = stepBattle(state, 50, demoContent);
      for (const event of result.events) {
        if (event.type === 'enemyKilled') kills.add(String(event.data.entityId));
        if (event.type === 'damage' && event.data.projectileId) contacts.add(String(event.data.targetId));
      }
      state = result.state;
    }
    assert.equal(state.phase, 'reward', `wave ${wave}: no permanent wall dead zone`);
    assert.deepEqual([...kills].sort(), ['left', 'right']);
    assert.deepEqual([...contacts].sort(), ['left', 'right'], 'real projectile collision, not despawning enemies');
    assert.ok(state.territory.hp > 0);
    assert.deepEqual(demoContent.spells.spark, spellBefore, 'starter range and damage unchanged');
  }
});
