import assert from "node:assert/strict";
import test from "node:test";
import { createGameRuntime } from "./index";

test("mixed subscriptions preserve order, queued snapshots and mutation isolation during reentrant commands",()=>{
  const runtime=createGameRuntime();
  const observed:string[]=[];
  let nested=false;
  runtime.subscribeEvents((summary,events)=>{
    const speed=events.find(event=>event.type==="speed.changed")?.data.speed;
    observed.push(`events:${summary.revision}:${speed}`);
    assert.deepEqual(Object.keys(summary).sort(),["gameTimeMs","id","phase","revision","wave"]);
    if(!nested) { nested=true;runtime.dispatch({id:"nested",type:"setSpeed",speed:3}); }
    summary.phase="defeat";
    for(const event of events) event.type="mutated";
  });
  runtime.subscribe((snapshot,events)=>{
    observed.push(`full:${snapshot.revision}:${snapshot.speed}`);
    assert.equal(snapshot.phase,"ready");
    assert.ok(events.some(event=>event.type==="speed.changed"));
    snapshot.coins=-999;
  });
  runtime.subscribeEvents((summary,events)=>{
    observed.push(`last:${summary.revision}:${events[0].data.speed}`);
    assert.equal(summary.phase,"ready");
    assert.equal(events[0].type,"speed.changed");
  });
  runtime.dispatch({id:"first",type:"setSpeed",speed:2});
  assert.deepEqual(observed,["events:1:2","full:1:2","last:1:2","events:2:3","full:2:3","last:2:3"]);
  assert.equal(runtime.getState().speed,3);
  assert.equal(runtime.getState().coins,0);
  runtime.dispose();
});

test("event-only listeners avoid full-state clones without sharing their event payloads",()=>{
  const measure=(eventOnly:boolean)=>{
    const runtime=createGameRuntime();
    runtime.subscribe(()=>{});
    if(eventOnly) { runtime.subscribeEvents(()=>{});runtime.subscribeEvents(()=>{}); }
    else { runtime.subscribe(()=>{});runtime.subscribe(()=>{}); }
    let stateClones=0;
    const clone=globalThis.structuredClone;
    globalThis.structuredClone=(<T>(value:T,options?:StructuredSerializeOptions):T=>{
      if(value&&typeof value==="object"&&"schemaVersion" in value&&"entities" in value)stateClones++;
      return clone(value,options);
    });
    try {runtime.dispatch({id:"sample",type:"setSpeed",speed:2});}
    finally {globalThis.structuredClone=clone;runtime.dispose();}
    return stateClones;
  };
  assert.equal(measure(false),4);
  assert.equal(measure(true),2);
});

test("duplicate callback registration and disposal keep the original subscription lifecycle",()=>{
  const runtime=createGameRuntime();let received=0;
  const listener=()=>{received++};
  const off=runtime.subscribeEvents(listener),offAgain=runtime.subscribeEvents(listener);
  runtime.dispatch({id:"once",type:"setSpeed",speed:2});assert.equal(received,1);
  off();runtime.dispatch({id:"removed",type:"setSpeed",speed:3});assert.equal(received,1);
  offAgain();runtime.subscribeEvents(listener);runtime.dispose();
  assert.equal(runtime.dispatch({id:"closed",type:"setSpeed",speed:1}).status,"rejected");
  assert.equal(received,1);
});
