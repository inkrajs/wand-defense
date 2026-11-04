import { INVENTORY_PAGE_ROWS, packInventory, type DockItem, type InventoryLayout } from "./inventoryAdapter";
import type { GameEvent } from "../contracts";

const MAX_LAYOUT_ITEM_BUDGET = 10_000;

/** Zero-width startup renders are provisional and must not seed cached positions. */
export function hasMeasuredInventoryWidth(width: number): boolean {
  return Number.isFinite(width) && width > 0;
}

/** Session-only UI memory; stale entries let an item reclaim its old spot if it returns. */
export type InventoryLayoutState = {
  columns: number;
  positions: InventoryLayout;
  /** IDs moved by the player; generated packing coordinates are intentionally excluded. */
  manualIds?: string[];
  /** Legacy coordinates whose author is unknown; keep them until reviewed. */
  unclassifiedIds?: string[];
  activeIds: string[];
  /** Greatest validated layout extent; bounds cached coordinates after removals. */
  extentRows: number;
  /** Historical item count bounds extentRows when inventory contents later shrink. */
  itemBudget: number;
};

export type InventoryLayoutProjection = {
  packed: ReturnType<typeof packInventory>;
  state: InventoryLayoutState;
  widthChanged: boolean;
};

/** Keeps valid saved spots fixed; new items are packed into currently free cells. */
export function projectInventoryLayout(
  items: DockItem[],
  columns: number,
  previous?: InventoryLayoutState,
  minRows = INVENTORY_PAGE_ROWS,
  pageRows = INVENTORY_PAGE_ROWS,
): InventoryLayoutProjection {
  const previousState = previous ?? { columns, positions: {}, manualIds: [], unclassifiedIds: [], activeIds: [], extentRows: minRows, itemBudget: Math.max(1, items.length) };
  const unclassifiedIds = previous?.unclassifiedIds ?? (previous && previous.manualIds === undefined ? Object.keys(previous.positions) : []);
  const itemBudget = Math.max(1, Math.min(MAX_LAYOUT_ITEM_BUDGET, Math.max(previousState.itemBudget ?? 0, previousState.activeIds.length, items.length)));
  const validatedExtent = Math.max(minRows, Math.min(
    Number.isSafeInteger(previousState.extentRows) && previousState.extentRows > 0 ? previousState.extentRows : minRows,
    4096 * itemBudget,
  ));
  const previousActive = new Set(previousState.activeIds);
  const orderedItems = [...items].sort((left, right) => Number(previousActive.has(right.id)) - Number(previousActive.has(left.id)));
  const liveIds = new Set(items.map(item => item.id));
  const validPositions = Object.fromEntries(Object.entries(previousState.positions).filter(([, position]) =>
    Number.isSafeInteger(position.x) && position.x >= 0
    && Number.isSafeInteger(position.y) && position.y >= 0 && position.y < validatedExtent
    && [0, 90, 180, 270].includes(position.rotation)));
  const previousExtent = items.reduce((bottom, item) => {
    const position = validPositions[item.id];
    return position ? Math.max(bottom, position.y + 1) : bottom;
  }, minRows);
  const packed = packInventory(orderedItems, columns, previousExtent, validPositions, pageRows);
  const positions = { ...validPositions };
  for (const item of packed.items) positions[item.id] = { ...item.position, rotation: item.rotation ?? 0 };
  const extentRows = Math.max(validatedExtent, packed.rows, ...Object.values(positions).map(position => position.y + 1));
  return {
    packed,
    widthChanged: previousState.columns !== columns,
    state: { columns, positions, manualIds: previousState.manualIds ?? [], unclassifiedIds, activeIds: [...liveIds], extentRows, itemBudget },
  };
}

/** Uses the authoritative merge event to transfer the target spot and release the source. */
export function carryMergeLayout(state: InventoryLayoutState, event: GameEvent): InventoryLayoutState {
  if (event.type !== "itemsMerged") return state;
  const { targetItemId, sourceItemId, outputItemId } = event.data;
  if (typeof targetItemId !== "string" || typeof sourceItemId !== "string" || typeof outputItemId !== "string") return state;
  const positions = { ...state.positions };
  const targetPosition = positions[targetItemId];
  const targetWasManual = state.manualIds?.includes(targetItemId) ?? false;
  const targetWasUnclassified = state.unclassifiedIds?.includes(targetItemId) ?? state.manualIds === undefined;
  delete positions[targetItemId];
  delete positions[sourceItemId];
  if (targetPosition) positions[outputItemId] = targetPosition;
  return {
    ...state,
    positions,
    manualIds: [...(state.manualIds ?? []).filter(id => id !== targetItemId && id !== sourceItemId), ...(targetWasManual && targetPosition ? [outputItemId] : [])],
    unclassifiedIds: [...(state.unclassifiedIds ?? []).filter(id => id !== targetItemId && id !== sourceItemId), ...(targetWasUnclassified && targetPosition ? [outputItemId] : [])],
    activeIds: [...state.activeIds.filter(id => id !== targetItemId && id !== sourceItemId), outputItemId],
    extentRows: Math.max(state.extentRows, targetPosition ? targetPosition.y + 1 : 0),
  };
}

/** Stores a user-authored bag position with its global row offset already applied. */
export function rememberInventoryPosition(
  state: InventoryLayoutState,
  itemId: string,
  position: InventoryLayout[string],
): InventoryLayoutState {
  if (!Number.isSafeInteger(position.x) || position.x < 0 || !Number.isSafeInteger(position.y) || position.y < 0 || ![0, 90, 180, 270].includes(position.rotation)) return state;
  return {
    ...state,
    positions: { ...state.positions, [itemId]: { ...position } },
    manualIds: state.manualIds?.includes(itemId) ? state.manualIds : [...(state.manualIds ?? []), itemId],
    unclassifiedIds: (state.unclassifiedIds ?? []).filter(id => id !== itemId),
    activeIds: state.activeIds.includes(itemId) ? state.activeIds : [...state.activeIds, itemId],
    extentRows: Math.max(state.extentRows, position.y + 1),
  };
}

/** Explicit permanent removal; ordinary transfers keep the stale coordinate cache. */
export function forgetInventoryLayoutItem(state: InventoryLayoutState, itemId: string): InventoryLayoutState {
  const positions = { ...state.positions };
  delete positions[itemId];
  return { ...state, positions, manualIds: (state.manualIds ?? []).filter(id => id !== itemId), unclassifiedIds: (state.unclassifiedIds ?? []).filter(id => id !== itemId), activeIds: state.activeIds.filter(id => id !== itemId) };
}
