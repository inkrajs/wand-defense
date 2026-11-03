import assert from 'node:assert/strict';
import test from 'node:test';
import type { Command, GameState } from '../contracts';
import { getTerritoryRepair, getTerritoryUpgrade } from '../content/territory';
import { createFixtureState } from './mock';
import { applyTerritoryRepair, applyTerritoryUpgrade } from './territory';

function fixture(): GameState {
  const state = createFixtureState();
  state.coins = 100;
  state.territory = { hp: 63, maxHp: 100, shield: 17, maxShield: 50 };
  return state;
}

test('wall upgrade preserves damage, deducts shared price and appends one ordered event', () => {
  const state = fixture();
  const before = structuredClone(state);
  const preview = getTerritoryUpgrade(state, 'wall');
  assert.deepEqual(preview, { track: 'wall', level: 1, nextLevel: 2, cost: 20, increase: 20, allowed: true });
  const result = applyTerritoryUpgrade(state, { id: 'wall', type: 'upgradeTerritory', track: 'wall' });
  assert.equal(result.result.status, 'executed');
  assert.equal(result.state.coins, 80);
  assert.deepEqual(result.state.territory, { ...state.territory, hp: 83, maxHp: 120, wallLevel: 2 });
  assert.equal(result.state.territory.maxHp - result.state.territory.hp, 37);
  assert.equal(result.state.revision, state.revision + 1);
  assert.equal(result.state.nextEventSeq, state.nextEventSeq + 1);
  assert.deepEqual(result.events, [{ seq: state.nextEventSeq, gameTimeMs: state.gameTimeMs, type: 'territoryUpgraded', data: { track: 'wall', level: 2, cost: 20, increase: 20 } }]);
  assert.deepEqual(result.state.events, [...state.events, ...result.events]);
  assert.deepEqual(state, before);
});

test('upgrades continue beyond former caps with level-based prices and preserve existing damage', () => {
  const state = fixture();
  state.territory.wallLevel = 100;
  state.coins = 1_000_000;
  const firstPreview = getTerritoryUpgrade(state, 'wall');
  assert.deepEqual(firstPreview, { track: 'wall', level: 100, nextLevel: 101, cost: 2_000, increase: 20, allowed: true });
  const first = applyTerritoryUpgrade(state, { id: 'wall-100', type: 'upgradeTerritory', track: 'wall' });
  assert.equal(first.result.status, 'executed');
  assert.equal(first.state.territory.wallLevel, 101);
  assert.equal(first.state.coins, 998_000);
  assert.equal(first.state.territory.maxHp - first.state.territory.hp, 37);

  const secondState = first.state;
  secondState.territory.wallLevel = 1_000;
  const second = applyTerritoryUpgrade(secondState, { id: 'wall-1000', type: 'upgradeTerritory', track: 'wall' });
  assert.equal(second.result.status, 'executed');
  assert.equal(second.state.territory.wallLevel, 1_001);
  assert.equal(second.state.coins, 978_000);
  assert.equal(second.state.territory.maxHp - second.state.territory.hp, 37);
});

test('shield upgrade keeps its own price progression and missing legacy shield defaults to zero', () => {
  const state = fixture();
  state.territory.shieldLevel = 3;
  const result = applyTerritoryUpgrade(state, { id: 'shield', type: 'upgradeTerritory', track: 'shield' });
  assert.equal(result.result.status, 'executed');
  assert.equal(result.state.coins, 55);
  assert.equal(result.state.territory.shieldLevel, 4);
  assert.equal(result.state.territory.shield, 27);
  assert.equal(result.state.territory.maxShield, 60);
  assert.equal(result.state.territory.maxShield! - result.state.territory.shield!, 33);
  assert.equal(result.state.territory.hp, state.territory.hp);

  const legacy = fixture();
  delete legacy.territory.shield;
  delete legacy.territory.maxShield;
  const first = applyTerritoryUpgrade(legacy, { id: 'legacy', type: 'upgradeTerritory', track: 'shield' });
  assert.equal(first.state.coins, 85);
  assert.equal(first.state.territory.shieldLevel, 2);
  assert.equal(first.state.territory.shield, 10);
  assert.equal(first.state.territory.maxShield, 10);
});

test('wall and shield repairs restore their missing amount at their own rounded prices', () => {
  const wall = fixture();
  const wallBefore = structuredClone(wall);
  assert.deepEqual(getTerritoryRepair(wall, 'wall'), {
    track: 'wall', current: 63, maximum: 100, restore: 37, cost: 19, allowed: true,
  });
  const repairedWall = applyTerritoryRepair(wall, { id: 'repair-wall', type: 'repairTerritory', track: 'wall' });
  assert.equal(repairedWall.result.status, 'executed');
  assert.equal(repairedWall.state.coins, 81);
  assert.equal(repairedWall.state.territory.hp, 100);
  assert.equal(repairedWall.state.territory.maxHp, 100);
  assert.deepEqual(repairedWall.events, [{
    seq: wall.nextEventSeq, gameTimeMs: wall.gameTimeMs, type: 'territoryRepaired',
    data: { track: 'wall', cost: 19, increase: 37, hp: 100, shield: 17 },
  }]);
  assert.deepEqual(wall, wallBefore);

  const shield = fixture();
  const repairedShield = applyTerritoryRepair(shield, { id: 'repair-shield', type: 'repairTerritory', track: 'shield' });
  assert.equal(repairedShield.result.status, 'executed');
  assert.equal(repairedShield.state.coins, 90);
  assert.equal(repairedShield.state.territory.shield, 50);
  assert.deepEqual(repairedShield.events[0].data, { track: 'shield', cost: 10, increase: 33, hp: 63, shield: 50 });
});

test('fractional repairs round up to one coin and full or missing legacy shields cannot be purchased', () => {
  const wall = fixture();
  wall.territory.hp = 99.5;
  assert.equal(getTerritoryRepair(wall, 'wall').cost, 1);
  assert.equal(applyTerritoryRepair(wall, { id: 'fraction-wall', type: 'repairTerritory', track: 'wall' }).state.coins, 99);

  const shield = fixture();
  shield.territory.shield = 49.8;
  assert.equal(getTerritoryRepair(shield, 'shield').cost, 1);
  assert.equal(applyTerritoryRepair(shield, { id: 'fraction-shield', type: 'repairTerritory', track: 'shield' }).state.coins, 99);

  for (const state of [
    (() => { const s = fixture(); s.territory.hp = s.territory.maxHp; return s; })(),
    (() => { const s = fixture(); delete s.territory.shield; delete s.territory.maxShield; return s; })(),
  ]) {
    const track = state.territory.shield === undefined ? 'shield' : 'wall';
    const before = structuredClone(state);
    const preview = getTerritoryRepair(state, track);
    assert.equal(preview.allowed, false);
    assert.equal(preview.cost, 0);
    assert.equal(preview.reason, 'full');
    const result = applyTerritoryRepair(state, { id: `full-${track}`, type: 'repairTerritory', track });
    assert.equal(result.result.code, 'ALREADY_FULL');
    assert.equal(result.state, state);
    assert.deepEqual(state, before);
    assert.deepEqual(result.events, []);
  }
});

test('coin, phase, and defeat rejections are atomic; paused battle is a legal repair phase', () => {
  const failures = [
    { name: 'coins', mutate: (state: GameState) => { state.coins = 18; }, code: 'INSUFFICIENT_COINS' },
    { name: 'phase', mutate: (state: GameState) => { state.phase = 'battle'; state.paused = false; }, code: 'INVALID_PHASE' },
    { name: 'defeat', mutate: (state: GameState) => { state.phase = 'defeat'; state.paused = true; }, code: 'INVALID_PHASE' },
  ] as const;
  for (const failure of failures) {
    const state = fixture();
    failure.mutate(state);
    const before = structuredClone(state);
    const preview = getTerritoryRepair(state, 'wall');
    assert.equal(preview.allowed, false);
    const result = applyTerritoryRepair(state, { id: failure.name, type: 'repairTerritory', track: 'wall' });
    assert.equal(result.result.code, failure.code);
    assert.equal(result.state, state);
    assert.deepEqual(state, before);
    assert.deepEqual(result.events, []);
  }

  const paused = fixture();
  paused.phase = 'battle';
  paused.paused = true;
  const repaired = applyTerritoryRepair(paused, { id: 'paused', type: 'repairTerritory', track: 'wall' });
  assert.equal(repaired.result.status, 'executed');
});

test('upgrades reject insufficient funds, invalid phase, and defeat without changing state', () => {
  const cases = [
    { reason: 'coins', mutate: (state: GameState) => { state.coins = 19; }, code: 'INSUFFICIENT_COINS' },
    { reason: 'phase', mutate: (state: GameState) => { state.phase = 'battle'; state.paused = false; }, code: 'INVALID_PHASE' },
    { reason: 'defeat', mutate: (state: GameState) => { state.phase = 'defeat'; state.paused = true; }, code: 'INVALID_PHASE' },
  ] as const;
  for (const entry of cases) {
    const state = fixture();
    entry.mutate(state);
    const before = structuredClone(state);
    const result = applyTerritoryUpgrade(state, { id: entry.reason, type: 'upgradeTerritory', track: 'wall' });
    assert.equal(result.result.code, entry.code);
    assert.equal(result.state, state);
    assert.deepEqual(state, before);
    assert.deepEqual(result.events, []);
  }
});

test('unknown tracks and invalid territory numbers reject without side effects', () => {
  const state = fixture();
  const unknownUpgrade = { id: 'unknown-u', type: 'upgradeTerritory', track: 'roof' } as unknown as Extract<Command, { type: 'upgradeTerritory' }>;
  const unknownRepair = { id: 'unknown-r', type: 'repairTerritory', track: 'roof' } as unknown as Extract<Command, { type: 'repairTerritory' }>;
  assert.equal(applyTerritoryUpgrade(state, unknownUpgrade).result.code, 'INVALID_ARGUMENT');
  assert.equal(applyTerritoryRepair(state, unknownRepair).result.code, 'INVALID_ARGUMENT');
  for (const corrupt of [
    (s: GameState) => { s.coins = NaN; },
    (s: GameState) => { s.territory.wallLevel = 1.5; },
    (s: GameState) => { s.territory.maxShield = Infinity; },
    (s: GameState) => { s.territory.hp = -1; },
    (s: GameState) => { s.coins = Number.MAX_SAFE_INTEGER + 1; },
  ]) {
    const invalid = fixture();
    corrupt(invalid);
    const before = structuredClone(invalid);
    assert.equal(getTerritoryUpgrade(invalid, 'wall').allowed, false);
    assert.equal(getTerritoryRepair(invalid, 'wall').allowed, false);
    const upgrade = applyTerritoryUpgrade(invalid, { id: 'invalid-u', type: 'upgradeTerritory', track: 'wall' });
    const repair = applyTerritoryRepair(invalid, { id: 'invalid-r', type: 'repairTerritory', track: 'wall' });
    assert.equal(upgrade.result.code, 'INVALID_STATE');
    assert.equal(repair.result.code, 'INVALID_STATE');
    assert.equal(upgrade.state, invalid);
    assert.equal(repair.state, invalid);
    assert.deepEqual(invalid, before);
    assert.deepEqual(upgrade.events, []);
    assert.deepEqual(repair.events, []);
  }
});

test('safe metadata boundaries commit once, while unsafe levels or counter increments are rejected', () => {
  const boundary = fixture();
  boundary.coins = Number.MAX_SAFE_INTEGER;
  boundary.revision = Number.MAX_SAFE_INTEGER - 1;
  boundary.nextEventSeq = Number.MAX_SAFE_INTEGER - 1;
  boundary.gameTimeMs = Number.MAX_SAFE_INTEGER;
  const committed = applyTerritoryUpgrade(boundary, { id: 'last-safe', type: 'upgradeTerritory', track: 'wall' });
  assert.equal(committed.result.status, 'executed');
  assert.equal(committed.state.revision, Number.MAX_SAFE_INTEGER);
  assert.equal(committed.state.nextEventSeq, Number.MAX_SAFE_INTEGER);
  assert.equal(committed.events[0].seq, Number.MAX_SAFE_INTEGER - 1);
  assert.equal(committed.events[0].gameTimeMs, Number.MAX_SAFE_INTEGER);

  for (const mutate of [
    (state: GameState) => { state.revision = Number.MAX_SAFE_INTEGER; },
    (state: GameState) => { state.nextEventSeq = Number.MAX_SAFE_INTEGER; },
    (state: GameState) => { state.revision = 0.5; },
    (state: GameState) => { state.gameTimeMs = Number.MAX_SAFE_INTEGER + 1; },
    (state: GameState) => { state.territory.wallLevel = Number.MAX_SAFE_INTEGER; },
  ]) {
    const state = fixture();
    mutate(state);
    const before = structuredClone(state);
    const result = applyTerritoryUpgrade(state, { id: 'unsafe', type: 'upgradeTerritory', track: 'wall' });
    assert.equal(result.result.code, 'INVALID_STATE');
    assert.equal(result.state, state);
    assert.deepEqual(state, before);
    assert.deepEqual(result.events, []);
  }
});
test('upgrade preview rejects only unsafe next prices or capacities without charging', () => {
  for (const mutate of [
    (state: GameState) => { state.territory.wallLevel = 1_000_000_000_000_000; },
    (state: GameState) => { state.territory.maxHp = Number.MAX_SAFE_INTEGER; },
    (state: GameState) => { state.territory.maxShield = Number.MAX_SAFE_INTEGER; },
  ]) {
    const state = fixture();
    state.coins = Number.MAX_SAFE_INTEGER;
    mutate(state);
    const track = state.territory.maxShield === Number.MAX_SAFE_INTEGER ? 'shield' : 'wall';
    const before = structuredClone(state);
    const preview = getTerritoryUpgrade(state, track);
    assert.equal(preview.allowed, false);
    assert.equal(preview.reason, 'invalid');
    assert.equal(preview.nextLevel, null);
    const result = applyTerritoryUpgrade(state, { id: 'unsafe-next', type: 'upgradeTerritory', track });
    assert.equal(result.result.code, 'INVALID_STATE');
    assert.equal(result.state, state);
    assert.deepEqual(state, before);
    assert.deepEqual(result.events, []);
  }
});
