import assert from "node:assert/strict";
import test from "node:test";
import type { InventoryItem } from "@inkra/react/inventory-grid";
import type { GameEvent } from "../contracts";
import { createGameRuntime } from "../runtime";
import { readRun, saveRun } from "../runtime/session";
import { carryMergeLayout, hasMeasuredInventoryWidth, projectInventoryLayout, rememberInventoryPosition, type InventoryLayoutState } from "./inventoryLayoutState";
import { INVENTORY_PAGE_ROWS, makeSupplyGridItem, type DockItem } from "./inventoryAdapter";

function item(id: string): DockItem {
  return { id, label: id, kind: "spell", definitionId: id, grade: "common", cells: [{ x: 0, y: 0 }], position: { x: 0, y: 0 }, rotatable: true } satisfies DockItem & InventoryItem;
}
function position(state: InventoryLayoutState, id: string) {
  return state.positions[id];
}

test("zero-width startup does not cache provisional packing and measured width preserves manual coordinates", () => {
  const items = Array.from({ length: 33 }, (_, index) => item(`i${index}`));
  let cached: InventoryLayoutState | undefined;
  const zeroWidthProjection = projectInventoryLayout(items, 1, cached);
  if (hasMeasuredInventoryWidth(0)) cached = zeroWidthProjection.state;
  assert.equal(cached, undefined);

  const measuredProjection = projectInventoryLayout(items, 26, cached);
  cached = measuredProjection.state;
  assert.equal(measuredProjection.packed.rows, INVENTORY_PAGE_ROWS);
  assert.equal(measuredProjection.packed.items.filter(entry => entry.position.y < INVENTORY_PAGE_ROWS).length, 33);

  cached = rememberInventoryPosition(cached, "i0", { x: 12, y: 4, rotation: 0 });
  assert.deepEqual(cached.manualIds, ["i0"]);
  const resized = projectInventoryLayout(items, 20, cached);
  assert.deepEqual(position(resized.state, "i0"), { x: 12, y: 4, rotation: 0 });
  assert.deepEqual(resized.state.manualIds, ["i0"]);
});

test("legacy layout positions with unknown origin remain unclassified instead of being discarded", () => {
  const initial = projectInventoryLayout([item("a"), item("b")], 2);
  const legacy = { ...initial.state, manualIds: undefined, unclassifiedIds: undefined } as unknown as InventoryLayoutState;
  const migrated = projectInventoryLayout([item("a"), item("b")], 26, legacy);
  assert.deepEqual(migrated.state.unclassifiedIds, ["a", "b"]);
  assert.deepEqual(position(migrated.state, "a"), position(initial.state, "a"));
  const moved = rememberInventoryPosition(migrated.state, "a", { x: 3, y: 4, rotation: 0 });
  assert.deepEqual(moved.manualIds, ["a"]);
  assert.deepEqual(moved.unclassifiedIds, ["b"]);
});

test("removing the first item does not compress other saved positions", () => {
  const initial = projectInventoryLayout([item("a"), item("b"), item("c")], 6);
  const next = projectInventoryLayout([item("b"), item("c")], 6, initial.state);
  assert.deepEqual(position(next.state, "b"), position(initial.state, "b"));
  assert.deepEqual(position(next.state, "c"), position(initial.state, "c"));
});

test("a new item occupies an open cell while existing items keep their positions", () => {
  const initialItems = [item("a"), item("b"), item("c")];
  const initial = projectInventoryLayout(initialItems, 6);
  const afterRemoval = projectInventoryLayout(initialItems.slice(1), 6, initial.state);
  const afterReward = projectInventoryLayout([...initialItems.slice(1), item("reward")], 6, afterRemoval.state);
  assert.deepEqual(position(afterReward.state, "b"), position(initial.state, "b"));
  assert.deepEqual(position(afterReward.state, "c"), position(initial.state, "c"));
  assert.deepEqual(position(afterReward.state, "reward"), position(initial.state, "a"));
});

test("the itemsMerged event transfers target layout to its output and releases its source", () => {
  const initial = projectInventoryLayout([item("source"), item("target"), item("other")], 6);
  const event: GameEvent = {
    seq: 1, type: "itemsMerged", gameTimeMs: 0,
    data: { sourceItemId: "source", targetItemId: "target", outputItemId: "merge-output:merged" },
  };
  const mergedState = carryMergeLayout(initial.state, event);
  const next = projectInventoryLayout([item("other"), item("merge-output:merged")], 6, mergedState);
  assert.deepEqual(position(next.state, "merge-output:merged"), position(initial.state, "target"));
  assert.deepEqual(position(next.state, "other"), position(initial.state, "other"));
  assert.equal(next.state.positions.source, undefined);
});

test("a transferred item can reclaim its old free position when it returns", () => {
  const initialItems = [item("a"), item("returning"), item("c")];
  const initial = projectInventoryLayout(initialItems, 6);
  const movedAway = projectInventoryLayout([item("a"), item("c")], 6, initial.state);
  const returned = projectInventoryLayout(initialItems, 6, movedAway.state);
  assert.deepEqual(position(returned.state, "returning"), position(initial.state, "returning"));
});

test("separate category layouts can use the same capacity without reserving invisible cells", () => {
  const spellInventory = projectInventoryLayout([item("spell")], 6);
  const wand = { ...item("stored-wand"), kind: "wand" as const, wandId: "stored-wand", cells: Array.from({ length: 9 }, (_, index) => ({ x: index % 3, y: Math.floor(index / 3) })) };
  const equipmentInventory = projectInventoryLayout([wand], 6);
  assert.deepEqual(position(spellInventory.state, "spell"), { x: 0, y: 0, rotation: 0 });
  assert.deepEqual(position(equipmentInventory.state, "stored-wand"), { x: 0, y: 0, rotation: 0 });
  assert.equal(spellInventory.packed.rows, equipmentInventory.packed.rows);
});

test("unverified huge cached coordinates cannot expand the trusted layout extent", () => {
  const initial = projectInventoryLayout([item("a")], 6);
  const corrupted = {
    ...initial.state,
    positions: { ...initial.state.positions, a: { x: 0, y: 1_000_000_000, rotation: 0 as const } },
  };
  const next = projectInventoryLayout([item("a"), item("b")], 6, corrupted);
  assert.equal(next.state.extentRows < 1_000_000, true);
  assert.deepEqual(position(next.state, "a"), position(initial.state, "a"));
  assert.equal(next.packed.unplaced.length, 0);
});

test("changing to three-row pages preserves legal manual positions and relocates only a crossing shape", () => {
  const square = {...item('square'), cells: [{x: 0, y: 0}, {x: 1, y: 0}, {x: 0, y: 1}, {x: 1, y: 1}], rotatable: false};
  const items = [square, item('kept'), ...Array.from({length: 25}, (_, i) => item(`extra-${i}`))];
  let desktop = projectInventoryLayout(items, 6).state;
  desktop = rememberInventoryPosition(desktop, 'square', {x: 0, y: 2, rotation: 0});
  desktop = rememberInventoryPosition(desktop, 'kept', {x: 5, y: 2, rotation: 0});
  const before = structuredClone(desktop);
  const mobile = projectInventoryLayout(items, 6, desktop, 3, 3);
  assert.deepEqual(position(mobile.state, 'kept'), {x: 5, y: 2, rotation: 0});
  assert.notEqual(position(mobile.state, 'square').y % 3, 2);
  assert.equal(mobile.packed.items.length, items.length); assert.equal(mobile.packed.unplaced.length, 0);
  assert.deepEqual(mobile.state.manualIds, desktop.manualIds);
  assert.deepEqual(desktop, before);
  const repeated = projectInventoryLayout(items, 6, mobile.state, 3, 3);
  assert.deepEqual(repeated.state.positions, mobile.state.positions);
  assert.deepEqual(projectInventoryLayout(items, 6, desktop), projectInventoryLayout(items, 6, desktop, 5, 5));
});

test("old supplies restore as fixed single cells and reflow conflicting or invalid positions without losing instances", () => {
  const checkpoint = createGameRuntime().checkpoint();
  checkpoint.state.territory.hp = 40;
  const supplies = {
    first: { id: "first", definitionId: "restoration-elixir", level: 2, grade: "rare" },
    repeat: { id: "repeat", definitionId: "restoration-elixir", level: 1, grade: "common" },
    shield: { id: "shield", definitionId: "aegis-essence", level: 3, grade: "epic" },
    mana: { id: "mana", definitionId: "mana-potion", level: 1, grade: "common" },
  } as const;
  checkpoint.state.supplies = supplies;
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  assert.equal(saveRun(storage, checkpoint), true);
  const saved = readRun(storage);
  assert.equal(saved.status, "loaded");
  const runtime = createGameRuntime(undefined, saved.checkpoint);
  const restored = runtime.getState().supplies!;
  assert.deepEqual(restored, supplies);
  const items = Object.values(restored).map(supply => makeSupplyGridItem(supply, { x: 0, y: 0 }));
  const previous: InventoryLayoutState = { columns: 6, activeIds: Object.keys(supplies), extentRows: 3, itemBudget: 4, positions: {
    first: { x: 1, y: 1, rotation: 90 }, repeat: { x: 1, y: 1, rotation: 180 },
    shield: { x: 5, y: 0, rotation: 0 }, mana: { x: 0, y: 1_000_000_000, rotation: 0 },
  } };
  const { packed, state } = projectInventoryLayout(items, 2, previous, 3, 3);
  assert.deepEqual(state.positions.first, { x: 1, y: 1, rotation: 0 });
  assert.equal(packed.unplaced.length, 0);
  assert.equal(new Set(packed.items.map(({position: {x, y}}) => `${x},${y}`)).size, items.length);
  assert.ok(packed.items.every(entry => entry.cells.length === 1 && entry.rotatable === false && entry.rotation === 0));
  const moved = rememberInventoryPosition(state, "first", { x: 1, y: 2, rotation: 0 });
  assert.deepEqual(projectInventoryLayout(items, 2, moved, 3, 3).state.positions.first, { x: 1, y: 2, rotation: 0 });
  assert.equal(runtime.dispatch({ id: "use-restored-supply", type: "useItem", itemId: "first" }).status, "executed");
  const { first: _consumed, ...remaining } = supplies;
  assert.deepEqual(runtime.getState().supplies, remaining);
});
