import test from 'node:test';
import assert from 'node:assert/strict';
import type { CombatEntity, GameState } from '../contracts';
import { createFixtureState } from '../runtime/mock';
import { applyContactDamage } from './targets';
import { advanceEnemyStatuses } from './statusEffects';

function battle(): GameState {
  const state = createFixtureState();
  state.phase = 'battle';
  return state;
}

function enemy(id: string, x: number, hp = 100): CombatEntity {
  return { id, definitionId: 'enemy-basic', kind: 'enemy', faction: 'enemy', x, y: 50,
    hp, maxHp: hp, damage: 0, speed: 0, range: 0, cooldownMs: 1000, attackRemainingMs: 0 };
}

function spellSource(definitionId: string, damage: number, options: Partial<CombatEntity> = {}): CombatEntity {
  return { id: `projectile-${definitionId}`, definitionId, kind: 'projectile', faction: 'player',
    x: 40, y: 50, hp: 1, maxHp: 1, damage, speed: 0, range: 30, cooldownMs: 0,
    attackRemainingMs: 0, sourceCharacterId: 'character-1', sourceItemId: `${definitionId}-item`,
    attackRoll: { accuracy: 1, critChance: 0, critMultiplier: 2, sourceLuck: 11 },
    ...options };
}

function record() {
  const events: { type: string; data: Record<string, unknown> }[] = [];
  return { events, emit: (type: string, data: Record<string, unknown>) => events.push({ type, data }) };
}

test('water hit wets a living enemy and lightning conducts once to the nearest living enemy', () => {
  const state = battle();
  const primary = enemy('wet-target', 50);
  const dead = enemy('dead-closest', 51, 0);
  const nearest = enemy('nearest', 52);
  const farther = enemy('farther', 55);
  nearest.status = { wetRemainingMs: 900 };
  state.entities.push(primary, dead, farther, nearest);
  const { events, emit } = record();
  const rng = state.rngState;

  applyContactDamage(state, spellSource('water-bolt', 12, { onHit: { slow: { multiplier: 0.75, durationMs: 1200 } } }), primary, emit);
  assert.equal(primary.hp, 88);
  assert.equal(primary.status?.wetRemainingMs, 1500);
  assert.deepEqual(primary.status?.slow, { multiplier: 0.75, remainingMs: 1200 });

  applyContactDamage(state, spellSource('lightning-bolt', 20), primary, emit);
  assert.equal(primary.hp, 68);
  assert.equal(primary.status?.wetRemainingMs, undefined, 'the lightning reaction consumes wet');
  assert.equal(nearest.hp, 90, 'the nearest other living enemy takes half of the resolved direct hit');
  assert.equal(farther.hp, 100, 'only one nearby enemy receives the arc');
  assert.equal(dead.hp, 0, 'dead entities are never selected as conductive targets');
  assert.equal(nearest.status?.wetRemainingMs, 900, 'the direct reaction hit does not recursively trigger status effects');
  assert.equal(state.rngState, rng, 'these accurate noncritical hits and the arc use no random draws');
  assert.equal(events.filter(event => event.type === 'elementalReaction').length, 1);
  assert.equal(events.find(event => event.type === 'elementalReaction')?.data.mode, 'conduct');
  const arcDamage = events.filter(event => event.type === 'damage').at(-1)?.data;
  assert.equal(arcDamage?.targetId, 'nearest');
  assert.equal(arcDamage?.amount, 10);
  assert.equal(arcDamage?.sourceCharacterId, 'character-1');
  assert.equal(arcDamage?.sourceItemId, 'lightning-bolt-item');
  assert.equal(arcDamage?.sourceLuck, 11);
  assert.equal(arcDamage?.effect, 'lightning-bolt');
});

test('lightning uses a bounded bonus hit on the wet target when no neighbor is in arc range', () => {
  const state = battle();
  const target = enemy('isolated-wet', 50);
  target.status = { wetRemainingMs: 700 };
  state.entities.push(target);
  const { events, emit } = record();

  applyContactDamage(state, spellSource('lightning-bolt', 20), target, emit);

  assert.equal(target.hp, 70, 'the direct hit and one half-strength reaction hit are both resolved');
  assert.equal(target.status, undefined);
  assert.equal(events.filter(event => event.type === 'damage').length, 2);
  assert.equal(events.find(event => event.type === 'elementalReaction')?.data.mode, 'amplify');
});

test('a successful water hit that kills its target does not leave a wet status', () => {
  const state = battle();
  const target = enemy('water-lethal', 50, 5);
  state.entities.push(target);
  applyContactDamage(state, spellSource('water-bolt', 20), target, () => {});
  assert.equal(target.hp, 0);
  assert.equal(target.status, undefined);
});

test('damage fully absorbed by armor does not apply or consume elemental reactions', () => {
  const state = battle();
  const primary = enemy('armored-target', 50);
  primary.armor = 1_000;
  primary.status = { wetRemainingMs: 800 };
  const neighbor = enemy('armored-neighbor', 52);
  state.entities.push(primary, neighbor);
  const { events, emit } = record();

  applyContactDamage(state, spellSource('lightning-bolt', 20), primary, emit);

  assert.equal(primary.hp, 100);
  assert.equal(primary.status?.wetRemainingMs, 800);
  assert.equal(neighbor.hp, 100);
  assert.equal(events.filter(event => event.type === 'elementalReaction').length, 0);
});

test('misses and lightning hits without wet do not apply or conduct reactions', () => {
  const state = battle();
  const primary = enemy('plain-target', 50);
  const neighbor = enemy('plain-neighbor', 52);
  state.entities.push(primary, neighbor);
  const { events, emit } = record();

  applyContactDamage(state, spellSource('water-bolt', 12, {
    attackRoll: { accuracy: 0, critChance: 0, critMultiplier: 2, sourceLuck: 11 },
  }), primary, emit);
  assert.equal(primary.status, undefined);
  applyContactDamage(state, spellSource('lightning-bolt', 20), primary, emit);
  assert.equal(primary.hp, 80);
  assert.equal(neighbor.hp, 100);
  assert.equal(events.filter(event => event.type === 'attackMiss').length, 1);
  assert.equal(events.filter(event => event.type === 'elementalReaction').length, 0);

  primary.status = { wetRemainingMs: 800 };
  applyContactDamage(state, spellSource('lightning-bolt', 20, {
    attackRoll: { accuracy: 0, critChance: 0, critMultiplier: 2, sourceLuck: 11 },
  }), primary, emit);
  assert.equal(primary.hp, 80);
  assert.equal(primary.status?.wetRemainingMs, 800, 'a missed lightning hit does not consume wet');
  assert.equal(neighbor.hp, 100);
  assert.equal(events.filter(event => event.type === 'attackMiss').length, 2);
});

test('wet expires in simulation time and pauses with the battle gates', () => {
  const state = battle();
  const target = enemy('wet-clock', 50);
  state.entities.push(target);
  const { events, emit } = record();
  applyContactDamage(state, spellSource('water-bolt', 1), target, emit);
  advanceEnemyStatuses(state, 500, emit);
  assert.equal(target.status?.wetRemainingMs, 1000);

  for (const gate of ['paused', 'backpackOpen'] as const) {
    state[gate] = true;
    advanceEnemyStatuses(state, 1000, emit);
    assert.equal(target.status?.wetRemainingMs, 1000);
    state[gate] = false;
  }
  advanceEnemyStatuses(state, 1000, emit);
  assert.equal(target.status, undefined);
  assert.ok(events.some(event => event.type === 'statusExpired' && event.data.statusType === 'wet'));
});

test('lethal lightning can still conduct from a wet target to one living neighbor', () => {
  const state = battle();
  const primary = enemy('lethal-wet', 50, 5);
  const neighbor = enemy('arc-victim', 54);
  state.entities.push(primary, neighbor);
  const { events, emit } = record();
  applyContactDamage(state, spellSource('water-bolt', 1), primary, emit);
  applyContactDamage(state, spellSource('lightning-bolt', 10), primary, emit);
  assert.equal(primary.hp, 0);
  assert.equal(neighbor.hp, 95);
  assert.ok(events.some(event => event.type === 'elementalReaction' && event.data.mode === 'conduct'));
});
