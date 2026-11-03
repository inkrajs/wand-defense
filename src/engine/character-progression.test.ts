import assert from "node:assert/strict";
import test from "node:test";
import type { CombatEntity, GameState } from "../contracts";
import { createInitialState } from "../runtime/initial";
import { demoContent } from "../content/demo";
import { normalizeCharacterProgression } from "../content/progression";
import { spawnProjectiles } from "./projectiles";
import { stepBattle } from "./index";

function enemy(id: string, y: number, maxHp: number): CombatEntity {
  return {id,definitionId:"enemy-basic",kind:"enemy",faction:"enemy",x:50,y,hp:1,maxHp,
    damage:0,speed:0,range:0,cooldownMs:1000,attackRemainingMs:1000};
}
function battle(): GameState {
  const state=createInitialState();state.phase="battle";state.wave=1;state.waveSpawnRemaining=0;
  state.characters.push({...structuredClone(state.characters[0]),id:"character-2",wandIds:[],xp:0,level:1});
  state.wands[0].placements=[];normalizeCharacterProgression(state);return state;
}
function fire(state: GameState, source: string, item: string) {
  assert.equal(spawnProjectiles(state,source,{itemId:item,definitionId:"spark",power:2,range:30,casts:1,speed:1000},()=>{}),true);
}

test("two characters earn separate cumulative XP and emit every personal level crossed", () => {
  const state=battle();state.entities=[enemy("a",70,160)];
  fire(state,"character-1","wand-a-spell");
  state.entities.push(enemy("b",80,480));fire(state,"character-2","wand-b-spell");
  const result=stepBattle(state,50,demoContent);
  assert.deepEqual(result.state.characters.map(c=>[c.xp,c.level]),[[20,2],[60,3]]);
  assert.equal(result.state.xp,80);assert.equal(result.state.playerLevel,2);
  assert.deepEqual(result.events.filter(e=>e.type==="characterLevelUp").map(e=>e.data),[
    {characterId:"character-1",level:2,previousLevel:1},
    {characterId:"character-2",level:2,previousLevel:1},
    {characterId:"character-2",level:3,previousLevel:2},
  ]);
  assert.deepEqual(result.events.filter(e=>e.type==="enemyKilled").map(e=>e.data.xpCharacterId),["character-1","character-2"]);
  assert.equal(result.events.some(e=>e.type==="playerLevelUp"),false);
  assert.equal(stepBattle(result.state,500,demoContent).events.length,0);
});

test("all firing wands credit their original character after transfer during flight", () => {
  let state=battle();
  state.wands[0].placements=[{itemId:"spark-1",x:0,y:0,rotation:0}];
  state.items["spark-2"]={...state.items["spark-1"],id:"spark-2"};
  state.wands.push({...structuredClone(state.wands[0]),id:"wand-2",placements:[{itemId:"spark-2",x:0,y:0,rotation:0}],cooldowns:{}});
  state.characters[0].wandIds.push("wand-2");
  state.entities=[{...enemy("target",70,100),hp:20}];
  const launched=stepBattle(state,50,demoContent);
  assert.equal(launched.state.entities.filter(e=>e.kind==="projectile").length,2);
  assert.ok(launched.state.entities.filter(e=>e.kind==="projectile").every(e=>e.sourceCharacterId==="character-1"));
  state=launched.state;
  for(const wand of state.wands) {wand.characterId="character-2";wand.placements=[];}
  state.characters[0].wandIds=[];state.characters[1].wandIds=["wand-1","wand-2"];
  for(let i=0;i<10&&state.phase==="battle";i++) state=stepBattle(state,50,demoContent).state;
  assert.deepEqual(state.characters.map(c=>c.xp),[13,0]);
  assert.equal(state.events.find(e=>e.type==="enemyKilled")?.data.xpCharacterId,"character-1");
});

test("a missing or removed kill owner never awards another character or upgrades the shared tally", () => {
  for(const source of [undefined,"removed-character"] as const) {
    const state=battle();state.xp=1000;state.entities=[enemy("target",80,800)];
    fire(state,"removed-character","old-spell");
    const bullet=state.entities.find(e=>e.kind==="projectile")!;
    if(source===undefined) delete bullet.sourceCharacterId;
    const result=stepBattle(state,50,demoContent);
    assert.deepEqual(result.state.characters.map(c=>[c.xp,c.level]),[[0,1],[0,1]]);
    assert.equal(result.state.xp,1100);assert.equal(result.state.playerLevel,1);
    const killed=result.events.find(e=>e.type==="enemyKilled")!;
    assert.equal(Object.hasOwn(killed.data,"xpCharacterId"),false);
    assert.equal(result.events.some(e=>e.type==="characterLevelUp"||e.type==="playerLevelUp"),false);
  }
});

test("pause and backpack freeze personal experience and level events with the projectile", () => {
  for(const flag of ["paused","backpackOpen"] as const) {
    const state=battle();state.entities=[enemy("target",80,160)];fire(state,"character-2","spell");
    state[flag]=true;const before=structuredClone(state);
    const result=stepBattle(state,5000,demoContent);
    assert.equal(result.state,state);assert.deepEqual(result.state,before);assert.deepEqual(result.events,[]);
  }
});
