import type { TacticalFlightState } from "../contracts/tactical-arcana";
import { releaseSplit, startReturn } from "./tactical-flight";
import type { AttackRollStats, CombatEntity, Element, GameState, OnHitSpec, ProjectileImpact, ProjectileSteering, SpellTrigger } from "../contracts";
import { integrateMotion } from "./motion";
import { normalizeImpact, resolveImpact } from "./impact";
import { nearbyEnemies } from "./targets";
import { getCharacterAnchors } from "../content/characterAnchors";
import { branchAngle, castPattern } from "./castPattern";
import { buildProjectileCollisionCandidates, firstProjectileCollision } from "./projectileCollision";
import { spawnProjectileField } from "./areaEffects";
import { releaseSpellTrigger } from "./spellTriggers";
import { TRIGGER_LIMITS } from "../contracts/trigger-limits";

export interface ProjectileSpec {
  itemId: string;
  definitionId: string;
  element?: Element;
  power: number;
  range: number;
  casts: number;
  burstCount?:number; splitCount?:number;
  speed: number;
  impact?: ProjectileImpact;
  attackRoll?: AttackRollStats;
  onHit?: OnHitSpec;
  origin?: { x: number; y: number };
  sourceEntityId?: string;
  trigger?: SpellTrigger;
  steering?: ProjectileSteering;
  manaRefund?: CombatEntity["manaRefund"];
  fixedOrigin?: boolean;
  maxCasts?: number;
  tacticalFlight?: TacticalFlightState;
  excludeTargetId?: string;
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
  const origin = spec.origin ?? getCharacterAnchors(state.characters).find(anchor => anchor.characterId === characterId)
    ?? {x: ORIGIN_X, y: ORIGIN_Y};
  if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y)) return false;
  const target = nearbyEnemies(state, origin.x, origin.y, spec.range,
    spec.excludeTargetId ? new Set([spec.excludeTargetId]) : undefined)[0];
  if (!target) return false;

  const alive = state.entities.filter(entity => entity.kind === "projectile" && entity.hp > 0
    && (entity.remainingMs === undefined || entity.remainingMs > 0)).length;
  const available = Math.max(0, PROJECTILE_LIMITS.alive - alive);
  if (available === 0) return false;
  const castLimit = spec.trigger ? TRIGGER_LIMITS.carrierCopies : PROJECTILE_LIMITS.perCast;
  const requestedLimit = Number.isFinite(spec.maxCasts) ? Math.max(0, spec.maxCasts!) : PROJECTILE_LIMITS.perCast;
  const pattern=castPattern(spec,Math.min(castLimit, requestedLimit, available));
  if (pattern.length === 0) return false;
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
      ...(spec.element ? { element: spec.element } : {}),
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
      ...(spec.sourceEntityId ? { sourceEntityId: spec.sourceEntityId } : {}),
      ...(spec.steering ? { steering: { ...spec.steering } } : {}),
      ...(i === 0 && spec.manaRefund ? { manaRefund: { ...spec.manaRefund } } : {}),
      ...(spec.fixedOrigin ? { fixedOrigin: true } : {}),
      ...(spec.trigger ? { trigger: structuredClone(spec.trigger), triggerRemainingMs: Math.max(TRIGGER_LIMITS.minDelayMs, Math.min(TRIGGER_LIMITS.maxDelayMs, Number.isFinite(spec.trigger.delayMs) ? spec.trigger.delayMs : 500)) } : {}),
      ...(spec.tacticalFlight ? { tacticalFlight: {
        ...spec.tacticalFlight,
        resplit: i === 0 ? spec.tacticalFlight.resplit : undefined,
        volleyOffset: spec.tacticalFlight.fanShot === 2 && Math.floor(i / pattern[i].branches) % 2 ? .15 : 0,
      } } : {}),
      ...(spec.excludeTargetId ? { excludedTargetId: spec.excludeTargetId } : {}),
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

  let releases = 0;
  let splitReleases = 0;
  let targetsById: Map<string, CombatEntity> | undefined;
  const release = (projectile: CombatEntity) => {
    const count = projectile.trigger?.additionalPayload ? 2 : 1;
    const allowed = releases + count <= TRIGGER_LIMITS.releasesPerStep;
    if (allowed) releases += count;
    releaseSpellTrigger(state, projectile, emit, allowed, spawnProjectiles);
  };
  const countAtEntry = state.entities.length;
  for (let index = 0; index < countAtEntry; index++) {
    const entity = state.entities[index];
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
    const life=Math.max(0,projectile.remainingMs??0);
    const timer = projectile.trigger?.mode === "timer"
      ? Math.max(0, Number.isFinite(projectile.triggerRemainingMs) ? projectile.triggerRemainingMs! : TRIGGER_LIMITS.minDelayMs) : Infinity;
    const activeDt=Math.min(slice,life,timer);
    if (projectile.trigger?.mode === "timer") projectile.triggerRemainingMs = Math.max(0, timer - activeDt);
    if (projectile.steering && projectile.splitWaypointX === undefined) {
      targetsById ??= new Map(state.entities.filter(entry => entry.kind === "enemy").map(entry => [entry.id, entry]));
      steerProjectile(state, projectile, targetsById, activeDt);
    }
    const motion=integrateMotion(projectile.moveSpeed??projectile.speed,projectile.speed,projectile.moveRampMs??0,activeDt);
    let distance=motion.distance,hit=false,escaped=false;
    const fieldImpact = projectile.impact?.type === "field" ? projectile.impact : undefined;
    const returns = Boolean(projectile.tacticalFlight?.returnFlight && !projectile.trigger);
    const rangeLimited = returns || fieldImpact !== undefined || projectile.trigger?.mode === "range" || projectile.trigger?.releaseAtRange === true;
    const castRange = rangeLimited ? Math.max(0, Number.isFinite(projectile.range) ? projectile.range : 0) : Infinity;
    projectile.remainingMs=life-activeDt;projectile.moveSpeed=motion.speed;
    for(let leg=0;leg<2&&(distance>0||(rangeLimited&&castRange-(Number.isFinite(projectile.travelledDistance)
      ? Math.max(0,projectile.travelledDistance!) : 0)<=1e-8));leg++) {
      const travelled = Math.max(0, Number.isFinite(projectile.travelledDistance) ? projectile.travelledDistance! : 0);
      const rangeRemaining = rangeLimited ? Math.max(0,castRange-travelled) : Infinity;
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
      const excluded = new Set(projectile.hitIds);
      if (projectile.excludedTargetId) excluded.add(projectile.excludedTargetId);
      const contact=fieldImpact?.trigger === "range" || (returns && projectile.remainingImpacts === 0) ? undefined
        : firstProjectileCollision(state,projectile,next,excluded,collisionCandidates,PROJECTILE_HIT_RADIUS);
      if(contact) {
        projectile.x=contact.x;projectile.y=contact.y;
        delete projectile.splitWaypointX;delete projectile.splitWaypointY;
        projectile.headingX=ux;projectile.headingY=uy;
        if(fieldImpact) {
          projectile.travelledDistance=travelled+contact.distance;
          spawnProjectileField(state,projectile,{x:contact.x,y:contact.y},fieldImpact,emit);
          if (projectile.trigger?.mode === "hit") release(projectile);
          projectile.hp=0;projectile.remainingMs=0;hit=true;break;
        }
        const keepsFlying=resolveImpact(state,projectile,contact.target,{x:ux,y:uy},emit);
        const continues = keepsFlying || (returns && !projectile.tacticalFlight?.returning);
        if (projectile.tacticalFlight?.resplit && splitReleases++ < 16) {
          releaseSplit(state, projectile, contact.target, emit, spawnProjectiles);
        }
        if (projectile.trigger?.mode === "hit") release(projectile);
        else if (projectile.trigger?.mode === "timer") {
          // Contact before the timer consumes the carrier without releasing the payload.
          delete projectile.trigger; delete projectile.triggerRemainingMs;
          projectile.hp=0;projectile.remainingMs=0;
        }
        if(!continues){projectile.hp=0;projectile.remainingMs=0;}
        else if (rangeLimited) projectile.travelledDistance = travelled + contact.distance;
        if(continues && projectile.impact?.type==="chain")aimProjectile(projectile,projectile.targetX!,projectile.targetY!);
        hit=true;break;
      }
      projectile.x=next.x;projectile.y=next.y;distance-=travel;
      if(rangeLimited) projectile.travelledDistance=travelled+travel;
      const rangeReached=rangeLimited && rangeRemaining<=travel+1e-8 && travel>=requested-1e-8;
      if(rangeReached) {
        if(fieldImpact && fieldImpact.trigger !== "contact") spawnProjectileField(state,projectile,projectile,fieldImpact,emit);
        if (projectile.trigger?.mode === "range" || projectile.trigger?.releaseAtRange) release(projectile);
        if (returns && startReturn(state, projectile, emit)) { hit = true; break; }
        projectile.hp=0;projectile.remainingMs=0;hit=true;break;
      }
      if(travel<requested-1e-8||travel<=0){escaped=true;break;}
      if(waypoint&&travel>=waypointDistance-1e-8) {
        delete projectile.splitWaypointX;delete projectile.splitWaypointY;
        aimProjectile(projectile,projectile.targetX??projectile.x,projectile.targetY??projectile.y-1);
      } else break;
    }
    if (!hit && !escaped && projectile.trigger?.mode === "timer" && projectile.triggerRemainingMs! <= 0) {
      release(projectile); projectile.hp=0; projectile.remainingMs=0;
      hit=true;
    }
    if(!hit&&(escaped||projectile.remainingMs!<=0)) {
      projectile.hp=0;projectile.remainingMs=0;emitExpired(projectile,emit,escaped?"outOfBounds":"timeout");
    }
  }
}

function launchProjectile(state:GameState,projectile:CombatEntity,emit:Emit):boolean {
  const origin = projectile.fixedOrigin ? undefined : projectile.sourceEntityId
    ? state.entities.find(entity => entity.id === projectile.sourceEntityId && entity.hp > 0)
    : getCharacterAnchors(state.characters).find(anchor=>anchor.characterId===projectile.sourceCharacterId);
  if (projectile.sourceEntityId && !origin) { projectile.hp=0;projectile.remainingMs=0;return false; }
  if(origin){projectile.x=origin.x;projectile.y=origin.y;projectile.originX=origin.x;projectile.originY=origin.y;}
  const targets=nearbyEnemies(state,projectile.x,projectile.y,projectile.range,
    projectile.excludedTargetId ? new Set([projectile.excludedTargetId]) : undefined);
  const target=targets[(projectile.splitBranchIndex??0)%Math.max(1,targets.length)];
  if(!target){projectile.hp=0;projectile.remainingMs=0;return false;}
  projectile.targetId=target.id;projectile.targetX=target.x;projectile.targetY=target.y;
  const count=projectile.splitBranchCount??1;
  if (projectile.tacticalFlight?.fanShot) {
    const angle = Math.atan2(target.y - projectile.y, target.x - projectile.x)
      + branchAngle(projectile.splitBranchIndex ?? 0, count, Math.PI / 8) + (projectile.tacticalFlight.volleyOffset ?? 0);
    projectile.headingX = Math.cos(angle);
    projectile.headingY = Math.sin(angle);
  } else if(count>1) {
    const dx=target.x-projectile.x,dy=target.y-projectile.y,length=Math.hypot(dx,dy);
    const angle=Math.atan2(dy,dx)+branchAngle(projectile.splitBranchIndex??0,count,Math.PI/10);
    const lead=Math.min(4,length*.35);
    projectile.splitWaypointX=clamp(projectile.x+Math.cos(angle)*lead,FIELD_MIN,FIELD_MAX);
    projectile.splitWaypointY=clamp(projectile.y+Math.sin(angle)*lead,FIELD_MIN,FIELD_MAX);
  }
  if (!projectile.tacticalFlight?.fanShot) aimProjectile(projectile,projectile.splitWaypointX??target.x,projectile.splitWaypointY??target.y);
  emit("projectileSpawned",{entityId:projectile.id,definitionId:projectile.definitionId,
    sourceCharacterId:projectile.sourceCharacterId,sourceItemId:projectile.sourceItemId,targetId:target.id,
    ...(projectile.sourceEntityId ? { sourceEntityId: projectile.sourceEntityId } : {}),
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


function steerProjectile(state: GameState, projectile: CombatEntity, enemies: Map<string, CombatEntity>, dt: number) {
  const turnRate = projectile.steering?.turnRate ?? 0;
  if (!Number.isFinite(turnRate) || turnRate <= 0) return;
  const current = enemies.get(projectile.targetId ?? "");
  const target = current && current.hp > 0 ? current : projectile.steering?.reacquire
    ? nearbyEnemies(state, projectile.x, projectile.y, 12, new Set(projectile.hitIds))[0] : undefined;
  if (!target) return;
  projectile.targetId = target.id;
  const heading = Math.atan2(projectile.headingY!, projectile.headingX!);
  const desired = Math.atan2(target.y - projectile.y, target.x - projectile.x);
  const turn = Math.atan2(Math.sin(desired - heading), Math.cos(desired - heading));
  const limit = Math.min(8, turnRate) * dt / 1000;
  const angle = heading + clamp(turn, -limit, limit);
  projectile.headingX = Math.cos(angle);
  projectile.headingY = Math.sin(angle);
}
