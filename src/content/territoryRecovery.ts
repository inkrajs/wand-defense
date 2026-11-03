import type { GameState } from '../contracts';
import {
  hasValidTerritoryUpgradeValues,
  isTerritoryUpgradeTrack,
  type TerritoryUpgradeTrack,
} from './territory';

const MAX_SAFE_VALUE = Number.MAX_SAFE_INTEGER;

export const territoryRecoveryRules = Object.freeze({
  wall: Object.freeze({ unlockCost: 300, costPerLevel: 150, ratePerLevel: 1 }),
  shield: Object.freeze({ unlockCost: 300, costPerLevel: 150, ratePerLevel: 2 }),
});

export interface TerritoryRecovery {
  track: TerritoryUpgradeTrack;
  level: number;
  unlocked: boolean;
  rate: number;
  nextRate: number;
  cost: number;
  allowed: boolean;
  reason?: 'coins' | 'phase' | 'invalid';
}

function recoveryLevel(territory: GameState['territory'], track: TerritoryUpgradeTrack): number {
  return (track === 'wall' ? territory.wallRepairLevel : territory.shieldRepairLevel) ?? 0;
}

function isRecoveryLevel(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function safeRate(level: number, track: TerritoryUpgradeTrack): number | undefined {
  const rate = level * territoryRecoveryRules[track].ratePerLevel;
  return Number.isFinite(rate) && rate >= 0 && rate <= MAX_SAFE_VALUE ? rate : undefined;
}

function isRecoveryPhase(state: GameState): boolean {
  return state.phase === 'ready' || state.phase === 'reward' || (state.phase === 'battle' && state.paused);
}

function invalidRecovery(track: TerritoryUpgradeTrack, level = 0, unlocked = false, rate = 0): TerritoryRecovery {
  return { track, level, unlocked, rate, nextRate: 0, cost: 0, allowed: false, reason: 'invalid' };
}

/** Preview an unlock or next recovery upgrade without changing the game state. */
export function getTerritoryRecovery(state: GameState, track: TerritoryUpgradeTrack): TerritoryRecovery {
  if (!isTerritoryUpgradeTrack(track)) return invalidRecovery('wall');
  if (!hasValidTerritoryUpgradeValues(state)) return invalidRecovery(track);

  const level = recoveryLevel(state.territory, track);
  if (!isRecoveryLevel(level)) return invalidRecovery(track);

  const unlocked = level > 0;
  const currentRate = safeRate(level, track);
  const nextLevel = level + 1;
  const nextRate = safeRate(nextLevel, track);
  const rule = territoryRecoveryRules[track];
  const cost = level === 0 ? rule.unlockCost : rule.costPerLevel * level;
  if (currentRate === undefined || !Number.isSafeInteger(nextLevel) || nextLevel < 1
      || nextRate === undefined || !Number.isFinite(cost) || cost < 0 || cost > MAX_SAFE_VALUE) {
    return invalidRecovery(track, level, unlocked, currentRate ?? 0);
  }

  const preview: TerritoryRecovery = { track, level, unlocked, rate: currentRate, nextRate, cost, allowed: false };
  if (!isRecoveryPhase(state)) return { ...preview, reason: 'phase' };
  if (state.coins < cost) return { ...preview, reason: 'coins' };
  return { ...preview, allowed: true };
}

/** Simulation-only rate lookup, independent of purchase and phase eligibility. */
export function getTerritoryRecoveryRate(
  territory: GameState['territory'],
  track: TerritoryUpgradeTrack,
): number {
  if (!isTerritoryUpgradeTrack(track)) return 0;
  const level = recoveryLevel(territory, track);
  if (!isRecoveryLevel(level)) return 0;
  return safeRate(level, track) ?? 0;
}
