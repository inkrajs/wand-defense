import type { BurnStatus, CombatEntity, GameState } from "../contracts";
import type { CombatEmit } from "./targets";

export const COMBAT_ROLL_LIMITS = Object.freeze({ maxDamage: 1e12, maxLuck: 1_000_000 });

export function boundedCombatValue(value: number | undefined, fallback: number, min: number, max: number): number {
  return value !== undefined && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

/** Shared HP mutation and provenance for resolved contacts and periodic damage. */
export function applyResolvedDamage(target: CombatEntity, amount: number, source: Record<string, unknown>, emit: CombatEmit): number {
  if (target.hp <= 0) return 0;
  const boundedAmount = boundedCombatValue(amount, 0, 0, COMBAT_ROLL_LIMITS.maxDamage);
  const armor = boundedCombatValue(target.armor, 0, 0, COMBAT_ROLL_LIMITS.maxDamage);
  const resolved = Math.max(0, boundedAmount - armor);
  target.hp = Math.max(0, target.hp - resolved);
  emit("damage", { ...source, targetId: target.id, amount: resolved, x: target.x, y: target.y,
    ...(armor > 0 ? { absorbedAmount: boundedAmount - resolved } : {}) });
  return resolved;
}

/** A saved burn never rolls accuracy/critical or applies another on-hit effect. */
export function applyPeriodicDamage(_state: GameState, target: CombatEntity, status: BurnStatus, emit: CombatEmit): void {
  applyResolvedDamage(target, status.damage, {
    statusId: status.id, sourceKind: "status", statusType: "burn", critical: false,
    sourceCharacterId: status.sourceCharacterId, sourceItemId: status.sourceItemId,
    effect: status.definitionId,
    sourceLuck: boundedCombatValue(status.sourceLuck, 0, 0, COMBAT_ROLL_LIMITS.maxLuck),
  }, emit);
}
