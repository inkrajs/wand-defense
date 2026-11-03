import assert from "node:assert/strict";
import test from "node:test";
import { advanceOwnedBattle, startBattle, stepBattle } from "./index";
import { createInitialState } from "../runtime/initial";
import { createGameRuntime } from "../runtime";
import { demoContent } from "../content/demo";

test("exclusive runtime stepping matches the pure engine while pure callers keep their input", () => {
  const initial=createInitialState();
  initial.items.ball={id:"ball",definitionId:"fireball",kind:"spell",grade:"rare",level:3};
  initial.wands[0].placements=[{itemId:"ball",x:0,y:0,rotation:0}];
  let pure=startBattle(initial,demoContent).state;
  let owned=structuredClone(pure);
  for(let tick=0;tick<120;tick++) {
    const before=structuredClone(pure), ownedReference=owned;
    const expected=stepBattle(pure,50,demoContent);
    const actual=advanceOwnedBattle(owned,50,demoContent);
    assert.deepEqual(pure,before,"pure engine never changes the caller's input");
    assert.equal(actual.state,ownedReference,"exclusive path retains the owned state allocation");
    assert.deepEqual(actual,expected,`full state and all events at tick ${tick}`);
    pure=expected.state; owned=actual.state;
  }
});

test("runtime checkpoints and queued listener snapshots stay isolated across owned ticks and reentry", () => {
  const runtime=createGameRuntime();
  runtime.dispatch({id:"start-owned",type:"startWave"});
  const checkpoint=runtime.checkpoint(), checkpointBefore=structuredClone(checkpoint);
  const snapshots:ReturnType<typeof runtime.getState>[]=[];
  let reentered=false;
  runtime.subscribe((state,events)=>{
    state.coins=-1;
    if(state.entities[0])state.entities[0].hp=-1;
    if(events[0])events[0].data.injected=true;
    if(!reentered) {reentered=true;runtime.dispatch({id:"nested-speed",type:"setSpeed",speed:2});}
  });
  runtime.subscribe(state=>snapshots.push(state));
  runtime.tick(50);
  const first=structuredClone(snapshots[0]);
  assert.ok(first.coins>=0);
  assert.ok(first.entities.every(entity=>entity.hp>0));
  assert.equal(snapshots[0].speed,1);
  assert.equal(snapshots[1].speed,2);
  runtime.tick(50);
  assert.deepEqual(snapshots[0],first,"later ticks cannot mutate an earlier listener snapshot");
  assert.deepEqual(checkpoint,checkpointBefore,"owned battle cannot mutate a previously returned checkpoint");
  assert.ok(runtime.getState().coins>=0);
  runtime.dispose();
});

test("caller-supplied catalogs retain pure-step rollback when a custom getter throws", () => {
  const content=structuredClone(demoContent), runtime=createGameRuntime(content);
  runtime.dispatch({id:"custom-start",type:"startWave"});
  const before=runtime.getState();
  Object.defineProperty(content.spells.spark,"power",{get(){throw new Error("custom content failure");},enumerable:true});
  assert.throws(()=>runtime.tick(50),/custom content failure/);
  assert.deepEqual(runtime.getState(),before);
  runtime.dispose();
});
