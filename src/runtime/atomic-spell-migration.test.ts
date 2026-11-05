import assert from "node:assert/strict";
import test from "node:test";
import { demoContent } from "../content/demo";
import { placementCells } from "../loadout/geometry";
import { createGameRuntime } from "./index";

test("shrinking a rotated atomic spell preserves every spell and resolves its old empty corner", () => {
  const seed = createGameRuntime();
  const checkpoint = seed.checkpoint();
  seed.dispose();
  const wand = checkpoint.state.wands[0];
  checkpoint.state.items["old-regrowth"] = {id:"old-regrowth", definitionId:"regrowth", kind:"spell", level:7, grade:"rare"};
  // Rotated regrowth previously occupied (1,0), (1,1), (0,1); (0,0) was empty.
  wand.placements = [{itemId:"old-regrowth",x:0,y:0,rotation:1},{itemId:"spark-1",x:0,y:0,rotation:0}];
  wand.cooldowns = {"old-regrowth":1234};
  const restored = createGameRuntime(demoContent, checkpoint);
  const state = restored.getState();
  assert.deepEqual(state.wands[0].placements, [
    {itemId:"old-regrowth",x:1,y:0,rotation:1},
    {itemId:"spark-1",x:0,y:0,rotation:0},
  ]);
  assert.deepEqual(state.wands[0].cooldowns, {"old-regrowth":1234});
  assert.deepEqual(state.items["old-regrowth"], checkpoint.state.items["old-regrowth"]);
  const cells = state.wands[0].placements.flatMap(placement => placementCells(demoContent.spells[state.items[placement.itemId].definitionId].shape, placement));
  assert.equal(new Set(cells.map(cell => `${cell.x},${cell.y}`)).size, cells.length);
  const reloaded = createGameRuntime(demoContent, restored.checkpoint());
  assert.deepEqual(reloaded.getState().wands, state.wands);
  restored.dispose();
  reloaded.dispose();
});

test("already valid single-cell wand positions are left untouched", () => {
  const runtime = createGameRuntime();
  const checkpoint = runtime.checkpoint();
  runtime.dispose();
  checkpoint.state.items["old-regrowth"] = {id:"old-regrowth",definitionId:"regrowth",kind:"spell",level:1,grade:"common"};
  checkpoint.state.wands[0].placements.push({itemId:"old-regrowth",x:1,y:0,rotation:1});
  const restored = createGameRuntime(demoContent, checkpoint);
  assert.deepEqual(restored.getState().wands[0].placements, checkpoint.state.wands[0].placements);
  restored.dispose();
});

test("raised recipe requirements preserve existing magic and discoveries when loading a checkpoint", () => {
  const runtime = createGameRuntime();
  const checkpoint = runtime.checkpoint();
  runtime.dispose();

  const { state } = checkpoint;
  state.wave = 7;
  state.knowledge.spellIds.push("iron-spark", "depleted-round");
  state.knowledge.arcanaIds.push("pierce");
  state.knowledge.recipeIds.push("depleted-round-recipe");
  state.items.round = { id: "round", definitionId: "depleted-round", kind: "spell", grade: "rare", level: 7 };
  state.backpack.push("round");

  const restored = createGameRuntime(demoContent, checkpoint);
  try {
    const after = restored.getState();
    assert.equal(after.wave, state.wave);
    assert.deepEqual(after.items, state.items);
    assert.deepEqual(after.backpack, state.backpack);
    assert.deepEqual(after.wands, state.wands);
    assert.ok(after.knowledge.recipeIds.includes("depleted-round-recipe"));
    assert.ok(after.knowledge.spellIds.includes("depleted-round"));
    assert.ok(!after.knowledge.spellIds.includes("tungsten-core"));
  } finally {
    restored.dispose();
  }
});
