import { useLayoutEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { InventoryGrid, PencilText, Tooltip } from "@inkra/react";
import type { InventoryContainer, InventoryChangeDetails, InventoryGridProps, InventoryItemRenderState } from "@inkra/react/inventory-grid";
import { AssetImage, resolveAsset } from "./assets";
import type { Command, CommandResult, GameState, WandInstance } from "../contracts";
import { inventoryDefinition as getDefinition, makeGridItem, quarterTurn, type DockItem } from "./inventoryAdapter";
import { getGameItemAppearance } from "./itemAppearance";
import type { CastFlashLookup } from "./wandMiniatureEvents";
import { WandClearButton } from "./WandClearButton";
import { getMagicPresentationIcon, MagicPresentationIcon } from "./magicPresentationIcons";
import { enrichMagicReward } from "../content/magicDescriptions";
import { demoContent } from "../content/demo";
import { getWandRecipeMaterialIds } from "./WandRecipeConfirmation";
import "./WandBoard.css";
import {useMagicInspectGesture} from "./useMagicInspectGesture";
import {fitWandSlots} from "./wandSizing";
import {FittedWand} from "./FittedWand";

type Props = { flashes: CastFlashLookup; activeCharacterId: string; state: GameState; dispatch: (command: Command) => CommandResult; onHeightChange: (height: number) => void; onInspectMagic?: (itemId:string)=>void };
type BoardItem = Extract<DockItem, { kind: "spell" | "arcana" }>;
type ComposedGridRootProps = InventoryGridProps<BoardItem> & {
  children: ReactNode;
  getItemContentPlacement?: (item: BoardItem) => "bounds" | "first-cell";
  onDraggingChange?: (active: boolean) => void;
};
type ComposedGridApi = {
  Root?: ComponentType<ComposedGridRootProps>;
  Container?: ComponentType<{ containerId: string; showHeader?: boolean; className?: string }>;
};
const WAND_CELL_SIZE = 56;

function magicItemLabel(item: BoardItem) {
  const definition = getDefinition(item);
  const reward = enrichMagicReward({ id: item.id, kind: "item", definitionId: item.definitionId, label: item.label ?? item.id, grade: item.grade }, demoContent);
  return [item.label ?? definition?.name ?? item.id, reward.description].filter(Boolean).join("。 ");
}
function MagicItemTooltip({ label, children }: { label: string; children: ReactNode }) {
  return <Tooltip.Provider delayDuration={300}><Tooltip.Root>
    <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
    <Tooltip.Portal><Tooltip.Content side="top">{label}</Tooltip.Content></Tooltip.Portal>
  </Tooltip.Root></Tooltip.Provider>;
}

/** Shared clear action for the board and backpack wand views. */
export function WandActions({wand, state, dispatch, className}: {
  wand?: WandInstance; state: GameState; dispatch: Props['dispatch']; className?: string;
}) {
  return <WandClearButton wand={wand} state={state} dispatch={dispatch} className={className} />;
}

export function WandBoard({ state, flashes, dispatch, activeCharacterId, onHeightChange, onInspectMagic }: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const inspectHandlers = useMagicInspectGesture(state, onInspectMagic ? itemId => {
    if (!dragging.current) onInspectMagic(itemId);
  } : undefined);
  const [availableWidth,setAvailableWidth]=useState(0);
  useLayoutEffect(()=>{
    const node=boardRef.current?.closest<HTMLElement>(".game-scene");
    if(!node)return;
    const measure=()=>{
      // Read a resolved edge: custom properties retain max()/safe-area expressions.
      const edge=node.querySelector<HTMLElement>(".game-backpack");
      const inset=edge ? parseFloat(getComputedStyle(edge).left) || 12 : 12;
      setAvailableWidth(Math.max(1,node.clientWidth-inset*2));
    };
    measure();const observer=new ResizeObserver(measure);observer.observe(node);
    return ()=>observer.disconnect();
  },[]);
  const character = state.characters.find(character => character.id === activeCharacterId) ?? state.characters[0];
  const equippedWands = useMemo(() => character ? character.wandIds.flatMap((id) => {
    const wand = state.wands.find((entry) => entry.id === id && entry.characterId === character.id);
    return wand ? [wand] : [];
  }).slice(0, 2) : [], [character, state.wands]);

  const recipeMaterials = useMemo(() => getWandRecipeMaterialIds(state, equippedWands), [state, equippedWands]);
  const fit=fitWandSlots(availableWidth,equippedWands,WAND_CELL_SIZE);
  const containers = useMemo<InventoryContainer<BoardItem>[]>(() => {
    return equippedWands.map((wand) => ({
      id: `wand:${wand.id}`,
      label: wand.name,
      columns: wand.width,
      rows: wand.height,
      items: wand.placements.flatMap((placement) => {
        const instance = state.items[placement.itemId];
        if (!instance) return [];
        return [makeGridItem(instance, { x: placement.x, y: placement.y }, placement.rotation) as BoardItem];
      }),
    }));
  }, [equippedWands, state.items]);

  useLayoutEffect(() => {
    const node = boardRef.current;
    if (!node) return;
    // Report the fitted row height so the start button follows its visible bounds.
    const reportHeight = () => onHeightChange(node.getBoundingClientRect().height);
    reportHeight();
    const observer = new ResizeObserver(reportHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, [activeCharacterId, onHeightChange]);

  function onInventoryChange(_next: readonly InventoryContainer<BoardItem>[], details: InventoryChangeDetails) {
    if (details.from.containerId !== details.to.containerId) return;
    const wand = equippedWands.find((entry) => `wand:${entry.id}` === details.to.containerId);
    if (!wand) return;
    dispatch({
      id: `wand-board-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: "placeItem",
      wandId: wand.id,
      itemId: details.from.itemId,
      x: details.to.position.x,
      y: details.to.position.y,
      rotation: quarterTurn(details.to.rotation),
    });
  }

  // 0.15's public registry keeps the default multi-container grid; the local
  // composed candidate adds Root/Container. Keep that optional surface behind
  // the same structural bridge used by InventoryDock.
  const composedGrid = InventoryGrid as unknown as ComposedGridApi;
  const composed = import.meta.env.INKRA_LOCAL === true && Boolean(composedGrid.Root && composedGrid.Container);
  const GridRoot = composedGrid.Root ?? (({ children }: ComposedGridRootProps) => <>{children}</>);
  const GridContainer = composedGrid.Container ?? (() => null);

  // Registry 0.15 does not expose getItemAppearance; the local Inkra build does.
  const appearanceProps = import.meta.env.INKRA_LOCAL === true
    ? { getItemAppearance: getGameItemAppearance }
    : {};

  const gridProps = {
    "aria-label": "当前角色法杖插槽",
    className: composed ? "wand-board__root" : "wand-board__root wand-board__root--registry",
    containers,
    cellSize: 56,
    disabled: state.phase === "battle",
    allowRotation: true,
    canPlace: ({ source, target }: Parameters<NonNullable<InventoryGridProps<BoardItem>["canPlace"]>>[0]) => source.id === target.id,
    onChange: onInventoryChange,
    labels: {
      instructions: "按空格选取物品，使用方向键移动，再按空格放下；按 R 旋转。",
      rotate: "旋转选中物品",
      pickedUp: (item: string) => `已选中 ${item}`,
      position: (item: string, container: string, column: number, row: number) => `${item} 移至第 ${column} 列、第 ${row} 行`,
      invalid: "此位置不可放置",
      requested: (item: string) => `已提交 ${item} 的布局操作`,
      cancelled: (item: string) => `已取消 ${item} 的移动`,
    },
    getItemLabel: (item: BoardItem) => {
      const label = getMagicPresentationIcon(item.definitionId) ? magicItemLabel(item) : item.label ?? item.id;
      return recipeMaterials.has(item.id) ? `${label} 可合成` : label;
    },
    ...appearanceProps,
    renderItem: (item: BoardItem, renderState: InventoryItemRenderState) => {
      const instance = state.items[item.id];
      const definition = instance && getDefinition(instance);
      const sourceWand = equippedWands.find(wand => wand.placements.some(placement => placement.itemId === item.id));
      const iconDefinition = getMagicPresentationIcon(item.definitionId);
      const label = iconDefinition ? magicItemLabel(item) : item.label ?? item.id;
      const iconSize = iconDefinition ? WAND_CELL_SIZE * Math.max(1, ...iconDefinition.shape.map(cell => Math.max(cell.x + 1, cell.y + 1))) : 20;
      const icon = iconDefinition
        ? <MagicPresentationIcon definitionId={item.definitionId} size={iconSize} rotation={renderState.rotation} seed={`wand-board-${item.definitionId}`} />
        : <AssetImage asset={resolveAsset(definition?.asset, { label: item.label ?? item.id, icon: item.kind === "spell" ? "✦" : "◇" })} />;
      const iconBox = <span className={`wand-board__item-icon${iconDefinition ? " wand-board__item-icon--magic" : ""}`}>{icon}</span>;
      return <span className="wand-board__item" data-wand-recipe-ready={!renderState.dragging && recipeMaterials.has(item.id) || undefined} data-cast-flashing={sourceWand && flashes.has(sourceWand.id, item.id) ? "true" : undefined}>
        {iconDefinition ? <MagicItemTooltip label={label}>{iconBox}</MagicItemTooltip> : iconBox}
        {!iconDefinition && <PencilText as="span" className="wand-board__item-label" seed="wand-board-item-label">{String(item.label)}</PencilText>}
      </span>;
    },
  } satisfies InventoryGridProps<BoardItem>;
  const composedInteractionProps = composed ? {
    getItemContentPlacement: (item: BoardItem) => getMagicPresentationIcon(item.definitionId) ? "bounds" as const : "first-cell" as const,
    onDraggingChange: (active: boolean) => { dragging.current = active; },
  } : {};

  return <div className="wand-board" ref={boardRef} {...inspectHandlers}>
    {containers.length > 0 && composed ? <GridRoot
      key={character?.id ?? activeCharacterId}
      {...gridProps}
      {...composedInteractionProps}
    >
      {containers.map((container,index) => {
        const wandId = container.id.slice("wand:".length);
        const wand = equippedWands.find(entry => entry.id === wandId);
        if (!wand) return null;
        return <div key={container.id} className="wand-board__slot" role="group" aria-label={`${wand.name}法杖编辑器`}>
          <FittedWand slotWidth={fit.slotWidth} {...fit.slots[index]} action={<WandActions wand={wand} state={state} dispatch={dispatch} />}>
            <GridContainer containerId={container.id} showHeader={false} className="wand-board__inventory" />
          </FittedWand>
        </div>;
      })}
    </GridRoot> : containers.length > 0 ? <div className="wand-board__registry-layout" style={{zoom:Math.min(1, (availableWidth || Infinity) / (equippedWands.reduce((sum,wand)=>sum+wand.width*56+6,0)+44+Math.max(0,equippedWands.length-1)*12))}}>
      <div className="wand-board__registry-actions" style={{ gridTemplateColumns: equippedWands.map(wand => `${wand.width * 56}px`).join(" ") }}>
        {equippedWands.map(wand => <WandActions key={wand.id} className="wand-board__registry-clear" wand={wand} state={state} dispatch={dispatch} />)}
      </div>
      <InventoryGrid<BoardItem> {...gridProps} />
    </div> : <div className="wand-board__slot wand-board__slot--empty"><WandClearButton className="wand-board__clear-button" state={state} dispatch={dispatch} /></div>}
  </div>;
}
