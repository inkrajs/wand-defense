import assert from "node:assert/strict";
import test from "node:test";
import type { CombatEntity } from "../contracts";
import { demoContent } from "../content/demo";
import { createInitialState } from "../runtime/initial";
import { stepBattle } from "./index";
import { spawnProjectiles } from "./projectiles";
import { advanceEnemies } from "./waves";

function enemy(overrides: Partial<CombatEntity> = {}): CombatEntity {
  return { id:"target",definitionId:"enemy-basic",kind:"enemy",faction:"enemy",x:50,y:70,
    hp:5,maxHp:5,damage:0,speed:0,range:0,cooldownMs:1000,attackRemainingMs:0,...overrides };
}
function battle() {
  const state=createInitialState(); state.phase="battle";state.wave=8;state.waveSpawnRemaining=0;
  state.entities=[enemy({level:8,grade:"rare"})]; return state;
}

for (const definitionId of ["spark","rock-shot"]) {
  test(`${definitionId} actual lethal contact carries its own cause and enemy death metadata`, () => {
    let state=battle();
    state.items={killer:{id:"killer",definitionId,kind:"spell",level:1,grade:"common"}};
    state.wands[0].placements=[{itemId:"killer",x:0,y:0,rotation:0}];
    state=stepBattle(state,50,demoContent).state;
    assert.equal(state.events.some(e=>e.type==="enemyKilled"),false);
    for(let i=0;i<50&&state.phase==="battle";i++) state=stepBattle(state,50,demoContent).state;
    const killed=state.events.filter(e=>e.type==="enemyKilled");
    assert.equal(killed.length,1);
    assert.deepEqual(killed[0].data, {entityId:"target",definitionId:"enemy-basic",xp:1,
      coins:killed[0].data.coins,x:50,y:70,maxHp:5,level:8,grade:"rare",wave:8,
      effect:definitionId,sourceItemId:"killer",sourceCharacterId:"character-1"});
    const damage=state.events.find(e=>e.type==="damage")!;
    assert.ok(damage.seq<killed[0].seq);assert.equal(damage.data.effect,definitionId);
  });
}

test("same-step multiple sources attribute only the hit that actually reaches zero HP", () => {
  const state=battle();state.entities=[enemy({hp:10,maxHp:10})];state.wands[0].placements=[];
  for(const [effect,power,item,char] of [["spark",4,"first","character-1"],["rock-shot",8,"killer","character-2"],["lightning-bolt",100,"late","character-3"]] as const) {
    spawnProjectiles(state,char,{itemId:item,definitionId:effect,power,range:30,casts:1,speed:1000},()=>{});
  }
  const result=stepBattle(state,50,demoContent);
  const damage=result.events.filter(e=>e.type==="damage");
  assert.deepEqual(damage.map(e=>e.data.sourceItemId),["first","killer"]);
  const killed=result.events.find(e=>e.type==="enemyKilled")!;
  assert.equal(killed.data.effect,"rock-shot");assert.equal(killed.data.sourceItemId,"killer");
  assert.equal(killed.data.sourceCharacterId,"character-2");
  assert.equal(result.events.filter(e=>e.type==="enemyKilled").length,1);
});

test("legacy pre-dead enemies default metadata without inferring a killer from historical damage", () => {
  const state=battle();state.entities=[enemy({hp:0})];
  state.events=[{seq:1,type:"damage",gameTimeMs:0,data:{targetId:"target",effect:"rock-shot",sourceItemId:"stale",sourceCharacterId:"stale"}}];
  state.nextEventSeq=2;
  const expectedRng=(Math.imul(state.rngState,1664525)+1013904223)>>>0;
  const result=stepBattle(state,50,demoContent);
  const killed=result.events.find(e=>e.type==="enemyKilled")!;
  assert.equal(killed.data.level,8);assert.equal(killed.data.grade,"common");
  for(const field of ["effect","sourceItemId","sourceCharacterId"]) assert.equal(Object.hasOwn(killed.data,field),false);
  assert.equal(result.state.rngState,expectedRng);assert.equal(result.state.xp,1);
  assert.equal(killed.data.coins,expectedRng/0x100000000<.25?1:0);
  assert.equal(stepBattle(result.state,50,demoContent).events.length,0);
});

test("enemy level and prototype grade tags reflect wave and boss tier without extra RNG", () => {
  for(const [wave,grade] of [[1,"common"],[5,"rare"],[10,"epic"],[100,"mythic"]] as const) {
    const state=battle();state.wave=wave;state.waveSpawnRemaining=1;state.spawnRemainingMs=0;state.entities=[];
    const expectedRng=(Math.imul(state.rngState,1664525)+1013904223)>>>0;
    advanceEnemies(state,50,()=>{});
    assert.equal(state.entities[0].level,wave);assert.equal(state.entities[0].grade,grade);
    assert.equal(state.rngState,expectedRng);
  }
});
