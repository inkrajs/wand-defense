import assert from "node:assert/strict";
import test from "node:test";
import type { CombatEntity } from "../contracts";
import { beamVisual } from "./beamVisuals";
import { projectileVisual } from "./combatVisuals";

const beam: CombatEntity={id:"ray",definitionId:"solar-ray",kind:"beam",faction:"player",x:50,y:84,targetX:50,targetY:40,hp:1,maxHp:1,damage:5,speed:0,range:40,cooldownMs:100,attackRemainingMs:100,remainingMs:900,beamWidth:2,sourceCharacterId:"owner"};

test("ray decoration follows its actual segment and character anchor without affecting combat",()=>{
  const visual=beamVisual(beam,{width:1000,height:800,sources:{owner:{x:400,y:650}}})!;
  assert.equal(visual.x,400);assert.equal(visual.y,650);
  assert.ok(Math.abs(visual.length-Math.hypot(100,-330))<1e-9);
  assert.equal(beam.attackRemainingMs,100);assert.equal(beam.remainingMs,900);
  for(const value of [NaN,Infinity,-Infinity]) assert.equal(beamVisual({...beam,targetX:value},{width:1000,height:800,sources:{}}),undefined);
  assert.equal(beamVisual({...beam,remainingMs:0},{width:1000,height:800,sources:{}}),undefined);
});

test("secondary projectile legs start at impact instead of snapping back to the caster",()=>{
  const visual=projectileVisual({...beam,kind:"projectile",definitionId:"arc-chain",x:45,y:50,originX:45,originY:50,targetX:55,targetY:40,hitIds:["first-enemy"]})!;
  assert.equal(visual.kind,"lightning");assert.equal(visual.originWeight,0);
  assert.equal(visual.x,45);assert.equal(visual.y,50);
});

test("off-field beam endpoints preserve their physical angle instead of clamping per axis",()=>{
  const visual=beamVisual({...beam,targetX:130,targetY:-30},{width:1000,height:800,sources:{}})!;
  const dx=1300-500,dy=-240-672;
  assert.equal(visual.angle,Math.atan2(dy,dx)*180/Math.PI);
  assert.equal(visual.length,Math.hypot(dx,dy));
});
