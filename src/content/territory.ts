import type { GameState } from '../contracts';

export type TerritoryUpgradeTrack = 'wall' | 'shield';

export const territoryUpgradeRules = {
  wall: { increase: 20, costPerLevel: 20 },
  shield: { increase: 10, costPerLevel: 15 },
} as const;

export const territoryRepairRules = {
  wall: { costPerPoint: 0.5 },
  shield: { costPerPoint: 0.3 },
} as const;

const MAX_SAFE_VALUE = Number.MAX_SAFE_INTEGER;

export interface TerritoryUpgrade {
  track: TerritoryUpgradeTrack;
  level: number;
  nextLevel: number | null;
  cost: number;
  increase: number;
  allowed: boolean;
  reason?: 'coins' | 'phase' | 'invalid';
}

export interface TerritoryRepair {
  track: TerritoryUpgradeTrack;
  current: number;
  maximum: number;
  restore: number;
  cost: number;
  allowed: boolean;
  reason?: 'full' | 'coins' | 'phase' | 'invalid';
}

export function isTerritoryUpgradeTrack(track: unknown): track is TerritoryUpgradeTrack {
  return track === 'wall' || track === 'shield';
}

function isSafeNonnegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_SAFE_VALUE;
}

function isValidLevel(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

function levelOf(state: GameState, track: TerritoryUpgradeTrack): number {
  return (track === 'wall' ? state.territory.wallLevel : state.territory.shieldLevel) ?? 1;
}

function currentAndMaximum(state: GameState, track: TerritoryUpgradeTrack): { current: number; maximum: number } {
  if (track === 'wall') return { current: state.territory.hp, maximum: state.territory.maxHp };
  return { current: state.territory.shield ?? 0, maximum: state.territory.maxShield ?? 0 };
}

function isRepairPhase(state: GameState): boolean {
  return state.phase === 'ready' || state.phase === 'reward' || (state.phase === 'battle' && state.paused);
}

/** Missing legacy levels and shield values use their level-one / zero defaults. */
export function hasValidTerritoryUpgradeValues(state: GameState): boolean {
  const t = state.territory;
  const shield = t.shield ?? 0;
  const maxShield = t.maxShield ?? 0;
  const values = [state.coins, t.hp, t.maxHp, shield, maxShield];
  return values.every(isSafeNonnegative)
    && t.hp <= t.maxHp && shield <= maxShield
    && isValidLevel(t.wallLevel ?? 1) && isValidLevel(t.shieldLevel ?? 1);
}

/** Preview and execution share the same unbounded progression price and safety checks. */
export function getTerritoryUpgrade(state: GameState, track: TerritoryUpgradeTrack): TerritoryUpgrade {
  if (!isTerritoryUpgradeTrack(track) || !hasValidTerritoryUpgradeValues(state)) {
    return { track, level: 1, nextLevel: null, cost: 0, increase: 0, allowed: false, reason: 'invalid' };
  }

  const level = levelOf(state, track);
  const rule = territoryUpgradeRules[track];
  const nextLevel = level + 1;
  const cost = rule.costPerLevel * level;
  const { current, maximum } = currentAndMaximum(state, track);
  if (!isValidLevel(nextLevel) || !isSafeNonnegative(cost)
      || !isSafeNonnegative(current + rule.increase) || !isSafeNonnegative(maximum + rule.increase)) {
    return { track, level, nextLevel: null, cost: 0, increase: 0, allowed: false, reason: 'invalid' };
  }

  const preview: TerritoryUpgrade = { track, level, nextLevel, cost, increase: rule.increase, allowed: false };
  if (!isRepairPhase(state)) return { ...preview, reason: 'phase' };
  if (state.coins < cost) return { ...preview, reason: 'coins' };
  return { ...preview, allowed: true };
}
/** Preview a full repair priced from the missing amount; this helper never mutates state. */
export function getTerritoryRepair(state: GameState, track: TerritoryUpgradeTrack): TerritoryRepair {
  if (!isTerritoryUpgradeTrack(track) || !hasValidTerritoryUpgradeValues(state)) {
    return { track, current: 0, maximum: 0, restore: 0, cost: 0, allowed: false, reason: 'invalid' };
  }

  const { current, maximum } = currentAndMaximum(state, track);
  const restore = maximum - current;
  if (!isSafeNonnegative(restore)) {
    return { track, current: 0, maximum: 0, restore: 0, cost: 0, allowed: false, reason: 'invalid' };
  }
  if (restore === 0) return { track, current, maximum, restore: 0, cost: 0, allowed: false, reason: 'full' };

  const cost = Math.max(1, Math.ceil(restore * territoryRepairRules[track].costPerPoint));
  if (!isSafeNonnegative(cost)) {
    return { track, current: 0, maximum: 0, restore: 0, cost: 0, allowed: false, reason: 'invalid' };
  }
  const preview: TerritoryRepair = { track, current, maximum, restore, cost, allowed: false };
  if (!isRepairPhase(state)) return { ...preview, reason: 'phase' };
  if (state.coins < cost) return { ...preview, reason: 'coins' };
  return { ...preview, allowed: true };
}
