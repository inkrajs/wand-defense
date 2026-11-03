import assert from "node:assert/strict";
import test from "node:test";
import type { ContentCatalog, GameState } from "../contracts";
import { createFixtureState } from "../runtime/mock";
import { applyLoadoutCommand } from "./transactions";

const content: ContentCatalog = {
  spells: {
    spark: { id: "spark", name: "火花", element: "fire", shape: [{ x: 0, y: 0 }], asset: { key: "spark", label: "火花" }, effect: "projectile", power: 1, manaCost: 1, cooldownMs: 1, range: 1, level: 1, grade: "common" },
    fireball: { id: "fireball", name: "火球", element: "fire", shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }], asset: { key: "fireball", label: "火球" }, effect: "projectile", power: 2, manaCost: 2, cooldownMs: 2, range: 2, level: 1, grade: "uncommon" },
    wolf: { id: "wolf", name: "狼", element: "wood", shape: [{ x: 0, y: 0 }], asset: { key: "wolf", label: "狼" }, effect: "summon", power: 1, manaCost: 1, cooldownMs: 1, range: 1, level: 1, grade: "common" },
    "arrow-tower": { id: "arrow-tower", name: "箭塔", element: "metal", shape: [{ x: 0, y: 0 }], asset: { key: "tower", label: "箭塔" }, effect: "building", power: 1, manaCost: 1, cooldownMs: 1, range: 1, level: 1, grade: "common" }
  },
  arcana: {
    amplify: { id: "amplify", name: "增幅", shape: [{ x: 0, y: 0 }], asset: { key: "amplify", label: "增幅" }, modifier: "amplify", value: 1, level: 1, grade: "common" }
  },
  recipes: [{ id: "fireball-recipe", name: "火球", inputs: ["spark", "amplify"], output: "fireball", requireAdjacency: true }],
  sequences: {}
};

function pausedState(): GameState {
  const state = createFixtureState();
  return { ...state, phase: "reward", paused: true, backpackOpen: true };
}

test("failed loadout commands preserve the original state and emit no events", () => {
  const state = pausedState();
  const result = applyLoadoutCommand(state, { id: "bad-place", type: "placeItem", wandId: "wand-1", itemId: "wolf-1", x: 8, y: 8, rotation: 0 }, content);
  assert.equal(result.result.status, "rejected");
  assert.equal(result.state, state);
  assert.deepEqual(result.events, []);
});

test("recipe merge consumes adjacent inputs atomically and adds known output to backpack", () => {
  const state = pausedState();
  const wand = state.wands[0];
  wand.placements.push({ itemId: "amplify-1", x: 1, y: 0, rotation: 0 });
  state.backpack = state.backpack.filter(id => id !== "amplify-1");
  const result = applyLoadoutCommand(state, { id: "merge-1", type: "mergeRecipe", wandId: wand.id, recipeId: "fireball-recipe", itemIds: ["amplify-1", "spark-1"] }, content);
  assert.equal(result.result.status, "executed");
  assert.equal(result.state.revision, state.revision + 1);
  assert.deepEqual(result.state.backpack, [...state.backpack, "merge-1:output"]);
  assert.equal(result.state.items["spark-1"], undefined);
  assert.equal(result.state.items["amplify-1"], undefined);
  assert.equal(result.state.items["merge-1:output"].definitionId, "fireball");
  assert.ok(result.state.knowledge.spellIds.includes("fireball"));
  assert.equal(result.state.wands[0].cooldowns["spark-1"], undefined);
  assert.equal(result.events.length, 1);
});

test("recipe merge rejects inputs that are not four-side connected", () => {
  const state = pausedState();
  const wand = state.wands[0];
  wand.placements.push({ itemId: "amplify-1", x: 2, y: 2, rotation: 0 });
  state.backpack = state.backpack.filter(id => id !== "amplify-1");
  const result = applyLoadoutCommand(state, { id: "merge-far", type: "mergeRecipe", wandId: wand.id, recipeId: "fireball-recipe", itemIds: ["spark-1", "amplify-1"] }, content);
  assert.equal(result.result.code, "INPUTS_NOT_ADJACENT");
  assert.equal(result.state, state);
  assert.deepEqual(result.events, []);
});

test("same-wand repositioning validates rotation and preserves item cooldown", () => {
  const state = pausedState();
  state.wands[0].cooldowns["spark-1"] = 123;
  const invalid = applyLoadoutCommand(state, { id: "bad-rotation", type: "placeItem", wandId: "wand-1", itemId: "spark-1", x: 1, y: 0, rotation: 9 as 0 }, content);
  assert.equal(invalid.result.code, "INVALID_ROTATION");
  const moved = applyLoadoutCommand(state, { id: "reposition", type: "placeItem", wandId: "wand-1", itemId: "spark-1", x: 1, y: 0, rotation: 0 }, content);
  assert.equal(moved.result.status, "executed");
  assert.equal(moved.state.wands[0].cooldowns["spark-1"], 123);
});

test("wand transfer honors current ownership and target capacity", () => {
  const state = pausedState();
  state.characters.push({ id: "character-2", name: "伙伴", sequenceId: "fire-9", level: 1, grade: "common", wandIds: ["wand-2", "wand-3"], mana: 10, maxMana: 10, manaRegen: 1 });
  state.wands.push(
    { id: "wand-2", name: "二号杖", characterId: "character-2", level: 1, grade: "common", width: 3, height: 3, placements: [], cooldowns: {} },
    { id: "wand-3", name: "三号杖", characterId: "character-2", level: 1, grade: "common", width: 3, height: 3, placements: [], cooldowns: {} }
  );
  const result = applyLoadoutCommand(state, { id: "equip-full", type: "equipWand", wandId: "wand-1", characterId: "character-2" }, content);
  assert.equal(result.result.code, "WAND_CAPACITY");
  assert.equal(result.state, state);
  assert.deepEqual(result.events, []);
});

test("wand transfer updates both owners without changing layout and rejects duplicate declarations", () => {
  const state = pausedState();
  state.characters.push({ ...structuredClone(state.characters[0]), id: "character-2", wandIds: [] });
  const command = { id: "transfer", type: "equipWand", wandId: "wand-1", characterId: "character-2" } as const;
  const transferred = applyLoadoutCommand(state, command, content);
  assert.equal(transferred.result.status, "executed");
  assert.deepEqual(transferred.state.characters.map(character => character.wandIds), [[], ["wand-1"]]);
  assert.equal(transferred.state.wands[0].characterId, "character-2");
  assert.deepEqual(transferred.state.wands[0].placements, state.wands[0].placements);
  assert.equal(applyLoadoutCommand(transferred.state, { ...command, id: "again" }, content).result.code, "ALREADY_EQUIPPED");
  state.characters[1].wandIds = ["wand-1"];
  const rejected = applyLoadoutCommand(state, command, content);
  assert.equal(rejected.result.code, "WAND_OWNERSHIP_INVALID");
  assert.equal(rejected.state, state);
});
