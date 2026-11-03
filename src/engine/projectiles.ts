import type { AttackRollStats, CombatEntity, GameState, OnHitSpec, ProjectileImpact } from "../contracts";
import { integrateMotion } from "./motion";
import { normalizeImpact, resolveImpact } from "./impact";
import { nearbyEnemies } from "./targets";
import { getCharacterAnchors } from "../content/characterAnchors";
import { branchAngle, castPattern } from "./castPattern";
import { buildProjectileCollisionCandidates, firstProjectileCollision } from "./projectileCollision";
import { spawnProjectileField } from "./areaEffects";

export interface ProjectileSpec {
  itemId: string;
  definitionId: string;
  power: number;
  range: number;
  casts: number;
  burstCount?:number; splitCount?:number;
  speed: number;
  impact?: ProjectileImpact;
  attackRoll?: AttackRollStats;
  onHit?: OnHitSpec;
}

type Emit = (type: string, data: Record<string, unknown>) => void;

const ORIGIN_X = 50;
const ORIGIN_Y = 84;
const MAX_LIFETIME_MS = 5_000;
/** Prototype simulation budgets, shared by all characters and wands. */
export const PROJECTILE_LIMITS = Object.freeze({ perCast: 64, alive: 512 });
export const PROJECTILE_HIT_RADIUS = 0.4;
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
  const origin = getCharacterAnchors(state.characters).find(anchor => anchor.characterId === characterId)
    ?? {x: ORIGIN_X, y: ORIGIN_Y};
  const target = nearbyEnemies(state, origin.x, origin.y, spec.range)[0];
  if (!target) return false;

  const alive = state.entities.filter(entity => entity.kind === "projectile" && entity.hp > 0
    && (entity.remainingMs === undefined || entity.remainingMs > 0)).length;
  const available = Math.max(0, PROJECTILE_LIMITS.alive - alive);
  if (available === 0) return false;
  const pattern=castPattern(spec,Math.min(PROJECTILE_LIMITS.perCast,available));
  const casts=pattern.length;
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
      x: origin.x,
      y: origin.y,
      hp: 1,
      maxHp: 1,
      damage: Math.max(0, Number.isFinite(spec.power) ? spec.power : 0),
      speed: cap,
      moveSpeed: fireball ? cap * 0.18 : cap,
      moveRampMs: fireball ? 600 : 0,
      range: spec.range,
      impact: normalizeImpact(spec.impact),
      ...(spec.impact?.type === "field" ? { travelledDistance: 0 } : {}),
      hitIds: [],
      remainingImpacts: normalizeImpact(spec.impact)?.maxTargets ?? 1,
      cooldownMs: 0,
      attackRemainingMs: 0,
      remainingMs: MAX_LIFETIME_MS,
      attackRoll: spec.attackRoll ? {...spec.attackRoll} : undefined,
      ...(spec.onHit ? { onHit: structuredClone(spec.onHit) } : {}),
      sourceCharacterId: characterId,
      sourceItemId: spec.itemId,
      targetId: target.id,
      originX: origin.x,
      originY: origin.y,
      targetX: target.x,
      targetY: target.y,
      launchDelayMs:pattern[i].delay,
      splitBranchIndex:pattern[i].branch,
      splitBranchCount:pattern[i].branches,
    };
    state.entities.push(projectile);
    if(!pattern[i].delay) launchProjectile(state,projectile,emit);
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
  const collisionCandidates = buildProjectileCollisionCandidates(state);

  for (const entity of state.entities) {
    if (entity.kind !== "projectile" || entity.hp <= 0 || (entity.remainingMs ?? 0) <= 0) continue;
    const projectile = entity;
    let slice=dt;
    if((projectile.launchDelayMs??0)>0) {
      const waiting=Math.min(slice,projectile.launchDelayMs!);
      projectile.launchDelayMs!-=waiting;slice-=waiting;
      if(projectile.launchDelayMs!>0)continue;
      if(!launchProjectile(state,projectile,emit))continue;
      if(slice<=0)continue;
    }
    if (!Number.isFinite(projectile.x)||!Number.isFinite(projectile.y)) {
      projectile.hp=0;projectile.remainingMs=0;emitExpired(projectile,emit,"invalidPosition");continue;
    }
    if((!Number.isFinite(projectile.headingX)||!Number.isFinite(projectile.headingY))
      &&(!Number.isFinite(projectile.targetX)||!Number.isFinite(projectile.targetY))) {
      projectile.hp=0;projectile.remainingMs=0;emitExpired(projectile,emit,"invalidPosition");continue;
    }
    if(!Number.isFinite(projectile.headingX)||!Number.isFinite(projectile.headingY))
      aimProjectile(projectile,projectile.targetX??projectile.x,projectile.targetY??projectile.y-1);
    const life=Math.max(0,projectile.remainingMs??0),activeDt=Math.min(slice,life);
    const motion=integrateMotion(projectile.moveSpeed??projectile.speed,projectile.speed,projectile.moveRampMs??0,activeDt);
    let distance=motion.distance,hit=false,escaped=false;
    const fieldImpact = projectile.impact?.type === "field" ? projectile.impact : undefined;
    const fieldRange = fieldImpact ? Math.max(0, Number.isFinite(projectile.range) ? projectile.range : 0) : Infinity;
    projectile.remainingMs=life-activeDt;projectile.moveSpeed=motion.speed;
    for(let leg=0;leg<2&&(distance>0||(fieldImpact&&fieldRange-(Number.isFinite(projectile.travelledDistance)
      ? Math.max(0,projectile.travelledDistance!) : 0)<=1e-8));leg++) {
      const travelled = Math.max(0, Number.isFinite(projectile.travelledDistance) ? projectile.travelledDistance! : 0);
      const rangeRemaining = fieldImpact ? Math.max(0,fieldRange-travelled) : Infinity;
      const waypoint=Number.isFinite(projectile.splitWaypointX)&&Number.isFinite(projectile.splitWaypointY);
      const wx=waypoint?projectile.splitWaypointX!-projectile.x:0,wy=waypoint?projectile.splitWaypointY!-projectile.y:0;
      const waypointDistance=waypoint?Math.hypot(wx,wy):Infinity;
      if(waypoint&&waypointDistance<1e-8) {
        delete projectile.splitWaypointX;delete projectile.splitWaypointY;
        aimProjectile(projectile,projectile.targetX??projectile.x,projectile.targetY??projectile.y-1);continue;
      }
      const ux=waypoint?wx/waypointDistance:projectile.headingX!,uy=waypoint?wy/waypointDistance:projectile.headingY!;
      const requested=Math.min(distance,waypointDistance,rangeRemaining);
      const borderX=ux>0?(FIELD_MAX-projectile.x)/ux:ux<0?(FIELD_MIN-projectile.x)/ux:Infinity;
      const borderY=uy>0?(FIELD_MAX-projectile.y)/uy:uy<0?(FIELD_MIN-projectile.y)/uy:Infinity;
      const travel=Math.max(0,Math.min(requested,borderX,borderY));
      const next={x:projectile.x+ux*travel,y:projectile.y+uy*travel};
      const contact=fieldImpact?.trigger === "range" ? undefined
        : firstProjectileCollision(state,projectile,next,new Set(projectile.hitIds??[]),collisionCandidates,PROJECTILE_HIT_RADIUS);
      if(contact) {
        projectile.x=contact.x;projectile.y=contact.y;
        delete projectile.splitWaypointX;delete projectile.splitWaypointY;
        projectile.headingX=ux;projectile.headingY=uy;
        if(fieldImpact) {
          projectile.travelledDistance=travelled+contact.distance;
          spawnProjectileField(state,projectile,{x:contact.x,y:contact.y},fieldImpact,emit);
          projectile.hp=0;projectile.remainingMs=0;hit=true;break;
        }
        const continues=resolveImpact(state,projectile,contact.target,{x:ux,y:uy},emit);
        if(!continues){projectile.hp=0;projectile.remainingMs=0;}
        else if(projectile.impact?.type==="chain")aimProjectile(projectile,projectile.targetX!,projectile.targetY!);
        hit=true;break;
      }
      projectile.x=next.x;projectile.y=next.y;distance-=travel;
      if(fieldImpact) projectile.travelledDistance=travelled+travel;
      const rangeReached=fieldImpact !== undefined && rangeRemaining<=travel+1e-8 && travel>=requested-1e-8;
      if(rangeReached) {
        if(fieldImpact.trigger !== "contact") spawnProjectileField(state,projectile,projectile,fieldImpact,emit);
        projectile.hp=0;projectile.remainingMs=0;hit=true;break;
      }
      if(travel<requested-1e-8||travel<=0){escaped=true;break;}
      if(waypoint&&travel>=waypointDistance-1e-8) {
        delete projectile.splitWaypointX;delete projectile.splitWaypointY;
        aimProjectile(projectile,projectile.targetX??projectile.x,projectile.targetY??projectile.y-1);
      } else break;
    }
    if(!hit&&(escaped||projectile.remainingMs!<=0)) {
      projectile.hp=0;projectile.remainingMs=0;emitExpired(projectile,emit,escaped?"outOfBounds":"timeout");
    }
  }
}

function launchProjectile(state:GameState,projectile:CombatEntity,emit:Emit):boolean {
  const origin=getCharacterAnchors(state.characters).find(anchor=>anchor.characterId===projectile.sourceCharacterId);
  if(origin){projectile.x=origin.x;projectile.y=origin.y;projectile.originX=origin.x;projectile.originY=origin.y;}
  const targets=nearbyEnemies(state,projectile.x,projectile.y,projectile.range);
  const target=targets[(projectile.splitBranchIndex??0)%Math.max(1,targets.length)];
  if(!target){projectile.hp=0;projectile.remainingMs=0;return false;}
  projectile.targetId=target.id;projectile.targetX=target.x;projectile.targetY=target.y;
  const count=projectile.splitBranchCount??1;
  if(count>1) {
    const dx=target.x-projectile.x,dy=target.y-projectile.y,length=Math.hypot(dx,dy);
    const angle=Math.atan2(dy,dx)+branchAngle(projectile.splitBranchIndex??0,count,Math.PI/10);
    const lead=Math.min(4,length*.35);
    projectile.splitWaypointX=clamp(projectile.x+Math.cos(angle)*lead,FIELD_MIN,FIELD_MAX);
    projectile.splitWaypointY=clamp(projectile.y+Math.sin(angle)*lead,FIELD_MIN,FIELD_MAX);
  }
  aimProjectile(projectile,projectile.splitWaypointX??target.x,projectile.splitWaypointY??target.y);
  emit("projectileSpawned",{entityId:projectile.id,definitionId:projectile.definitionId,
    sourceCharacterId:projectile.sourceCharacterId,sourceItemId:projectile.sourceItemId,targetId:target.id,
    x:projectile.x,y:projectile.y,originX:projectile.originX,originY:projectile.originY,
    targetX:projectile.targetX,targetY:projectile.targetY});
  return true;
}

function emitExpired(
  projectile: CombatEntity,
  emit: Emit,
  reason: "timeout" | "targetLost" | "invalidPosition" | "outOfBounds",
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function aimProjectile(projectile:CombatEntity,x:number,y:number) {
  const dx=x-projectile.x,dy=y-projectile.y,length=Math.hypot(dx,dy);
  projectile.headingX=length>0?dx/length:0;projectile.headingY=length>0?dy/length:-1;
}
