import type { AttackRollStats, BeamSpec, CombatEntity, GameState, OnHitSpec } from "../contracts";
import { applyContactDamage, nearbyEnemies, type CombatEmit } from "./targets";
import { getCharacterAnchors } from "../content/characterAnchors";
import { branchAngle, castPattern } from "./castPattern";

export const BEAM_LIMITS = Object.freeze({alive:24,maxTargets:8,minTickMs:100,maxDurationMs:5000});
export interface BeamCastSpec { itemId:string;definitionId:string;power:number;range:number;casts:number;burstCount?:number;splitCount?:number;beam:BeamSpec;attackRoll?:AttackRollStats;onHit?:OnHitSpec }
const finite = (n:number, fallback:number) => Number.isFinite(n) ? n : fallback;

export function spawnBeams(state:GameState, characterId:string, spec:BeamCastSpec, emit:CombatEmit):boolean {
  if(state.phase!=="battle"||state.paused||state.backpackOpen) return false;
  const range=Math.max(0,finite(spec.range,0));
  const origin=getCharacterAnchors(state.characters).find(anchor=>anchor.characterId===characterId) ?? {x:50,y:84};
  const target=nearbyEnemies(state,origin.x,origin.y,range)[0];
  if(!target||range<=0) return false;
  const available=BEAM_LIMITS.alive-state.entities.filter(e=>e.kind==="beam"&&e.hp>0&&(e.remainingMs??0)>0).length;
  if(available<=0) return false;
  const pattern=castPattern(spec,available),casts=pattern.length;
  const tickMs=Math.max(BEAM_LIMITS.minTickMs,Math.min(BEAM_LIMITS.maxDurationMs,finite(spec.beam.tickMs,100)));
  const duration=Math.max(100,Math.min(BEAM_LIMITS.maxDurationMs,finite(spec.beam.durationMs,100)));
  const width=Math.max(.1,Math.min(20,finite(spec.beam.width,1)));
  const maxTargets=Math.max(1,Math.min(BEAM_LIMITS.maxTargets,Math.floor(finite(spec.beam.maxTargets,1))));
  const ids=new Set(state.entities.map(e=>e.id));
  for(let i=0;i<casts;i++) {
    const base=`beam-${state.wave}-${state.nextEventSeq}-${i}`;let id=base,suffix=1;
    while(ids.has(id)) id=`${base}-${suffix++}`;ids.add(id);
    const beam:CombatEntity={id,definitionId:spec.definitionId,kind:"beam",faction:"player",x:origin.x,y:origin.y,
      originX:origin.x,originY:origin.y,hp:1,maxHp:1,damage:Math.max(0,finite(spec.power,0)),
      speed:0,range,cooldownMs:tickMs,attackRemainingMs:tickMs,remainingMs:duration,
      beamWidth:width,maxTargets,attackRoll:spec.attackRoll?{...spec.attackRoll}:undefined,sourceCharacterId:characterId,sourceItemId:spec.itemId,
      ...(spec.onHit ? { onHit: structuredClone(spec.onHit) } : {}),
      launchDelayMs:pattern[i].delay,splitBranchIndex:pattern[i].branch,splitBranchCount:pattern[i].branches};
    state.entities.push(beam);
    if(!pattern[i].delay) launchBeam(state,beam,emit);
  }
  emit("spellCast",{sourceCharacterId:characterId,sourceItemId:spec.itemId,definitionId:spec.definitionId,casts,targetId:target.id});
  return true;
}

/** Pulses are driven by simulation time, never by display frames. */
export function advanceBeams(state:GameState,dtMs:number,emit:CombatEmit):void {
  if(state.phase!=="battle"||state.paused||state.backpackOpen||!Number.isFinite(dtMs)||dtMs<=0) return;
  for(const beam of state.entities) {
    if(beam.kind!=="beam"||beam.hp<=0||(beam.remainingMs??0)<=0) continue;
    let slice=dtMs;
    if((beam.launchDelayMs??0)>0) {
      const waiting=Math.min(slice,beam.launchDelayMs!);
      beam.launchDelayMs!-=waiting;slice-=waiting;
      if(beam.launchDelayMs!>0)continue;
      if(!launchBeam(state,beam,emit))continue;
      if(slice<=0)continue;
    }
    if(!Number.isFinite(beam.targetX)||!Number.isFinite(beam.targetY)) {beam.hp=0;beam.remainingMs=0;continue;}
    let elapsed=Math.min(slice,beam.remainingMs!);
    // Legacy/corrupt intervals cannot create a zero-delay pulse loop.
    beam.cooldownMs=Math.max(BEAM_LIMITS.minTickMs,finite(beam.cooldownMs,100));
    beam.attackRemainingMs=Math.max(0,finite(beam.attackRemainingMs,beam.cooldownMs));
    while(elapsed>0&&beam.remainingMs!>0) {
      const advance=Math.min(elapsed,Math.max(0,beam.attackRemainingMs));
      beam.remainingMs!-=advance;beam.attackRemainingMs-=advance;elapsed-=advance;
      if(beam.attackRemainingMs<=0) {
        const maxTargets=Math.max(1,Math.min(BEAM_LIMITS.maxTargets,Math.floor(finite(beam.maxTargets??1,1))));
        const width=Math.max(.1,Math.min(20,finite(beam.beamWidth??1,1)));
        const targets=nearbyEnemies(state,beam.x,beam.y,beam.range+width/2)
          .filter(enemy=>distanceToSegment(enemy,beam)<=width/2).slice(0,maxTargets);
        for(const target of targets) if(target.hp>0) applyContactDamage(state,beam,target,emit);
        beam.attackRemainingMs=beam.cooldownMs;
      }
    }
    if(beam.remainingMs!<=0) beam.hp=0;
  }
}

function launchBeam(state:GameState,beam:CombatEntity,emit:CombatEmit):boolean {
  const origin=getCharacterAnchors(state.characters).find(anchor=>anchor.characterId===beam.sourceCharacterId);
  if(origin){beam.x=origin.x;beam.y=origin.y;beam.originX=origin.x;beam.originY=origin.y;}
  const targets=nearbyEnemies(state,beam.x,beam.y,beam.range);
  const target=targets[(beam.splitBranchIndex??0)%Math.max(1,targets.length)];
  if(!target){beam.hp=0;beam.remainingMs=0;return false;}
  const dx=target.x-beam.x,dy=target.y-beam.y,length=Math.hypot(dx,dy);
  // Different targets give different real rays. Against a lone target, retain
  // contact while separating the ray directions within its beam width.
  const branch=beam.splitBranchIndex??0,count=beam.splitBranchCount??1;
  const targetIndex=branch%targets.length,localIndex=Math.floor(branch/targets.length);
  const localCount=Math.ceil((count-targetIndex)/targets.length);
  const spread=Math.min(Math.PI/12,Math.atan2((beam.beamWidth??1)*.35,Math.max(.1,length)));
  const angle=Math.atan2(dy,dx)+branchAngle(localIndex,localCount,spread);
  beam.headingX=Math.cos(angle);beam.headingY=Math.sin(angle);
  beam.targetX=beam.x+Math.cos(angle)*beam.range;beam.targetY=beam.y+Math.sin(angle)*beam.range;
  emit("beamSpawned",{entityId:beam.id,definitionId:beam.definitionId,sourceCharacterId:beam.sourceCharacterId,
    sourceItemId:beam.sourceItemId,x:beam.x,y:beam.y,targetX:beam.targetX,targetY:beam.targetY,
    beamWidth:beam.beamWidth,remainingMs:beam.remainingMs});
  return true;
}

function distanceToSegment(target:CombatEntity,beam:CombatEntity):number {
  const dx=beam.targetX!-beam.x,dy=beam.targetY!-beam.y;
  const lengthSquared=dx*dx+dy*dy;
  const t=lengthSquared>0?Math.max(0,Math.min(1,((target.x-beam.x)*dx+(target.y-beam.y)*dy)/lengthSquared)):0;
  return Math.hypot(target.x-(beam.x+t*dx),target.y-(beam.y+t*dy));
}
