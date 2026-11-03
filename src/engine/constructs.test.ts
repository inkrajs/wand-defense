import test from 'node:test';
import assert from 'node:assert/strict';
import type { CombatEntity, ConstructSpec, GameState } from '../contracts';
import { createFixtureState } from '../runtime/mock';
import { advanceConstructs, CONSTRUCT_LIMITS, normalizeConstruct, spawnConstructs, type ConstructCastSpec } from './constructs';

function baseConstruct(overrides: Partial<ConstructSpec> = {}): ConstructSpec {
  return {
    hp: 50, durationMs: 10_000, attackIntervalMs: 500, maxAlive: 2,
    attackMode: 'contact', behavior: 'attack', moveSpeed: 0,
    ...overrides,
  };
}

function fixture(phase: GameState['phase'] = 'battle'): GameState {
  const state = createFixtureState();
  state.phase = phase;
  state.items.unit = { id: 'unit', definitionId: 'wolf', kind: 'spell', level: 1, grade: 'common' };
  state.wands[0].placements = [{ itemId: 'unit', x: 0, y: 0, rotation: 0 }];
  state.characters[0].wandIds = [state.wands[0].id];
  state.waveSpawnRemaining = 1;
  return state;
}

function cast(overrides: Partial<ConstructCastSpec> = {}): ConstructCastSpec {
  return {
    kind: 'summon', itemId: 'unit', definitionId: 'wolf', power: 10, range: 8, casts: 1,
    construct: baseConstruct(), position: { x: 50, y: 84 },
    attackRoll: { accuracy: 1, critChance: 0, critMultiplier: 2, sourceLuck: 9 },
    ...overrides,
  };
}

function addEnemy(state: GameState, id: string, x = 50, y = 84, hp = 100): CombatEntity {
  const enemy: CombatEntity = { id, definitionId: 'enemy-basic', kind: 'enemy', faction: 'enemy',
    x, y, hp, maxHp: hp, damage: 1, speed: 0, range: 1, cooldownMs: 1000, attackRemainingMs: 0 };
  state.entities.push(enemy);
  return enemy;
}

function spawn(state: GameState, spec = cast(), events: { type: string; data: Record<string, unknown> }[] = []) {
  const result = spawnConstructs(state, 'character-1', spec,
    (type, data) => events.push({ type, data }));
  return { result, events };
}

test('normalizeConstruct enforces construct lifetime, source capacity and numeric budgets', () => {
  assert.deepEqual(normalizeConstruct(baseConstruct({ durationMs: 60_000, maxAlive: 12 })),
    { ...baseConstruct(), durationMs: 30_000, maxAlive: 8 });
  assert.equal(normalizeConstruct(baseConstruct({ hp: 0 })), undefined);
  assert.equal(normalizeConstruct(baseConstruct({ attackIntervalMs: Number.NaN })), undefined);
  assert.equal(CONSTRUCT_LIMITS.alive, 32);
  assert.equal(CONSTRUCT_LIMITS.perCast, 8);
});

test('manual buildings deploy in ready or paused preparation without a target or caller-owned coin charge', () => {
  for (const phase of ['ready', 'reward'] as const) {
    const state = fixture(phase);
    state.paused = true;
    state.backpackOpen = true;
    state.coins = 20;
    const { result, events } = spawn(state, cast({ kind: 'building', position: { x: 100, y: 0 },
      construct: baseConstruct({ coinCost: 5 }) }));
    assert.equal(result, true);
    const building = state.entities.find(entity => entity.kind === 'building')!;
    assert.deepEqual([building.x, building.y], [100, 0]);
    assert.equal(state.coins, 20, 'the caller spends a single coin cost after success');
    assert.equal(events[0].type, 'constructSpawned');
    assert.equal(events[0].data.kind, 'building');
  }
});

test('automatic summons wait for active battle, but can spawn without any enemy', () => {
  const ready = fixture('ready');
  assert.equal(spawn(ready, cast({ position: undefined })).result, false);
  assert.equal(ready.entities.length, 0);

  const state = fixture('battle');
  const { result } = spawn(state, cast({ position: undefined }));
  assert.equal(result, true);
  assert.deepEqual([state.entities[0].x, state.entities[0].y], [50, 84]);
  state.paused = true;
  assert.equal(spawn(state, cast({ position: undefined })).result, false);
});

test('invalid position, defeat, unaffordable coin cost and capacity failures are atomic', () => {
  const state = fixture('battle');
  const invalid = spawn(state, cast({ position: { x: 100.1, y: 2 } }));
  assert.equal(invalid.result, false);
  assert.deepEqual(invalid.events, []);
  assert.equal(state.entities.length, 0);

  state.phase = 'defeat';
  assert.equal(spawn(state).result, false);
  state.phase = 'battle';
  state.coins = 0;
  assert.equal(spawn(state, cast({ construct: baseConstruct({ coinCost: 1 }) })).result, false);
  assert.equal(state.entities.length, 0);

  state.coins = 100;
  const capped = spawn(state, cast({ casts: 3, burstCount: 3, splitCount: 3,
    construct: baseConstruct({ maxAlive: 8 }) }));
  assert.equal(capped.result, true, 'the cast creates the available prefix up to its eight-entity budget');
  assert.equal(state.entities.length, 8);
  assert.equal(capped.events.at(-1)?.type, 'spellCast');
  assert.equal(capped.events.at(-1)?.data.casts, 8, 'the event reports the actual number created');

  const fullGlobal = fixture('battle');
  for (let index = 0; index < CONSTRUCT_LIMITS.alive; index++) {
    fullGlobal.entities.push({ id: `existing-${index}`, definitionId: 'other', kind: 'summon', faction: 'player',
      x: 50, y: 84, hp: 1, maxHp: 1, damage: 0, speed: 0, range: 0, cooldownMs: 1000,
      attackRemainingMs: 0, remainingMs: 1000, sourceCharacterId: `char-${index}`, sourceItemId: `item-${index}` });
  }
  assert.equal(spawn(fullGlobal).result, false);
  assert.equal(fullGlobal.entities.length, CONSTRUCT_LIMITS.alive);
});

test('same-source maxAlive uses character, item and definition and reports the actual multi-copy spawn', () => {
  const state = fixture();
  const request = cast({ casts: 2, splitCount: 2, construct: baseConstruct({ maxAlive: 2 }) });
  assert.equal(spawn(state, request).result, true);
  assert.equal(state.entities.filter(entity => entity.kind === 'summon').length, 2);
  assert.equal(spawn(state, cast({ construct: baseConstruct({ maxAlive: 2 }) })).result, false);
  const differentDefinition = cast({ definitionId: 'other-spell', construct: baseConstruct({ maxAlive: 1 }) });
  state.items.other = { id: 'other', definitionId: 'other-spell', kind: 'spell', level: 1, grade: 'common' };
  state.wands[0].placements.push({ itemId: 'other', x: 1, y: 0, rotation: 0 });
  assert.equal(spawn(state, { ...differentDefinition, itemId: 'other' }).result, true);
});

test('contact constructs use shared combat damage and preserve original cast on-hit provenance', () => {
  const state = fixture();
  const enemy = addEnemy(state, 'enemy-target', 50, 84, 100);
  const spec = cast({ range: 5, power: 12, onHit: { slow: { multiplier: 0.5, durationMs: 1000 } } });
  assert.equal(spawn(state, spec).result, true);
  const construct = state.entities.find(entity => entity.kind === 'summon')!;
  advanceConstructs(state, 50, () => {});
  assert.equal(enemy.hp, 88);
  assert.deepEqual(enemy.status?.slow, { multiplier: 0.5, remainingMs: 1000 });
  assert.equal(construct.sourceCharacterId, 'character-1');
  assert.equal(construct.sourceItemId, 'unit');
});

test('projectile constructs fire from their true entity origin and retain sourceEntityId', () => {
  const state = fixture();
  addEnemy(state, 'enemy-target', 20, 25);
  assert.equal(spawn(state, cast({ kind: 'building', position: { x: 20, y: 20 }, range: 6,
    construct: baseConstruct({ attackMode: 'projectile', projectileSpeed: 60 }) })).result, true);
  const construct = state.entities.find(entity => entity.kind === 'building')!;
  advanceConstructs(state, 50, () => {});
  const projectile = state.entities.find(entity => entity.kind === 'projectile')!;
  assert.equal(projectile.sourceEntityId, construct.id);
  assert.deepEqual([projectile.originX, projectile.originY], [construct.x, construct.y]);
  assert.equal(projectile.sourceCharacterId, 'character-1');
  assert.equal(projectile.sourceItemId, 'unit');
});

test('healing constructs restore an injured ally or territory and shield behavior restores territory shield', () => {
  const state = fixture();
  assert.equal(spawn(state, cast({ construct: baseConstruct({ behavior: 'heal' }), power: 15 })).result, true);
  const healer = state.entities.find(entity => entity.kind === 'summon')!;
  const ally = { ...structuredClone(healer), id: 'injured-ally', hp: 10, maxHp: 40 };
  state.entities.push(ally);
  advanceConstructs(state, 50, () => {});
  assert.equal(ally.hp, 25);
  assert.equal(state.territory.hp, state.territory.maxHp);

  const territory = fixture();
  territory.territory.hp -= 20;
  assert.equal(spawn(territory, cast({ construct: baseConstruct({ behavior: 'heal' }), power: 8 })).result, true);
  advanceConstructs(territory, 50, () => {});
  assert.equal(territory.territory.hp, territory.territory.maxHp - 12);

  const shield = fixture();
  shield.territory.shield = 0;
  assert.equal(spawn(shield, cast({ construct: baseConstruct({ behavior: 'shield' }), power: 7 })).result, true);
  advanceConstructs(shield, 50, () => {});
  assert.equal(shield.territory.shield, 7);
});

test('summons approach targets only until attack range and lifetime advances only during battle', () => {
  const state = fixture('ready');
  assert.equal(spawn(state, cast({ position: { x: 50, y: 10 }, range: 3, power: 0,
    construct: baseConstruct({ moveSpeed: 10, durationMs: 2000 }) })).result, true);
  const summon = state.entities.find(entity => entity.kind === 'summon')!;
  const events: string[] = [];
  advanceConstructs(state, 500, type => events.push(type));
  assert.equal(summon.remainingMs, 2000);
  state.phase = 'battle';
  const enemy = addEnemy(state, 'enemy-target', 50, 20);
  advanceConstructs(state, 700, type => events.push(type));
  assert.equal(summon.y, 17, 'the summon stops at its three-unit attack range');
  assert.equal(summon.remainingMs, 1300);
  assert.equal(enemy.hp, 100);
  advanceConstructs(state, 1300, type => events.push(type));
  assert.equal(state.entities.some(entity => entity.id === summon.id), false);
  assert.ok(events.includes('constructExpired'));
});

test('a construct can finish an attack during the final partial lifetime segment', () => {
  const state = fixture();
  const enemy = addEnemy(state, 'enemy-endpoint', 50, 84, 100);
  assert.equal(spawn(state, cast({ range: 2, power: 5,
    construct: baseConstruct({ durationMs: 25, attackIntervalMs: 100 }) })).result, true);
  const entity = state.entities.find(candidate => candidate.kind === 'summon')!;
  entity.attackRemainingMs = 10;
  const events: string[] = [];
  advanceConstructs(state, 50, type => events.push(type));
  assert.equal(enemy.hp, 95, 'the attack timer expires within the construct’s final 25 ms');
  assert.equal(state.entities.some(candidate => candidate.id === entity.id), false);
  assert.deepEqual(events, ['damage', 'constructExpired']);
});
