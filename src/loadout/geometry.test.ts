import assert from "node:assert/strict";
import test from "node:test";
import type { Cell } from "../contracts";
import { areAdjacent, placementCells, rotateShape, validatePlacement } from "./geometry";

test("rotateShape rotates asymmetric shapes clockwise and normalizes their origin", () => {
  const shape: Cell[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
  assert.deepEqual(rotateShape(shape, 1), [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]);
  assert.deepEqual(rotateShape(shape, 2), [{ x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 0 }]);
  assert.deepEqual(rotateShape([{ x: 2, y: 3 }], 3), [{ x: 0, y: 0 }]);
});

test("placementCells applies rotation before the placement offset", () => {
  assert.deepEqual(
    placementCells([{ x: 0, y: 0 }, { x: 1, y: 0 }], { itemId: "wand-item", x: 2, y: 3, rotation: 1 }),
    [{ x: 2, y: 3 }, { x: 2, y: 4 }],
  );
});

test("validatePlacement reports invalid shapes, bounds, and overlap", () => {
  assert.deepEqual(validatePlacement(3, 3, [], []), { valid: false, code: "INVALID_PLACEMENT" });
  assert.deepEqual(validatePlacement(3, 3, [{ x: 0, y: 0 }, { x: 0, y: 0 }], []), { valid: false, code: "INVALID_PLACEMENT" });
  assert.deepEqual(validatePlacement(3, 3, [{ x: 3, y: 0 }], []), { valid: false, code: "OUT_OF_BOUNDS" });
  assert.deepEqual(validatePlacement(3, 3, [{ x: 1, y: 1 }], [{ x: 1, y: 1 }]), { valid: false, code: "OCCUPIED" });
  assert.deepEqual(validatePlacement(3, 3, [{ x: 1, y: 1 }], []), { valid: true });
  assert.deepEqual(validatePlacement(0, 3, [{ x: 1, y: 1 }], []), { valid: false, code: "INVALID_PLACEMENT" });
});

test("areAdjacent requires a shared four-direction edge, not a diagonal", () => {
  assert.equal(areAdjacent([{ x: 0, y: 0 }], [{ x: 1, y: 0 }]), true);
  assert.equal(areAdjacent([{ x: 0, y: 0 }], [{ x: 1, y: 1 }]), false);
});
