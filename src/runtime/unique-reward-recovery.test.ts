import assert from "node:assert/strict";
import test from "node:test";
import { demoContent } from "../content/demo";
import { getRewardOfferKey } from "../content/randomRewards";
import { createGameRuntime } from "./index";

test("legacy duplicate reward cards are replaced once without changing progression or valid choices",()=>{
  const base=createGameRuntime(),saved=base.checkpoint();base.dispose();
  saved.state.phase="reward";saved.state.wave=31;saved.state.coins=781;
  saved.state.rewards=[
    {id:"range-first",kind:"buff",label:"射程提升",grade:"common",effect:{type:"rangePercent",value:5}},
    {id:"range-old",kind:"buff",label:"射程提升",grade:"rare",effect:{type:"rangePercent",value:10}},
    {id:"coins-first",kind:"coins",label:"金币",grade:"common",amount:10},
    {id:"coins-old",kind:"coins",label:"金币",grade:"uncommon",amount:15},
  ];
  const before=structuredClone(saved);
  const runtime=createGameRuntime(demoContent,saved),after=runtime.getState();
  assert.equal(after.rewards.length,4);
  assert.equal(new Set(after.rewards.map(getRewardOfferKey)).size,4);
  assert.deepEqual(after.rewards[0],before.state.rewards[0]);
  assert.deepEqual(after.rewards[2],before.state.rewards[2]);
  assert.ok(!after.rewards.some(reward=>reward.id==="range-old"||reward.id==="coins-old"));
  for(const key of ["id","wave","coins","characters","wands","items","backpack","rewardHistory","runStatistics"] as const)
    assert.deepEqual(after[key],before.state[key]);
  assert.deepEqual(saved,before);
  for(const reward of after.rewards) if(reward.definitionId)
    assert.ok([...after.knowledge.spellIds,...after.knowledge.arcanaIds].includes(reward.definitionId));
  const restored=createGameRuntime(demoContent,runtime.checkpoint());
  assert.deepEqual(restored.getState(),after);
  const retainedRng=restored.getState().rngState;
  assert.equal(restored.dispatch({id:"stale-claim",type:"claimReward",rewardId:"range-old"}).status,"rejected");
  assert.equal(restored.getState().rngState,retainedRng);
  const retained=after.rewards[0];
  assert.equal(restored.dispatch({id:"valid-claim",type:"claimReward",rewardId:retained.id}).status,"executed");
  const claimed=restored.checkpoint();
  assert.equal(restored.dispatch({id:"valid-claim",type:"claimReward",rewardId:retained.id}).status,"executed");
  assert.deepEqual(restored.checkpoint(),claimed);
  runtime.dispose();restored.dispose();
});

test("unique offers and an empty reward checkpoint do not consume randomness on restoration",()=>{
  const base=createGameRuntime(),saved=base.checkpoint();base.dispose();
  saved.state.phase="reward";
  for(const rewards of [[],[
    {id:"one",kind:"coins" as const,label:"金币",amount:10},
    {id:"two",kind:"buff" as const,label:"攻击",effect:{type:"attackPercent" as const,value:10}},
  ]]) {
    saved.state.rewards=rewards;
    const restored=createGameRuntime(demoContent,saved);
    assert.equal(restored.getState().rngState,saved.state.rngState);
    assert.deepEqual(restored.getState().rewards,rewards);
    restored.dispose();
  }
});
