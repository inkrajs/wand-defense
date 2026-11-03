import type { CombatEntity, GameState } from "../contracts";
import { getMonsterSize } from "../content/monsters";

export type ProjectileCollisionCandidate = { target: CombatEntity; radius: number };

/** Build per-advance collision data; callers must not retain it across simulation steps. */
export function buildProjectileCollisionCandidates(state: GameState): readonly ProjectileCollisionCandidate[] {
  const candidates: ProjectileCollisionCandidate[] = [];
  for (const target of state.entities) {
    if (target.kind !== "enemy" || target.faction !== "enemy" || target.hp <= 0
      || !Number.isFinite(target.x) || !Number.isFinite(target.y)) continue;
    candidates.push({ target, radius: getMonsterSize(target).hitRadius });
  }
  return candidates;
}

/** Swept collision catches intervening enemies even at high projectile speeds. */
export function firstProjectileCollision(
  state: GameState,
  from: { x: number; y: number },
  to: { x: number; y: number },
  excluded: ReadonlySet<string>,
  candidates: readonly ProjectileCollisionCandidate[] = buildProjectileCollisionCandidates(state),
  projectileRadius = 0,
) {
  const radiusExtension = Number.isFinite(projectileRadius) && projectileRadius >= 0 ? projectileRadius : 0;
  const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);
  const ux=length>0?dx/length:0,uy=length>0?dy/length:0;
  let first:{target:CombatEntity;x:number;y:number;distance:number}|undefined;
  for(const candidate of candidates) {
    const { target, radius } = candidate;
    let effectiveRadius = radius;
    if (radiusExtension > 0) {
      const expandedRadius = radius + radiusExtension;
      if (Number.isFinite(expandedRadius)) effectiveRadius = expandedRadius;
    }
    if(target.kind!=="enemy"||target.faction!=="enemy"||target.hp<=0||excluded.has(target.id)
      ||!Number.isFinite(target.x)||!Number.isFinite(target.y))continue;
    const ox=target.x-from.x,oy=target.y-from.y,projection=ox*ux+oy*uy;
    const perpendicular=ox*ox+oy*oy-projection*projection;
    if(perpendicular>effectiveRadius*effectiveRadius+1e-8)continue;
    const root=Math.sqrt(Math.max(0,effectiveRadius*effectiveRadius-perpendicular));
    let distance=projection-root;
    if(distance<0) {
      if(ox*ox+oy*oy<=effectiveRadius*effectiveRadius)distance=0;
      else continue;
    }
    if(distance>length+1e-8)continue;
    if(!first||distance<first.distance-1e-8||(Math.abs(distance-first.distance)<1e-8&&target.id<first.target.id))
      first={target,x:from.x+ux*distance,y:from.y+uy*distance,distance};
  }
  return first;
}
