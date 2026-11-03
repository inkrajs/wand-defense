import assert from 'node:assert/strict';
import test from 'node:test';
import type { Command, GameState } from '../contracts';
import { getTerritoryUpgrade } from '../content/territory';
import { createFixtureState } from './mock';
import { applyTerritoryUpgrade } from './territory';

function fixture(): GameState {
  const state = createFixtureState();
  state.coins = 100;
  state.territory = { hp: 63, maxHp: 100, shield: 17, maxShield: 50 };
  return state;
}

test('legacy wall upgrade preserves damage, deducts cost and emits one ordered event without mutating input', () => {
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

test('shield upgrade uses its own price progression and handles legacy missing shield data', () => {
  const state = fixture();
  state.territory.shieldLevel = 3;
  const result = applyTerritoryUpgrade(state, { id: 'shield', type: 'upgradeTerritory', track: 'shield' });
  assert.equal(result.result.status, 'executed');
  assert.equal(result.state.coins, 55);
  assert.equal(result.state.territory.shieldLevel, 4);
  assert.equal(result.state.territory.shield, 27);
  assert.equal(result.state.territory.maxShield, 60);
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

test('coins, cap and phase rejection preserve original state; paused battle permits upgrading', () => {
  for (const reason of ['coins', 'maxLevel', 'phase', 'defeat'] as const) {
    const state = fixture();
    if (reason === 'coins') state.coins = 19;
    if (reason === 'maxLevel') state.territory.wallLevel = 5;
    if (reason === 'phase') { state.phase = 'battle'; state.paused = false; }
    if (reason === 'defeat') { state.phase = 'defeat'; state.paused = true; }
    const before = structuredClone(state);
    const preview = getTerritoryUpgrade(state, 'wall');
    assert.equal(preview.allowed, false);
    assert.equal(preview.reason, reason === 'defeat' ? 'phase' : reason);
    if (reason === 'maxLevel') assert.equal(preview.nextLevel, null);
    const result = applyTerritoryUpgrade(state, { id: reason, type: 'upgradeTerritory', track: 'wall' });
    assert.equal(result.result.status, 'rejected');
    assert.equal(result.state, state);
    assert.deepEqual(state, before);
    assert.deepEqual(result.events, []);
  }
  const paused = fixture();
  paused.phase = 'battle'; paused.paused = true; paused.backpackOpen = false;
  assert.equal(applyTerritoryUpgrade(paused, { id: 'paused', type: 'upgradeTerritory', track: 'wall' }).result.status, 'executed');
});

test('runtime rejects unknown tracks and malformed numeric state without side effects', () => {
  const state = fixture();
  const unknown = { id: 'unknown', type: 'upgradeTerritory', track: 'roof' } as unknown as Extract<Command, { type: 'upgradeTerritory' }>;
  assert.equal(applyTerritoryUpgrade(state, unknown).result.code, 'INVALID_ARGUMENT');
  for (const corrupt of [
    (s: GameState) => { s.coins = NaN; },
    (s: GameState) => { s.territory.wallLevel = NaN; },
    (s: GameState) => { s.territory.maxShield = Infinity; },
    (s: GameState) => { s.territory.hp = -1; },
  ]) {
    const invalid = fixture(); corrupt(invalid);
    const before = structuredClone(invalid);
    const result = applyTerritoryUpgrade(invalid, { id: 'invalid', type: 'upgradeTerritory', track: 'wall' });
    assert.equal(result.result.code, 'INVALID_STATE');
    assert.equal(result.state, invalid);
    assert.deepEqual(invalid, before);
    assert.deepEqual(result.events, []);
    assert.equal(getTerritoryUpgrade(invalid, 'wall').allowed, false);
  }
});
