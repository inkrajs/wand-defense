import assert from 'node:assert/strict';
import test from 'node:test';
import type { Command, GameState } from '../contracts';
import { getTerritoryRecovery } from '../content/territoryRecovery';
import { createFixtureState } from './mock';
import { applyTerritoryRecoveryUpgrade } from './territoryRecovery';

function fixture(): GameState {
  const state = createFixtureState();
  state.coins = 2_000;
  state.territory = { hp: 63, maxHp: 100, shield: 17, maxShield: 50 };
  return state;
}

test('first recovery purchase unlocks only its track and does not immediately restore territory', () => {
  const state = fixture();
  const before = structuredClone(state);
  const preview = getTerritoryRecovery(state, 'wall');
  assert.equal(preview.level, 0);
  assert.equal(preview.unlocked, false);
  assert.equal(preview.cost, 300);
  assert.equal(preview.allowed, true);
  const result = applyTerritoryRecoveryUpgrade(state, { id: 'wall-unlock', type: 'upgradeTerritoryRecovery', track: 'wall' });
  assert.equal(result.result.status, 'executed');
  assert.equal(result.state.coins, 1_700);
  assert.equal(result.state.territory.wallRepairLevel, 1);
  assert.equal(result.state.territory.shieldRepairLevel, undefined);
  assert.equal(result.state.territory.hp, 63);
  assert.equal(result.state.territory.maxHp, 100);
  assert.equal(result.state.territory.shield, 17);
  assert.equal(result.state.territory.maxShield, 50);
  assert.deepEqual(result.events, [{
    seq: state.nextEventSeq, gameTimeMs: state.gameTimeMs, type: 'territoryRecoveryUpgraded',
    data: { track: 'wall', level: 1, cost: 300, rate: preview.nextRate },
  }]);
  assert.equal(result.state.revision, state.revision + 1);
  assert.equal(result.state.nextEventSeq, state.nextEventSeq + 1);
  assert.deepEqual(result.state.events, [...state.events, ...result.events]);
  assert.deepEqual(state, before);
});

test('later levels charge by current level and preserve each independent recovery rate', () => {
  const state = fixture();
  state.territory.wallRepairLevel = 1;
  state.territory.shieldRepairLevel = 3;
  const beforeWallRate = getTerritoryRecovery(state, 'wall').rate;
  const wallPreview = getTerritoryRecovery(state, 'wall');
  assert.equal(wallPreview.cost, 150);
  const wall = applyTerritoryRecoveryUpgrade(state, { id: 'wall-next', type: 'upgradeTerritoryRecovery', track: 'wall' });
  assert.equal(wall.result.status, 'executed');
  assert.equal(wall.state.territory.wallRepairLevel, 2);
  assert.equal(wall.state.territory.shieldRepairLevel, 3);
  assert.equal(wall.state.coins, 1_850);
  assert.deepEqual(wall.events[0].data, { track: 'wall', level: 2, cost: 150, rate: wallPreview.nextRate });
  assert.equal(getTerritoryRecovery(wall.state, 'shield').rate, getTerritoryRecovery(state, 'shield').rate);
  assert.notEqual(wallPreview.nextRate, beforeWallRate);

  const shieldPreview = getTerritoryRecovery(state, 'shield');
  assert.equal(shieldPreview.cost, 450);
  assert.equal(shieldPreview.nextRate, 8);
  const shield = applyTerritoryRecoveryUpgrade(state, { id: 'shield-next', type: 'upgradeTerritoryRecovery', track: 'shield' });
  assert.equal(shield.result.status, 'executed');
  assert.equal(shield.state.territory.shieldRepairLevel, 4);
  assert.equal(shield.state.territory.wallRepairLevel, 1);
  assert.equal(shield.state.coins, 1_550);
  assert.deepEqual(shield.events[0].data, { track: 'shield', level: 4, cost: 450, rate: shieldPreview.nextRate });
  assert.equal(shield.state.territory.hp, state.territory.hp);
  assert.equal(shield.state.territory.shield, state.territory.shield);
});

test('legacy missing recovery levels start at zero and unlock independently', () => {
  const state = fixture();
  delete state.territory.wallRepairLevel;
  delete state.territory.shieldRepairLevel;
  const wall = applyTerritoryRecoveryUpgrade(state, { id: 'legacy-wall', type: 'upgradeTerritoryRecovery', track: 'wall' });
  assert.equal(wall.state.territory.wallRepairLevel, 1);
  assert.equal(wall.state.territory.shieldRepairLevel, undefined);
  const shield = applyTerritoryRecoveryUpgrade(state, { id: 'legacy-shield', type: 'upgradeTerritoryRecovery', track: 'shield' });
  assert.equal(shield.state.territory.shieldRepairLevel, 1);
  assert.equal(shield.state.territory.wallRepairLevel, undefined);
});

test('ready, reward, and paused battle permit recovery upgrades; active battle and defeat reject atomically', () => {
  const permitted = [
    fixture(),
    (() => { const state = fixture(); state.phase = 'reward'; return state; })(),
    (() => { const state = fixture(); state.phase = 'battle'; state.paused = true; return state; })(),
  ];
  for (const [index, state] of permitted.entries()) {
    assert.equal(getTerritoryRecovery(state, 'wall').allowed, true);
    assert.equal(applyTerritoryRecoveryUpgrade(state, { id: `allowed-${index}`, type: 'upgradeTerritoryRecovery', track: 'wall' }).result.status, 'executed');
  }
  for (const [index, phase] of (['battle', 'defeat'] as const).entries()) {
    const state = fixture();
    state.phase = phase;
    state.paused = phase === 'defeat';
    const before = structuredClone(state);
    assert.equal(getTerritoryRecovery(state, 'wall').reason, 'phase');
    const result = applyTerritoryRecoveryUpgrade(state, { id: `phase-${index}`, type: 'upgradeTerritoryRecovery', track: 'wall' });
    assert.equal(result.result.code, 'INVALID_PHASE');
    assert.equal(result.state, state);
    assert.deepEqual(state, before);
    assert.deepEqual(result.events, []);
  }
});

test('insufficient coins reject without mutation or event', () => {
  const state = fixture();
  state.coins = 299;
  const before = structuredClone(state);
  assert.equal(getTerritoryRecovery(state, 'wall').reason, 'coins');
  const result = applyTerritoryRecoveryUpgrade(state, { id: 'poor', type: 'upgradeTerritoryRecovery', track: 'wall' });
  assert.equal(result.result.code, 'INSUFFICIENT_COINS');
  assert.equal(result.state, state);
  assert.deepEqual(state, before);
  assert.deepEqual(result.events, []);
});

test('unknown type or track rejects with INVALID_ARGUMENT', () => {
  const state = fixture();
  const unknownTrack = { id: 'track', type: 'upgradeTerritoryRecovery', track: 'roof' } as unknown as Extract<Command, { type: 'upgradeTerritoryRecovery' }>;
  const unknownType = { id: 'type', type: 'repairTerritoryRecovery', track: 'wall' } as unknown as Extract<Command, { type: 'upgradeTerritoryRecovery' }>;
  for (const command of [unknownTrack, unknownType]) {
    const before = structuredClone(state);
    const result = applyTerritoryRecoveryUpgrade(state, command);
    assert.equal(result.result.code, 'INVALID_ARGUMENT');
    assert.equal(result.state, state);
    assert.deepEqual(state, before);
    assert.deepEqual(result.events, []);
  }
});

test('safe metadata boundaries commit once and unsafe metadata or levels reject', () => {
  const boundary = fixture();
  boundary.revision = Number.MAX_SAFE_INTEGER - 1;
  boundary.nextEventSeq = Number.MAX_SAFE_INTEGER - 1;
  boundary.gameTimeMs = Number.MAX_SAFE_INTEGER;
  const committed = applyTerritoryRecoveryUpgrade(boundary, { id: 'boundary', type: 'upgradeTerritoryRecovery', track: 'wall' });
  assert.equal(committed.result.status, 'executed');
  assert.equal(committed.state.revision, Number.MAX_SAFE_INTEGER);
  assert.equal(committed.state.nextEventSeq, Number.MAX_SAFE_INTEGER);

  const invalidCases: { track: 'wall' | 'shield'; mutate: (state: GameState) => void }[] = [
    { track: 'wall', mutate: (state: GameState) => { state.revision = Number.MAX_SAFE_INTEGER; } },
    { track: 'wall', mutate: (state: GameState) => { state.nextEventSeq = Number.MAX_SAFE_INTEGER; } },
    { track: 'wall', mutate: (state: GameState) => { state.gameTimeMs = Number.MAX_SAFE_INTEGER + 1; } },
    { track: 'wall', mutate: (state: GameState) => { state.territory.wallRepairLevel = Number.MAX_SAFE_INTEGER; } },
    { track: 'wall', mutate: (state: GameState) => { state.territory.wallRepairLevel = Number.MAX_SAFE_INTEGER - 1; } },
    { track: 'shield', mutate: (state: GameState) => { state.territory.shieldRepairLevel = 1.5; } },
    { track: 'wall', mutate: (state: GameState) => { state.coins = Number.MAX_SAFE_INTEGER + 1; } },
  ];
  for (const { track, mutate } of invalidCases) {
    const state = fixture();
    mutate(state);
    const before = structuredClone(state);
    const result = applyTerritoryRecoveryUpgrade(state, { id: 'unsafe', type: 'upgradeTerritoryRecovery', track });
    assert.equal(result.result.code, 'INVALID_STATE');
    assert.equal(result.state, state);
    assert.deepEqual(state, before);
    assert.deepEqual(result.events, []);
  }
});
test('an unrelated malformed recovery level cannot block the healthy track', () => {
  for (const track of ['wall', 'shield'] as const) {
    const state = fixture();
    if (track === 'wall') state.territory.shieldRepairLevel = Number.NaN;
    else state.territory.wallRepairLevel = Number.NaN;
    const result = applyTerritoryRecoveryUpgrade(state, {
      id: `independent-${track}`, type: 'upgradeTerritoryRecovery', track,
    });
    assert.equal(result.result.status, 'executed');
    assert.equal(result.state.coins, 1_700);
    assert.equal(track === 'wall' ? result.state.territory.wallRepairLevel : result.state.territory.shieldRepairLevel, 1);
    assert.ok(Number.isNaN(track === 'wall' ? result.state.territory.shieldRepairLevel : result.state.territory.wallRepairLevel));
  }
});
