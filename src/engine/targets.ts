import type { CombatEntity, GameState } from "../contracts";
import { nextCombatRandom } from "./random";
import { applyResolvedDamage, boundedCombatValue, COMBAT_ROLL_LIMITS } from "./damage";
import { applyElementalReaction, applyOnHitEffects } from "./statusEffects";
export { COMBAT_ROLL_LIMITS } from "./damage";

export type CombatEmit = (type: string, data: Record<string, unknown>) => void;

/** Stable target order shared by launch, impact propagation and beams. */
export function nearbyEnemies(state: GameState, x: number, y: number, radius: number, excluded: ReadonlySet<string> = new Set()): CombatEntity[] {
  const limit = Number.isFinite(radius) ? Math.max(0, radius) : 0;
  return state.entities.filter(entity => entity.kind === "enemy" && entity.faction === "enemy" && entity.hp > 0 && !excluded.has(entity.id))
    .map(entity => ({entity, distance: Math.hypot(entity.x - x, entity.y - y)}))
    .filter(entry => entry.distance <= limit)
    .sort((a,b) => a.distance - b.distance || a.entity.id.localeCompare(b.entity.id)).map(entry => entry.entity);
}

/** Only simulation contact/pulses call this; preserves the firing character's cause. */
export function applyContactDamage(state:GameState, source: CombatEntity, target: CombatEntity, emit: CombatEmit): void {
  if (target.hp <= 0) return;
  const wasWet = (target.status?.wetRemainingMs ?? 0) > 0;
  const bounded = boundedCombatValue;
  const accuracy = bounded(source.attackRoll?.accuracy,1,0,1);
  const critChance = bounded(source.attackRoll?.critChance,0,0,1);
  const critMultiplier = bounded(source.attackRoll?.critMultiplier,1.5,1,10);
  let critical = false;
  if (accuracy < 1 || critChance > 0) {
    const roll = nextCombatRandom(state);
    if (roll >= accuracy) {
      emit("attackMiss",{entityId:source.id,targetId:target.id,sourceCharacterId:source.sourceCharacterId,
        sourceItemId:source.sourceItemId,effect:source.definitionId,x:target.x,y:target.y});
      return;
    }
    critical = roll / accuracy < critChance;
  }
  const baseDamage = Number.isFinite(source.damage) ? Math.max(0, source.damage) : 0;
  const amount = Math.min(COMBAT_ROLL_LIMITS.maxDamage,baseDamage * (critical ? critMultiplier : 1));
  const resolved = applyResolvedDamage(target, amount, { ...(source.kind === "beam" ? {beamId: source.id} : source.kind === "area" ? {areaId: source.id}
    : source.kind === "chain" ? {chainId: source.id} : source.kind === "summon" || source.kind === "building"
      ? { sourceEntityId: source.id, sourceKind: source.kind } : {projectileId: source.id}),
    targetId: target.id, sourceCharacterId: source.sourceCharacterId, sourceItemId: source.sourceItemId,
    ...(source.sourceEntityId ? { sourceEntityId: source.sourceEntityId } : {}),
    amount, critical, sourceLuck:bounded(source.attackRoll?.sourceLuck,0,0,COMBAT_ROLL_LIMITS.maxLuck),
    effect: source.definitionId }, emit);
  if (resolved > 0) applyElementalReaction(state, source, target, resolved, wasWet, emit);
  if (resolved > 0 && target.hp > 0 && source.onHit) applyOnHitEffects(state, source, target, emit);
}
