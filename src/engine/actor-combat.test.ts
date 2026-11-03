import assert from "node:assert/strict";
import test from "node:test";
import type { CombatEntity, GameState } from "../contracts";
import { createInitialState } from "../runtime/initial";
import { createCharacterBaseStats } from "../content/characters";
import { demoContent } from "../content/demo";
import { applyContactDamage } from "./targets";
import { stepBattle } from "./index";
import { spawnProjectiles, advanceProjectiles } from "./projectiles";
import { spawnBeams, advanceBeams } from "./beams";

function enemy():CombatEntity {return {id:"target",definitionId:"enemy-basic",kind:"enemy",faction:"enemy",x:50,y:80,
  hp:100,maxHp:100,damage:0,speed:0,range:0,cooldownMs:1000,attackRemainingMs:0};}
function battle():GameState {
  const state=createInitialState();state.phase="battle";state.wave=1;state.waveSpawnRemaining=0;
  state.entities=[enemy()];state.rngState=0;return state;
}

test("one saved roll preserves hit probability and conditional crit; misses produce no damage",()=>{
  const state=battle(),target=state.entities[0];
  const source={...enemy(),id:"bullet",kind:"projectile" as const,faction:"player" as const,damage:10,
    sourceCharacterId:"character-1",attackRoll:{accuracy:.5,critChance:.5,critMultiplier:2,sourceLuck:0}};
  const events:{type:string;data:Record<string,unknown>}[]=[];
  const emit=(type:string,data:Record<string,unknown>)=>events.push({type,data});
  applyContactDamage(state,source,target,emit);
  assert.equal(target.hp,80);assert.equal(events.at(-1)!.data.critical,true);assert.equal(state.rngState,1013904223);
  applyContactDamage(state,source,target,emit);
  assert.equal(target.hp,70);assert.equal(events.at(-1)!.data.critical,false);assert.equal(state.rngState,1196435762);
  applyContactDamage(state,source,target,emit);
  assert.equal(target.hp,70);assert.equal(events.at(-1)!.type,"attackMiss");assert.equal(state.rngState,3519870697);
  assert.equal(events.filter(e=>e.type==="damage").length,2);
  const neutral={...source,attackRoll:undefined};const seed=state.rngState;
  applyContactDamage(state,neutral,target,emit);
  assert.equal(target.hp,60);assert.equal(state.rngState,seed);
});

test("missed impact targets are consumed once and beams reuse the same saved-roll path",()=>{
  const state=battle();state.wands[0].placements=[];
  spawnProjectiles(state,"character-1",{itemId:"miss",definitionId:"arc-chain",power:1000,range:30,casts:1,speed:1000,
    impact:{type:"chain",radius:10,maxTargets:3,falloff:.7},attackRoll:{accuracy:0,critChance:1,critMultiplier:2,sourceLuck:0}},()=>{});
  const projectile=state.entities.find(e=>e.kind==="projectile")!;
  const events:string[]=[];advanceProjectiles(state,50,type=>events.push(type));
  assert.equal(state.entities[0].hp,100);assert.deepEqual(projectile.hitIds,["target"]);
  assert.deepEqual(events,["attackMiss"]);const seed=state.rngState;
  advanceProjectiles(state,50,type=>events.push(type));assert.equal(state.rngState,seed);
  spawnBeams(state,"character-1",{itemId:"beam",definitionId:"solar-ray",power:10,range:30,casts:1,
    beam:{width:2,durationMs:300,tickMs:100,maxTargets:1},attackRoll:{accuracy:1,critChance:1,critMultiplier:2,sourceLuck:0}},()=>{});
  advanceBeams(state,99,()=>{});assert.equal(state.entities[0].hp,100);
  advanceBeams(state,1,()=>{});assert.equal(state.entities[0].hp,80);
});

test("luck is captured at firing and affects the actual killer's coin roll without extra RNG",()=>{
  const coinOnlyContent={...demoContent,gear:{},items:{}};
  for(const luck of [0,30]) {
    let state=battle();state.rngState=3000;state.entities[0].hp=1;state.entities[0].maxHp=8;
    state.characters[0].baseStats={...createCharacterBaseStats(),luck};
    state=stepBattle(state,50,coinOnlyContent).state;
    const bullet=state.entities.find(e=>e.kind==="projectile")!;
    assert.equal(bullet.attackRoll!.sourceLuck,luck);
    state.characters[0].baseStats!.luck=0;
    for(let i=0;i<10&&state.phase==="battle";i++) state=stepBattle(state,50,coinOnlyContent).state;
    assert.equal(state.events.find(e=>e.type==="enemyKilled")!.data.coins,luck===0?0:1);
    assert.equal(state.rngState,1712511927);assert.equal(state.characters[0].xp,1);
  }
});

test("equipped mana capacity and regeneration affect simulation and wave-end refill",()=>{
  let state=battle();state.wands[0].statBonuses={maxMana:50,manaRegen:10};state.wands[0].placements=[];
  state=stepBattle(state,1000,demoContent).state;
  assert.ok(Math.abs(state.characters[0].mana-122)<1e-8);
  assert.equal(state.characters[0].maxMana,100);assert.equal(state.characters[0].manaRegen,12);
  state.entities[0].hp=0;state=stepBattle(state,50,demoContent).state;
  assert.equal(state.characters[0].mana,150);
});

test("actor attack, range and casting frequency alter real launch and contact timing",()=>{
  let state=battle();state.entities[0].y=50;state.entities[0].hp=500;
  state.characters[0].manaRegen=0;
  state.characters[0].baseStats={...createCharacterBaseStats(),attack:5,range:20,castSpeedPercent:100};
  const first=stepBattle(state,50,demoContent);
  assert.equal(first.events.filter(e=>e.type==="spellCast").length,1);
  assert.equal(first.state.wands[0].cooldowns["spark-1"],350);
  assert.ok(Math.abs(first.state.entities.find(e=>e.kind==="projectile")!.damage-16.5)<1e-8);
  state=stepBattle(first.state,350,demoContent).state;
  assert.equal(state.events.filter(e=>e.type==="spellCast").length,2);
  assert.equal(state.characters[0].mana,92);
  assert.equal(state.entities[0].hp,500);
  state=stepBattle(state,150,demoContent).state;
  assert.ok(Math.abs(state.entities.find(e=>e.id==="target")!.hp-483.5)<1e-8);
});

test("real emitted projectiles retain accuracy and crit snapshots after actor changes",()=>{
  let state=battle();state.characters[0].manaRegen=0;
  state.characters[0].baseStats={...createCharacterBaseStats(),accuracy:.5,critChance:.5,critMultiplier:2};
  state=stepBattle(state,50,demoContent).state;
  state.characters[0].baseStats={...createCharacterBaseStats(),accuracy:1,critChance:0};
  state=stepBattle(state,100,demoContent).state;
  assert.equal(state.entities.find(e=>e.id==="target")!.hp,78);
  assert.equal(state.rngState,1013904223);
  assert.equal(state.events.find(e=>e.type==="damage")!.data.critical,true);
});

test("a real accuracy miss cannot produce lethal damage, death rewards or personal XP",()=>{
  let state=battle();state.entities[0].hp=1;state.characters[0].baseStats={...createCharacterBaseStats(),accuracy:0};
  state=stepBattle(state,2000,demoContent).state;
  assert.equal(state.entities.find(e=>e.id==="target")!.hp,1);
  assert.equal(state.characters[0].xp,0);assert.equal(state.coins,0);assert.equal(state.phase,"battle");
  assert.ok(state.events.some(e=>e.type==="attackMiss"));
  assert.equal(state.events.some(e=>e.type==="damage"||e.type==="enemyKilled"||e.type==="characterLevelUp"),false);
});
