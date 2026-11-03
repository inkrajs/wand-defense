import { getGameItemAppearance } from "./itemAppearance";
import { GameTabsList } from "./GameTabsList";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, InventoryGrid, PencilIcon, PencilText, Tabs, Tooltip } from "@inkra/react";
import type { InventoryChangeDetails, InventoryContainer, InventoryGridProps, InventoryItemRenderState, InventoryPlacement } from "@inkra/react/inventory-grid";
import type { Command, CommandResult, GameState, GearSlot } from "../contracts";
import { columnsForInventoryWidth, INVENTORY_PAGE_ROWS, inventoryDefinition as definitionFor, makeGearGridItem, makeGridItem, makeSupplyGridItem, makeWandGridItem, minimumRequiredColumns, packInventory, quarterTurn, type DockItem } from "./inventoryAdapter";
import { localInventoryCombineCompat } from "./inventoryCombineCompat";
import { carryMergeLayout, hasMeasuredInventoryWidth, projectInventoryLayout, rememberInventoryPosition, type InventoryLayoutState } from "./inventoryLayoutState";
import { AssetImage, resolveAsset } from "./assets";
import { getWandDetailLabel, WandPreview } from "./WandMiniatures";
import { WandClearButton } from "./WandClearButton";
import { getMagicPresentationIcon, MagicPresentationIcon } from "./magicPresentationIcons";
import { enrichMagicReward } from "../content/magicDescriptions";
import { demoContent } from "../content/demo";
import { getGearPresentationIcon, GearPresentationIcon } from "./gearPresentationIcons";
import { getSupplyPresentationIcon, SupplyPresentationIcon } from "./supplyPresentationIcons";
import "./InventoryDock.css";

type InventoryGridHandle = { cancelDrag(): void };
type Category = "items" | "spells" | "equipment" | "supplies";
type LocalGridProps = InventoryGridProps<DockItem> & { children: React.ReactNode; canCombine?: (context: { sourceItem: DockItem; targetItem: DockItem }) => boolean; onCombine?: (context: { sourceItem: DockItem; targetItem: DockItem }) => void };
type LocalDropContext = { sourceItem: DockItem; source: InventoryPlacement | InventoryContainer<DockItem>; targetId: string; rotation: DockItem["rotation"]; containers: readonly InventoryContainer<DockItem>[] };
type LocalDropTargetProps = { targetId: string; label: string; disabled?: boolean; className?: string; canDrop?: (context: LocalDropContext) => boolean; onDrop: (context: LocalDropContext) => void; children: (state: { isDragging: boolean; isOver: boolean; canDrop: boolean }) => React.ReactNode };
type LocalGridApi = { Root?: React.ComponentType<LocalGridProps>; Container?: React.ComponentType<{ containerId: string; showHeader?: boolean; className?: string; style?: React.CSSProperties }>; DropTarget?: React.ComponentType<LocalDropTargetProps> };
const GRID_CELL_SIZE = 48;
const categoryIcons = {
  items: [{d:"M4 8h16v12H4zM8 8V5h8v3", mode:"stroke" as const}],
  spells: [{d:"M12 3 14 9l6 3-6 3-2 6-2-6-6-3 6-3 2-6Z", mode:"stroke" as const}],
  equipment: [{d:"M5 19 19 5M16 4l3 1 1 3", mode:"stroke" as const}],
  supplies: [{d:"M9 3h6v3l2 2v12H7V8l2-2V3ZM8 11h8M10 15h4", mode:"stroke" as const}],
};
const trashPaths = [{ d: "M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6", mode: "stroke" as const }];
const arrangePaths = [{ d: "M4 6h16M4 12h10M4 18h6M17 10l3 2-3 2M12 16l3 2-3 2", mode: "stroke" as const }];
const gearSlotLabels: Record<GearSlot, string> = { head: "头部", body: "身体", feet: "足部", accessory: "饰品" };
type Props = { category: Category; state: GameState; dispatch: (command: Command) => CommandResult; activeCharacterId: string; showWands?: boolean; showLoadout?: boolean; onCategoryChange?: (category: Category) => void; onWandAreaHeightChange?: (height: number) => void };
type PendingStorageMove = { kind: "spell" | "equipment"; itemId: string; position: { x: number; y: number; rotation: 0 | 90 | 180 | 270 } };

function magicIcon(item: DockItem) {
  return item.kind === "spell" || item.kind === "arcana" ? getMagicPresentationIcon(item.definitionId) : undefined;
}
function magicItemLabel(item: DockItem) {
  const definition = definitionFor(item);
  if (!definition || (item.kind !== "spell" && item.kind !== "arcana")) return item.label ?? item.id;
  const reward = enrichMagicReward({ id: item.id, kind: "item", definitionId: item.definitionId, label: item.label ?? item.id, grade: item.grade }, demoContent);
  return [item.label ?? definition.name, reward.description].filter(Boolean).join("。 ");
}
function MagicItemTooltip({ label, children }: { label: string; children: ReactNode }) {
  return <Tooltip.Provider delayDuration={300}><Tooltip.Root>
    <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
    <Tooltip.Portal><Tooltip.Content side="top">{label}</Tooltip.Content></Tooltip.Portal>
  </Tooltip.Root></Tooltip.Provider>;
}
function GearSlotIcon({ slot, definitionId, size, seed }: { slot: GearSlot; definitionId?: string; size: number; seed: string }) {
  if (definitionId && getGearPresentationIcon(definitionId)) {
    return <GearPresentationIcon definitionId={definitionId} size={size} seed={seed} />;
  }
  const d = slot === "head"
    ? "M4 11a8 8 0 0 1 16 0v3H4zM7 14v5h10v-5M4 11h16"
    : slot === "body"
      ? "M7 4 3 8l3 3v9h12v-9l3-3-4-4-3 3h-4z"
      : slot === "feet"
        ? "M6 4v10l-2 4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2l-4-4V4"
        : "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v10M7 12h10";
  return <PencilIcon paths={[{ d, mode: "stroke" }]} size={size} sourceSize={24} seed={seed} decorative />;
}

function packedContainers(prefix: string, label: string, packed: ReturnType<typeof packInventory>, columns: number): InventoryContainer<DockItem>[] {
  return packed.segments.map((segment, index) => ({
    id: `${prefix}:${segment.rowOffset}`,
    label: index === 0 ? label : `${label} ${index + 1}`,
    columns,
    rows: segment.rows,
    items: segment.items,
  }));
}
function filterPackedItems(packed: ReturnType<typeof packInventory>, predicate: (item: DockItem) => boolean): ReturnType<typeof packInventory> {
  return {
    ...packed,
    items: packed.items.filter(predicate),
    unplaced: packed.unplaced.filter(predicate),
    segments: packed.segments.map(segment => ({ ...segment, items: segment.items.filter(predicate) })),
  };
}
function extendPackedRows(packed: ReturnType<typeof packInventory>, rows: number): ReturnType<typeof packInventory> {
  const totalRows = Math.max(INVENTORY_PAGE_ROWS, Math.ceil(Math.max(rows, packed.rows) / INVENTORY_PAGE_ROWS) * INVENTORY_PAGE_ROWS);
  const segmentCount = Math.max(1, totalRows / INVENTORY_PAGE_ROWS);
  const pageItems = Array.from({ length: segmentCount }, () => [] as DockItem[]);
  for (const item of packed.items) {
    const page = Math.floor(item.position.y / INVENTORY_PAGE_ROWS);
    if (page < pageItems.length) pageItems[page].push({ ...item, position: { ...item.position, y: item.position.y - page * INVENTORY_PAGE_ROWS } });
  }
  return {
    ...packed,
    rows: totalRows,
    segments: Array.from({ length: segmentCount }, (_, index) => {
      const rowOffset = index * INVENTORY_PAGE_ROWS;
      return {
        rowOffset,
        rows: INVENTORY_PAGE_ROWS,
        items: pageItems[index],
      };
    }),
  };
}
function sameLayoutState(left: InventoryLayoutState | undefined, right: InventoryLayoutState) {
  return Boolean(left
    && left.columns === right.columns
    && left.extentRows === right.extentRows
    && left.itemBudget === right.itemBudget
    && JSON.stringify(left.manualIds ?? []) === JSON.stringify(right.manualIds ?? [])
    && JSON.stringify(left.unclassifiedIds ?? []) === JSON.stringify(right.unclassifiedIds ?? [])
    && left.activeIds.length === right.activeIds.length
    && left.activeIds.every((id, index) => id === right.activeIds[index])
    && JSON.stringify(left.positions) === JSON.stringify(right.positions));
}
function isStorageContainer(id: string, prefix: string) { return id === prefix || id.startsWith(`${prefix}:`); }
function storageRowOffset(id: string) {
  const offset = Number(id.slice(id.lastIndexOf(":") + 1));
  return Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
}
function wandIdFromContainer(id: string) { return id.startsWith("wand:") ? id.slice("wand:".length) : ""; }
function characterIdFromGearContainer(id: string) { return id.startsWith("character:") ? id.slice("character:".length).split(":wand-slot:")[0] : ""; }
function wandSlotIndexFromGearContainer(id: string): 0 | 1 | undefined {
  const match = id.match(/:wand-slot:([01])$/);
  return match ? Number(match[1]) as 0 | 1 : undefined;
}
function dropSourceContainerId(source: InventoryPlacement | InventoryContainer<DockItem>) {
  return "containerId" in source ? source.containerId : source.id;
}

export function InventoryDock({ category, state, dispatch, activeCharacterId, showWands = true, showLoadout = false, onCategoryChange, onWandAreaHeightChange }: Props) {
  const [pageIndex, setPageIndex] = useState(0);
  const measureRef = useRef<HTMLDivElement>(null);
  const topAreaRef = useRef<HTMLDivElement>(null);
  const [loadoutTargets, setLoadoutTargets] = useState<HTMLElement[]>([]);
  const [gearTargets, setGearTargets] = useState<Partial<Record<GearSlot, HTMLElement>>>({});
  const [availableWidth, setAvailableWidth] = useState(0);
  useLayoutEffect(() => {
    const node = measureRef.current;
    if (!node) return;
    const update = () => setAvailableWidth(node.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (!onWandAreaHeightChange) return;
    const node = topAreaRef.current;
    if (!node) {
      onWandAreaHeightChange(0);
      return;
    }
    // offsetHeight reports the full untransformed flex-wrap area, including
    // both equipped wands when narrow layouts wrap them onto separate rows.
    const reportHeight = () => onWandAreaHeightChange(node.getBoundingClientRect().height);
    reportHeight();
    const observer = new ResizeObserver(reportHeight);
    observer.observe(node);
    window.addEventListener("resize", reportHeight);
    return () => { observer.disconnect(); window.removeEventListener("resize", reportHeight); };
  }, [activeCharacterId, category, showWands, showLoadout, onWandAreaHeightChange]);
  useLayoutEffect(() => {
    if (!showLoadout || category !== "equipment") { setLoadoutTargets([]); return; }
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-character-wand-slot]"));
    setLoadoutTargets(targets);
  }, [activeCharacterId, category, showLoadout]);
  useLayoutEffect(() => {
    if (!showLoadout || category !== "items") { setGearTargets({}); return; }
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-character-gear-slot]"));
    const mapped: Partial<Record<GearSlot, HTMLElement>> = {};
    for (const target of targets) {
      const slot = target.dataset.characterGearSlot as GearSlot | undefined;
      if (slot === "head" || slot === "body" || slot === "feet" || slot === "accessory") mapped[slot] = target;
    }
    setGearTargets(mapped);
  }, [activeCharacterId, category, showLoadout]);
  const [result, setResult] = useState<CommandResult | null>(null);
  const [selectedSupplyId, setSelectedSupplyId] = useState<string | null>(null);
  const [spellLayout, setSpellLayout] = useState<InventoryLayoutState>();
  const [equipmentLayout, setEquipmentLayout] = useState<InventoryLayoutState>();
  const [gearLayout, setGearLayout] = useState<InventoryLayoutState>();
  const [supplyLayout, setSupplyLayout] = useState<InventoryLayoutState>();
  const inventoryGridHandle = useRef<InventoryGridHandle>(null);
  const [pendingStorageMoves, setPendingStorageMoves] = useState<Record<string, PendingStorageMove>>({});
  const [mergeEventCursor, setMergeEventCursor] = useState(state.nextEventSeq);
  const primaryCharacter = state.characters.find((character) => character.id === activeCharacterId) ?? state.characters[0];
  const activeWands = useMemo(() => state.wands.filter(entry => entry.characterId === primaryCharacter?.id && primaryCharacter.wandIds.includes(entry.id)), [primaryCharacter, state.wands]);

  const spellItems = useMemo(() => state.backpack.flatMap(id => state.items[id] ? [makeGridItem(state.items[id], { x: 0, y: 0 })] : []), [state.backpack, state.items]);
  const storedWandItems = useMemo(() => state.wands.filter(entry => entry.characterId === null).map(entry => makeWandGridItem(entry, { x: 0, y: 0 }, true)), [state.wands]);
  const gearItems = useMemo(() => Object.values(state.gear ?? {}).filter(entry => entry.characterId === null).map(entry => makeGearGridItem(entry, { x: 0, y: 0 })), [state.gear]);
  const supplyItems = useMemo(() => Object.values(state.supplies ?? {}).map(entry => makeSupplyGridItem(entry, { x: 0, y: 0 })), [state.supplies]);
  const spellColumns = columnsForInventoryWidth(availableWidth, minimumRequiredColumns(spellItems), GRID_CELL_SIZE);
  const equipmentColumns = columnsForInventoryWidth(availableWidth, minimumRequiredColumns(storedWandItems), GRID_CELL_SIZE);
  const gearColumns = columnsForInventoryWidth(availableWidth, minimumRequiredColumns(gearItems), GRID_CELL_SIZE);
  const supplyColumns = columnsForInventoryWidth(availableWidth, minimumRequiredColumns(supplyItems), GRID_CELL_SIZE);
  const activeColumns = category === "equipment" ? equipmentColumns : category === "items" ? gearColumns : category === "supplies" ? supplyColumns : spellColumns;
  const pendingMergeEvents = useMemo(() => state.events.filter(event => event.seq >= mergeEventCursor && event.type === "itemsMerged"), [state.events, mergeEventCursor]);
  const spellLayoutAfterMerges = useMemo(() => spellLayout && pendingMergeEvents.length
    ? pendingMergeEvents.reduce(carryMergeLayout, spellLayout)
    : spellLayout, [spellLayout, pendingMergeEvents]);
  const spellProjection = useMemo(() => projectInventoryLayout(spellItems, spellColumns, spellLayoutAfterMerges), [spellItems, spellColumns, spellLayoutAfterMerges]);
  const equipmentProjection = useMemo(() => projectInventoryLayout(storedWandItems, equipmentColumns, equipmentLayout), [storedWandItems, equipmentColumns, equipmentLayout]);
  const gearProjection = useMemo(() => projectInventoryLayout(gearItems, gearColumns, gearLayout), [gearItems, gearColumns, gearLayout]);
  const supplyProjection = useMemo(() => projectInventoryLayout(supplyItems, supplyColumns, supplyLayout), [supplyItems, supplyColumns, supplyLayout]);
  const sharedRows = Math.max(INVENTORY_PAGE_ROWS, spellProjection.packed.rows, equipmentProjection.packed.rows, gearProjection.packed.rows, supplyProjection.packed.rows);
  const spellPacked = extendPackedRows(spellProjection.packed, sharedRows);
  const equipmentPacked = extendPackedRows(equipmentProjection.packed, sharedRows);
  const gearPacked = extendPackedRows(gearProjection.packed, sharedRows);
  const supplyPacked = extendPackedRows(supplyProjection.packed, sharedRows);
  const pageCount = Math.max(1, spellPacked.segments.length, equipmentPacked.segments.length, gearPacked.segments.length, supplyPacked.segments.length);
  useEffect(() => setPageIndex(current => Math.min(current, pageCount - 1)), [pageCount]);

  // Advance the cursor only after the event-adjusted projection has been committed.
  // Its layout effect below persists the target-to-output coordinate migration.
  useEffect(() => {
    if (!pendingMergeEvents.length) return;
    setMergeEventCursor(state.nextEventSeq);
  }, [pendingMergeEvents, state.nextEventSeq]);
  useLayoutEffect(() => {
    if (!hasMeasuredInventoryWidth(availableWidth)) return;
    if (!sameLayoutState(spellLayout, spellProjection.state)) setSpellLayout(spellProjection.state);
    if (!sameLayoutState(equipmentLayout, equipmentProjection.state)) setEquipmentLayout(equipmentProjection.state);
    if (!sameLayoutState(gearLayout, gearProjection.state)) setGearLayout(gearProjection.state);
    if (!sameLayoutState(supplyLayout, supplyProjection.state)) setSupplyLayout(supplyProjection.state);
  }, [availableWidth, spellLayout, spellProjection.state, equipmentLayout, equipmentProjection.state, gearLayout, gearProjection.state, supplyLayout, supplyProjection.state]);
  useEffect(() => {
    const settled: string[] = [];
    for (const event of state.events) {
      const commandId = event.data.commandId;
      if (typeof commandId !== "string") continue;
      const move = pendingStorageMoves[commandId];
      if (!move) continue;
      if (move.kind === "spell" && event.type === "itemRemoved" && event.data.itemId === move.itemId) {
        setSpellLayout(layout => rememberInventoryPosition(layout ?? spellProjection.state, move.itemId, move.position));
        settled.push(commandId);
      } else if (move.kind === "equipment" && event.type === "wandUnequipped" && event.data.wandId === move.itemId) {
        setEquipmentLayout(layout => rememberInventoryPosition(layout ?? equipmentProjection.state, move.itemId, move.position));
        settled.push(commandId);
      }
    }
    if (settled.length) setPendingStorageMoves(current => Object.fromEntries(Object.entries(current).filter(([id]) => !settled.includes(id))));
  }, [state.events, pendingStorageMoves, spellProjection.state, equipmentProjection.state]);
  const inventory = useMemo((): { containers: InventoryContainer<DockItem>[]; overflow: number } => {
    if (category === "equipment") {
      const maxWidth = Math.max(1, ...state.wands.map((entry) => entry.width));
      const maxHeight = Math.max(1, ...state.wands.map((entry) => entry.height));
      const storedWands = equipmentPacked;
      const storageContainers = packedContainers("equipment-backpack", "未装备法杖", storedWands, equipmentColumns).filter(container => container.id === `equipment-backpack:${pageIndex * INVENTORY_PAGE_ROWS}`);
      const activeGear: InventoryContainer<DockItem>[] = primaryCharacter ? [0, 1].map(slotIndex => {
        const wandId = primaryCharacter.wandIds[slotIndex];
        const equipped = state.wands.find(entry => entry.id === wandId && entry.characterId === primaryCharacter.id);
        return {
          id: `character:${primaryCharacter.id}:wand-slot:${slotIndex}`,
          label: `${primaryCharacter.name} 法杖位 ${slotIndex + 1}`,
          columns: maxWidth,
          rows: maxHeight,
          items: equipped ? [makeWandGridItem(equipped, { x: 0, y: 0 })] : [],
        };
      }) : [];
      return { containers: [...storageContainers, ...activeGear], overflow: storedWands.unplaced.length };
    }
    if (category === "items") {
      const storageContainers = packedContainers("gear-backpack", "未装备装备", gearPacked, gearColumns).filter(container => container.id === `gear-backpack:${pageIndex * INVENTORY_PAGE_ROWS}`);
      return { containers: storageContainers, overflow: gearPacked.unplaced.length };
    }
    if (category === "supplies") {
      const storageContainers = packedContainers("supplies", "道具", supplyPacked, supplyColumns).filter(container => container.id === `supplies:${pageIndex * INVENTORY_PAGE_ROWS}`);
      return { containers: storageContainers, overflow: supplyPacked.unplaced.length };
    }
    const wandContainers: InventoryContainer<DockItem>[] = category === "spells" ? activeWands.map(activeWand => ({
      id: `wand:${activeWand.id}`,
      label: activeWand.name,
      columns: activeWand.width,
      rows: activeWand.height,
      items: activeWand.placements.flatMap(placement => {
        const instance = state.items[placement.itemId];
        return instance ? [makeGridItem(instance, { x: placement.x, y: placement.y }, placement.rotation)] : [];
      }),
    })) : [];
    const storageContainers = packedContainers("backpack", "背包", spellPacked, spellColumns).filter(container => container.id === `backpack:${pageIndex * INVENTORY_PAGE_ROWS}`);
    return { containers: [...wandContainers, ...storageContainers], overflow: spellPacked.unplaced.length };

  }, [activeWands, category, spellPacked, equipmentPacked, gearPacked, supplyPacked, state.characters, state.items, state.wands, primaryCharacter, spellColumns, equipmentColumns, gearColumns, supplyColumns, pageIndex]);

  function onInventoryChange(_next: readonly InventoryContainer<DockItem>[], details: InventoryChangeDetails) {
    const { from, to } = details;
    if (category === "equipment") {
      const fromStore = isStorageContainer(from.containerId, "equipment-backpack");
      const toStore = isStorageContainer(to.containerId, "equipment-backpack");
      const toPosition = { x: to.position.x, y: to.position.y + (toStore ? storageRowOffset(to.containerId) : 0), rotation: to.rotation };
      if (fromStore && toStore) {
        setEquipmentLayout(layout => rememberInventoryPosition(layout ?? equipmentProjection.state, from.itemId, toPosition));
        return;
      }
      let command: Command | null = null;
      if (fromStore && characterIdFromGearContainer(to.containerId) && wandSlotIndexFromGearContainer(to.containerId) !== undefined) {
        command = { id: commandId(), type: "equipWand", wandId: from.itemId, characterId: characterIdFromGearContainer(to.containerId), slot: wandSlotIndexFromGearContainer(to.containerId) };
      } else if (characterIdFromGearContainer(from.containerId) && toStore) {
        command = { id: commandId(), type: "unequipWand", wandId: from.itemId };
      }
      if (command) {
        const response = dispatch(command);
        setResult(response);
        if (response.status === "executed" && characterIdFromGearContainer(from.containerId) && toStore) {
          setEquipmentLayout(layout => rememberInventoryPosition(layout ?? equipmentProjection.state, from.itemId, toPosition));
        } else if (response.status === "accepted" && characterIdFromGearContainer(from.containerId) && toStore) {
          setPendingStorageMoves(moves => ({ ...moves, [command.id]: { kind: "equipment", itemId: from.itemId, position: toPosition } }));
        }
      }
      return;
    }
    const storagePrefix = category === "items" ? "gear-backpack" : category === "supplies" ? "supplies" : "backpack";
    const fromBackpack = isStorageContainer(from.containerId, storagePrefix);
    const toBackpack = isStorageContainer(to.containerId, storagePrefix);
    const sourceWandId = wandIdFromContainer(from.containerId);
    const targetWandId = wandIdFromContainer(to.containerId);
    const toPosition = { x: to.position.x, y: to.position.y + (toBackpack ? storageRowOffset(to.containerId) : 0), rotation: to.rotation };
    if (fromBackpack && toBackpack) {
      if (category === "items") setGearLayout(layout => rememberInventoryPosition(layout ?? gearProjection.state, from.itemId, toPosition));
      else if (category === "supplies") setSupplyLayout(layout => rememberInventoryPosition(layout ?? supplyProjection.state, from.itemId, toPosition));
      else setSpellLayout(layout => rememberInventoryPosition(layout ?? spellProjection.state, from.itemId, toPosition));
      return;
    }
    if (category !== "spells") return;
    const command: Command | null = fromBackpack && targetWandId
      ? { id: commandId(), type: "placeItem", wandId: targetWandId, itemId: from.itemId, x: to.position.x, y: to.position.y, rotation: quarterTurn(to.rotation) }
      : sourceWandId && toBackpack
        ? { id: commandId(), type: "removeItem", wandId: sourceWandId, itemId: from.itemId }
        : sourceWandId && targetWandId === sourceWandId
          ? { id: commandId(), type: "placeItem", wandId: sourceWandId, itemId: from.itemId, x: to.position.x, y: to.position.y, rotation: quarterTurn(to.rotation) }
          : null;
    if (!command) return;
    const response = dispatch(command);
    setResult(response);
    if (sourceWandId && toBackpack && response.status === "executed") {
      setSpellLayout(layout => rememberInventoryPosition(layout ?? spellProjection.state, from.itemId, toPosition));
    } else if (sourceWandId && toBackpack && response.status === "accepted") {
      setPendingStorageMoves(moves => ({ ...moves, [command.id]: { kind: "spell", itemId: from.itemId, position: toPosition } }));
    }
  }

  const storagePrefix = category === "equipment" ? "equipment-backpack" : category === "items" ? "gear-backpack" : category === "supplies" ? "supplies" : "backpack";
  const storageContainers = inventory.containers.filter(container => isStorageContainer(container.id, storagePrefix));
  const wandContainers = inventory.containers.filter(container => container.id.startsWith("wand:"));
  const equipmentContainers = inventory.containers.filter(container => container.id.startsWith("character:"));
  const localGridFeatures = InventoryGrid as unknown as LocalGridApi;
  const localGrid = import.meta.env.INKRA_LOCAL === true && Boolean(localGridFeatures.Root && localGridFeatures.Container);
  const GridRoot = localGridFeatures.Root ?? (({ children }: LocalGridProps) => <>{children}</>);
  const GridContainer = localGridFeatures.Container ?? (() => null);
  const DropTarget = localGridFeatures.DropTarget;
  const combineProps = localInventoryCombineCompat(localGrid, state, dispatch, setResult);
  const gridProps = {
    "aria-label": "法杖和背包物品",
    ...(localGrid ? { handleRef: inventoryGridHandle } : {}),
    className: "inventory-dock__grid",
    containers: inventory.containers,
    cellSize: GRID_CELL_SIZE,
    disabled: state.phase === "battle" && !state.paused,
    allowRotation: true,
    canPlace: ({ item, source, target }: Parameters<NonNullable<InventoryGridProps<DockItem>["canPlace"]>>[0]) => {
      if (category === "equipment") {
        const sourceStore = isStorageContainer(source.id, "equipment-backpack");
        const targetStore = isStorageContainer(target.id, "equipment-backpack");
        const sourceCharacter = Boolean(characterIdFromGearContainer(source.id));
        const targetCharacter = Boolean(characterIdFromGearContainer(target.id));
        return item.kind === "wand" && ((sourceStore && targetStore) || (sourceStore && targetCharacter) || (sourceCharacter && targetStore));
      }
      if (category === "items") return item.kind === "gear" && isStorageContainer(source.id, "gear-backpack") && isStorageContainer(target.id, "gear-backpack");
      if (category === "supplies") return item.kind === "supply" && isStorageContainer(source.id, "supplies") && isStorageContainer(target.id, "supplies");
      const sourceBag = isStorageContainer(source.id, "backpack");
      const targetBag = isStorageContainer(target.id, "backpack");
      const sourceWand = wandIdFromContainer(source.id);
      const targetWand = wandIdFromContainer(target.id);
      return item.kind !== "wand" && ((sourceBag && targetBag) || (sourceBag && Boolean(targetWand)) || (Boolean(sourceWand) && targetBag) || (sourceWand !== "" && sourceWand === targetWand));
    },
    onChange: onInventoryChange,
    labels: {
      instructions: "按空格选取物品，使用方向键移动，再按空格放下；按 R 旋转。",
      rotate: "旋转物品",
      pickedUp: (item: string) => `已选中 ${item}`,
      position: (item: string, container: string, column: number, row: number) => `${item} 移至${container}第 ${column} 列、第 ${row} 行`,
      invalid: "此位置不可放置",
      requested: (item: string) => `已提交 ${item} 的布局操作`,
      cancelled: (item: string) => `已取消 ${item} 的移动`,
    },
    getItemLabel: (item: DockItem) => item.kind === "wand"
      ? (() => { const wand = state.wands.find(entry => entry.id === item.wandId); return wand ? getWandDetailLabel(state, wand) : item.label ?? item.id; })()
      : magicIcon(item) ? magicItemLabel(item) : item.label ?? item.id,
    getItemContentPlacement: (item: DockItem) => item.kind === "wand" || magicIcon(item) ? "bounds" as const : "first-cell" as const,
    renderItemActions: (item: DockItem) => {
      if (item.kind !== "wand") return null;
      const wand = state.wands.find(entry => entry.id === item.wandId && entry.characterId === null);
      return wand ? <WandClearButton wand={wand} state={state} dispatch={dispatch} commandId={commandId} /> : null;
    },
    ...(localGrid ? { getItemAppearance: getGameItemAppearance } : {}),
    renderItem: (item: DockItem, renderState: InventoryItemRenderState & { combineTarget?: boolean }) => {
      const iconDefinition = magicIcon(item);
      const supplyIcon = item.kind === "supply" ? getSupplyPresentationIcon(item.definitionId) : undefined;
      if (item.kind === "wand") {
        const wand = state.wands.find(entry => entry.id === item.wandId);
        if (!wand) return null;
        const naturalWidth = wand.width * GRID_CELL_SIZE;
        const naturalHeight = wand.height * GRID_CELL_SIZE;
        return <span className="inventory-dock__item inventory-dock__item--wand" data-kind={item.kind} data-combine-target={renderState.combineTarget || undefined}>
          <span className="inventory-dock__wand-preview" style={{ width: naturalWidth, height: naturalHeight, transform: `translate(-50%, -50%) rotate(${renderState.rotation}deg)` }}><WandPreview state={state} wand={wand} size={Math.max(wand.width, wand.height) * GRID_CELL_SIZE} detailMode /></span>
        </span>;
      }
      const label = iconDefinition ? magicItemLabel(item) : item.label ?? item.id;
      const icon = item.kind === "gear"
        ? <GearSlotIcon slot={item.slot} definitionId={item.definitionId} size={24} seed={`gear-${item.definitionId ?? item.slot}`} />
        : item.kind === "supply"
          ? supplyIcon
            ? <SupplyPresentationIcon definitionId={item.definitionId} size={GRID_CELL_SIZE * Math.max(1, ...supplyIcon.shape.map(cell => Math.max(cell.x + 1, cell.y + 1)))} rotation={renderState.rotation} seed={`supply-${item.definitionId}`} />
            : <AssetImage asset={resolveAsset(definitionFor(item)?.asset, { label: item.label ?? item.id, icon: "◇" })} />
          : iconDefinition
            ? <MagicPresentationIcon definitionId={item.definitionId} size={GRID_CELL_SIZE * Math.max(1, ...iconDefinition.shape.map(cell => Math.max(cell.x + 1, cell.y + 1)))} rotation={renderState.rotation} seed={`inventory-${item.definitionId}`} />
            : <AssetImage asset={resolveAsset(definitionFor(item)?.asset, { label: item.label ?? item.id, icon: item.kind === "spell" ? "✦" : "◇" })} />;
      const iconBox = <span className={`inventory-dock__item-icon${iconDefinition ? " inventory-dock__item-icon--magic" : ""}`} aria-hidden="true">{icon}</span>;
      return <span className="inventory-dock__item" data-kind={item.kind} data-combine-target={renderState.combineTarget || undefined}>
        {iconDefinition ? <MagicItemTooltip label={label}>{iconBox}</MagicItemTooltip> : iconBox}
        {!iconDefinition && <PencilText className="inventory-dock__item-label" as="span" seed="inventory-item-label">{String(item.label)}</PencilText>}
      </span>;
    },
  };
  function changePage(nextPage: number) {
    inventoryGridHandle.current?.cancelDrag();
    setPageIndex(nextPage);
  }
  function arrangeCurrentCategory() {
    inventoryGridHandle.current?.cancelDrag();
    setPageIndex(0);
    setSelectedSupplyId(null);
    const compact = projectInventoryLayout(
      category === "spells" ? spellItems
        : category === "equipment" ? storedWandItems
          : category === "items" ? gearItems : supplyItems,
      category === "spells" ? spellColumns : category === "equipment" ? equipmentColumns : category === "items" ? gearColumns : supplyColumns,
    ).state;
    if (category === "spells") setSpellLayout(compact);
    else if (category === "equipment") setEquipmentLayout(compact);
    else if (category === "items") setGearLayout(compact);
    else setSupplyLayout(compact);
  }
  const gearSlots = localGrid && showLoadout && category === "equipment" ? ([0, 1] as const).map(slot => {
    const container = equipmentContainers.find(entry => entry.id === `character:${primaryCharacter?.id}:wand-slot:${slot}`);
    const target = loadoutTargets[slot];
    if (!container || !target) return null;
    const wandItem = container.items[0];
    const wand = wandItem ? state.wands.find(entry => entry.id === wandItem.id) : undefined;
    const label = `${primaryCharacter?.name ?? "角色"} 法杖位 ${slot + 1}`;
    const gearVisual = (dragState?: { isDragging: boolean; isOver: boolean; canDrop: boolean }) => <span className="inventory-dock__gear-drop" data-equipped={wand ? "true" : undefined} data-drop-active={dragState?.isDragging || undefined} data-drop-over={dragState?.isOver || undefined} data-can-drop={dragState?.canDrop || undefined} role="group" aria-label={wand?.name ? `${label}：${wand.name}` : `${label}：空装备位`}>
      {wand ? <>
        <WandPreview state={state} wand={wand} size={44} />
        <Button type="button" size="icon-xs" variant="ghost" className="inventory-dock__gear-unequip" aria-label={`卸下${label}的${wand.name}`} title={`卸下${wand.name}`} disabled={gridProps.disabled} onClick={event => { event.stopPropagation(); setResult(dispatch({ id: commandId(), type: "unequipWand", wandId: wand.id })); }}><PencilIcon paths={[{ d: "M10 6 4 12l6 6M4 12h10a6 6 0 0 0 6-6", mode: "stroke" }]} size={18} sourceSize={24} seed={`unequip-wand-${slot}`} decorative /></Button>
      </> : null}
    </span>;
    const content = DropTarget ? <DropTarget
      targetId={container.id}
      label={label}
      className="inventory-dock__external-target inventory-dock__external-target--wand"
      disabled={gridProps.disabled}
      canDrop={({ sourceItem, source }) => sourceItem.kind === "wand" && isStorageContainer(dropSourceContainerId(source), "equipment-backpack")}
      onDrop={({ sourceItem }) => {
        if (sourceItem.kind !== "wand" || !primaryCharacter) return;
        setResult(dispatch({ id: commandId(), type: "equipWand", wandId: sourceItem.wandId, characterId: primaryCharacter.id, slot }));
      }}
    >{gearVisual}</DropTarget> : gearVisual();
    return createPortal(content, target, container.id);
  }) : null;
  const gearLoadoutPortals = localGrid && showLoadout && category === "items" ? (["head", "body", "feet", "accessory"] as const).map(slot => {
    const target = gearTargets[slot];
    if (!target || !primaryCharacter) return null;
    const gearId = primaryCharacter.gearIds?.[slot];
    const gear = gearId ? state.gear?.[gearId] : undefined;
    const item = gear ? makeGearGridItem(gear, { x: 0, y: 0 }) : undefined;
    const label = `${primaryCharacter.name} ${gearSlotLabels[slot]}`;
    const gearVisual = (dragState?: { isDragging: boolean; isOver: boolean; canDrop: boolean }) => <span className="inventory-dock__gear-drop" data-equipped={gear ? "true" : undefined} data-drop-active={dragState?.isDragging || undefined} data-drop-over={dragState?.isOver || undefined} data-can-drop={dragState?.canDrop || undefined} role="group" aria-label={gear ? `${label}：${gear.name}` : `${label}：空装备位`}>
      {gear ? <>
        <span className="inventory-dock__gear-icon" aria-hidden="true"><GearSlotIcon slot={gear.slot} definitionId={gear.definitionId} size={32} seed={`equipped-gear-${gear.definitionId ?? gear.slot}`} /></span>
        <Button type="button" size="icon-xs" variant="ghost" className="inventory-dock__gear-unequip" aria-label={`卸下${label}的${gear.name}`} title={`卸下${gear.name}`} disabled={gridProps.disabled} onClick={event => { event.stopPropagation(); setResult(dispatch({ id: commandId(), type: "unequipGear", gearId: gear.id })); }}><PencilIcon paths={[{ d: "M10 6 4 12l6 6M4 12h10a6 6 0 0 0 6-6", mode: "stroke" }]} size={18} sourceSize={24} seed={`unequip-gear-${slot}`} decorative /></Button>
      </> : null}
    </span>;
    const content = DropTarget ? <DropTarget
      targetId={`character:${primaryCharacter.id}:gear-slot:${slot}`}
      label={label}
      className="inventory-dock__external-target inventory-dock__external-target--gear"
      disabled={gridProps.disabled}
      canDrop={({ sourceItem, source }) => sourceItem.kind === "gear" && sourceItem.slot === slot && isStorageContainer(dropSourceContainerId(source), "gear-backpack")}
      onDrop={({ sourceItem }) => { if (sourceItem.kind === "gear") setResult(dispatch({ id: commandId(), type: "equipGear", gearId: sourceItem.gearId, characterId: primaryCharacter.id })); }}
    >{gearVisual}</DropTarget> : gearVisual();
    return createPortal(content, target, `gear:${slot}`);
  }) : null;
  const discardTarget = DropTarget ? <DropTarget
    targetId="discard"
    label="丢弃"
    className="inventory-dock__external-target inventory-dock__external-target--trash"
    disabled={gridProps.disabled}
    canDrop={({ sourceItem, source }) => {
      const containerId = dropSourceContainerId(source);
      if (sourceItem.kind === "wand") return isStorageContainer(containerId, "equipment-backpack");
      if (sourceItem.kind === "gear") return isStorageContainer(containerId, "gear-backpack");
      if (sourceItem.kind === "supply") return isStorageContainer(containerId, "supplies");
      return true;
    }}
    onDrop={({ sourceItem }) => {
      const command: Command = sourceItem.kind === "wand"
        ? { id: commandId(), type: "discardWand", wandId: sourceItem.wandId }
        : sourceItem.kind === "gear"
          ? { id: commandId(), type: "discardGear", gearId: sourceItem.gearId }
          : sourceItem.kind === "supply"
            ? { id: commandId(), type: "discardSupply", itemId: sourceItem.supplyId }
            : { id: commandId(), type: "discardItem", itemId: sourceItem.id };
      setResult(dispatch(command));
    }}
  >{({ isDragging, isOver, canDrop }) => <Button size="icon" variant="ghost" className="inventory-dock__trash" aria-label="丢弃拖入物品" title="将物品或未装备法杖拖到此处丢弃" disabled={gridProps.disabled} data-drop-active={isDragging || undefined} data-drop-over={isOver && canDrop || undefined} data-can-drop={canDrop || undefined}><PencilIcon paths={trashPaths} size={32} sourceSize={24} seed="inventory-trash" decorative /></Button>}</DropTarget> : <Button size="icon" variant="ghost" className="inventory-dock__trash" aria-label="丢弃拖入物品" title="将物品或未装备法杖拖到此处丢弃" disabled><PencilIcon paths={trashPaths} size={32} sourceSize={24} seed="inventory-trash" decorative /></Button>;
  const renderTabs = (composed: boolean) => <Tabs.Root className="inventory-dock__tabs" value={category} onValueChange={value => { const next = value as Category; inventoryGridHandle.current?.cancelDrag(); setPageIndex(0); onCategoryChange?.(next); }}>
    <GameTabsList className="inventory-dock__categories" aria-label="背包分类" overflow="scroll">
      <Tabs.Trigger value="spells" startIcon={<PencilIcon paths={categoryIcons.spells} size={32} sourceSize={24} seed="spells-tab" decorative />}>魔法</Tabs.Trigger>
      <Tabs.Trigger value="items" startIcon={<PencilIcon paths={categoryIcons.items} size={32} sourceSize={24} seed="items-tab" decorative />}>装备</Tabs.Trigger>
      <Tabs.Trigger value="equipment" startIcon={<PencilIcon paths={categoryIcons.equipment} size={32} sourceSize={24} seed="equipment-tab" decorative />}>法杖</Tabs.Trigger>
      <Tabs.Trigger value="supplies" startIcon={<PencilIcon paths={categoryIcons.supplies} size={32} sourceSize={24} seed="supplies-tab" decorative />}>道具</Tabs.Trigger>
    </GameTabsList>
    <Tabs.Content className="inventory-dock__tab-content" value={category}>
      {composed && showWands && category === "spells" && <div className="inventory-dock__wand-area" ref={topAreaRef} aria-label="当前角色法杖插槽">{wandContainers.map(container => {
        const wandId = container.id.slice("wand:".length);
        const wand = state.wands.find(entry => entry.id === wandId);
        return <div key={container.id} className="inventory-dock__wand-slot">
          <GridContainer containerId={container.id} showHeader={false} />
          <WandClearButton wand={wand} state={state} dispatch={dispatch} commandId={commandId} />
        </div>;
      })}</div>}
      {composed && showWands && !showLoadout && category === "equipment" && equipmentContainers.length > 0 && <div className="inventory-dock__gear-area" ref={topAreaRef} aria-label="当前角色法杖位">{equipmentContainers.map(container => <GridContainer key={container.id} containerId={container.id} showHeader={false} />)}</div>}
      <div className="inventory-dock__storage-viewport" aria-label={category === "equipment" ? "未装备法杖" : category === "items" ? "未装备装备" : category === "supplies" ? "道具背包" : "魔法背包"}>
        {composed ? storageContainers.map(container => <GridContainer key={container.id} containerId={container.id} showHeader={false} />) : <InventoryGrid<DockItem> {...gridProps} />}
      </div>
    </Tabs.Content>{gearSlots}{gearLoadoutPortals}
  </Tabs.Root>;
  const renderToolbar = () => <nav className="inventory-dock__toolbar" aria-label="背包工具栏">
    <Button type="button" size="icon" variant="ghost" className="inventory-dock__arrange" aria-label="整理背包" title="整理当前分类" disabled={gridProps.disabled || !(category === "spells" ? spellItems.length : category === "equipment" ? storedWandItems.length : category === "items" ? gearItems.length : supplyItems.length)} onClick={arrangeCurrentCategory}>
      <PencilIcon paths={arrangePaths} size={24} sourceSize={24} seed="inventory-arrange" decorative />
    </Button>
    {discardTarget}
    {pageCount > 1 ? <span className="inventory-dock__pagination">
      <Button size="icon" variant="ghost" aria-label="上一页" disabled={pageIndex === 0} onClick={() => changePage(Math.max(0, pageIndex - 1))}><PencilIcon paths={[{ d: "M15 5 8 12l7 7", mode: "stroke" }]} sourceSize={24} size={32} seed="inventory-page-previous" decorative /></Button>
      <Button size="icon" variant="ghost" aria-label="下一页" disabled={pageIndex >= pageCount - 1} onClick={() => changePage(Math.min(pageCount - 1, pageIndex + 1))}><PencilIcon paths={[{ d: "m9 5 7 7-7 7", mode: "stroke" }]} sourceSize={24} size={32} seed="inventory-page-next" decorative /></Button>
    </span> : null}
    {category === "supplies" && selectedSupplyId && supplyItems.some(item => item.id === selectedSupplyId) && <Button type="button" size="sm" variant="outline" disabled={gridProps.disabled} onClick={() => { setResult(dispatch({ id: commandId(), type: "useItem", itemId: selectedSupplyId })); setSelectedSupplyId(null); }}>使用选中道具</Button>}
  </nav>;

  return <section className="inventory-dock" onFocusCapture={event => { const target = (event.target as HTMLElement).closest<HTMLElement>("[data-inventory-item]"); const supply = supplyItems.find(item => item.id === target?.dataset.inventoryItem); if (supply) setSelectedSupplyId(supply.id); }} onClick={event => { const target = (event.target as HTMLElement).closest<HTMLElement>("[data-inventory-item]"); const supply = supplyItems.find(item => item.id === target?.dataset.inventoryItem); setSelectedSupplyId(supply?.id ?? null); }} data-category={category} data-has-pages={pageCount > 1 ? "true" : undefined} data-ready-group={state.phase === "ready" && state.backpackOpen && showWands ? "true" : undefined} aria-label="背包库存" style={{ "--inventory-cell-size": `${GRID_CELL_SIZE}px`, "--inventory-columns": activeColumns, "--inventory-page-rows": INVENTORY_PAGE_ROWS } as React.CSSProperties}>
    <div className="inventory-dock__measure" ref={measureRef} aria-hidden="true" />

    {localGrid ? <GridRoot {...gridProps} {...combineProps}>{renderTabs(true)}{renderToolbar()}</GridRoot> : <>{renderTabs(false)}{renderToolbar()}</>}
    {pageCount > 1 && <>
      <span className="sr-only" aria-live="polite" aria-atomic="true">第 {pageIndex + 1} 页，共 {pageCount} 页</span>
    </>}
    {inventory.overflow > 0 && <output className="inventory-dock__announcement" role="status">{`有 ${inventory.overflow} 件物品未显示。`}</output>}
    {result && <output className={`inventory-dock__announcement is-${result.status}`} aria-live="polite" data-command-status={result.status} data-command-code={result.code}>
      {result.status === "rejected" ? `操作未执行：${result.message ?? result.code ?? "操作被拒绝"}` : result.status === "accepted" ? "操作已提交，等待处理。" : "操作已完成。"}
    </output>}
  </section>;
}

function commandId() {
  return `inventory-dock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
