import type { CombatEntity, GameState, ProjectileImpact } from "../contracts";
import { applyContactDamage, nearbyEnemies, type CombatEmit } from "./targets";

export const MAX_IMPACT_TARGETS = 8;
const count = (value: number, max = MAX_IMPACT_TARGETS) => Number.isFinite(value) ? Math.max(1,Math.min(max,Math.floor(value))) : 1;
const radius = (value: number) => Number.isFinite(value) ? Math.max(0,Math.min(100,value)) : 0;
const falloff = (value: number | undefined) => value !== undefined && Number.isFinite(value) ? Math.max(0,Math.min(1,value)) : 1;
const duration = (value: number) => Number.isFinite(value) ? Math.max(1,Math.min(5_000,value)) : 400;
const interval = (value: number) => Number.isFinite(value) ? Math.max(200,Math.min(5_000,value)) : 400;

export function normalizeImpact(impact?: ProjectileImpact): ProjectileImpact | undefined {
  if (!impact) return undefined;
  switch (impact.type) {
    case "pierce": return {type:"pierce",maxTargets:count(impact.maxTargets),falloff:falloff(impact.falloff)};
    case "splash": return {type:"splash",maxTargets:count(impact.maxTargets),radius:radius(impact.radius)};
    case "chain": return {type:"chain",maxTargets:count(impact.maxTargets),radius:radius(impact.radius),falloff:falloff(impact.falloff)};
    case "field": return {type:"field",radius:radius(impact.radius),maxTargets:count(impact.maxTargets),
      durationMs:duration(impact.durationMs),tickMs:interval(impact.tickMs),
      trigger:impact.trigger === "range" || impact.trigger === "either" ? impact.trigger : "contact"};
  }
}

/** Resolve one true contact. A returned true keeps the same projectile for a later flight leg. */
export function resolveImpact(state: GameState, projectile: CombatEntity, target: CombatEntity, direction: {x:number;y:number}, emit: CombatEmit): boolean {
  const impact = normalizeImpact(projectile.impact);
  if (impact?.type === "field") return false;
  const hits = new Set(projectile.hitIds ?? []);
  const budget = Math.min(impact?.maxTargets ?? 1, MAX_IMPACT_TARGETS);
  const remaining = Math.max(0, Math.min(budget - hits.size, projectile.remainingImpacts ?? budget));
  if (remaining === 0 || hits.has(target.id)) return false;
  const targets = impact?.type === "splash"
    ? [target, ...nearbyEnemies(state,target.x,target.y,impact.radius,new Set([...hits,target.id]))].slice(0,remaining)
    : [target];
  for (const victim of targets) {
    if (victim.hp <= 0 || hits.has(victim.id)) continue;
    hits.add(victim.id);
    applyContactDamage(state,projectile,victim,emit);
  }
  projectile.hitIds = [...hits];
  projectile.remainingImpacts = Math.max(0,budget - hits.size);
  if (!impact || impact.type === "splash" || projectile.remainingImpacts === 0) return false;
  if (impact.type === "pierce") {
    const length = Math.hypot(direction.x,direction.y);
    if (length === 0) return false;
    const ux = direction.x / length, uy = direction.y / length;
    projectile.damage*=falloff(impact.falloff);
    projectile.originX=projectile.x;projectile.originY=projectile.y;
    projectile.targetId=undefined;projectile.targetX=projectile.x+ux*projectile.range;projectile.targetY=projectile.y+uy*projectile.range;
    projectile.headingX=ux;projectile.headingY=uy;
    return true;
  }
  const candidates = nearbyEnemies(state,target.x,target.y,impact.radius,hits);
  const next = candidates[0];
  if (!next) return false;
  projectile.damage *= falloff(impact.falloff);
  projectile.originX = projectile.x; projectile.originY = projectile.y;
  projectile.targetId = next.id; projectile.targetX = next.x; projectile.targetY = next.y;
  return true;
}
