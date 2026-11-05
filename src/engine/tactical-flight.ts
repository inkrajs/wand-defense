import type { CombatEntity, GameState } from "../contracts";
import type { TacticalFlightState } from "../contracts/tactical-arcana";
import type { ProjectileSpec } from "./projectiles";
import { nearbyEnemies, type CombatEmit } from "./targets";

export type TacticalProjectile = CombatEntity & { tacticalFlight?: TacticalFlightState };
export type TacticalProjectileSpec = ProjectileSpec & { tacticalFlight?: TacticalFlightState; excludeTargetId?: string };

export function startReturn(state: GameState, projectile: TacticalProjectile, emit: CombatEmit): boolean {
  const flight = projectile.tacticalFlight;
  if (!flight?.returnFlight || flight.returning || projectile.trigger || (projectile.remainingMs ?? 0) <= 0) return false;
  const x = projectile.originX;
  const y = projectile.originY;
  if (x === undefined || y === undefined) return false;
  const target = flight.returnFlight === 2
    ? nearbyEnemies(state, projectile.x, projectile.y, 16, new Set(projectile.hitIds))[0] : undefined;
  const end = target ?? { x, y };
  const dx = end.x - projectile.x;
  const dy = end.y - projectile.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-5) return false;
  projectile.headingX = dx / distance;
  projectile.headingY = dy / distance;
  projectile.range = distance;
  projectile.travelledDistance = 0;
  projectile.remainingImpacts = 1;
  projectile.damage *= .62;
  projectile.hitIds = [];
  delete projectile.steering;
  delete projectile.splitWaypointX;
  delete projectile.splitWaypointY;
  flight.returning = true;
  emit("projectileTurned", { entityId: projectile.id, x: projectile.x, y: projectile.y, targetId: target?.id });
  return true;
}

/** Only the lead branch can generate children. Each generation falls in power, max depth two. */
export function releaseSplit(
  state: GameState, projectile: TacticalProjectile, target: CombatEntity, emit: CombatEmit,
  spawn: (state: GameState, owner: string, spec: TacticalProjectileSpec, emit: CombatEmit) => boolean,
): void {
  const depth = projectile.tacticalFlight?.resplit;
  if (!depth) return;
  delete projectile.tacticalFlight!.resplit;
  const remainingTargets = nearbyEnemies(state, projectile.x, projectile.y, 12, new Set([target.id]));
  if (!remainingTargets.length || !projectile.sourceCharacterId || !projectile.sourceItemId) return;
  spawn(state, projectile.sourceCharacterId, {
    itemId: projectile.sourceItemId, definitionId: projectile.definitionId, element: projectile.element,
    power: projectile.damage * .36, range: 12, speed: Math.max(50, projectile.speed),
    casts: 2, splitCount: 2, maxCasts: 2,
    origin: { x: projectile.x, y: projectile.y }, fixedOrigin: true,
    tacticalFlight: depth === 2 ? { resplit: 1 } : undefined,
    excludeTargetId: target.id,
  }, emit);
}
