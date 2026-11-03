import { packInventory, type DockItem, type InventoryLayout } from "./inventoryAdapter";
import type { GameEvent } from "../contracts";

const MAX_LAYOUT_ITEM_BUDGET = 10_000;

/** Session-only UI memory; stale entries let an item reclaim its old spot if it returns. */
export type InventoryLayoutState = {
  columns: number;
  positions: InventoryLayout;
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
  minRows = 3,
): InventoryLayoutProjection {
  const previousState = previous ?? { columns, positions: {}, activeIds: [], extentRows: minRows, itemBudget: Math.max(1, items.length) };
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
  const packed = packInventory(orderedItems, columns, previousExtent, validPositions);
  const positions = { ...validPositions };
  for (const item of packed.items) positions[item.id] = { ...item.position, rotation: item.rotation ?? 0 };
  const extentRows = Math.max(validatedExtent, packed.rows, ...Object.values(positions).map(position => position.y + 1));
  return {
    packed,
    widthChanged: previousState.columns !== columns,
    state: { columns, positions, activeIds: [...liveIds], extentRows, itemBudget },
  };
}

/** Uses the authoritative merge event to transfer the target spot and release the source. */
export function carryMergeLayout(state: InventoryLayoutState, event: GameEvent): InventoryLayoutState {
  if (event.type !== "itemsMerged") return state;
  const { targetItemId, sourceItemId, outputItemId } = event.data;
  if (typeof targetItemId !== "string" || typeof sourceItemId !== "string" || typeof outputItemId !== "string") return state;
  const positions = { ...state.positions };
  const targetPosition = positions[targetItemId];
  delete positions[targetItemId];
  delete positions[sourceItemId];
  if (targetPosition) positions[outputItemId] = targetPosition;
  return {
    ...state,
    positions,
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
    activeIds: state.activeIds.includes(itemId) ? state.activeIds : [...state.activeIds, itemId],
    extentRows: Math.max(state.extentRows, position.y + 1),
  };
}

/** Explicit permanent removal; ordinary transfers keep the stale coordinate cache. */
export function forgetInventoryLayoutItem(state: InventoryLayoutState, itemId: string): InventoryLayoutState {
  const positions = { ...state.positions };
  delete positions[itemId];
  return { ...state, positions, activeIds: state.activeIds.filter(id => id !== itemId) };
}
