import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState } from "../runtime/initial";
import { collectDeathVisuals } from "./deathVisuals";

test("death presentation follows fresh lethal events, never prospective hits or history",()=>{
  const state=createInitialState();
  state.events=[{seq:1,gameTimeMs:0,type:"damage",data:{targetId:"enemy",x:20,y:30}},
    {seq:2,gameTimeMs:0,type:"enemyKilled",data:{entityId:"enemy",definitionId:"boss-minor",x:20,y:30}},
    {seq:3,gameTimeMs:0,type:"enemyKilled",data:{x:NaN,y:30}},
    {seq:4,gameTimeMs:0,type:"enemyKilled",data:{entityId:"edge-enemy",definitionId:"enemy-moss",x:-12,y:104}},
    {seq:5,gameTimeMs:0,type:"enemyKilled",data:{definitionId:"legacy-enemy",x:50,y:50}}];
  const before=structuredClone(state);
  assert.deepEqual(collectDeathVisuals(state,1),[
    {seq:2,x:20,y:30,entityId:"enemy",definitionId:"boss-minor"},
    {seq:4,x:-12,y:104,entityId:"edge-enemy",definitionId:"enemy-moss"},
    {seq:5,x:50,y:50,entityId:undefined,definitionId:"legacy-enemy"},
  ]);
  assert.deepEqual(collectDeathVisuals(state,5),[]);
  assert.deepEqual(state,before);
});
