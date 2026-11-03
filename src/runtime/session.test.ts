import assert from "node:assert/strict";
import test from "node:test";
import { createGameRuntime } from "./index";
import { loadRun, saveRun, RUN_STORAGE_KEY } from "./session";

function storage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); } };
}

test("start closes the preparation backpack atomically without bypassing rewards", () => {
  const runtime = createGameRuntime();
  runtime.dispatch({id:"manual-pause",type:"setPaused",paused:true});
  runtime.dispatch({id:"open",type:"setBackpack",open:true});
  assert.equal(runtime.dispatch({id:"start",type:"startWave"}).status,"executed");
  const battle = runtime.getState();
  assert.equal(battle.phase,"battle");assert.equal(battle.wave,1);
  assert.equal(battle.backpackOpen,false);assert.equal(battle.paused,false);
  runtime.dispatch({id:"open-again",type:"setBackpack",open:true});
  runtime.dispatch({id:"close-again",type:"setBackpack",open:false});
  assert.equal(runtime.getState().paused,false);
  const saved = runtime.checkpoint();saved.state.phase="reward";
  const reward = createGameRuntime(undefined,saved),before=reward.getState();
  assert.equal(reward.dispatch({id:"skip-reward",type:"startWave"}).status,"rejected");
  assert.deepEqual(reward.getState(),before);
});

test("refresh checkpoint keeps the live wave, layout, command receipts and pause restoration", () => {
  const first = createGameRuntime(), store = storage();
  const place = {id:"saved-place",type:"placeItem" as const,wandId:"wand-1",itemId:"amplify-1",x:1,y:0,rotation:0 as const};
  first.dispatch(place);
  first.dispatch({id:"saved-start",type:"startWave"});
  first.tick(250);
  first.dispatch({id:"saved-open",type:"setBackpack",open:true});
  const before = first.getState();
  assert.equal(saveRun(store,first.checkpoint()),true);
  const next = createGameRuntime(undefined,loadRun(store));
  assert.deepEqual(next.getState(),before);
  next.dispatch(place);
  assert.deepEqual(next.getState(),before);
  next.dispatch({id:"saved-close",type:"setBackpack",open:false});
  assert.equal(next.getState().paused,false);
  for(let i=0;i<1200 && next.getState().phase==="battle";i++) next.tick(50);
  assert.equal(next.getState().phase,"reward");
  next.dispatch({id:"saved-claim",type:"claimReward",rewardId:next.getState().rewards[0].id});
  next.dispatch({id:"saved-next",type:"startWave"});
  assert.equal(next.getState().wave,2);
  first.dispose();next.dispose();
});

test("restart starts a fresh run once, retains transport cursors, and persists that new run", () => {
  const runtime=createGameRuntime(), store=storage();
  runtime.dispatch({id:"old-start",type:"startWave"});
  runtime.tick(250);
  runtime.dispatch({id:"old-unlock",type:"unlockCheats"});
  runtime.dispatch({id:"old-backpack",type:"setBackpack",open:true});
  const before=runtime.getState(), command={id:"restart-once",type:"restart" as const};
  assert.equal(runtime.dispatch(command).status,"executed");
  const fresh=runtime.getState();
  assert.notEqual(fresh.id,before.id);
  assert.equal(fresh.wave,0);assert.equal(fresh.phase,"ready");
  assert.equal(fresh.coins,0);assert.equal(fresh.xp,0);
  assert.equal(fresh.paused,false);assert.equal(fresh.backpackOpen,false);
  assert.deepEqual(fresh.cheats,{unlocked:false,enabled:false});
  assert.ok(fresh.revision>before.revision);assert.ok(fresh.nextEventSeq>before.nextEventSeq);
  runtime.dispatch({id:"new-start",type:"startWave"});
  runtime.dispatch(command);
  assert.equal(runtime.getState().wave,1);
  saveRun(store,runtime.checkpoint());
  const restored=createGameRuntime(undefined,loadRun(store));
  assert.deepEqual(restored.getState(),runtime.getState());
  store.setItem(RUN_STORAGE_KEY,"broken-json");assert.equal(loadRun(store),undefined);
  runtime.dispose();restored.dispose();
});
