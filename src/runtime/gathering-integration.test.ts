import assert from "node:assert/strict";
import test from "node:test";
import { demoContent } from "../content/demo";
import { createGameRuntime } from "./index";

test("gathering boosts real kill and clear income once, preserves fractional carry, and never discounts refresh spending", () => {
  const initial = createGameRuntime(), checkpoint = initial.checkpoint(); initial.dispose();
  Object.assign(checkpoint.state,{phase:"battle",wave:1,waveSpawnRemaining:0,spawnRemainingMs:0,rngState:0,coins:0,coinIncomeRemainder:.9});
  checkpoint.state.runBonuses={attackPercent:0,gatheringPercent:10};
  checkpoint.state.entities=[{id:"fallen",definitionId:"enemy-basic",kind:"enemy",faction:"enemy",x:50,y:20,
    hp:0,maxHp:16,damage:0,speed:0,range:0,cooldownMs:1000,attackRemainingMs:0}];
  const before = structuredClone(checkpoint), runtime = createGameRuntime(demoContent,checkpoint);
  runtime.tick(50);
  const after = runtime.getState();
  assert.equal(after.phase,"reward");
  assert.equal(after.events.find(event=>event.type==="enemyKilled")?.data.coins,2);
  assert.equal(after.events.find(event=>event.type==="waveCleared")?.data.coins,7);
  assert.equal(after.coins,9);
  assert.ok(Math.abs(after.coinIncomeRemainder!-.7)<1e-9);
  assert.equal(after.runStatistics?.coinsEarned,9);
  assert.deepEqual(checkpoint,before);
  const restored = createGameRuntime(demoContent,JSON.parse(JSON.stringify(runtime.checkpoint())));
  assert.equal(restored.getState().coinIncomeRemainder,after.coinIncomeRemainder);
  assert.equal(restored.dispatch({id:"paid-refresh",type:"refreshRewards",offerId:after.rewards[0].id}).status,"executed");
  assert.equal(restored.getState().coins,8);
  assert.equal(restored.getState().coinIncomeRemainder,after.coinIncomeRemainder);
  assert.equal(restored.getState().runStatistics?.coinsEarned,9);
  restored.dispatch({id:"restart",type:"restart"});
  assert.equal(restored.getState().coinIncomeRemainder,0);
  assert.equal(restored.getState().runBonuses?.gatheringPercent??0,0);
  runtime.dispose(); restored.dispose();
});

test("coin reward cards use the same gathering income path and acquisition statistics", () => {
  const initial = createGameRuntime(), checkpoint = initial.checkpoint(); initial.dispose();
  checkpoint.state.phase="reward"; checkpoint.state.wave=1;
  checkpoint.state.runBonuses={attackPercent:0,gatheringPercent:10};
  checkpoint.state.rewards=[{id:"coin-card",kind:"coins",label:"金币",amount:10}];
  const runtime = createGameRuntime(demoContent,checkpoint);
  assert.equal(runtime.dispatch({id:"claim",type:"claimReward",rewardId:"coin-card"}).status,"executed");
  assert.equal(runtime.getState().coins,11);
  assert.equal(runtime.getState().runStatistics?.coinsEarned,11);
  assert.equal(runtime.getState().rewardHistory?.at(-1)?.reward.amount,10);
  runtime.dispose();
});
