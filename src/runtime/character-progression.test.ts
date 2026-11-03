import assert from "node:assert/strict";
import test from "node:test";
import { demoContent } from "../content/demo";
import { createGameRuntime } from "./index";
import { projectEvents, projectState } from "../agent/projection";

test("legacy shared experience migrates once without duplicating experience or old level gifts", () => {
  const checkpoint=createGameRuntime().checkpoint();
  const first=checkpoint.state.characters[0];delete first.xp;
  checkpoint.state.characters.push({...structuredClone(first),id:"character-2",wandIds:[]});
  checkpoint.state.xp=75;checkpoint.state.playerLevel=3;
  const runtime=createGameRuntime(demoContent,checkpoint),state=runtime.getState();
  assert.equal(state.characters[0].xp,75);assert.equal(state.characters[0].level,3);
  assert.equal(state.characters[1].xp,0);assert.equal(state.characters[1].level,1);
  assert.deepEqual(state.backpack,checkpoint.state.backpack);
  assert.deepEqual(state.events,checkpoint.state.events);
  assert.deepEqual(createGameRuntime(demoContent,runtime.checkpoint()).getState(),state);
  const projection=projectState(state);
  assert.equal(projection.experienceMode,"perCharacter");
  assert.deepEqual(projection.characters.map(character=>character.experienceProgress.value),[15,0]);
});

test("a non-primary character levels up, receives one gift and keeps personal progress after reload", () => {
  const checkpoint=createGameRuntime().checkpoint();
  const state=checkpoint.state;
  state.characters.push({...structuredClone(state.characters[0]),id:"character-2",name:"同行者",wandIds:[],xp:0});
  state.phase="battle";state.wave=1;state.waveSpawnRemaining=0;
  state.entities=[
    {id:"target",definitionId:"enemy-basic",kind:"enemy",faction:"enemy",x:50,y:70,hp:1,maxHp:160,damage:0,speed:0,range:0,cooldownMs:1000,attackRemainingMs:1000},
    {id:"in-flight",definitionId:"water-bolt",kind:"projectile",faction:"player",x:50,y:70,hp:1,maxHp:1,damage:1,speed:100,range:0,cooldownMs:0,attackRemainingMs:0,remainingMs:1000,targetId:"target",targetX:50,targetY:70,sourceCharacterId:"character-2"},
  ];
  const runtime=createGameRuntime(demoContent,checkpoint);runtime.tick(50);
  const after=runtime.getState();
  assert.equal(after.characters[0].xp,0);assert.equal(after.characters[0].level,1);
  assert.equal(after.characters[1].xp,20);assert.equal(after.characters[1].level,2);
  assert.equal(after.playerLevel,1);
  assert.equal(after.backpack.length,state.backpack.length+1);
  assert.equal(after.events.filter(event=>event.type==="character.levelReward").length,1);
  const levelEvent=after.events.find(event=>event.type==="characterLevelUp")!;
  assert.equal(projectEvents(after,[levelEvent])[0].data.characterId,"character-2");
  const restored=createGameRuntime(demoContent,runtime.checkpoint());restored.tick(50);
  assert.deepEqual(restored.getState(),after);
});

test("newly recruited characters start their own level-one progress", () => {
  const checkpoint=createGameRuntime().checkpoint();
  checkpoint.state.phase="reward";
  checkpoint.state.characters[0].xp=75;checkpoint.state.characters[0].level=3;
  checkpoint.state.xp=75;
  checkpoint.state.rewards=[{id:"recruit",kind:"character",label:"同行者"}];
  const runtime=createGameRuntime(demoContent,checkpoint);
  assert.equal(runtime.dispatch({id:"claim-character",type:"claimReward",rewardId:"recruit"}).status,"executed");
  const characters=runtime.getState().characters;
  assert.deepEqual(characters.map(character=>[character.level,character.xp]),[[3,75],[1,0]]);
});
