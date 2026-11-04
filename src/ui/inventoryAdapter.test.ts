import assert from "node:assert/strict";
import test from "node:test";
import { assertInventoryContainers, rotateInventoryCells, type InventoryItem } from "@inkra/react/inventory-grid";
import type { WandInstance } from "../contracts";
import { columnsForInventoryWidth, INVENTORY_PAGE_ROWS, makeWandGridItem, minimumRequiredColumns, packInventory, type DockItem } from "./inventoryAdapter";

function item(id: string, cells: InventoryItem["cells"] = [{ x: 0, y: 0 }], rotatable = true): DockItem {
  return { id, label: id, kind: "spell", definitionId: id, grade: "common", cells, position: { x: 0, y: 0 }, rotatable };
}

test("six columns keep nine single-cell items inside the default five rows", () => {
  const packed = packInventory(Array.from({ length: 9 }, (_, index) => item(`i${index}`)), 6);
  assert.equal(packed.rows, INVENTORY_PAGE_ROWS);
  assert.equal(packed.items.length, 9);
  assert.equal(packed.unplaced.length, 0);
});

test("packing grows rows to fit every owned cell shape while preserving valid saved positions", () => {
  const items = Array.from({ length: 22 }, (_, index) => item(`i${index}`, index % 3 === 0 ? [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] : [{ x: 0, y: 0 }]));
  const packed = packInventory(items, 6, INVENTORY_PAGE_ROWS, { i0: { x: 4, y: 3, rotation: 0 } });
  assert.ok(packed.rows > INVENTORY_PAGE_ROWS);
  assert.equal(packed.items.length, items.length);
  assert.equal(packed.unplaced.length, 0);
  assert.deepEqual(packed.items.find(candidate => candidate.id === "i0")?.position, { x: 4, y: 3 });
  assert.equal(packed.items.find(candidate => candidate.id === "i0")?.rotation, 0);
  const uniqueIds = new Set(packed.items.map(candidate => candidate.id));
  assert.equal(uniqueIds.size, items.length);
});

test("colliding saved positions repack the conflict without dropping either item", () => {
  const packed = packInventory([item("a"), item("b"), item("c")], 6, INVENTORY_PAGE_ROWS, {
    a: { x: 0, y: 0, rotation: 0 },
    b: { x: 0, y: 0, rotation: 0 },
  });
  assert.deepEqual(packed.items.find(candidate => candidate.id === "a")?.position, { x: 0, y: 0 });
  assert.equal(packed.items.length, 3);
  assert.equal(packed.unplaced.length, 0);
  assert.notDeepEqual(packed.items.find(candidate => candidate.id === "b")?.position, { x: 0, y: 0 });
});

test("a shape that would cross a page boundary is relocated whole to the next page", () => {
  const shape = item("shape", [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }], false);
  const packed = packInventory([shape], 6, INVENTORY_PAGE_ROWS, { shape: { x: 0, y: INVENTORY_PAGE_ROWS - 1, rotation: 0 } });
  assert.equal(packed.unplaced.length, 0);
  assert.equal(packed.items.length, 1);
  assert.equal(Math.floor(packed.items[0].position.y / INVENTORY_PAGE_ROWS), Math.floor((packed.items[0].position.y + 1) / INVENTORY_PAGE_ROWS));
  assert.notEqual(packed.items[0].position.y, INVENTORY_PAGE_ROWS - 1);
});

test("a later small item fills an earlier hole left by a large item", () => {
  const items = [item("saved-top"), item("saved-bottom"), item("large", [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }], false), item("small")];
  const packed = packInventory(items, 3, INVENTORY_PAGE_ROWS, {
    "saved-top": { x: 1, y: 0, rotation: 0 },
    "saved-bottom": { x: 1, y: 1, rotation: 0 },
  });
  assert.deepEqual(packed.items.find(candidate => candidate.id === "large")?.position, { x: 0, y: 2 });
  assert.deepEqual(packed.items.find(candidate => candidate.id === "small")?.position, { x: 0, y: 0 });
});

test("a shape wider than the column count rotates into the fixed-width grid", () => {
  const packed = packInventory([item("wide", [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }])], 2);
  assert.equal(packed.unplaced.length, 0);
  assert.equal(packed.rows, INVENTORY_PAGE_ROWS);
  assert.equal(packed.items[0].rotation, 90);
});

test("demo spell input order places spark before fireball instead of area-sorting it away", () => {
  const spark = item("spark-1", [{ x: 0, y: 0 }]);
  const fireball = item("fireball-1", [{ x: 0, y: 0 }, { x: 1, y: 0 }]);
  const packed = packInventory([spark, fireball], 6);
  assert.deepEqual(packed.items.map(entry => entry.id), ["spark-1", "fireball-1"]);
  assert.deepEqual(packed.items.map(entry => entry.position), [{ x: 0, y: 0 }, { x: 1, y: 0 }]);
});

test("responsive columns retain 48px cells and fill narrow and wide viewports", () => {
  assert.equal(columnsForInventoryWidth(296, 3, 48), 6);
  assert.equal(columnsForInventoryWidth(256, 3, 48), 5);
  assert.equal(columnsForInventoryWidth(190, 3, 48), 3);
  assert.equal(columnsForInventoryWidth(1281, 3, 48), 26);
  assert.equal(minimumRequiredColumns([item("wide", [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }])]), 1);
});

test("shapes taller than the five-row page are reported as unplaced instead of split", () => {
  const cells = Array.from({ length: 6 * 400 }, (_, index) => ({ x: index % 6, y: Math.floor(index / 6) }));
  const packed = packInventory([item("tall-a", cells, false), item("tall-b", cells, false), item("tall-c", cells, false)], 6);
  assert.equal(packed.unplaced.length, 3);
  assert.equal(packed.items.length, 0);
});

test("packing splits storage into public-grid containers within the 4096-cell limit", () => {
  const items = Array.from({ length: 4100 }, (_, index) => item(`large-${index}`));
  const packed = packInventory(items, 1);
  assert.equal(packed.unplaced.length, 0);
  assert.equal(packed.items.length, items.length);
  assert.ok(packed.segments.length > 1);
  assert.ok(packed.segments.every(segment => segment.rows > 0 && segment.rows <= 4096));
  assert.equal(packed.segments.reduce((total, segment) => total + segment.items.length, 0), items.length);
  assertInventoryContainers(packed.segments.map((segment, index) => ({
    id: `segment-${index}`,
    columns: 1,
    rows: segment.rows,
    items: segment.items,
  })));
});

test("invalid far-away UI coordinates are ignored within the packing row bound", () => {
  const packed = packInventory([item("a")], 6, INVENTORY_PAGE_ROWS, { a: { x: 0, y: 1_000_000_000, rotation: 0 } });
  assert.equal(packed.rows, INVENTORY_PAGE_ROWS);
  assert.equal(packed.unplaced.length, 0);
  assert.deepEqual(packed.items[0].position, { x: 0, y: 0 });
  assert.equal(packed.segments.reduce((count, segment) => count + segment.rows, 0), INVENTORY_PAGE_ROWS);
});

test("three-row pages retain every mixed shape whole, preserve legal spots and keep rows as minimum extent", () => {
  const shapes = [
    [{x: 0, y: 0}],
    [{x: 0, y: 0}, {x: 1, y: 0}, {x: 0, y: 1}, {x: 1, y: 1}],
    [{x: 0, y: 0}, {x: 0, y: 1}, {x: 0, y: 2}],
  ];
  const items = Array.from({length: 80}, (_, i) => item(`mobile-${i}`, shapes[i % shapes.length], false));
  const saved = {"mobile-0": {x: 5, y: 2, rotation: 0 as const}, "mobile-1": {x: 0, y: 2, rotation: 0 as const}};
  const packed = packInventory(items, 6, 11, saved, 3);
  assert.equal(packed.unplaced.length, 0);
  assert.equal(packed.items.length, items.length);
  assert.equal(new Set(packed.items.map(value => value.id)).size, items.length);
  assert.ok(packed.rows >= 11);
  assert.deepEqual(packed.items.find(value => value.id === 'mobile-0')!.position, {x: 5, y: 2});
  assert.notEqual(packed.items.find(value => value.id === 'mobile-1')!.position.y, 2);
  for (const placed of packed.items) {
    const pages = new Set(rotateInventoryCells(placed.cells, placed.rotation).map(cell => Math.floor((cell.y + placed.position.y) / 3)));
    assert.equal(pages.size, 1, placed.id);
  }
  assertInventoryContainers(packed.segments.map((segment, index) => ({id: `mobile-${index}`, columns: 6, rows: segment.rows, items: segment.items})));
  assert.deepEqual(packInventory(items, 6, 5, saved), packInventory(items, 6, 5, saved, 5));
});

test("three-row pagination stays aligned with 4096-cell segments without losing items", () => {
  const singles = Array.from({length: 4100}, (_, i) => item(`segmented-${i}`));
  const packed = packInventory(singles, 1, 3, {}, 3);
  assert.equal(packed.items.length, singles.length); assert.equal(packed.unplaced.length, 0);
  assert.equal(new Set(packed.segments.flatMap(segment => segment.items.map(value => value.id))).size, singles.length);
  assert.ok(packed.segments.every(segment => segment.rows <= 4096 && segment.rowOffset % 3 === 0));
  assertInventoryContainers(packed.segments.map((segment, i) => ({id: `segment-${i}`, columns: 1, rows: segment.rows, items: segment.items})));
  // A raw four-row segment conflicts with global three-row pages unless segments align to pages.
  const wide = Array.from({length: 6}, (_, i) => item(`wide-page-${i}`, [{x: 0, y: 0}, {x: 1023, y: 0}, {x: 0, y: 2}], false));
  const widePacked = packInventory(wide, 1024, 3, {}, 3);
  assert.equal(widePacked.unplaced.length, 0); assert.equal(widePacked.items.length, wide.length);
  assert.ok(widePacked.segments.every(segment => segment.rows * 1024 <= 4096));
});

test("mobile wand previews scale display cells proportionally without changing authoritative wand data", () => {
  for (const [width, height, expectedWidth, expectedHeight] of [[5, 5, 3, 3], [4, 4, 3, 3], [6, 4, 5, 3], [2, 5, 1, 3], [3, 2, 3, 2]]) {
    const wand: WandInstance = {id: `wand-${width}-${height}`, name: '法杖', width, height, characterId: null,
      level: 7, grade: 'rare', placements: [{itemId: 'kept-spell', x: 1, y: 1, rotation: 1}], cooldowns: {'kept-spell': 750}};
    const before = structuredClone(wand);
    assert.equal(makeWandGridItem(wand, {x: 0, y: 0}).cells.length, width * height);
    const preview = makeWandGridItem(wand, {x: 2, y: 3}, false, 3);
    assert.equal(Math.max(...preview.cells.map(cell => cell.x)) + 1, expectedWidth);
    assert.equal(Math.max(...preview.cells.map(cell => cell.y)) + 1, expectedHeight);
    assert.equal(preview.cells.length, expectedWidth * expectedHeight);
    assert.deepEqual(preview.position, {x: 2, y: 3});
    assert.ok(preview.kind === 'wand');
    assert.equal(preview.wandId, wand.id); assert.equal(preview.grade, wand.grade);
    assert.deepEqual(wand, before);
    const packed = packInventory([preview], expectedWidth, 3, {}, 3);
    assert.equal(packed.unplaced.length, 0);
  }
});
