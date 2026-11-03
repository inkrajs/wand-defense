import assert from "node:assert/strict";
import test from "node:test";
import { createGameRuntime } from "./index";
import { dispatchRemote } from "../agent/protocol";
import { projectFrame } from "../agent/projection";
import { compileWand } from "../loadout/compile";
import { demoContent } from "../content/demo";

test("same-grade merge uses the authoritative remote command path without duplicate ownership", () => {
  const runtime=createGameRuntime();
  runtime.dispatch({id:"unlock",type:"unlockCheats"});runtime.dispatch({id:"enable",type:"setCheats",enabled:true});
  runtime.dispatch({id:"grant",type:"cheat",action:"grantItem",definitionId:"amplify"});
  const sourceItemId=runtime.getState().backpack.find(id => id!=="amplify-1")!;
  const command={id:"combine",type:"mergeItems",sourceItemId,targetItemId:"amplify-1"};
  assert.equal(dispatchRemote(runtime,command).status,"executed");
  const combined=runtime.getState(),item=combined.items["combine:merged"];
  assert.equal(item.definitionId,"amplify");assert.equal(item.grade,"uncommon");
  assert.deepEqual(combined.backpack,[item.id]);
  assert.equal(combined.items[sourceItemId],undefined);assert.equal(combined.items["amplify-1"],undefined);
  dispatchRemote(runtime,command);assert.deepEqual(runtime.getState(),combined);
  const frame=projectFrame(combined,combined.events,[]);
  assert.equal(frame.events.find(event => event.type === "itemsMerged")?.data.grade,"uncommon");
  assert.ok(frame.capabilities.commands.includes("mergeItems"));
  assert.equal(runtime.dispatch({id:"equip",type:"placeItem",wandId:"wand-1",itemId:item.id,x:1,y:0,rotation:0}).status,"executed");
  assert.ok(compileWand(runtime.getState(),"wand-1",demoContent)!.spells[0].power>16.5);
});
