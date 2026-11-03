import assert from "node:assert/strict";
import test from "node:test";
import { assertInventoryContainers, type InventoryItem } from "@inkra/react/inventory-grid";
import { columnsForInventoryWidth, minimumRequiredColumns, packInventory, type DockItem } from "./inventoryAdapter";

function item(id: string, cells: InventoryItem["cells"] = [{ x: 0, y: 0 }], rotatable = true): DockItem {
  return { id, label: id, kind: "spell", definitionId: id, grade: "common", cells, position: { x: 0, y: 0 }, rotatable };
}

test("six columns keep nine single-cell items inside the default three rows", () => {
  const packed = packInventory(Array.from({ length: 9 }, (_, index) => item(`i${index}`)), 6);
  assert.equal(packed.rows, 3);
  assert.equal(packed.items.length, 9);
  assert.equal(packed.unplaced.length, 0);
});

test("packing grows rows to fit every owned cell shape while preserving saved positions", () => {
  const items = Array.from({ length: 22 }, (_, index) => item(`i${index}`, index % 3 === 0 ? [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] : [{ x: 0, y: 0 }]));
  const packed = packInventory(items, 6, 3, { i0: { x: 4, y: 5, rotation: 0 } });
  assert.ok(packed.rows > 3);
  assert.equal(packed.items.length, items.length);
  assert.equal(packed.unplaced.length, 0);
  assert.deepEqual(packed.items.find(candidate => candidate.id === "i0")?.position, { x: 4, y: 5 });
  assert.equal(packed.items.find(candidate => candidate.id === "i0")?.rotation, 0);
  const uniqueIds = new Set(packed.items.map(candidate => candidate.id));
  assert.equal(uniqueIds.size, items.length);
});

test("colliding saved positions repack the conflict without dropping either item", () => {
  const packed = packInventory([item("a"), item("b"), item("c")], 6, 3, {
    a: { x: 0, y: 0, rotation: 0 },
    b: { x: 0, y: 0, rotation: 0 },
  });
  assert.deepEqual(packed.items.find(candidate => candidate.id === "a")?.position, { x: 0, y: 0 });
  assert.equal(packed.items.length, 3);
  assert.equal(packed.unplaced.length, 0);
  assert.notDeepEqual(packed.items.find(candidate => candidate.id === "b")?.position, { x: 0, y: 0 });
});

test("a shape wider than the column count rotates into the fixed-width grid", () => {
  const packed = packInventory([item("wide", [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }])], 2);
  assert.equal(packed.unplaced.length, 0);
  assert.equal(packed.rows, 3);
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

test("large full-width shapes get separate bounded segments without losing items", () => {
  const cells = Array.from({ length: 6 * 400 }, (_, index) => ({ x: index % 6, y: Math.floor(index / 6) }));
  const packed = packInventory([item("tall-a", cells, false), item("tall-b", cells, false), item("tall-c", cells, false)], 6);
  assert.equal(packed.unplaced.length, 0);
  assert.equal(packed.items.length, 3);
  assert.equal(new Set(packed.items.map(entry => Math.floor(entry.position.y / packed.segmentRowLimit))).size, 3);
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
  const packed = packInventory([item("a")], 6, 3, { a: { x: 0, y: 1_000_000_000, rotation: 0 } });
  assert.equal(packed.rows, 3);
  assert.equal(packed.unplaced.length, 0);
  assert.deepEqual(packed.items[0].position, { x: 0, y: 0 });
  assert.equal(packed.segments.reduce((count, segment) => count + segment.rows, 0), 3);
});
