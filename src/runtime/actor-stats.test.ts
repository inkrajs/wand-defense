import assert from "node:assert/strict";
import test from "node:test";
import { createGameRuntime } from "./index";
import { getCharacterStats } from "../content/characters";

test("legacy constructor adds defaults once without replacing identity, XP or mana",()=>{
  const seed=createGameRuntime().checkpoint();const character=seed.state.characters[0];
  delete character.baseStats;character.mana=37;character.xp=20;character.level=2;
  const before={id:character.id,mana:character.mana,xp:character.xp,level:character.level};
  const runtime=createGameRuntime(undefined,seed),restored=runtime.getState().characters[0];
  assert.deepEqual({id:restored.id,mana:restored.mana,xp:restored.xp,level:restored.level},before);
  assert.equal(restored.baseStats!.accuracy,1);assert.equal(restored.baseStats!.attack,0);
  const again=createGameRuntime(undefined,runtime.checkpoint());assert.deepEqual(again.getState(),runtime.getState());
  runtime.dispose();again.dispose();
});

test("real wand removal recomputes capacity and clamps excess mana without writing equipment into base",()=>{
  const seed=createGameRuntime().checkpoint();seed.state.backpackOpen=true;seed.state.paused=true;
  seed.state.wands[0].statBonuses={attack:5,maxMana:50};seed.state.characters[0].mana=140;
  const runtime=createGameRuntime(undefined,seed);const base=structuredClone(runtime.getState().characters[0].baseStats);
  assert.equal(getCharacterStats(runtime.getState(),"character-1")!.final.maxMana,150);
  assert.equal(runtime.dispatch({id:"off",type:"unequipWand",wandId:"wand-1"}).status,"executed");
  const after=runtime.getState();assert.equal(after.characters[0].mana,100);
  assert.equal(getCharacterStats(after,"character-1")!.equipment.attack,0);
  assert.deepEqual(after.characters[0].baseStats,base);
  assert.equal(runtime.dispatch({id:"on",type:"equipWand",wandId:"wand-1",characterId:"character-1"}).status,"executed");
  assert.equal(getCharacterStats(runtime.getState(),"character-1")!.final.maxMana,150);
  assert.equal(runtime.getState().characters[0].mana,100);runtime.dispose();
});

test("recruits receive independent neutral stats and existing run mana bonuses exactly once",()=>{
  const seed=createGameRuntime().checkpoint();seed.state.phase="reward";
  seed.state.characters[0].baseStats!.attack=5;seed.state.characters[0].mana=37;
  seed.state.characters[0].maxMana=120;seed.state.characters[0].manaRegen=15;
  seed.state.runBonuses={attackPercent:0,maxMana:20,manaRegen:3};
  seed.state.rewards=[{id:"recruit",kind:"character",label:"同行者",grade:"common"}];
  const runtime=createGameRuntime(undefined,seed);
  assert.equal(runtime.dispatch({id:"claim-recruit",type:"claimReward",rewardId:"recruit"}).status,"executed");
  const state=runtime.getState(),[first,recruit]=state.characters;
  assert.equal(first.mana,37);assert.equal(first.baseStats!.attack,5);assert.equal(recruit.baseStats!.attack,0);
  assert.notStrictEqual(first.baseStats,recruit.baseStats);
  assert.notStrictEqual(first.baseStats!.elementBonuses,recruit.baseStats!.elementBonuses);
  const stats=getCharacterStats(state,recruit.id)!.final;
  assert.equal(stats.maxMana,120);assert.equal(stats.manaRegen,15);assert.equal(recruit.mana,120);
  runtime.dispose();
});
