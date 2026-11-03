import assert from "node:assert/strict";
import test from "node:test";
import { createGameRuntime } from "./index";
import { demoContent } from "../content/demo";
import { grantPreviewMagic, inspectPreviewInventory, updateAuthorizedPreview, reviveAuthorizedPreview, fillAuthorizedInventory, applyAuthorizedPreviewGrants } from "./preview";
import { dispatchRemote } from "../agent/protocol";

test("local inventory inspection never changes the run or unlocks cheats", () => {
  const runtime=createGameRuntime(), before=runtime.checkpoint();
  const report=inspectPreviewInventory(runtime,"read-only");
  assert.equal(report.ownedItems,2);
  assert.equal(report.backpackItems,1);
  assert.deepEqual(report.definitions,["amplify","spark"]);
  assert.deepEqual(runtime.checkpoint(),before);
  runtime.dispose();
});

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


test("chain preview update only targets the previously authorized save and is one-off",()=>{
  const runtime=createGameRuntime(), before=runtime.checkpoint();
  assert.equal(updateAuthorizedPreview(runtime,demoContent),undefined);
  assert.deepEqual(runtime.checkpoint(),before);
  runtime.dispatch({id:'preview:user-all-magic-20261104-03:unlock',type:'unlockCheats'});
  const authorized=runtime.getState();
  const report=updateAuthorizedPreview(runtime,demoContent);
  assert.equal(report?.granted,3);
  assert.equal(report?.grantedWands,2);
  assert.deepEqual(runtime.getState().wands.slice(-2).map(w=>[w.width,w.height]),[[4,4],[5,5]]);
  assert.equal(runtime.getState().cheats.enabled,authorized.cheats.enabled);
  assert.equal(runtime.getState().wave,authorized.wave);
  assert.equal(runtime.getState().id,authorized.id);
  assert.equal(runtime.getState().backpack.some(id=>runtime.getState().items[id].definitionId==='dark-orb'),false);
  const after=runtime.checkpoint();
  assert.equal(updateAuthorizedPreview(runtime,demoContent),undefined);
  assert.deepEqual(runtime.checkpoint(),after);
  runtime.dispatch({id:'preview-restart',type:'restart'});
  runtime.dispatch({id:'preview-new-unlock',type:'unlockCheats'});
  const restarted=runtime.checkpoint();
  assert.equal(updateAuthorizedPreview(runtime,demoContent),undefined);
  assert.deepEqual(runtime.checkpoint(),restarted);
  runtime.dispose();
});

test("the authorized one-off revival preserves the build and never revives a restarted run",()=>{
  const original=createGameRuntime();
  original.dispatch({id:'preview:user-all-magic-20261104-03:unlock',type:'unlockCheats'});
  const checkpoint=original.checkpoint();
  checkpoint.state.phase='defeat';checkpoint.state.wave=20;checkpoint.state.territory.hp=0;
  checkpoint.state.coins=350;
  const runtime=createGameRuntime(demoContent,checkpoint);
  const report=reviveAuthorizedPreview(runtime);
  assert.equal(report?.status,'executed');assert.equal(report?.phase,'ready');
  assert.equal(report?.nextWave,20);assert.equal(report?.preservedBuild,true);
  assert.equal(report?.preservedCoins,true);assert.equal(runtime.getState().cheats.enabled,false);
  const after=runtime.checkpoint();
  assert.equal(reviveAuthorizedPreview(runtime),undefined);assert.deepEqual(runtime.checkpoint(),after);
  runtime.dispatch({id:'fresh-restart',type:'restart'});
  const fresh=runtime.checkpoint();fresh.state.phase='defeat';fresh.state.territory.hp=0;
  const restarted=createGameRuntime(demoContent,fresh),before=restarted.checkpoint();
  assert.equal(reviveAuthorizedPreview(restarted),undefined);assert.deepEqual(restarted.checkpoint(),before);
});

test("all supported preview items are filled once without resetting progression or replacing existing layouts",()=>{
  const runtime=createGameRuntime();assert.equal(fillAuthorizedInventory(runtime,demoContent),undefined);
  runtime.dispatch({id:'preview:user-all-magic-20261104-03:unlock',type:'unlockCheats'});
  const before=runtime.getState(),report=fillAuthorizedInventory(runtime,demoContent)!;
  assert.equal(report.status,'executed');assert.equal(report.spellKinds,Object.keys(demoContent.spells).length);assert.equal(report.arcanaKinds,Object.keys(demoContent.arcana).length);
  assert.equal(report.gearKinds,Object.keys(demoContent.gear??{}).length);assert.equal(report.itemKinds,Object.keys(demoContent.items??{}).length);
  assert.equal(report.grantedGear,Object.keys(demoContent.gear??{}).length);assert.equal(report.grantedSupplies,Object.keys(demoContent.items??{}).length);
  assert.equal(report.granted,Object.keys(demoContent.spells).length+Object.keys(demoContent.arcana).length-2);assert.equal(report.grantedWands,2);
  assert.equal(report.preservedLayouts,true);assert.equal(report.preservedCoins,true);
  const after=runtime.getState();assert.equal(after.id,before.id);assert.equal(after.wave,before.wave);
  assert.equal(after.cheats.enabled,before.cheats.enabled);assert.deepEqual(after.wands[0],before.wands[0]);
  assert.equal(fillAuthorizedInventory(runtime,demoContent),undefined);assert.deepEqual(runtime.getState(),after);
});

test("pending new-magic gifts wait for preparation and completed gifts never refill consumed items",()=>{
  const original=createGameRuntime();
  original.dispatch({id:'preview:user-all-magic-20261104-03:unlock',type:'unlockCheats'});
  original.dispatch({id:'preview-test-start',type:'startWave'});
  const combat=original.checkpoint();
  assert.deepEqual(applyAuthorizedPreviewGrants(original,demoContent),{reports:[],pending:true});
  assert.deepEqual(original.checkpoint(),combat);
  combat.state.phase='ready';combat.state.entities=[];
  const runtime=createGameRuntime(demoContent,combat);
  const result=applyAuthorizedPreviewGrants(runtime,demoContent);
  assert.equal(result.pending,false);assert.equal(result.reports.length,3);
  assert.ok(result.reports.every(report=>report.status==='executed'&&report.preservedCoins&&report.preservedLayouts));
  const saved=runtime.checkpoint();
  for(const definitionId of ['fire-field-bolt','thunder-field-bolt','thunderstorm','moving-storm','quadruple','sextuple'])
    assert.ok(Object.values(saved.state.items).some(item=>item.definitionId===definitionId));
  const consumed=Object.values(saved.state.items).find(item=>item.definitionId==='moving-storm')!.id;
  delete saved.state.items[consumed];saved.state.backpack=saved.state.backpack.filter(id=>id!==consumed);
  const restored=createGameRuntime(demoContent,saved),before=restored.checkpoint();
  assert.deepEqual(applyAuthorizedPreviewGrants(restored,demoContent),{reports:[],pending:false});
  assert.deepEqual(restored.checkpoint(),before);
  original.dispose();runtime.dispose();restored.dispose();
});
