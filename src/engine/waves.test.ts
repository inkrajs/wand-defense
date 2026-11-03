import test from 'node:test';
import assert from 'node:assert/strict';
import type { CombatEntity, GameState } from '../contracts';
import { getCharacterAnchor } from '../content/characterAnchors';
import { getMonsterSize, getUnlockedMinionDefinitions } from '../content/monsters';
import { createFixtureState } from '../runtime/mock';
import { advanceEnemies, getWaveSpec } from './waves';

function battleState(wave = 1): GameState {
  const state = createFixtureState();
  state.phase = 'battle';
  state.wave = wave;
  state.waveSpawnRemaining = getWaveSpec(wave).count;
  state.spawnRemainingMs = 0;
  return state;
}

function spawnAt(state: GameState, spawnIndex: number): { enemy: CombatEntity; events: string[] } {
  const events: string[] = [];
  const existingIds = new Set(state.entities.map(entity => entity.id));
  state.waveSpawnRemaining = getWaveSpec(state.wave).count - spawnIndex;
  state.spawnRemainingMs = 0;
  advanceEnemies(state, 1, type => events.push(type));
  const enemy = state.entities.find(entity => entity.kind === 'enemy' && !existingIds.has(entity.id));
  assert.ok(enemy);
  return { enemy, events };
}

function once(seed: number): { value: number; state: number } {
  const next = (Math.imul(1_664_525, seed >>> 0) + 1_013_904_223) >>> 0;
  return { value: next / 0x1_0000_0000, state: next };
}

function addSecondCharacter(state: GameState): void {
  state.characters.push({ ...structuredClone(state.characters[0]), id: 'character-2', name: '同行者', wandIds: [] });
}

function spawnWaveSummary(wave: number, seed: number) {
  const state = battleState(wave);
  state.rngState = seed;
  const spec = getWaveSpec(wave);
  const spawned: { type: string; data: Record<string, unknown>; enemy: CombatEntity }[] = [];
  for (let index = 0; index < spec.count; index++) {
    state.waveSpawnRemaining = spec.count - index;
    state.spawnRemainingMs = 0;
    const ids = new Set(state.entities.map(entity => entity.id));
    const events: { type: string; data: Record<string, unknown> }[] = [];
    advanceEnemies(state, 1, (type, data) => events.push({ type, data }));
    const entity = state.entities.find(candidate => candidate.kind === 'enemy' && !ids.has(candidate.id))!;
    const event = events.find(candidate => candidate.type === 'enemySpawned' || candidate.type === 'bossSpawned')!;
    spawned.push({ type: event.type, data: event.data, enemy: structuredClone(entity) });
  }
  return { spawned, rngState: state.rngState, state };
}

test('species movement overrides parity while lane and hunter target keep the one existing random draw', () => {
  const seed = 123456789;
  const expected = once(seed);
  const straightState = battleState(2);
  straightState.rngState = seed;
  addSecondCharacter(straightState);
  const straight = spawnAt(straightState, 0);
  assert.equal(straight.enemy.definitionId, 'enemy-basic');
  assert.equal(straight.enemy.movementMode, 'straight');
  assert.equal(straight.enemy.targetCharacterId, undefined);
  assert.equal(straightState.rngState, expected.state);
  assert.ok(Math.abs(straight.enemy.x - (10 + expected.value * 80)) < 1e-12);

  const huntState = battleState(2);
  huntState.rngState = seed;
  addSecondCharacter(huntState);
  const moss = spawnAt(huntState, 1);
  assert.equal(moss.enemy.definitionId, 'enemy-moss');
  assert.equal(moss.enemy.movementMode, 'straight', 'species movement overrides odd-index hunter parity');
  assert.equal(moss.enemy.targetCharacterId, undefined);
  assert.equal(huntState.rngState, expected.state);
  assert.ok(Math.abs(moss.enemy.x - (10 + expected.value * 80)) < 1e-12);

  const huntStateWave3 = battleState(3);
  huntStateWave3.rngState = seed;
  addSecondCharacter(huntStateWave3);
  const hunter = spawnAt(huntStateWave3, 1);
  assert.equal(hunter.enemy.definitionId, 'enemy-ember');
  assert.equal(hunter.enemy.movementMode, 'huntCharacter');
  const selected = huntStateWave3.characters[Math.floor(expected.value * huntStateWave3.characters.length)];
  assert.equal(hunter.enemy.targetCharacterId, selected.id);
  assert.equal(huntStateWave3.rngState, expected.state);
  assert.ok(hunter.enemy.x >= 10 && hunter.enemy.x <= 90);
});

test('first-wave spawns stay inside the starter lane and straight enemies keep their actual x', () => {
  const state = battleState(1);
  const count = getWaveSpec(1).count;
  const straightX = new Map<string, number>();
  for (let index = 0; index < count; index++) {
    const { enemy } = spawnAt(state, index);
    assert.equal(enemy.definitionId, 'enemy-basic');
    assert.ok(enemy.x >= 30 && enemy.x <= 70);
    if (enemy.movementMode === 'straight') straightX.set(enemy.id, enemy.x);
  }
  assert.equal(state.entities.length, count);
  assert.equal(state.entities[0].movementMode, 'straight', 'the first basic keeps the friendly straight lane');
  assert.equal(state.entities[0].targetCharacterId, undefined);
  assert.equal(straightX.size, Math.ceil(count / 2));
  state.waveSpawnRemaining = 0;
  advanceEnemies(state, 1_000, () => {});
  for (const [id, x] of straightX) {
    const enemy = state.entities.find(entity => entity.id === id)!;
    assert.equal(enemy.x, x);
  }
});

test('unlocked ordinary species rotate in catalog order and apply their full spawn ratios', () => {
  assert.deepEqual(getUnlockedMinionDefinitions(1).map(definition => definition.id), ['enemy-basic']);
  assert.deepEqual(getUnlockedMinionDefinitions(2).map(definition => definition.id), ['enemy-basic', 'enemy-moss']);
  assert.deepEqual(getUnlockedMinionDefinitions(10).map(definition => definition.id), [
    'enemy-basic', 'enemy-moss', 'enemy-ember', 'enemy-frost-moth', 'enemy-shadow-bat',
    'enemy-sand-beetle', 'enemy-crystal-crab',
  ]);

  const state = battleState(2);
  const basic = spawnAt(state, 0).enemy;
  const moss = spawnAt(state, 1).enemy;
  const spawn = getUnlockedMinionDefinitions(2).find(definition => definition.id === moss.definitionId)!.spawn!;
  assert.equal(basic.definitionId, 'enemy-basic');
  assert.equal(moss.definitionId, 'enemy-moss');
  assert.equal(moss.hp, 21 * spawn.hpMultiplier);
  assert.equal(moss.damage, 3 * spawn.damageMultiplier);
  assert.equal(moss.speed, 10.5 * spawn.speedMultiplier);
  assert.equal(moss.cooldownMs, Math.max(400, 995 * spawn.cooldownMultiplier));
  assert.equal(getMonsterSize(moss).id, 'small');

  const slowDefinition = getUnlockedMinionDefinitions(201).find(definition => definition.spawn!.cooldownMultiplier > 1)!;
  const late = spawnWaveSummary(201, 12345).spawned.find(entry => entry.enemy.definitionId === slowDefinition.id)!.enemy;
  assert.equal(late.cooldownMs, 400 * slowDefinition.spawn!.cooldownMultiplier,
    'the high-wave 400 ms floor is multiplied for the actual slow species');
  assert.ok(late.cooldownMs > 400);
});

test('wave 28 contains all unlocked minions with definition-sized entries and deterministic replay', () => {
  const seed = 987654321;
  const first = spawnWaveSummary(28, seed);
  const replay = spawnWaveSummary(28, seed);
  const spec = getWaveSpec(28);
  const minions = first.spawned.filter(entry => entry.type === 'enemySpawned');
  const bosses = first.spawned.filter(entry => entry.type === 'bossSpawned');
  const expectedIds = getUnlockedMinionDefinitions(28).map(definition => definition.id);
  const actualIds = [...new Set(minions.map(entry => entry.enemy.definitionId))];
  assert.deepEqual(actualIds.sort(), [...expectedIds].sort());
  assert.equal(first.spawned.length, spec.count);
  assert.equal(bosses.length, spec.bossNodes.length);
  assert.deepEqual(first.spawned, replay.spawned);

  let expectedRng = seed;
  for (let index = 0; index < spec.count; index++) expectedRng = once(expectedRng).state;
  assert.equal(first.rngState, expectedRng, 'species rotation adds no random draws');

  const baseHp = 18 + (28 - 1) * 3;
  const baseDamage = 2 + 28 - 1;
  const baseSpeed = 10 + Math.min(28 - 1, 10) * 0.5;
  const baseCooldown = Math.max(400, 1_000 - (28 - 1) * 5);
  for (const entry of minions) {
    const definition = getUnlockedMinionDefinitions(28).find(candidate => candidate.id === entry.enemy.definitionId)!;
    const ratios = definition.spawn!;
    assert.equal(entry.data.definitionId, definition.id);
    assert.equal(entry.enemy.hp, baseHp * ratios.hpMultiplier);
    assert.equal(entry.enemy.maxHp, entry.enemy.hp);
    assert.equal(entry.enemy.damage, baseDamage * ratios.damageMultiplier);
    assert.equal(entry.enemy.speed, baseSpeed * ratios.speedMultiplier);
    assert.equal(entry.enemy.cooldownMs, Math.max(400, baseCooldown * ratios.cooldownMultiplier));
    assert.equal(entry.enemy.bodySize, undefined, 'body size remains derived from the definition');
    const spawnY = -(getMonsterSize(entry.enemy).pixels / 6 + 2);
    assert.ok(entry.enemy.y >= spawnY && entry.enemy.y <= spawnY + entry.enemy.speed * 0.001 + 1e-6);
  }

  for (const node of spec.bossNodes) {
    const entry = first.spawned[node.spawnIndex];
    assert.equal(entry.type, 'bossSpawned');
    assert.equal(entry.enemy.definitionId, `boss-${node.tier}`);
    assert.equal(entry.data.bossTier, node.tier);
  }
});

test('boss schedule and boss identity remain intact when movement mode is assigned', () => {
  const state = battleState(5);
  const spec = getWaveSpec(5);
  const node = spec.bossNodes[0];
  assert.ok(node);
  const spawned = spawnAt(state, node.spawnIndex);
  assert.equal(spawned.enemy.definitionId, `boss-${node.tier}`);
  assert.equal(spawned.enemy.hp, 30 * 3);
  assert.equal(spawned.enemy.damage, 6 * 2);
  assert.equal(spawned.enemy.speed, 7);
  assert.equal(spawned.enemy.cooldownMs, 980);
  assert.deepEqual(spawned.events, ['bossSpawned']);
});

test('straight and legacy enemies keep their birth lane while moving vertically', () => {
  const state = battleState();
  const { enemy } = spawnAt(state, 0);
  const birthX = enemy.x;
  delete enemy.movementMode; // old checkpoints default to straight
  enemy.y = 20;
  enemy.speed = 10;
  enemy.moveSpeed = 10;
  enemy.moveRampMs = 0;
  state.waveSpawnRemaining = 0;
  advanceEnemies(state, 1_000, () => {});
  assert.equal(enemy.x, birthX);
  assert.equal(enemy.y, 30);
});

test('hunter reaches its selected anchor, then continues down that lane to attack only the territory', () => {
  const state = battleState();
  addSecondCharacter(state);
  const { enemy } = spawnAt(state, 1);
  const targetId = enemy.targetCharacterId!;
  const anchor = getCharacterAnchor(state.characters, targetId)!;
  enemy.x = 50;
  enemy.speed = 1_000;
  enemy.moveSpeed = 1_000;
  enemy.moveRampMs = 0;
  state.waveSpawnRemaining = 0;
  const events: string[] = [];

  advanceEnemies(state, 1_000, type => events.push(type));
  assert.equal(enemy.x, anchor.x);
  assert.equal(enemy.y, 84);
  assert.equal(events.length, 0);

  advanceEnemies(state, 1_000, type => events.push(type));
  assert.equal(enemy.x, anchor.x);
  assert.equal(enemy.y, 92);
  assert.deepEqual(events, ['territoryAttacked']);
  assert.equal(state.territory.shield, 48);
  assert.equal(state.territory.hp, 100);
});

test('missing hunter targets fall back to the first remaining character without another random draw', () => {
  const state = battleState();
  addSecondCharacter(state);
  const { enemy } = spawnAt(state, 1);
  state.characters = [state.characters[0]];
  enemy.x = 50;
  enemy.speed = 1_000;
  enemy.moveSpeed = 1_000;
  enemy.moveRampMs = 0;
  state.waveSpawnRemaining = 0;
  const rngState = state.rngState;
  advanceEnemies(state, 1_000, () => {});
  assert.equal(enemy.targetCharacterId, 'character-1');
  assert.equal(enemy.x, 50);
  assert.equal(enemy.y, 84);
  assert.equal(state.rngState, rngState);
});

test('hunter switches to straight movement when no characters remain', () => {
  const state = battleState();
  addSecondCharacter(state);
  const { enemy } = spawnAt(state, 1);
  state.characters = [];
  const laneX = enemy.x;
  enemy.y = 0;
  enemy.speed = 10;
  enemy.moveSpeed = 10;
  enemy.moveRampMs = 0;
  state.waveSpawnRemaining = 0;
  advanceEnemies(state, 1_000, () => {});
  assert.equal(enemy.movementMode, 'straight');
  assert.equal(enemy.targetCharacterId, undefined);
  assert.equal(enemy.x, laneX);
  assert.equal(enemy.y, 10);
});

test('slow weights only the active movement segment without changing the enemy speed ramp', () => {
  const state = battleState();
  const { enemy } = spawnAt(state, 0);
  state.waveSpawnRemaining = 0;
  enemy.x = 50;
  enemy.y = 20;
  enemy.speed = 10;
  enemy.moveSpeed = 10;
  enemy.moveRampMs = 0;
  enemy.status = { slow: { multiplier: 0.5, remainingMs: 40 } };

  advanceEnemies(state, 100, () => {});

  assert.equal(enemy.y, 20.8, '40 ms is slowed and the remaining 60 ms is normal speed');
  assert.equal(enemy.moveSpeed, 10, 'slow does not permanently rewrite current velocity');
  assert.equal(enemy.speed, 10, 'slow does not rewrite the movement cap');
  assert.equal(enemy.moveRampMs, 0, 'slow does not rewrite the ramp');
});

test('paused and open-backpack states freeze enemy movement and spawning', () => {
  for (const field of ['paused', 'backpackOpen'] as const) {
    const state = battleState();
    const { enemy } = spawnAt(state, 0);
    enemy.moveSpeed = enemy.speed / 2;
    state.waveSpawnRemaining = 2;
    state.spawnRemainingMs = 0;
    state[field] = true;
    const before = structuredClone(state);
    advanceEnemies(state, 50, () => {});
    assert.deepEqual(state, before);
  }
});
test('a real territory attack emits one source-position event and damages the territory once', () => {
  const state = battleState();
  const { enemy } = spawnAt(state, 0);
  state.waveSpawnRemaining = 0;
  enemy.y = 92;
  enemy.attackRemainingMs = 0;
  const events: { type: string; data: Record<string, unknown> }[] = [];
  advanceEnemies(state, 50, (type, data) => events.push({ type, data }));
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'territoryAttacked');
  assert.deepEqual(events[0].data, {
    enemyId: enemy.id, sourceEntityId: enemy.id, targetId: 'territory', x: enemy.x, y: 92,
    damage: 2, shieldAbsorbed: 2, hpDamage: 0, territoryShield: 48, territoryHp: 100,
  });
  assert.equal(state.territory.shield, 48);
  assert.equal(state.territory.hp, 100);
  advanceEnemies(state, 50, (type, data) => events.push({ type, data }));
  assert.equal(events.length, 1);
  assert.equal(state.territory.shield, 48);
});
