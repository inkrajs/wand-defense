import assert from "node:assert/strict";
import test from "node:test";
import type { CombatEntity } from "../contracts";
import { demoContent } from "../content/demo";
import { compileWand } from "../loadout/compile";
import { createInitialState } from "../runtime/initial";
import { castPattern } from "./castPattern";
import { spawnProjectiles, advanceProjectiles } from "./projectiles";
import { spawnBeams, advanceBeams } from "./beams";
import { stepBattle } from "./index";
import { projectileVisual } from "../ui/combatVisuals";
import { beamVisual } from "../ui/beamVisuals";

function battle() {
  const state=createInitialState();state.phase="battle";state.wave=1;state.waveSpawnRemaining=0;
  const enemy:CombatEntity={id:"enemy",definitionId:"enemy-basic",kind:"enemy",faction:"enemy",x:50,y:64,
    hp:1000,maxHp:1000,damage:0,speed:0,range:0,cooldownMs:1000,attackRemainingMs:1000};
  state.entities=[enemy];return state;
}
const projectile={itemId:"spark-1",definitionId:"spark",power:10,range:30,casts:2,speed:40};
const quiet=()=>{};

test("compile keeps double temporal and split spatial, while total copies compose and stay bounded",()=>{
  const state=createInitialState(),wand=state.wands[0];
  state.items.double={id:"double",definitionId:"double",kind:"arcana",level:1,grade:"common"};
  state.items.split={id:"split",definitionId:"split",kind:"arcana",level:1,grade:"common"};
  wand.placements=[{itemId:"spark-1",x:1,y:1,rotation:0},{itemId:"double",x:0,y:1,rotation:0},
    {itemId:"split",x:2,y:0,rotation:0}];
  const spell=compileWand(state,wand.id,demoContent)!.spells[0];
  assert.equal(spell.burstCount,2);assert.equal(spell.splitCount,2);assert.equal(spell.copies,4);
  const pattern=castPattern({...projectile,burstCount:64,splitCount:64},512);
  assert.equal(pattern.length,64);assert.ok(pattern.every(slot=>Number.isFinite(slot.delay)));
});

test("double launches at distinct times, pending shots are invisible, and pause freezes the delay",()=>{
  const state=battle(),events:string[]=[];
  spawnProjectiles(state,"character-1",{...projectile,burstCount:2,splitCount:1},type=>events.push(type));
  const shots=state.entities.filter(entity=>entity.kind==="projectile");
  assert.equal(shots.length,2);assert.equal(events.filter(type=>type==="projectileSpawned").length,1);
  assert.equal(projectileVisual(shots[1]),undefined);
  advanceProjectiles(state,100,quiet);assert.equal(shots[1].launchDelayMs,20);assert.equal(shots[1].y,84);
  state.paused=true;advanceProjectiles(state,500,quiet);assert.equal(shots[1].launchDelayMs,20);
  state.paused=false;advanceProjectiles(state,20,type=>events.push(type));
  assert.equal(events.filter(type=>type==="projectileSpawned").length,2);
  assert.equal(shots[1].launchDelayMs,0);assert.ok(shots[0].y<shots[1].y);
  const restored=JSON.parse(JSON.stringify(state));
  advanceProjectiles(state,50,quiet);advanceProjectiles(restored,50,quiet);
  assert.deepEqual(restored,JSON.parse(JSON.stringify(state)));
});

test("split flies through separate actual branches before converging on a lone target",()=>{
  const state=battle();
  spawnProjectiles(state,"character-1",{...projectile,burstCount:1,splitCount:2},quiet);
  const shots=state.entities.filter(entity=>entity.kind==="projectile");
  advanceProjectiles(state,50,quiet);
  assert.ok(shots[0].x<50);assert.ok(shots[1].x>50);
  assert.equal(state.entities[0].hp,1000);
  for(let index=0;index<20;index++)advanceProjectiles(state,50,quiet);
  assert.equal(state.entities[0].hp,980);
});

test("split assigns different nearby targets and delayed launches choose a living target before firing",()=>{
  const state=battle();state.entities.push({...state.entities[0],id:"other",x:55});
  spawnProjectiles(state,"character-1",{...projectile,burstCount:1,splitCount:2},quiet);
  assert.equal(new Set(state.entities.filter(entity=>entity.kind==="projectile").map(entity=>entity.targetId)).size,2);
  const pending=battle();
  spawnProjectiles(pending,"character-1",{...projectile,burstCount:2,splitCount:1},quiet);
  const first=pending.entities[0];first.hp=0;
  pending.entities.push({...first,id:"replacement",hp:1000,x:55});
  advanceProjectiles(pending,120,quiet);
  const shots=pending.entities.filter(entity=>entity.kind==="projectile");
  assert.equal(shots[0].targetId,"enemy");assert.equal(shots[1].targetId,"replacement");
});

test("beam split has distinct real segments and double starts its own later pulse clock",()=>{
  const state=battle(),events:string[]=[];
  spawnBeams(state,"character-1",{itemId:"ray",definitionId:"solar-ray",power:5,range:30,casts:4,
    burstCount:2,splitCount:2,beam:{width:2,durationMs:900,tickMs:100,maxTargets:3}},type=>events.push(type));
  const beams=state.entities.filter(entity=>entity.kind==="beam");
  assert.equal(events.filter(type=>type==="beamSpawned").length,2);
  assert.notEqual(beams[0].targetX,beams[1].targetX);
  assert.equal(beamVisual(beams[2],{width:1000,height:800,sources:{}}),undefined);
  advanceBeams(state,100,quiet);assert.equal(state.entities[0].hp,990);
  advanceBeams(state,20,type=>events.push(type));
  assert.equal(events.filter(type=>type==="beamSpawned").length,4);
  assert.equal(beams[2].attackRemainingMs,100);
  advanceBeams(state,100,quiet);assert.equal(state.entities[0].hp,970);
});

test("the whole double burst consumes mana once, not again for the scheduled launch",()=>{
  const state=battle();
  state.items.double={id:"double",definitionId:"double",kind:"arcana",level:1,grade:"common"};
  state.wands[0].placements=[{itemId:"spark-1",x:0,y:0,rotation:0},{itemId:"double",x:1,y:0,rotation:0}];
  let next=stepBattle(state,50,demoContent).state;
  assert.equal(next.characters[0].mana,96);
  next=stepBattle(next,150,demoContent).state;
  assert.ok(next.characters[0].mana>=96);
  assert.equal(next.events.filter(event=>event.type==="projectileSpawned").length,2);
});
