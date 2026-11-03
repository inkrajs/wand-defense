import assert from "node:assert/strict";
import test from "node:test";
import type { GameState, Grade, ItemInstance } from "../contracts";
import { demoContent } from "../content/demo";
import { createFixtureState } from "../runtime/mock";
import { applyLoadoutCommand } from "./index";
import { canMergeItems } from "./merge-items";

function item(id: string, definitionId = "spark", grade: Grade = "common", level = 1): ItemInstance {
  return { id, definitionId, kind: "spell", grade, level };
}

function readyFixture(): GameState {
  const state = createFixtureState();
  state.phase = "reward";
  state.paused = true;
  state.backpackOpen = true;
  return state;
}

function addBagItem(state: GameState, instance: ItemInstance): void {
  state.items[instance.id] = instance;
  state.backpack.push(instance.id);
}

test("bag to wand merge keeps target placement and unrelated items; canMergeItems is only a candidate check", () => {
  const state = readyFixture();
  state.items["spark-1"].level = 2;
  state.wands[0].placements[0] = { itemId: "spark-1", x: 1, y: 1, rotation: 0 };
  state.wands[0].placements.push({ itemId: "spark-other", x: 2, y: 1, rotation: 0 });
  state.items["spark-other"] = item("spark-other");
  addBagItem(state, item("spark-source", "spark", "common", 5));
  const beforeCandidate = structuredClone(state);

  assert.equal(canMergeItems(state, "spark-source", "spark-1", demoContent), true);
  assert.deepEqual(state, beforeCandidate);
  // A cancelled candidate has no transaction side effects.
  assert.deepEqual(state, beforeCandidate);

  const merged = applyLoadoutCommand(state, {
    id: "bag-wand",
    type: "mergeItems",
    sourceItemId: "spark-source",
    targetItemId: "spark-1",
  }, demoContent);
  const outputId = "bag-wand:merged";
  assert.equal(merged.result.status, "executed");
  assert.equal(merged.state.items[outputId].level, 5);
  assert.equal(merged.state.items[outputId].grade, "uncommon");
  assert.equal(merged.state.items["spark-source"], undefined);
  assert.equal(merged.state.items["spark-1"], undefined);
  assert.deepEqual(merged.state.wands[0].placements, [
    { itemId: outputId, x: 1, y: 1, rotation: 0 },
    { itemId: "spark-other", x: 2, y: 1, rotation: 0 },
  ]);
  assert.deepEqual(merged.state.backpack, beforeCandidate.backpack.filter(id => id !== "spark-source"));
});

test("arcana can merge with arcana and advances using the target definition", () => {
  const state = readyFixture();
  state.items["amplify-1"].level = 3;
  state.items["amplify-copy"] = { id: "amplify-copy", definitionId: "amplify", kind: "arcana", grade: "common", level: 7 };
  state.backpack.push("amplify-copy");

  assert.equal(canMergeItems(state, "amplify-copy", "amplify-1", demoContent), true);
  const merged = applyLoadoutCommand(state, {
    id: "arcana-pair",
    type: "mergeItems",
    sourceItemId: "amplify-copy",
    targetItemId: "amplify-1",
  }, demoContent);
  assert.equal(merged.result.status, "executed");
  assert.deepEqual(merged.state.items["arcana-pair:merged"], {
    id: "arcana-pair:merged", definitionId: "amplify", kind: "arcana", grade: "uncommon", level: 7,
  });
  assert.deepEqual(merged.state.backpack, ["arcana-pair:merged"]);
});

test("cross-wand merge retains the target position and carries the larger cooldown", () => {
  const state = readyFixture();
  const secondWand = structuredClone(state.wands[0]);
  secondWand.id = "wand-2";
  secondWand.name = "第二根法杖";
  secondWand.placements = [{ itemId: "spark-source", x: 0, y: 1, rotation: 1 }];
  secondWand.cooldowns = { "spark-source": 600 };
  state.wands.push(secondWand);
  state.characters[0].wandIds.push("wand-2");
  state.wands[0].placements[0] = { itemId: "spark-1", x: 2, y: 2, rotation: 2 };
  state.wands[0].cooldowns["spark-1"] = 250;
  state.wands[0].placements.push({ itemId: "spark-other", x: 1, y: 2, rotation: 0 });
  state.items["spark-other"] = item("spark-other");
  state.backpack = state.backpack.filter(id => id !== "spark-1");
  state.items["spark-source"] = item("spark-source", "spark", "common", 3);

  const merged = applyLoadoutCommand(state, {
    id: "cross-wand",
    type: "mergeItems",
    sourceItemId: "spark-source",
    targetItemId: "spark-1",
  }, demoContent);
  const outputId = "cross-wand:merged";
  assert.equal(merged.result.status, "executed");
  assert.deepEqual(merged.state.wands[0].placements, [
    { itemId: outputId, x: 2, y: 2, rotation: 2 },
    { itemId: "spark-other", x: 1, y: 2, rotation: 0 },
  ]);
  assert.equal(merged.state.wands[0].cooldowns[outputId], 600);
  assert.deepEqual(merged.state.wands[1].placements, []);
  assert.equal(merged.state.wands[1].cooldowns["spark-source"], undefined);
});

test("bag to bag merge keeps target ordering and the merged cooldown through placement", () => {
  const state = readyFixture();
  state.wands[0].placements = [];
  state.backpack = ["before", "spark-source", "spark-target", "after", "amplify-1"];
  state.items = {
    "before": item("before"),
    "spark-source": item("spark-source"),
    "spark-target": item("spark-target", "spark", "common", 4),
    "after": item("after"),
    "amplify-1": state.items["amplify-1"],
  };
  // The IDs retain a cooldown from their previous wand placement.
  state.wands[0].cooldowns = { "spark-source": 700, "spark-target": 400 };

  const merged = applyLoadoutCommand(state, {
    id: "bag-bag",
    type: "mergeItems",
    sourceItemId: "spark-source",
    targetItemId: "spark-target",
  }, demoContent);
  const outputId = "bag-bag:merged";
  assert.equal(merged.result.status, "executed");
  assert.deepEqual(merged.state.backpack, ["before", outputId, "after", "amplify-1"]);
  assert.equal(merged.state.wands[0].cooldowns[outputId], 700);

  const placed = applyLoadoutCommand(merged.state, {
    id: "place-merged",
    type: "placeItem",
    wandId: "wand-1",
    itemId: outputId,
    x: 1,
    y: 1,
    rotation: 0,
  }, demoContent);
  assert.equal(placed.result.status, "executed");
  assert.deepEqual(placed.state.wands[0].placements, [{ itemId: outputId, x: 1, y: 1, rotation: 0 }]);
  assert.equal(placed.state.wands[0].cooldowns[outputId], 700);
});

test("invalid merges and battle phase rejection preserve the original state", () => {
  const cases: Array<{ name: string; candidate?: boolean; prepare: (state: GameState) => { source: string; target: string; commandId: string } }> = [
    { name: "same ID", prepare: state => ({ source: "spark-1", target: "spark-1", commandId: "same" }) },
    { name: "grade mismatch", prepare: state => { addBagItem(state, item("source", "spark", "rare")); return { source: "source", target: "spark-1", commandId: "grade" }; } },
    { name: "definition mismatch", prepare: state => { addBagItem(state, item("source", "regrowth")); return { source: "source", target: "spark-1", commandId: "definition" }; } },
    { name: "mythic cap", prepare: state => { state.items["spark-1"].grade = "mythic"; addBagItem(state, item("source", "spark", "mythic")); return { source: "source", target: "spark-1", commandId: "mythic" }; } },
    { name: "duplicate location", prepare: state => { addBagItem(state, item("spark-1")); addBagItem(state, item("source")); return { source: "source", target: "spark-1", commandId: "location" }; } },
    { name: "output ID collision", candidate: true, prepare: state => { addBagItem(state, item("source")); state.items["collision:merged"] = item("collision:merged"); return { source: "source", target: "spark-1", commandId: "collision" }; } },
  ];

  for (const scenario of cases) {
    const state = readyFixture();
    const { source, target, commandId } = scenario.prepare(state);
    const before = structuredClone(state);
    assert.equal(canMergeItems(state, source, target, demoContent), scenario.candidate ?? false, `${scenario.name}: candidate`);
    const result = applyLoadoutCommand(state, {
      id: commandId,
      type: "mergeItems",
      sourceItemId: source,
      targetItemId: target,
    }, demoContent);
    assert.equal(result.result.status, "rejected", scenario.name);
    assert.equal(result.state, state, scenario.name);
    assert.deepEqual(result.state, before, scenario.name);
    assert.deepEqual(result.events, [], scenario.name);
  }

  const battle = readyFixture();
  battle.phase = "battle";
  battle.paused = false;
  addBagItem(battle, item("source"));
  assert.equal(canMergeItems(battle, "source", "spark-1", demoContent), false);
  const beforeBattle = structuredClone(battle);
  const denied = applyLoadoutCommand(battle, {
    id: "battle-merge",
    type: "mergeItems",
    sourceItemId: "source",
    targetItemId: "spark-1",
  }, demoContent);
  assert.equal(denied.result.status, "rejected");
  assert.equal(denied.state, battle);
  assert.deepEqual(denied.state, beforeBattle);
  assert.deepEqual(denied.events, []);

  const pausedBattle = structuredClone(battle);
  pausedBattle.paused = true;
  assert.equal(canMergeItems(pausedBattle, "source", "spark-1", demoContent), true);

  const defeat = structuredClone(battle);
  defeat.phase = "defeat";
  defeat.paused = true;
  assert.equal(canMergeItems(defeat, "source", "spark-1", demoContent), false);
});
