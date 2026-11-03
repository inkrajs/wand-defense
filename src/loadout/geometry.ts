import type { Cell, Placement } from "../contracts";

/** Rotate a grid shape clockwise in quarter turns and move its origin to (0, 0). */
export function rotateShape(shape: readonly Cell[], rotation: 0 | 1 | 2 | 3): Cell[] {
  let cells = shape.map(({ x, y }) => ({ x, y }));
  for (let turn = 0; turn < rotation; turn += 1) {
    cells = cells.map(({ x, y }) => ({ x: -y, y: x }));
  }
  if (cells.length === 0) return cells;
  const minX = Math.min(...cells.map(({ x }) => x));
  const minY = Math.min(...cells.map(({ y }) => y));
  return cells.map(({ x, y }) => ({ x: x - minX, y: y - minY }));
}

/** Return the absolute wand cells occupied by a placement. */
export function placementCells(shape: readonly Cell[], placement: Placement): Cell[] {
  return rotateShape(shape, placement.rotation).map(({ x, y }) => ({
    x: x + placement.x,
    y: y + placement.y,
  }));
}

/** Whether any cells from the two shapes share a horizontal or vertical edge. */
export function areAdjacent(a: readonly Cell[], b: readonly Cell[]): boolean {
  const occupied = new Set(a.map(({ x, y }) => `${x},${y}`));
  return b.some(({ x, y }) =>
    occupied.has(`${x - 1},${y}`) || occupied.has(`${x + 1},${y}`) ||
    occupied.has(`${x},${y - 1}`) || occupied.has(`${x},${y + 1}`),
  );
}

export function validatePlacement(
  width: number,
  height: number,
  cells: readonly Cell[],
  occupied: readonly Cell[],
): { valid: boolean; code?: string } {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || cells.length === 0) {
    return { valid: false, code: "INVALID_PLACEMENT" };
  }
  const seen = new Set<string>();
  for (const { x, y } of cells) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) return { valid: false, code: "INVALID_PLACEMENT" };
    const key = `${x},${y}`;
    if (seen.has(key)) return { valid: false, code: "INVALID_PLACEMENT" };
    seen.add(key);
  }
  if (cells.some(({ x, y }) => x < 0 || y < 0 || x >= width || y >= height)) {
    return { valid: false, code: "OUT_OF_BOUNDS" };
  }
  const occupiedSet = new Set(occupied.map(({ x, y }) => `${x},${y}`));
  if (cells.some(({ x, y }) => occupiedSet.has(`${x},${y}`))) {
    return { valid: false, code: "OCCUPIED" };
  }
  return { valid: true };
}
