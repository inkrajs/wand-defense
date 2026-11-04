import { rotateInventoryCells, type InventoryItem } from "@inkra/react/inventory-grid";
import type { Element, GearDefinition, GearInstance, Grade, ItemInstance, SupplyDefinition, SupplyInstance, WandInstance } from "../contracts";
import { demoContent } from "../content/demo";
import { gearDefinitions } from "../content/gear";
import { supplyDefinitions } from "../content/supplies";
import { resolveAsset } from "./assets";

export type DockItem = InventoryItem & (
  | { kind: ItemInstance["kind"]; definitionId: string; grade: Grade; element?: Element }
  | { kind: "wand"; wandId: string; grade: Grade }
  | { kind: "gear"; gearId: string; definitionId?: string; slot: GearInstance["slot"]; grade: Grade }
  | { kind: "supply"; supplyId: string; definitionId: string; grade: Grade }
);
export const INVENTORY_PAGE_ROWS = 5;
export function inventoryDefinition(item: Pick<ItemInstance, "kind" | "definitionId">): typeof demoContent.spells[string] | typeof demoContent.arcana[string];
export function inventoryDefinition(item: DockItem): typeof demoContent.spells[string] | typeof demoContent.arcana[string] | GearDefinition | SupplyDefinition | undefined;
export function inventoryDefinition(item: Pick<ItemInstance, "kind" | "definitionId"> | DockItem) {
  if (item.kind === "wand") return undefined;
  if (item.kind === "spell") return demoContent.spells[item.definitionId];
  if (item.kind === "arcana") return demoContent.arcana[item.definitionId];
  if (item.kind === "gear") return item.definitionId ? gearDefinitions[item.definitionId] : undefined;
  return supplyDefinitions[item.definitionId];
}
export function quarterTurn(rotation: number): 0 | 1 | 2 | 3 {
  return (((rotation / 90) % 4 + 4) % 4) as 0 | 1 | 2 | 3;
}
export function makeGridItem(item: ItemInstance, position: { x: number; y: number }, rotation = 0): DockItem {
  const definition = inventoryDefinition(item);
  return { id: item.id, label: resolveAsset(definition?.asset, { label: definition?.name ?? item.definitionId, icon: item.kind === "spell" ? "✦" : "◇" }).label,
    cells: definition?.shape?.length ? definition.shape : [{ x: 0, y: 0 }], position, rotation: (rotation * 90) as DockItem["rotation"], rotatable: true, kind: item.kind, definitionId: item.definitionId, grade: item.grade, element: item.kind === "spell" ? demoContent.spells[item.definitionId]?.element : undefined };
}
export function makeWandGridItem(wand: WandInstance, position: { x: number; y: number }, rotatable = false, maxPreviewRows?: number): DockItem {
  const rowLimit = maxPreviewRows !== undefined && Number.isFinite(maxPreviewRows) ? Math.max(1, Math.floor(maxPreviewRows)) : wand.height;
  const scale = Math.min(1, rowLimit / wand.height);
  const width = Math.max(1, Math.round(wand.width * scale));
  const height = Math.max(1, Math.round(wand.height * scale));
  return { id: wand.id, wandId: wand.id, kind: "wand", grade: wand.grade, label: wand.name, cells: Array.from({ length: width * height }, (_, index) => ({ x: index % width, y: Math.floor(index / width) })), position, rotatable };
}

export function makeGearGridItem(gear: GearInstance, position: { x: number; y: number }): DockItem {
  const definition = gear.definitionId ? gearDefinitions[gear.definitionId] : undefined;
  return {
    id: gear.id,
    label: definition?.name ?? gear.name,
    cells: [{ x: 0, y: 0 }],
    position,
    rotatable: false,
    kind: "gear",
    gearId: gear.id,
    definitionId: gear.definitionId,
    slot: gear.slot,
    grade: gear.grade,
  };
}

export function makeSupplyGridItem(supply: SupplyInstance, position: { x: number; y: number }): DockItem {
  const definition = supplyDefinitions[supply.definitionId];
  return {
    id: supply.id,
    label: definition?.name ?? supply.definitionId,
    cells: definition?.shape?.length ? definition.shape : [{ x: 0, y: 0 }],
    position,
    rotatable: true,
    kind: "supply",
    supplyId: supply.id,
    definitionId: supply.definitionId,
    grade: supply.grade,
  };
}

export type InventoryLayout = Record<string, { x: number; y: number; rotation: 0 | 90 | 180 | 270 }>;
export const MAX_CONTAINER_CELLS = 4096;

export function minimumRequiredColumns(items: readonly DockItem[]) {
  return Math.max(1, ...items.map(item => {
    const rotations = item.rotatable === false ? [0] as const : [0, 90, 180, 270] as const;
    return Math.min(...rotations.map(rotation => {
      const cells = rotateInventoryCells(item.cells, rotation);
      return Math.max(...cells.map(cell => cell.x)) - Math.min(...cells.map(cell => cell.x)) + 1;
    }));
  }));
}

/** Fill the measured width with 48px touch cells; Inkra adds 4px padding on each side. */
export function columnsForInventoryWidth(width: number, minColumns: number, cellSize = 48) {
  const fits = Math.floor((Math.max(0, width) - 8) / cellSize);
  return Math.max(1, minColumns, fits);
}

/** UI-only packing of real shapes into fixed-width inventory rows. */
export function packInventory(items: DockItem[], columns: number, rows = INVENTORY_PAGE_ROWS, saved: InventoryLayout = {}, pageRows = INVENTORY_PAGE_ROWS) {
  columns = Math.max(1, Math.min(MAX_CONTAINER_CELLS, Math.floor(columns)));
  pageRows = Number.isFinite(pageRows) ? Math.max(1, Math.min(MAX_CONTAINER_CELLS, Math.floor(pageRows))) : INVENTORY_PAGE_ROWS;
  const baseRows = Math.max(pageRows, Math.floor(rows));
  const containerRows = Math.max(1, Math.floor(MAX_CONTAINER_CELLS / columns));
  // Whole-page segments avoid incompatible page/container boundaries stranding otherwise valid shapes.
  const segmentRowLimit = containerRows >= pageRows ? Math.floor(containerRows / pageRows) * pageRows : containerRows;
  const heightBudget = items.reduce((total, item) => {
    const rotations = (item.rotatable === false ? [0] : [0, 90, 180, 270]) as (0 | 90 | 180 | 270)[];
    const heights = rotations.map(rotation => rotateInventoryCells(item.cells, rotation))
      .filter(cells => cells.length > 0 && Math.max(...cells.map(cell => cell.x)) - Math.min(...cells.map(cell => cell.x)) + 1 <= columns)
      .map(cells => Math.max(...cells.map(cell => cell.y)) - Math.min(...cells.map(cell => cell.y)) + 1);
    return total + (heights.length ? Math.min(...heights) + 1 : 0);
  }, 0);
  const naturalBound = baseRows + heightBudget;
  const savedBottom = items.reduce((bottom, item) => {
    const position = saved[item.id];
    if (!position || position.y < 0 || position.y >= naturalBound) return bottom;
    const cells = rotateInventoryCells(item.cells, position.rotation);
    if (!cells.length) return bottom;
    return Math.max(bottom, position.y + Math.max(...cells.map(cell => cell.y)) + 1);
  }, baseRows);
  const requiredBound = Math.max(baseRows, savedBottom) + heightBudget;
  const tallShapeCount = items.filter(item => {
    const rotations = (item.rotatable === false ? [0] : [0, 90, 180, 270]) as (0 | 90 | 180 | 270)[];
    const minHeight = Math.min(...rotations.map(rotation => {
      const cells = rotateInventoryCells(item.cells, rotation);
      return Math.max(...cells.map(cell => cell.y)) - Math.min(...cells.map(cell => cell.y)) + 1;
    }));
    return minHeight > segmentRowLimit / 2;
  }).length;
  const segmentCount = Math.max(1, Math.ceil(requiredBound / segmentRowLimit), tallShapeCount);
  const maxRows = segmentCount * segmentRowLimit;
  const height = maxRows;
  const occupied = new Set<string>();
  const placed: DockItem[] = [];
  const remaining: DockItem[] = [];
  const cellsAt = (item: DockItem, x: number, y: number, rotation: 0 | 90 | 180 | 270) =>
    rotateInventoryCells(item.cells, rotation).map(cell => ({ x: cell.x + x, y: cell.y + y }));
  const fits = (cells: {x:number;y:number}[]) => {
    if (!cells.length || cells.some(cell => cell.x < 0 || cell.x >= columns || cell.y < 0 || cell.y >= height || occupied.has(`${cell.x},${cell.y}`))) return false;
    const page = Math.floor(cells[0].y / pageRows);
    if (cells.some(cell => Math.floor(cell.y / pageRows) !== page)) return false;
    const segment = Math.floor(cells[0].y / segmentRowLimit);
    return cells.every(cell => Math.floor(cell.y / segmentRowLimit) === segment);
  };
  const add = (item: DockItem, x: number, y: number, rotation: 0 | 90 | 180 | 270) => {
    cellsAt(item, x, y, rotation).forEach(cell => occupied.add(`${cell.x},${cell.y}`));
    placed.push({ ...item, position: { x, y }, rotation });
  };
  for (const item of items) {
    const position = saved[item.id];
    if (position && position.y < naturalBound && fits(cellsAt(item, position.x, position.y, position.rotation))) add(item, position.x, position.y, position.rotation);
    else remaining.push(item);
  }
  const unplaced: DockItem[] = [];
  const nextSearchByShape = new Map<string, { y: number; x: number }>();
  for (const item of remaining) {
    let found = false;
    const rotations: (0 | 90 | 180 | 270)[] = item.rotatable === false ? [0] : [0, 90, 180, 270];
    const fitsAnyPage = rotations.some(rotation => {
      const shape = rotateInventoryCells(item.cells, rotation);
      return shape.length > 0
        && Math.max(...shape.map(cell => cell.x)) - Math.min(...shape.map(cell => cell.x)) + 1 <= columns
        && Math.max(...shape.map(cell => cell.y)) - Math.min(...shape.map(cell => cell.y)) + 1 <= pageRows;
    });
    if (!fitsAnyPage) { unplaced.push(item); continue; }
    const shapeKey = `${item.rotatable === false ? "fixed" : "rotatable"}:${JSON.stringify(item.cells)}`;
    const start = nextSearchByShape.get(shapeKey) ?? { y: 0, x: 0 };
    for (let y = start.y; y < height && !found; y++) {
      for (let x = y === start.y ? start.x : 0; x < columns && !found; x++) {
        for (const rotation of rotations) if (fits(cellsAt(item, x, y, rotation))) {
          add(item, x, y, rotation);
          nextSearchByShape.set(shapeKey, x + 1 < columns ? { y, x: x + 1 } : { y: y + 1, x: 0 });
          found = true;
          break;
        }
      }
    }
    if (!found) nextSearchByShape.set(shapeKey, { y: height, x: 0 });
    if (!found) unplaced.push(item);
  }
  const usedRows = placed.reduce((bottom, item) => Math.max(bottom, item.position.y + Math.max(...rotateInventoryCells(item.cells, item.rotation).map(cell => cell.y)) + 1), baseRows);
  const segmentTotal = Math.max(1, Math.ceil(usedRows / segmentRowLimit));
  const segments = Array.from({ length: segmentTotal }, (_, index) => {
    const rowOffset = index * segmentRowLimit;
    const segmentRows = Math.min(segmentRowLimit, usedRows - rowOffset);
    return {
      rowOffset,
      rows: segmentRows,
      items: placed.filter(item => Math.floor(item.position.y / segmentRowLimit) === index)
        .map(item => ({ ...item, position: { x: item.position.x, y: item.position.y - rowOffset } })),
    };
  });
  return { items: placed, unplaced, rows: usedRows, segments, segmentRowLimit };
}
