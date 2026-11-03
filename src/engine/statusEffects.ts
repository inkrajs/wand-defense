import type { BurnStatus, CombatEntity, EnemyStatus, GameState, OnHitSpec } from "../contracts";
import { applyPeriodicDamage, boundedCombatValue, COMBAT_ROLL_LIMITS } from "./damage";
import type { CombatEmit } from "./targets";

export const STATUS_LIMITS = Object.freeze({
  minSlowMultiplier: 0.1,
  maxDurationMs: 5_000,
  minBurnTickMs: 200,
  maxBurnSources: 4,
  maxKnockback: 12,
});

/** Returns a detached, bounded description of the on-hit effects understood by combat. */
export function normalizeOnHit(spec?: OnHitSpec): OnHitSpec | undefined {
  if (!spec || typeof spec !== "object") return undefined;
  const normalized: OnHitSpec = {};
  const knockback = finiteNonnegative(spec.knockback);
  if (knockback > 0) normalized.knockback = Math.min(STATUS_LIMITS.maxKnockback, knockback);

  const slow = spec.slow;
  if (slow && typeof slow === "object" && Number.isFinite(slow.multiplier) && slow.multiplier > 0) {
    const durationMs = boundedDuration(slow.durationMs);
    if (durationMs > 0) normalized.slow = {
      multiplier: Math.max(STATUS_LIMITS.minSlowMultiplier, Math.min(1, slow.multiplier)),
      durationMs,
    };
  }

  const burn = spec.burn;
  if (burn && typeof burn === "object" && Number.isFinite(burn.powerRatio) && burn.powerRatio > 0
    && Number.isFinite(burn.tickMs) && burn.tickMs > 0) {
    const durationMs = boundedDuration(burn.durationMs);
    if (durationMs > 0) normalized.burn = {
      powerRatio: burn.powerRatio,
      durationMs,
      tickMs: Math.max(STATUS_LIMITS.minBurnTickMs, burn.tickMs),
    };
  }

  return normalized.knockback !== undefined || normalized.slow || normalized.burn ? normalized : undefined;
}

/** Called only after a real, damaging contact has succeeded. */
export function applyOnHitEffects(state: GameState, source: CombatEntity, target: CombatEntity, emit: CombatEmit): void {
  if (target.kind !== "enemy" || target.faction !== "enemy" || target.hp <= 0) return;
  const spec = normalizeOnHit(source.onHit);
  if (!spec) return;

  if (spec.slow) applySlow(target, source, spec.slow, emit);
  if (spec.burn) applyBurn(target, source, spec.burn, emit);
  if (spec.knockback) applyKnockback(target, source, spec.knockback, emit);
}

/** Advances status clocks by active simulation time; it never rolls or reapplies on-hit effects. */
export function advanceEnemyStatuses(state: GameState, dtMs: number, emit: CombatEmit): void {
  const dt = Number.isFinite(dtMs) ? Math.max(0, dtMs) : 0;
  if (state.phase !== "battle" || state.paused || state.backpackOpen || dt <= 0) return;

  for (const target of state.entities) {
    if (target.kind !== "enemy" || target.faction !== "enemy" || !target.status) continue;
    const status = target.status;
    if (status.slow) {
      status.slow.remainingMs = Math.max(0, boundedDuration(status.slow.remainingMs) - dt);
      if (status.slow.remainingMs <= 0) {
        emit("statusExpired", { targetId: target.id, statusId: slowStatusId(target), statusType: "slow" });
        delete status.slow;
      }
    }

    if (status.burns) {
      const activeBurns: BurnStatus[] = [];
      for (const burn of status.burns.slice(0, STATUS_LIMITS.maxBurnSources)) {
        advanceBurn(state, target, burn, dt, emit);
        if (burn.remainingMs > 0) activeBurns.push(burn);
        else emit("statusExpired", burnEventData(target, burn));
      }
      if (activeBurns.length > 0) status.burns = activeBurns;
      else delete status.burns;
    }

    if (!status.slow && !status.burns?.length) delete target.status;
  }
}

function applySlow(target: CombatEntity, source: CombatEntity, incoming: NonNullable<OnHitSpec["slow"]>, emit: CombatEmit): void {
  target.status ??= {};
  const current = target.status.slow;
  if (!current || incoming.multiplier < current.multiplier) {
    target.status.slow = { multiplier: incoming.multiplier, remainingMs: incoming.durationMs };
  } else if (incoming.multiplier === current.multiplier) {
    current.remainingMs = Math.max(current.remainingMs, incoming.durationMs);
  } else {
    return;
  }
  emit("statusApplied", {
    targetId: target.id, statusId: slowStatusId(target), statusType: "slow",
    ...sourceEventData(source), multiplier: target.status.slow!.multiplier,
    remainingMs: target.status.slow!.remainingMs,
  });
}

function applyBurn(target: CombatEntity, source: CombatEntity, incoming: NonNullable<OnHitSpec["burn"]>, emit: CombatEmit): void {
  const baseDamage = finiteNonnegative(source.damage);
  if (baseDamage <= 0) return;
  const damage = Math.min(COMBAT_ROLL_LIMITS.maxDamage, baseDamage * incoming.powerRatio);
  if (!Number.isFinite(damage) || damage <= 0) return;

  target.status ??= {};
  target.status.burns ??= [];
  const burns = target.status.burns;
  const existing = burns.find(candidate => sameBurnSource(candidate, source));
  let burn: BurnStatus;
  if (existing) {
    const stronger = damage > existing.damage;
    existing.remainingMs = Math.max(existing.remainingMs, incoming.durationMs);
    if (stronger) {
      existing.damage = damage;
      existing.sourceLuck = sourceLuck(source);
    }
    burn = existing;
  } else {
    if (burns.length >= STATUS_LIMITS.maxBurnSources) return;
    burn = {
      id: burnStatusId(target, source),
      definitionId: source.definitionId,
      sourceCharacterId: source.sourceCharacterId,
      sourceItemId: source.sourceItemId,
      sourceLuck: sourceLuck(source),
      damage,
      remainingMs: incoming.durationMs,
      tickMs: incoming.tickMs,
      tickRemainingMs: incoming.tickMs,
    };
    burns.push(burn);
  }
  emit("statusApplied", {
    targetId: target.id, ...burnEventData(target, burn), statusType: "burn",
    remainingMs: burn.remainingMs, tickMs: burn.tickMs, tickRemainingMs: burn.tickRemainingMs,
  });
}

function applyKnockback(target: CombatEntity, source: CombatEntity, distance: number, emit: CombatEmit): void {
  const direction = knockbackDirection(target, source);
  if (!direction) return;
  const beforeX = target.x;
  const beforeY = target.y;
  target.x = clamp(target.x + direction.x * distance, 0, 100);
  target.y = Math.min(100, target.y + direction.y * distance);
  emit("knockback", {
    targetId: target.id, statusType: "knockback", ...sourceEventData(source),
    distance: Math.hypot(target.x - beforeX, target.y - beforeY), x: target.x, y: target.y,
  });
}

function knockbackDirection(target: CombatEntity, source: CombatEntity): { x: number; y: number } | undefined {
  const heading = unitVector(source.headingX, source.headingY);
  if (heading) return heading;
  const position = unitVector(target.x - source.x, target.y - source.y);
  if (position) return position;
  return unitVector(target.x - source.originX!, target.y - source.originY!);
}

function unitVector(x: number | undefined, y: number | undefined): { x: number; y: number } | undefined {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  const length = Math.hypot(x!, y!);
  return length > 0 ? { x: x! / length, y: y! / length } : undefined;
}

function advanceBurn(state: GameState, target: CombatEntity, burn: BurnStatus, dt: number, emit: CombatEmit): void {
  let lifeRemaining = boundedDuration(burn.remainingMs);
  const tickMs = Math.max(STATUS_LIMITS.minBurnTickMs, finite(burn.tickMs, STATUS_LIMITS.minBurnTickMs));
  let tickRemainingMs = Math.max(0, Math.min(tickMs, finite(burn.tickRemainingMs, tickMs)));
  let activeMs = Math.min(dt, lifeRemaining);
  while (lifeRemaining > 0 && activeMs >= tickRemainingMs) {
    activeMs -= tickRemainingMs;
    lifeRemaining = Math.max(0, lifeRemaining - tickRemainingMs);
    if (target.hp > 0) applyPeriodicDamage(state, target, burn, emit);
    tickRemainingMs = tickMs;
    if (activeMs === 0 || lifeRemaining === 0) break;
  }
  lifeRemaining = Math.max(0, lifeRemaining - activeMs);
  burn.remainingMs = lifeRemaining;
  burn.tickRemainingMs = lifeRemaining > 0 ? Math.max(0, tickRemainingMs - activeMs) : tickMs;
}

function sameBurnSource(burn: BurnStatus, source: CombatEntity): boolean {
  return burn.sourceCharacterId === source.sourceCharacterId && burn.sourceItemId === source.sourceItemId
    && burn.definitionId === source.definitionId;
}

function burnStatusId(target: CombatEntity, source: CombatEntity): string {
  return `burn:${encodeURIComponent(target.id)}:${encodeURIComponent(source.sourceCharacterId ?? "")}`
    + `:${encodeURIComponent(source.sourceItemId ?? "")}:${encodeURIComponent(source.definitionId)}`;
}

function slowStatusId(target: CombatEntity): string { return `slow:${target.id}`; }

function sourceLuck(source: CombatEntity): number {
  return boundedCombatValue(source.attackRoll?.sourceLuck, 0, 0, COMBAT_ROLL_LIMITS.maxLuck);
}

function sourceEventData(source: CombatEntity): Record<string, unknown> {
  return {
    sourceCharacterId: source.sourceCharacterId,
    sourceItemId: source.sourceItemId,
    effect: source.definitionId,
  };
}

function burnEventData(target: CombatEntity, burn: BurnStatus): Record<string, unknown> {
  return {
    statusId: burn.id, statusType: "burn", targetId: target.id,
    sourceCharacterId: burn.sourceCharacterId, sourceItemId: burn.sourceItemId,
    effect: burn.definitionId, damage: burn.damage,
  };
}

function boundedDuration(value: number): number {
  return Math.min(STATUS_LIMITS.maxDurationMs, finiteNonnegative(value));
}

function finiteNonnegative(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, value!) : 0;
}

function finite(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
