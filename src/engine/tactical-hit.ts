import type { CombatEntity, GameState, OnHitSpec } from "../contracts";
import type { TacticalHit, TacticalStatus } from "../contracts/tactical-arcana";
import { applyResolvedDamage } from "./damage";
import { nearbyEnemies, type CombatEmit } from "./targets";

type TacticalEntity = CombatEntity & { onHit?: OnHitSpec & { tactical?: TacticalHit } };
type TacticalTarget = CombatEntity & { tacticalStatus?: TacticalStatus };

const live = (untilMs: number | undefined, now: number) => (untilMs ?? 0) > now;

export function tacticalArmorPierce(target: TacticalTarget, now: number, current = 0): number {
  return live(target.tacticalStatus?.exposedUntilMs, now) ? Math.max(current, .45) : current;
}

/** Effects run once per resolved contact. Secondary damage never enters the contact hook. */
export function applyTacticalHit(
  state: GameState, source: TacticalEntity, target: TacticalTarget, damage: number,
  provenance: Record<string, unknown>, emit: CombatEmit,
): void {
  if (damage <= 0 || target.faction !== "enemy" || source.faction !== "player") return;
  const tactic = source.onHit?.tactical;
  const status = target.tacticalStatus;
  if (!tactic && !status) return;
  const now = state.gameTimeMs;
  const active = status ?? {};
  const hit = (victim: CombatEntity, ratio: number, effect: string) =>
    applyResolvedDamage(victim, damage * ratio, { ...provenance, critical: false, tactic: effect }, emit, { armorPierce: .5 });
  const neighbor = () => nearbyEnemies(state, target.x, target.y, 7, new Set([target.id]))[0];

  if (live(active.brand?.untilMs, now) && active.brand?.owner === source.sourceCharacterId) {
    const tier = active.brand?.tier;
    delete active.brand;
    hit(target, .45, "brand");
    if (tier === 2) {
      const secondary = neighbor();
      if (secondary) hit(secondary, .6, "detonation");
    }
  } else if (tactic?.branding && target.hp > 0) {
    active.brand = { owner: source.sourceCharacterId, untilMs: now + 1800, tier: tactic.branding };
  }

  if (tactic?.freezing === 2 && live(active.frozenUntilMs, now)) {
    delete active.frozenUntilMs;
    if (target.status?.slow?.multiplier === .1) delete target.status.slow;
    hit(target, .65, "ice-shatter");
  } else if (tactic?.freezing && target.hp > 0 && source.element === "water"
    && (target.status?.slow?.remainingMs ?? 0) > 0 && !live(active.frozenUntilMs, now)) {
    const duration = target.definitionId.startsWith("boss-") ? 220 : 520;
    active.frozenUntilMs = now + duration;
    (target.status ??= {}).slow = { multiplier: .1, remainingMs: duration };
  }

  if (tactic?.conductivity === 2 && live(active.conductiveUntilMs, now)) {
    delete active.conductiveUntilMs;
    const secondary: TacticalTarget = neighbor() ?? target;
    hit(secondary, .55, "superconduct");
    if (secondary.hp > 0) (secondary.tacticalStatus ??= {}).exposedUntilMs = now + 1200;
  } else if (tactic?.conductivity && target.hp > 0) {
    active.conductiveUntilMs = now + 1500;
  }

  if (tactic?.armorBreak) {
    if (tactic.armorBreak === 2 && live(active.exposedUntilMs, now)) hit(target, .38, "weak-point");
    if (target.hp > 0) active.exposedUntilMs = now + (tactic.armorBreak === 2 ? 2200 : 1450);
  }
  if (target.hp > 0 && (active.brand || active.frozenUntilMs || active.conductiveUntilMs || active.exposedUntilMs)) {
    target.tacticalStatus = active;
  }
}
