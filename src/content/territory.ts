import type { GameState } from '../contracts';

export type TerritoryUpgradeTrack = 'wall' | 'shield';
export const territoryUpgradeRules = {
  wall: { maxLevel: 5, increase: 20, costPerLevel: 20 },
  shield: { maxLevel: 5, increase: 10, costPerLevel: 15 },
} as const;
export interface TerritoryUpgrade {
  track: TerritoryUpgradeTrack;
  level: number;
  nextLevel: number | null;
  cost: number;
  increase: number;
  allowed: boolean;
  reason?: 'maxLevel' | 'coins' | 'phase';
}

export function isTerritoryUpgradeTrack(track: unknown): track is TerritoryUpgradeTrack {
  return track === 'wall' || track === 'shield';
}

/** Missing legacy levels are level one; malformed numeric state is never upgraded. */
export function hasValidTerritoryUpgradeValues(state: GameState): boolean {
  const t = state.territory;
  const values = [state.coins, t.hp, t.maxHp, t.shield ?? 0, t.maxShield ?? 0];
  return values.every(value => Number.isFinite(value) && value >= 0)
    && t.hp <= t.maxHp && (t.shield ?? 0) <= (t.maxShield ?? 0)
    && [t.wallLevel ?? 1, t.shieldLevel ?? 1].every(level => Number.isInteger(level) && level >= 1);
}

/** UI preview and execution share prices, limits and phase checks. */
export function getTerritoryUpgrade(state: GameState, track: TerritoryUpgradeTrack): TerritoryUpgrade {
  if (!isTerritoryUpgradeTrack(track) || !hasValidTerritoryUpgradeValues(state)) {
    return { track, level: 1, nextLevel: null, cost: 0, increase: 0, allowed: false, reason: 'phase' };
  }
  const rule = territoryUpgradeRules[track];
  const level = (track === 'wall' ? state.territory.wallLevel : state.territory.shieldLevel) ?? 1;
  const capped = level >= rule.maxLevel;
  const preview: TerritoryUpgrade = {
    track, level, nextLevel: capped ? null : level + 1,
    cost: capped ? 0 : rule.costPerLevel * level,
    increase: capped ? 0 : rule.increase,
    allowed: false,
  };
  if (capped) return { ...preview, reason: 'maxLevel' };
  if (!(state.phase === 'ready' || state.phase === 'reward' || (state.phase === 'battle' && state.paused))) return { ...preview, reason: 'phase' };
  if (state.coins < preview.cost) return { ...preview, reason: 'coins' };
  return { ...preview, allowed: true };
}
