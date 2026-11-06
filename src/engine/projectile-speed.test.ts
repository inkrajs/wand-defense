import assert from "node:assert/strict";
import test from "node:test";
import type { CombatEntity } from "../contracts";
import { createInitialState } from "../runtime/initial";
import { createCharacterBaseStats, getCharacterStats } from "../content/characters";
import { demoContent } from "../content/demo";
import { stepBattle } from "./index";

function shot(definitionId:string,basePercent:number,equipmentPercent:number) {
  let state=createInitialState();state.phase="battle";state.wave=1;state.waveSpawnRemaining=0;
  state.characters[0].manaRegen=0;
  state.characters[0].baseStats={...createCharacterBaseStats(),projectileSpeedPercent:basePercent};
  state.wands[0].statBonuses={projectileSpeedPercent:equipmentPercent};
  state.items["spark-1"].definitionId=definitionId;
  const target:CombatEntity={id:"target",definitionId:"enemy-basic",kind:"enemy",faction:"enemy",x:50,y:64,
    hp:500,maxHp:500,damage:0,speed:0,range:0,cooldownMs:1000,attackRemainingMs:0};
  state.entities=[target];
  const launch=stepBattle(state,50,demoContent);state=launch.state;
  for(let step=0;step<60&&!state.events.some(e=>e.type==="damage");step++) state=stepBattle(state,50,demoContent).state;
  const impact=state.events.find(e=>e.type==="damage")!;
  assert.ok(impact);
  const cast=launch.events.find(e=>e.type==="spellCast")!;
  return {launch,state,flightMs:impact.gameTimeMs-cast.gameTimeMs};
}

test("base plus equipped projectile speed shortens real flight independently of casting frequency",()=>{
  const normal=shot("spark",0,0),fast=shot("spark",50,50);
  const normalBullet=normal.launch.state.entities.find(e=>e.kind==="projectile")!;
  const fastBullet=fast.launch.state.entities.find(e=>e.kind==="projectile")!;
  assert.equal(normalBullet.speed,48);assert.equal(normalBullet.moveSpeed,48);
  assert.equal(fastBullet.speed,96);assert.equal(fastBullet.moveSpeed,96);
  assert.equal(normal.flightMs,400);assert.equal(fast.flightMs,200);
  assert.equal(normal.launch.state.wands[0].cooldowns["spark-1"],700);
  assert.equal(fast.launch.state.wands[0].cooldowns["spark-1"],700);
  assert.equal(normal.launch.state.characters[0].mana,96);assert.equal(fast.launch.state.characters[0].mana,96);
  assert.equal(getCharacterStats(fast.launch.state,"character-1")!.final.projectileSpeedMultiplier,2);
});

test("accelerating fireballs use the scaled speed cap and entry velocity",()=>{
  const normal=shot("fireball",0,0),fast=shot("fireball",100,0);
  const normalBullet=normal.launch.state.entities.find(e=>e.kind==="projectile")!;
  const fastBullet=fast.launch.state.entities.find(e=>e.kind==="projectile")!;
  assert.equal(normalBullet.speed,50);assert.equal(normalBullet.moveSpeed,9);
  assert.equal(fastBullet.speed,100);assert.equal(fastBullet.moveSpeed,18);
  assert.equal(fastBullet.moveRampMs,normalBullet.moveRampMs);
  assert.ok(fast.flightMs<normal.flightMs);
});

test("projectile speed does not accelerate fixed beams or their pulse interval",()=>{
  const normal=shot("solar-ray",0,0),boosted=shot("solar-ray",100,100);
  const normalBeam=normal.launch.state.entities.find(e=>e.kind==="beam")!;
  const boostedBeam=boosted.launch.state.entities.find(e=>e.kind==="beam")!;
  assert.equal(normal.flightMs,100);assert.equal(boosted.flightMs,100);
  assert.equal(normalBeam.speed,0);assert.equal(boostedBeam.speed,0);
  assert.equal(normalBeam.cooldownMs,boostedBeam.cooldownMs);
  assert.equal(normal.launch.state.wands[0].cooldowns["spark-1"],boosted.launch.state.wands[0].cooldowns["spark-1"]);
});
