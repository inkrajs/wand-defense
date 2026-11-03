import assert from "node:assert/strict";
import test from "node:test";
import { createGameRuntime } from "./index";
import { demoContent } from "../content/demo";
import { grantPreviewMagic } from "./preview";
import { dispatchRemote } from "../agent/protocol";

test("an explicit preview request fills this run with spells and arcana exactly once", () => {
  const runtime = createGameRuntime();
  assert.equal(dispatchRemote(runtime,{id:"remote-grant",type:"cheat",action:"grantItem",definitionId:"focus"}).status,"rejected");
  assert.equal(dispatchRemote(runtime,{id:"remote-unlock",type:"unlockCheats"}).status,"rejected");
  runtime.dispatch({id:"start",type:"startWave"});runtime.tick(50);
  const before = runtime.getState();
  const result = grantPreviewMagic(runtime,demoContent,"human-request-1");
  const after = runtime.getState();
  assert.equal(result.granted,Object.keys(demoContent.spells).length + Object.keys(demoContent.arcana).length);assert.equal(result.unchangedRun,true);
  assert.equal(after.wave,before.wave);assert.equal(after.gameTimeMs,before.gameTimeMs);
  assert.equal(after.backpackOpen,true);assert.equal(after.paused,true);
  for (const id of [...Object.keys(demoContent.spells),...Object.keys(demoContent.arcana)])
    assert.ok(after.backpack.some(itemId => after.items[itemId].definitionId === id));
  grantPreviewMagic(runtime,demoContent,"human-request-1");
  assert.deepEqual(runtime.getState(),after);
  assert.equal(runtime.dispatch({id:"legacy",type:"cheat",action:"grantSpell",definitionId:"focus"}).status,"rejected");
});

test("a preview top-up preserves existing items and adds only missing magic", () => {
  const runtime = createGameRuntime();
  const before = runtime.getState();
  const result = grantPreviewMagic(runtime, demoContent, "human-top-up", true);
  const after = runtime.getState();
  const definitions = [...Object.keys(demoContent.spells), ...Object.keys(demoContent.arcana)];
  assert.equal(result.granted, definitions.length - Object.keys(before.items).length);
  for (const definitionId of definitions) assert.equal(Object.values(after.items).filter(item => item.definitionId === definitionId).length, 1);
  for (const [id, item] of Object.entries(before.items)) assert.deepEqual(after.items[id], item);
  assert.deepEqual(after.wands, before.wands);
  assert.equal(after.wave, before.wave);
  assert.equal(after.id, before.id);
  assert.equal(grantPreviewMagic(runtime, demoContent, "human-top-up", true).granted, 0);
  assert.deepEqual(runtime.getState(), after);
});
