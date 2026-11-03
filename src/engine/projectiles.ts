import type { CombatEntity, GameState } from "../contracts";
import { integrateMotion } from "./motion";

export interface ProjectileSpec {
  itemId: string;
  definitionId: string;
  power: number;
  range: number;
  casts: number;
  speed: number;
}

type Emit = (type: string, data: Record<string, unknown>) => void;

const ORIGIN_X = 50;
const ORIGIN_Y = 84;
const MAX_LIFETIME_MS = 5_000;
/** Prototype simulation budgets, shared by all characters and wands. */
export const PROJECTILE_LIMITS = Object.freeze({ perCast: 64, alive: 512 });
const FIELD_MIN = 0;
const FIELD_MAX = 100;

/** Adds one projectile per cast at the closest eligible enemy. */
export function spawnProjectiles(
  state: GameState,
  characterId: string,
  spec: ProjectileSpec,
  emit: Emit,
): boolean {
  if (state.phase !== "battle" || state.paused || state.backpackOpen) return false;
  const target = nearestTarget(state, spec.range);
  if (!target) return false;

  const alive = state.entities.filter(entity => entity.kind === "projectile" && entity.hp > 0
    && (entity.remainingMs === undefined || entity.remainingMs > 0)).length;
  const available = Math.max(0, PROJECTILE_LIMITS.alive - alive);
  if (available === 0) return false;
  const requested = Math.max(1, Math.floor(Number.isFinite(spec.casts) ? spec.casts : 1));
  const casts = Math.min(requested, PROJECTILE_LIMITS.perCast, available);
  const cap = Math.max(0, Number.isFinite(spec.speed) ? spec.speed : 0);
  const fireball = spec.definitionId === "fireball";
  const usedIds = new Set(state.entities.map((entity) => entity.id));
  for (let i = 0; i < casts; i++) {
    const baseId = `projectile-${state.wave}-${state.nextEventSeq}-${i}`;
    let id = baseId;
    let collision = 1;
    while (usedIds.has(id)) id = `${baseId}-${collision++}`;
    usedIds.add(id);
    const projectile: CombatEntity = {
      id,
      definitionId: spec.definitionId,
      kind: "projectile",
      faction: "player",
      x: ORIGIN_X,
      y: ORIGIN_Y,
      hp: 1,
      maxHp: 1,
      damage: Math.max(0, Number.isFinite(spec.power) ? spec.power : 0),
      speed: cap,
      moveSpeed: fireball ? cap * 0.18 : cap,
      moveRampMs: fireball ? 600 : 0,
      range: 0,
      cooldownMs: 0,
      attackRemainingMs: 0,
      remainingMs: MAX_LIFETIME_MS,
      sourceCharacterId: characterId,
      sourceItemId: spec.itemId,
      targetId: target.id,
      originX: ORIGIN_X,
      originY: ORIGIN_Y,
      targetX: target.x,
      targetY: target.y,
    };
    state.entities.push(projectile);
    emit("projectileSpawned", {
      entityId: id,
      definitionId: spec.definitionId,
      sourceCharacterId: characterId,
      sourceItemId: spec.itemId,
      targetId: target.id,
      x: projectile.x,
      y: projectile.y,
      originX: projectile.originX,
      originY: projectile.originY,
      targetX: projectile.targetX,
      targetY: projectile.targetY,
    });
  }
  emit("spellCast", {
    sourceCharacterId: characterId,
    sourceItemId: spec.itemId,
    definitionId: spec.definitionId,
    casts,
    targetId: target.id,
  });
  return true;
}

/** Advances only projectiles that existed at entry, so new casts wait for the next step. */
export function advanceProjectiles(state: GameState, dtMs: number, emit: Emit): void {
  const dt = Math.max(0, Number.isFinite(dtMs) ? dtMs : 0);
  if (state.phase !== "battle" || state.paused || state.backpackOpen || dt <= 0) return;

  for (const entity of state.entities) {
    if (entity.kind !== "projectile" || entity.hp <= 0 || (entity.remainingMs ?? 0) <= 0) continue;
    const projectile = entity;
    const target = projectile.targetId
      ? state.entities.find((candidate) => candidate.id === projectile.targetId && candidate.kind === "enemy" && candidate.faction === "enemy" && candidate.hp > 0)
      : undefined;
    if (target) {
      projectile.targetX = target.x;
      projectile.targetY = target.y;
    }
    if (!Number.isFinite(projectile.x) || !Number.isFinite(projectile.y) ||
        !Number.isFinite(projectile.targetX) || !Number.isFinite(projectile.targetY)) {
      projectile.hp = 0;
      projectile.remainingMs = 0;
      emitExpired(projectile, emit, "invalidPosition");
      continue;
    }
    const targetX = projectile.targetX!;
    const targetY = projectile.targetY!;

    const life = Math.max(0, projectile.remainingMs ?? 0);
    const activeDt = Math.min(dt, life);
    const dx = targetX - projectile.x;
    const dy = targetY - projectile.y;
    const remainingDistance = Math.hypot(dx, dy);
    const motion = integrateMotion(projectile.moveSpeed ?? projectile.speed, projectile.speed, projectile.moveRampMs ?? 0, activeDt);
    if (remainingDistance <= motion.distance) {
      projectile.x = clamp(targetX, FIELD_MIN, FIELD_MAX);
      projectile.y = clamp(targetY, FIELD_MIN, FIELD_MAX);
      if (target && target.hp > 0 && target.id === projectile.targetId && life > 0) {
        const amount = Math.max(0, projectile.damage);
        target.hp = Math.max(0, target.hp - amount);
        emit("damage", {
          projectileId: projectile.id,
          targetId: target.id,
          sourceCharacterId: projectile.sourceCharacterId,
          sourceItemId: projectile.sourceItemId,
          amount,
          effect: projectile.definitionId,
          x: target.x,
          y: target.y,
        });
      } else {
        emitExpired(projectile, emit, "targetLost");
      }
      projectile.hp = 0;
      projectile.remainingMs = 0;
      continue;
    }

    projectile.moveSpeed = motion.speed;
    if (remainingDistance > 0) {
      projectile.x = clamp(projectile.x + dx / remainingDistance * motion.distance, FIELD_MIN, FIELD_MAX);
      projectile.y = clamp(projectile.y + dy / remainingDistance * motion.distance, FIELD_MIN, FIELD_MAX);
    }
    projectile.remainingMs = life - activeDt;
    if (projectile.remainingMs <= 0) {
      projectile.hp = 0;
      emitExpired(projectile, emit, "timeout");
    }
  }
}

function emitExpired(
  projectile: CombatEntity,
  emit: Emit,
  reason: "timeout" | "targetLost" | "invalidPosition",
): void {
  emit("projectileExpired", {
    entityId: projectile.id,
    sourceCharacterId: projectile.sourceCharacterId,
    sourceItemId: projectile.sourceItemId,
    targetId: projectile.targetId,
    x: Number.isFinite(projectile.x) ? projectile.x : Number.isFinite(projectile.originX) ? projectile.originX : ORIGIN_X,
    y: Number.isFinite(projectile.y) ? projectile.y : Number.isFinite(projectile.originY) ? projectile.originY : ORIGIN_Y,
    reason,
  });
}

function nearestTarget(state: GameState, range: number): CombatEntity | undefined {
  const maxRange = Math.max(0, Number.isFinite(range) ? range : 0);
  return state.entities
    .filter((entity) => entity.kind === "enemy" && entity.faction === "enemy" && entity.hp > 0)
    .map((entity) => ({ entity, distance: Math.hypot(entity.x - ORIGIN_X, entity.y - ORIGIN_Y) }))
    .filter((entry) => entry.distance <= maxRange)
    .sort((a, b) => a.distance - b.distance || a.entity.id.localeCompare(b.entity.id))[0]?.entity;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
