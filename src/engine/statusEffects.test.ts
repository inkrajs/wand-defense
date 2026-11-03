import test from 'node:test';
import assert from 'node:assert/strict';
import type { CombatEntity, GameState, OnHitSpec } from '../contracts';
import { createFixtureState } from '../runtime/mock';
import { advanceEnemyStatuses, applyOnHitEffects, normalizeOnHit } from './statusEffects';

function stateWithEnemy(): { state: GameState; enemy: CombatEntity } {
  const state = createFixtureState();
  state.phase = 'battle';
  const enemy: CombatEntity = {
    id: 'enemy-status', definitionId: 'enemy-moss', kind: 'enemy', faction: 'enemy',
    x: 50, y: 20, hp: 500, maxHp: 500, damage: 1, speed: 10, range: 4,
    cooldownMs: 1000, attackRemainingMs: 0,
  };
  state.entities = [enemy];
  return { state, enemy };
}

function source(overrides: Partial<CombatEntity> = {}): CombatEntity {
  return {
    id: 'projectile-1', definitionId: 'spark', kind: 'projectile', faction: 'player',
    x: 50, y: 20, hp: 1, maxHp: 1, damage: 10, speed: 0, range: 30,
    cooldownMs: 1000, attackRemainingMs: 0, sourceCharacterId: 'character-1',
    sourceItemId: 'item-1', attackRoll: { accuracy: 1, critChance: 0, critMultiplier: 2, sourceLuck: 7 },
    ...overrides,
  };
}

function capture() {
  const events: { type: string; data: Record<string, unknown> }[] = [];
  return { events, emit: (type: string, data: Record<string, unknown>) => events.push({ type, data }) };
}

test('normalizeOnHit bounds movement and duration and rejects empty or malformed effects', () => {
  const spec: OnHitSpec = {
    knockback: 99,
    slow: { multiplier: 0.01, durationMs: 9000 },
    burn: { powerRatio: 0.5, durationMs: 7000, tickMs: 1 },
  };
  assert.deepEqual(normalizeOnHit(spec), {
    knockback: 12,
    slow: { multiplier: 0.1, durationMs: 5000 },
    burn: { powerRatio: 0.5, durationMs: 5000, tickMs: 200 },
  });
  assert.equal(normalizeOnHit(undefined), undefined);
  assert.equal(normalizeOnHit({ slow: { multiplier: 0, durationMs: 500 } }), undefined);
  assert.equal(normalizeOnHit({ burn: { powerRatio: 1, durationMs: 0, tickMs: 100 } }), undefined);
});

test('slow keeps the strongest multiplier, refreshes equal strength by max remaining, and ignores weaker extensions', () => {
  const { state, enemy } = stateWithEnemy();
  const { events, emit } = capture();
  applyOnHitEffects(state, source({ onHit: { slow: { multiplier: 0.6, durationMs: 1000 } } }), enemy, emit);
  applyOnHitEffects(state, source({ id: 'projectile-2', onHit: { slow: { multiplier: 0.8, durationMs: 5000 } } }), enemy, emit);
  assert.deepEqual(enemy.status?.slow, { multiplier: 0.6, remainingMs: 1000 });
  applyOnHitEffects(state, source({ id: 'projectile-3', onHit: { slow: { multiplier: 0.6, durationMs: 700 } } }), enemy, emit);
  assert.equal(enemy.status?.slow?.remainingMs, 1000);
  applyOnHitEffects(state, source({ id: 'projectile-4', onHit: { slow: { multiplier: 0.6, durationMs: 1600 } } }), enemy, emit);
  assert.deepEqual(enemy.status?.slow, { multiplier: 0.6, remainingMs: 1600 });
  assert.equal(events.filter(event => event.type === 'statusApplied').length, 3);
});

test('burn refreshes only the same character-item-definition source and preserves its tick countdown', () => {
  const { state, enemy } = stateWithEnemy();
  const { events, emit } = capture();
  applyOnHitEffects(state, source({ onHit: { burn: { powerRatio: 0.3, durationMs: 1000, tickMs: 400 } } }), enemy, emit);
  const original = enemy.status!.burns![0];
  original.tickRemainingMs = 175;
  applyOnHitEffects(state, source({ damage: 20, attackRoll: { accuracy: 1, critChance: 0, critMultiplier: 2, sourceLuck: 12 },
    onHit: { burn: { powerRatio: 0.4, durationMs: 800, tickMs: 800 } } }), enemy, emit);
  assert.equal(enemy.status!.burns!.length, 1);
  assert.equal(original.damage, 8);
  assert.equal(original.remainingMs, 1000);
  assert.equal(original.tickRemainingMs, 175);
  assert.equal(original.tickMs, 400);
  assert.equal(original.sourceLuck, 12);

  for (let index = 2; index <= 5; index++) {
    applyOnHitEffects(state, source({ id: `projectile-${index}`, sourceItemId: `item-${index}`, definitionId: `spell-${index}`,
      onHit: { burn: { powerRatio: 0.1, durationMs: 800, tickMs: 250 } } }), enemy, emit);
  }
  assert.equal(enemy.status!.burns!.length, 4);
  assert.equal(enemy.status!.burns!.some(burn => burn.definitionId === 'spell-5'), false, 'a fifth new source is ignored');
});

test('burn ticks on simulation time without RNG or recursive on-hit effects and emits saved provenance', () => {
  const { state, enemy } = stateWithEnemy();
  const events: { type: string; data: Record<string, unknown> }[] = [];
  const collector = (type: string, data: Record<string, unknown>) => events.push({ type, data });
  const attack = source({
    attackRoll: { accuracy: 0, critChance: 1, critMultiplier: 4, sourceLuck: 33 },
    onHit: { burn: { powerRatio: 0.5, durationMs: 650, tickMs: 200 } },
  });
  // The successful contact has already been resolved; burn application and ticks never roll.
  applyOnHitEffects(state, attack, enemy, collector);
  const rng = state.rngState;
  advanceEnemyStatuses(state, 199, collector);
  assert.equal(enemy.hp, 500);
  advanceEnemyStatuses(state, 1, collector);
  assert.equal(enemy.hp, 495);
  assert.equal(state.rngState, rng);
  advanceEnemyStatuses(state, 400, collector);
  assert.equal(enemy.hp, 485);
  advanceEnemyStatuses(state, 50, collector);
  assert.equal(events.filter(event => event.type === 'attackMiss').length, 0);
  assert.deepEqual(events.filter(event => event.type === 'damage').map(event => event.data), [
    { statusId: 'burn:enemy-status:character-1:item-1:spark', sourceKind: 'status', statusType: 'burn', critical: false,
      sourceCharacterId: 'character-1', sourceItemId: 'item-1', effect: 'spark', sourceLuck: 33,
      targetId: 'enemy-status', amount: 5, x: 50, y: 20 },
    { statusId: 'burn:enemy-status:character-1:item-1:spark', sourceKind: 'status', statusType: 'burn', critical: false,
      sourceCharacterId: 'character-1', sourceItemId: 'item-1', effect: 'spark', sourceLuck: 33,
      targetId: 'enemy-status', amount: 5, x: 50, y: 20 },
    { statusId: 'burn:enemy-status:character-1:item-1:spark', sourceKind: 'status', statusType: 'burn', critical: false,
      sourceCharacterId: 'character-1', sourceItemId: 'item-1', effect: 'spark', sourceLuck: 33,
      targetId: 'enemy-status', amount: 5, x: 50, y: 20 },
  ]);
  assert.equal(events.at(-1)?.type, 'statusExpired');
  assert.equal(enemy.status, undefined);
});

test('knockback follows real heading, clamps x, and permits off-screen y', () => {
  const { state, enemy } = stateWithEnemy();
  enemy.x = 98;
  enemy.y = -2;
  const { events, emit } = capture();
  applyOnHitEffects(state, source({ x: 98, y: -2, headingX: 1, headingY: -1,
    onHit: { knockback: 12 } }), enemy, emit);
  assert.equal(enemy.x, 100);
  assert.ok(enemy.y < -2);
  assert.equal(events[0].type, 'knockback');
  assert.ok((events[0].data.distance as number) <= 12);
  assert.equal(events[0].data.distance, Math.hypot(2, enemy.y + 2));
});

test('status clocks pause with battle and backpack gates and expire after their active duration', () => {
  const { state, enemy } = stateWithEnemy();
  const { emit } = capture();
  applyOnHitEffects(state, source({ onHit: {
    slow: { multiplier: 0.5, durationMs: 250 },
    burn: { powerRatio: 0.1, durationMs: 250, tickMs: 200 },
  } }), enemy, emit);
  for (const key of ['paused', 'backpackOpen'] as const) {
    state[key] = true;
    const before = structuredClone(enemy.status);
    advanceEnemyStatuses(state, 500, emit);
    assert.deepEqual(enemy.status, before);
    state[key] = false;
  }
  advanceEnemyStatuses(state, 250, emit);
  assert.equal(enemy.status, undefined);
});
