import { getGameItemAppearance } from "./itemAppearance";
import { GameTabsList } from "./GameTabsList";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { InventoryGrid, PencilIcon, PencilText, Tabs } from "@inkra/react";
import type { InventoryChangeDetails, InventoryContainer, InventoryGridProps, InventoryItemRenderState } from "@inkra/react/inventory-grid";
import type { Command, CommandResult, GameState } from "../contracts";
import { columnsForInventoryWidth, inventoryDefinition as definitionFor, makeGridItem, makeWandGridItem, minimumRequiredColumns, packInventory, quarterTurn, type DockItem } from "./inventoryAdapter";
import { localInventoryCombineCompat } from "./inventoryCombineCompat";
import { carryMergeLayout, projectInventoryLayout, rememberInventoryPosition, type InventoryLayoutState } from "./inventoryLayoutState";
import { AssetImage, resolveAsset } from "./assets";
import "./InventoryDock.css";

type Category = "items" | "spells" | "equipment";
type LocalGridProps = InventoryGridProps<DockItem> & { children: React.ReactNode; canCombine?: (context: { sourceItem: DockItem; targetItem: DockItem }) => boolean; onCombine?: (context: { sourceItem: DockItem; targetItem: DockItem }) => void };
type LocalGridApi = { Root?: React.ComponentType<LocalGridProps>; Container?: React.ComponentType<{ containerId: string; showHeader?: boolean; className?: string }> };
const GRID_CELL_SIZE = 48;
const categoryIcons = {
  items: [{d:"M4 8h16v12H4zM8 8V5h8v3", mode:"stroke" as const}],
  spells: [{d:"M12 3 14 9l6 3-6 3-2 6-2-6-6-3 6-3 2-6Z", mode:"stroke" as const}],
  equipment: [{d:"M5 19 19 5M16 4l3 1 1 3", mode:"stroke" as const}],
};
type Props = { state: GameState; dispatch: (command: Command) => CommandResult; activeCharacterId: string; showWands?: boolean; showLoadout?: boolean; onCategoryChange?: (category: Category) => void; onWandAreaHeightChange?: (height: number) => void };
type PendingStorageMove = { kind: "spell" | "equipment"; itemId: string; position: { x: number; y: number; rotation: 0 | 90 | 180 | 270 } };

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
  const totalRows = Math.max(3, rows, packed.rows);
  const segmentCount = Math.max(1, Math.ceil(totalRows / packed.segmentRowLimit));
  const byOffset = new Map(packed.segments.map(segment => [segment.rowOffset, segment]));
  return {
    ...packed,
    rows: totalRows,
    segments: Array.from({ length: segmentCount }, (_, index) => {
      const rowOffset = index * packed.segmentRowLimit;
      return {
        rowOffset,
        rows: Math.min(packed.segmentRowLimit, totalRows - rowOffset),
        items: byOffset.get(rowOffset)?.items ?? [],
      };
    }),
  };
}
function sameLayoutState(left: InventoryLayoutState | undefined, right: InventoryLayoutState) {
  return Boolean(left
    && left.columns === right.columns
    && left.extentRows === right.extentRows
    && left.itemBudget === right.itemBudget
    && left.activeIds.length === right.activeIds.length
    && left.activeIds.every((id, index) => id === right.activeIds[index])
    && JSON.stringify(left.positions) === JSON.stringify(right.positions));
}
function isStorageContainer(id: string, prefix: "backpack" | "equipment-backpack") { return id === prefix || id.startsWith(`${prefix}:`); }
function storageRowOffset(id: string) {
  const offset = Number(id.slice(id.lastIndexOf(":") + 1));
  return Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
}
function wandIdFromContainer(id: string) { return id.startsWith("wand:") ? id.slice("wand:".length) : ""; }
function characterIdFromGearContainer(id: string) { return id.startsWith("character:") ? id.slice("character:".length).split(":wand-slot:")[0] : ""; }

export function InventoryDock({ state, dispatch, activeCharacterId, showWands = true, showLoadout = false, onCategoryChange, onWandAreaHeightChange }: Props) {
  const [category, setCategory] = useState<Category>("spells");
  const measureRef = useRef<HTMLDivElement>(null);
  const topAreaRef = useRef<HTMLDivElement>(null);
  const [loadoutTargets, setLoadoutTargets] = useState<HTMLElement[]>([]);
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
    const reportHeight = () => onWandAreaHeightChange(node.offsetHeight);
    reportHeight();
    const observer = new ResizeObserver(reportHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, [activeCharacterId, category, showWands, showLoadout, onWandAreaHeightChange]);
  useLayoutEffect(() => {
    if (!showLoadout || category !== "equipment") { setLoadoutTargets([]); return; }
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-character-wand-slot]"));
    setLoadoutTargets(targets);
  }, [activeCharacterId, category, showLoadout]);
  const [result, setResult] = useState<CommandResult | null>(null);
  const [spellLayout, setSpellLayout] = useState<InventoryLayoutState>();
  const [equipmentLayout, setEquipmentLayout] = useState<InventoryLayoutState>();
  const [pendingStorageMoves, setPendingStorageMoves] = useState<Record<string, PendingStorageMove>>({});
  const [mergeEventCursor, setMergeEventCursor] = useState(state.nextEventSeq);
  const primaryCharacter = state.characters.find((character) => character.id === activeCharacterId) ?? state.characters[0];
  const activeWands = useMemo(() => state.wands.filter(entry => entry.characterId === primaryCharacter?.id && primaryCharacter.wandIds.includes(entry.id)), [primaryCharacter, state.wands]);

  const spellItems = useMemo(() => state.backpack.flatMap(id => state.items[id] ? [makeGridItem(state.items[id], { x: 0, y: 0 })] : []), [state.backpack, state.items]);
  const storedWandItems = useMemo(() => state.wands.filter(entry => entry.characterId === null).map(entry => makeWandGridItem(entry, { x: 0, y: 0 }, true)), [state.wands]);
  const minColumns = minimumRequiredColumns([...spellItems, ...storedWandItems]);
  const sharedColumns = columnsForInventoryWidth(availableWidth, minColumns, GRID_CELL_SIZE);
  const pendingMergeEvents = useMemo(() => state.events.filter(event => event.seq >= mergeEventCursor && event.type === "itemsMerged"), [state.events, mergeEventCursor]);
  const spellLayoutAfterMerges = useMemo(() => spellLayout && pendingMergeEvents.length
    ? pendingMergeEvents.reduce(carryMergeLayout, spellLayout)
    : spellLayout, [spellLayout, pendingMergeEvents]);
  const spellProjection = useMemo(() => projectInventoryLayout(spellItems, sharedColumns, spellLayoutAfterMerges), [spellItems, sharedColumns, spellLayoutAfterMerges]);
  const equipmentProjection = useMemo(() => projectInventoryLayout(storedWandItems, sharedColumns, equipmentLayout), [storedWandItems, sharedColumns, equipmentLayout]);
  const sharedRows = Math.max(3, spellProjection.packed.rows, equipmentProjection.packed.rows);
  const spellPacked = extendPackedRows(spellProjection.packed, sharedRows);
  const equipmentPacked = extendPackedRows(equipmentProjection.packed, sharedRows);

  // Advance the cursor only after the event-adjusted projection has been committed.
  // Its layout effect below persists the target-to-output coordinate migration.
  useEffect(() => {
    if (!pendingMergeEvents.length) return;
    setMergeEventCursor(state.nextEventSeq);
  }, [pendingMergeEvents, state.nextEventSeq]);
  useLayoutEffect(() => {
    if (!sameLayoutState(spellLayout, spellProjection.state)) setSpellLayout(spellProjection.state);
    if (!sameLayoutState(equipmentLayout, equipmentProjection.state)) setEquipmentLayout(equipmentProjection.state);
  }, [spellLayout, spellProjection.state, equipmentLayout, equipmentProjection.state]);
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
      const storageContainers = packedContainers("equipment-backpack", "未装备法杖", storedWands, sharedColumns);
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
    const packed = category === "spells" ? spellPacked : filterPackedItems(spellPacked, () => false);
    const storageContainers = packedContainers("backpack", category === "items" ? "物品" : "背包", packed, sharedColumns);
    return { containers: [...wandContainers, ...storageContainers], overflow: category === "items" ? 0 : packed.unplaced.length };

  }, [activeWands, category, spellPacked, equipmentPacked, state.characters, state.items, state.wands, primaryCharacter, sharedColumns]);

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
      if (fromStore && characterIdFromGearContainer(to.containerId)) {
        command = { id: commandId(), type: "equipWand", wandId: from.itemId, characterId: characterIdFromGearContainer(to.containerId) };
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
    const fromBackpack = isStorageContainer(from.containerId, "backpack");
    const toBackpack = isStorageContainer(to.containerId, "backpack");
    const sourceWandId = wandIdFromContainer(from.containerId);
    const targetWandId = wandIdFromContainer(to.containerId);
    const toPosition = { x: to.position.x, y: to.position.y + (toBackpack ? storageRowOffset(to.containerId) : 0), rotation: to.rotation };
    if (fromBackpack && toBackpack) {
      setSpellLayout(layout => rememberInventoryPosition(layout ?? spellProjection.state, from.itemId, toPosition));
      return;
    }
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

  const storagePrefix = category === "equipment" ? "equipment-backpack" : "backpack";
  const storageContainers = inventory.containers.filter(container => isStorageContainer(container.id, storagePrefix));
  const wandContainers = inventory.containers.filter(container => container.id.startsWith("wand:"));
  const equipmentContainers = inventory.containers.filter(container => container.id.startsWith("character:"));
  const localGridFeatures = InventoryGrid as unknown as LocalGridApi;
  const localGrid = import.meta.env.INKRA_LOCAL === true && Boolean(localGridFeatures.Root && localGridFeatures.Container);
  const GridRoot = localGridFeatures.Root ?? (({ children }: LocalGridProps) => <>{children}</>);
  const GridContainer = localGridFeatures.Container ?? (() => null);
  const combineProps = localInventoryCombineCompat(localGrid, state, dispatch, setResult);
  const gridProps = {
    "aria-label": "法杖和背包物品",
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
    getItemLabel: (item: DockItem) => item.label ?? item.id,
    ...(localGrid ? { getItemAppearance: getGameItemAppearance } : {}),
    renderItem: (item: DockItem, renderState: InventoryItemRenderState & { combineTarget?: boolean }) => <span className="inventory-dock__item" title={item.label} data-combine-target={renderState.combineTarget || undefined}>
      <span className="inventory-dock__item-icon" aria-hidden="true">{item.kind === "wand" ? "▦" : <AssetImage asset={resolveAsset(definitionFor(item)?.asset, { label: item.label ?? item.id, icon: item.kind === "spell" ? "✦" : "◇" })} />}</span>
      <PencilText className="inventory-dock__item-label" as="span" seed="inventory-item-label">{String(item.label)}</PencilText>
    </span>,
  };
  const visibleGearPortals = localGrid && showLoadout && category === "equipment" ? equipmentContainers.slice(0, 2).map((container, index) => loadoutTargets[index] ? createPortal(<GridContainer containerId={container.id} showHeader={false} className="character-page__loadout-grid" />, loadoutTargets[index], container.id) : null) : null;
  const renderTabs = (composed: boolean) => <Tabs.Root className="inventory-dock__tabs" value={category} onValueChange={value => { const next = value as Category; setCategory(next); onCategoryChange?.(next); }}>
    <GameTabsList className="inventory-dock__categories" aria-label="背包分类" overflow="scroll">
      <Tabs.Trigger value="spells" startIcon={<PencilIcon paths={categoryIcons.spells} size={32} sourceSize={24} seed="spells-tab" decorative />}>魔法</Tabs.Trigger>
      <Tabs.Trigger value="items" startIcon={<PencilIcon paths={categoryIcons.items} size={32} sourceSize={24} seed="items-tab" decorative />}>物品</Tabs.Trigger>
      <Tabs.Trigger value="equipment" startIcon={<PencilIcon paths={categoryIcons.equipment} size={32} sourceSize={24} seed="equipment-tab" decorative />}>装备</Tabs.Trigger>
    </GameTabsList>
    <Tabs.Content className="inventory-dock__tab-content" value={category}>
      {composed && showWands && category === "spells" && <div className="inventory-dock__wand-area" ref={topAreaRef} aria-label="当前角色法杖插槽">{wandContainers.map(container => <GridContainer key={container.id} containerId={container.id} showHeader={false} />)}</div>}
      {composed && showWands && !showLoadout && category === "equipment" && equipmentContainers.length > 0 && <div className="inventory-dock__gear-area" ref={topAreaRef} aria-label="当前角色法杖位">{equipmentContainers.map(container => <GridContainer key={container.id} containerId={container.id} showHeader={false} />)}</div>}
      <div className="inventory-dock__storage-viewport" aria-label={category === "equipment" ? "未装备法杖" : "背包物品"}>
        {composed ? storageContainers.map(container => <GridContainer key={container.id} containerId={container.id} showHeader={false} />) : <InventoryGrid<DockItem> {...gridProps} />}
      </div>
    </Tabs.Content>{visibleGearPortals}
  </Tabs.Root>;

  return <section className="inventory-dock" data-category={category} data-ready-group={state.phase === "ready" && state.backpackOpen && showWands ? "true" : undefined} aria-label="背包库存" style={{ "--inventory-cell-size": `${GRID_CELL_SIZE}px`, "--inventory-columns": sharedColumns } as React.CSSProperties}>
    <div className="inventory-dock__measure" ref={measureRef} aria-hidden="true" />

    {localGrid ? <GridRoot {...gridProps} {...combineProps}>{renderTabs(true)}</GridRoot> : renderTabs(false)}
    {inventory.overflow > 0 && <output className="inventory-dock__announcement" role="status">{`有 ${inventory.overflow} 件物品未显示。`}</output>}
    {result && <output className={`inventory-dock__announcement is-${result.status}`} aria-live="polite" data-command-status={result.status} data-command-code={result.code}>
      {result.status === "rejected" ? `操作未执行：${result.message ?? result.code ?? "操作被拒绝"}` : result.status === "accepted" ? "操作已提交，等待处理。" : "操作已完成。"}
    </output>}
  </section>;
}

function commandId() {
  return `inventory-dock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
