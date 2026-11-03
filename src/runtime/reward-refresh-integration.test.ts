import assert from "node:assert/strict";
import test from "node:test";
import { demoContent } from "../content/demo";
import { getRewardOfferKey } from "../content/randomRewards";
import { projectFrame } from "../agent/projection";
import { dispatchRemote, parseRemoteCommand } from "../agent/protocol";
import { createGameRuntime, type GameRuntime } from "./index";
import { getRewardRefreshQuote } from "./rewardRefresh";

function rewardRun(wave = 1, coins = 100) {
  const initial = createGameRuntime(), checkpoint = initial.checkpoint(); initial.dispose();
  checkpoint.state.phase = "reward"; checkpoint.state.wave = wave; checkpoint.state.coins = coins;
  checkpoint.state.rewards = [
    {id:"old-attack",kind:"buff",label:"攻击",effect:{type:"attackPercent",value:10}},
    {id:"old-mana",kind:"buff",label:"法力",effect:{type:"maxMana",value:10}},
    {id:"old-coin",kind:"coins",label:"金币",amount:10},
    {id:"old-spell",kind:"item",label:"火花",definitionId:"spark"},
  ];
  return createGameRuntime(demoContent,checkpoint);
}
function refresh(runtime: GameRuntime, id: string) {
  return runtime.dispatch({id,type:"refreshRewards",offerId:runtime.getState().rewards[0].id});
}

test("paid refreshes use 1, 3, 9; stale offers and repeated command IDs cannot charge twice", () => {
  const runtime = rewardRun(1,20), original = runtime.getState();
  const command = {id:"paid-1",type:"refreshRewards" as const,offerId:original.rewards[0].id};
  assert.equal(runtime.dispatch(command).status,"executed");
  const first = runtime.getState();
  assert.equal(first.coins,19);
  assert.equal(getRewardRefreshQuote(first).cost,3);
  assert.equal(new Set(first.rewards.map(getRewardOfferKey)).size,4);
  assert.ok(first.rewards.every(reward=>!original.rewards.some(old=>old.id===reward.id)));
  assert.equal(first.rewardHistory?.length,0);
  assert.deepEqual(first.runStatistics,original.runStatistics);
  assert.equal(runtime.dispatch(command).status,"executed");
  assert.deepEqual(runtime.getState(),first);
  assert.equal(runtime.dispatch({...command,id:"stale-refresh"}).status,"rejected");
  assert.equal(runtime.dispatch({id:"stale-claim",type:"claimReward",rewardId:original.rewards[0].id}).status,"rejected");
  assert.deepEqual(runtime.getState(),first);
  assert.equal(refresh(runtime,"paid-2").status,"executed");
  assert.equal(runtime.getState().coins,16);
  assert.equal(refresh(runtime,"paid-3").status,"executed");
  assert.equal(runtime.getState().coins,7);
  assert.equal(getRewardRefreshQuote(runtime.getState()).cost,27);
  const poor = runtime.getState();
  assert.equal(refresh(runtime,"too-expensive").status,"rejected");
  assert.deepEqual(runtime.getState(),poor);
  runtime.dispose();
});

test("wave free budgets reset while the paid counter survives checkpoints and later waves", () => {
  let runtime = rewardRun(10,20);
  assert.equal(getRewardRefreshQuote(runtime.getState()).freeRemaining,1);
  assert.equal(refresh(runtime,"free-10").status,"executed");
  assert.equal(runtime.getState().coins,20);
  assert.equal(refresh(runtime,"paid-10").status,"executed");
  assert.equal(runtime.getState().coins,19);
  const saved = runtime.checkpoint(), state = runtime.getState(); runtime.dispose();
  runtime = createGameRuntime(demoContent,saved);
  assert.deepEqual(runtime.getState().rewards,state.rewards);
  assert.equal(runtime.getState().rngState,state.rngState);
  assert.equal(getRewardRefreshQuote(runtime.getState()).freeRemaining,0);
  assert.equal(getRewardRefreshQuote(runtime.getState()).cost,3);
  const next = runtime.checkpoint(); runtime.dispose(); next.state.wave = 20;
  runtime = createGameRuntime(demoContent,next);
  assert.equal(getRewardRefreshQuote(runtime.getState()).freeRemaining,2);
  assert.equal(getRewardRefreshQuote(runtime.getState()).nextPaidCost,3);
  refresh(runtime,"free-20-a"); refresh(runtime,"free-20-b");
  assert.equal(runtime.getState().coins,19);
  assert.equal(getRewardRefreshQuote(runtime.getState()).cost,3);
  assert.equal(refresh(runtime,"paid-20").status,"executed");
  assert.equal(runtime.getState().coins,16);
  runtime.dispatch({id:"new-run",type:"restart"});
  assert.deepEqual(runtime.getState().rewardRefresh,{wave:0,freeUsed:0,paidCount:0,refreshCount:0});
  runtime.dispose();
});

test("refresh is available through the same semantic protocol and does not expose hidden catalog data", () => {
  const runtime = rewardRun(10,0), state = runtime.getState();
  const frame = projectFrame(state,[],[],demoContent);
  assert.ok(frame.capabilities.commands.includes("refreshRewards"));
  assert.equal(frame.state.rewardRefresh.cost,0);
  assert.equal(frame.state.rewardRefresh.canRefresh,true);
  assert.equal(parseRemoteCommand({id:"missing-offer",type:"refreshRewards"}),undefined);
  assert.equal(dispatchRemote(runtime,{id:"remote-refresh",type:"refreshRewards",offerId:state.rewards[0].id}).status,"executed");
  assert.equal(runtime.getState().coins,0);
  const next = projectFrame(runtime.getState(),[],[],demoContent);
  assert.equal(next.state.rewardRefresh.canRefresh,false);
  assert.ok(next.content.spells.every(spell=>next.state.knowledge.spellIds.includes(spell.id)));
  const checkpoint = runtime.checkpoint(); runtime.dispose(); checkpoint.state.phase="ready";
  const ready = createGameRuntime(demoContent,checkpoint), before = ready.getState();
  assert.equal(refresh(ready,"not-reward-phase").status,"rejected");
  assert.deepEqual(ready.getState(),before); ready.dispose();
});

test("luck and gathering rewards apply once and retain their exact history after reload", () => {
  for (const [type,value] of [["luck",3],["gatheringPercent",10]] as const) {
    const runtime = rewardRun(), checkpoint = runtime.checkpoint(); runtime.dispose();
    checkpoint.state.rewards=[{id:`reward-${type}`,kind:"buff",label:type,effect:{type,value}}];
    const current = createGameRuntime(demoContent,checkpoint);
    const command = {id:"claim-new-buff",type:"claimReward" as const,rewardId:checkpoint.state.rewards[0].id};
    assert.equal(current.dispatch(command).status,"executed");
    const after = current.getState();
    assert.equal(type === "luck" ? after.luck : after.runBonuses?.gatheringPercent,value);
    assert.equal(after.rewardHistory?.at(-1)?.reward.effect?.type,type);
    current.dispatch(command); assert.deepEqual(current.getState(),after);
    const restored = createGameRuntime(demoContent,current.checkpoint());
    assert.deepEqual(restored.getState().rewardHistory,after.rewardHistory);
    assert.equal(type === "luck" ? restored.getState().luck : restored.getState().runBonuses?.gatheringPercent,value);
    current.dispose(); restored.dispose();
  }
});
