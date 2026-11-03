import type { GameState } from "../contracts";
import { getTerritoryRecoveryRate } from "../content/territoryRecovery";

const safeResource = (value: number): boolean => Number.isFinite(value)
  && value >= 0 && value <= Number.MAX_SAFE_INTEGER;

function recovered(current: number, maximum: number, rate: number, seconds: number): number {
  if (!safeResource(current) || !safeResource(maximum) || current >= maximum || rate <= 0) return current;
  const gap = maximum - current;
  // Compare before multiplying so even a very large finite dt cannot overflow the gain.
  return seconds >= gap / rate ? maximum : Math.min(maximum, current + rate * seconds);
}

/** Advance unlocked recovery using the caller's already-scaled simulation time. */
export function advanceTerritoryRecovery(state: GameState, dtMs: number): void {
  if (state.phase !== "battle" || state.paused || state.backpackOpen
    || !Number.isFinite(dtMs) || dtMs <= 0) return;
  const territory = state.territory;
  if (!safeResource(territory.hp) || territory.hp <= 0
    || !safeResource(territory.maxHp) || territory.hp > territory.maxHp) return;
  const seconds = dtMs / 1_000;
  if (seconds <= 0) return;
  const wallRate = getTerritoryRecoveryRate(territory, "wall");
  const shieldRate = getTerritoryRecoveryRate(territory, "shield");
  if (wallRate > 0) territory.hp = recovered(territory.hp, territory.maxHp, wallRate, seconds);
  if (shieldRate > 0) {
    const shield = territory.shield ?? 0;
    const next = recovered(shield, territory.maxShield ?? 0, shieldRate, seconds);
    if (next !== shield) territory.shield = next;
  }
}
