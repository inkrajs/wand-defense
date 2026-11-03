import assert from 'node:assert/strict';
import test from 'node:test';
import type { GameState } from '../contracts';
import { createInitialState } from '../runtime/initial';
import {
  getTerritoryRecovery,
  getTerritoryRecoveryRate,
  territoryRecoveryRules,
} from './territoryRecovery';

function fixture(): GameState {
  return createInitialState();
}

test('frozen rules preview first unlock and per-level costs for both tracks', () => {
  assert.equal(Object.isFrozen(territoryRecoveryRules), true);
  assert.equal(Object.isFrozen(territoryRecoveryRules.wall), true);
  assert.deepEqual(territoryRecoveryRules, {
    wall: { unlockCost: 300, costPerLevel: 150, ratePerLevel: 1 },
    shield: { unlockCost: 300, costPerLevel: 150, ratePerLevel: 2 },
  });

  const state = fixture();
  state.coins = 1_000;
  assert.deepEqual(getTerritoryRecovery(state, 'wall'), {
    track: 'wall', level: 0, unlocked: false, rate: 0, nextRate: 1, cost: 300, allowed: true,
  });
  assert.deepEqual(getTerritoryRecovery(state, 'shield'), {
    track: 'shield', level: 0, unlocked: false, rate: 0, nextRate: 2, cost: 300, allowed: true,
  });

  state.territory.wallRepairLevel = 1;
  state.territory.shieldRepairLevel = 1;
  assert.deepEqual(getTerritoryRecovery(state, 'wall'), {
    track: 'wall', level: 1, unlocked: true, rate: 1, nextRate: 2, cost: 150, allowed: true,
  });
  assert.deepEqual(getTerritoryRecovery(state, 'shield'), {
    track: 'shield', level: 1, unlocked: true, rate: 2, nextRate: 4, cost: 150, allowed: true,
  });
});

test('legacy levels default to zero and progression has no gameplay cap', () => {
  const state = fixture();
  state.coins = 1_000_000;
  delete state.territory.wallRepairLevel;
  delete state.territory.shieldRepairLevel;
  assert.equal(state.territory.wallRepairLevel, undefined);
  assert.equal(getTerritoryRecovery(state, 'wall').level, 0);
  assert.equal(getTerritoryRecoveryRate(state.territory, 'wall'), 0);

  state.territory.wallRepairLevel = 1_000;
  const high = getTerritoryRecovery(state, 'wall');
  assert.equal(high.level, 1_000);
  assert.equal(high.rate, 1_000);
  assert.equal(high.nextRate, 1_001);
  assert.equal(high.cost, 150_000);
  assert.equal(high.allowed, true);
  assert.equal(getTerritoryRecoveryRate(state.territory, 'wall'), 1_000);

  state.territory.shieldRepairLevel = 8;
  assert.equal(getTerritoryRecoveryRate(state.territory, 'shield'), 16);
});

test('coin and phase rejection preserve the computed rates and costs', () => {
  const state = fixture();
  state.coins = 0;
  state.territory.wallRepairLevel = 3;
  const poor = getTerritoryRecovery(state, 'wall');
  assert.deepEqual(poor, {
    track: 'wall', level: 3, unlocked: true, rate: 3, nextRate: 4,
    cost: 450, allowed: false, reason: 'coins',
  });

  state.coins = 1_000;
  state.phase = 'battle';
  state.paused = false;
  const activeBattle = getTerritoryRecovery(state, 'wall');
  assert.equal(activeBattle.allowed, false);
  assert.equal(activeBattle.reason, 'phase');
  assert.equal(activeBattle.rate, 3);
  assert.equal(activeBattle.nextRate, 4);
  assert.equal(activeBattle.cost, 450);

  state.paused = true;
  assert.equal(getTerritoryRecovery(state, 'wall').allowed, true);
  state.phase = 'defeat';
  assert.equal(getTerritoryRecovery(state, 'wall').allowed, false);
  assert.equal(getTerritoryRecovery(state, 'wall').reason, 'phase');
});

test('invalid territory or recovery levels reject with finite output', () => {
  for (const level of [Number.NaN, -1, 1.5, Number.MAX_SAFE_INTEGER]) {
    const state = fixture();
    state.coins = Number.MAX_SAFE_INTEGER;
    state.territory.wallRepairLevel = level;
    const preview = getTerritoryRecovery(state, 'wall');
    assert.equal(preview.allowed, false);
    assert.equal(preview.reason, 'invalid');
    assert.ok([preview.level, preview.rate, preview.nextRate, preview.cost].every(Number.isFinite));
  }

  const badTerritory = fixture();
  badTerritory.territory.hp = -1;
  assert.equal(getTerritoryRecovery(badTerritory, 'wall').reason, 'invalid');
  const badCoins = fixture();
  badCoins.coins = Number.NaN;
  assert.equal(getTerritoryRecovery(badCoins, 'shield').reason, 'invalid');
});

test('rate lookup ignores coins and phase, defaults legacy values, and safely rejects bad tracks or levels', () => {
  const state = fixture();
  state.coins = 0;
  state.phase = 'defeat';
  state.territory.wallRepairLevel = 2;
  assert.equal(getTerritoryRecoveryRate(state.territory, 'wall'), 2);

  const maxSafeTerritory = { ...state.territory, wallRepairLevel: Number.MAX_SAFE_INTEGER };
  assert.equal(getTerritoryRecoveryRate(maxSafeTerritory, 'wall'), Number.MAX_SAFE_INTEGER);
  for (const level of [Number.NaN, -1, 1.25, Number.POSITIVE_INFINITY]) {
    assert.equal(getTerritoryRecoveryRate({ ...state.territory, shieldRepairLevel: level }, 'shield'), 0);
  }
  assert.equal(getTerritoryRecoveryRate(state.territory, 'other' as never), 0);
  assert.equal(getTerritoryRecovery({ ...state, territory: state.territory }, 'other' as never).allowed, false);
});

test('previews do not mutate state or repair-level fields', () => {
  const state = fixture();
  state.coins = 1_000;
  state.territory.wallRepairLevel = 2;
  const before = structuredClone(state);
  getTerritoryRecovery(state, 'wall');
  getTerritoryRecoveryRate(state.territory, 'wall');
  assert.deepEqual(state, before);
});
