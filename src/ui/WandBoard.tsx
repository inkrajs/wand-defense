import { useLayoutEffect, useMemo, useRef } from "react";
import { InventoryGrid, PencilText } from "@inkra/react";
import type { InventoryContainer, InventoryChangeDetails } from "@inkra/react/inventory-grid";
import { AssetImage, resolveAsset } from "./assets";
import type { Command, CommandResult, GameState } from "../contracts";
import { inventoryDefinition as getDefinition, makeGridItem, quarterTurn, type DockItem } from "./inventoryAdapter";
import { getGameItemAppearance } from "./itemAppearance";
import "./WandBoard.css";

type Props = { activeCharacterId: string; state: GameState; dispatch: (command: Command) => CommandResult; onHeightChange: (height: number) => void };
type BoardItem = Extract<DockItem, { kind: "spell" | "arcana" }>;

export function WandBoard({ state, dispatch, activeCharacterId, onHeightChange }: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const character = state.characters.find(character => character.id === activeCharacterId) ?? state.characters[0];
  const equippedWands = useMemo(() => character ? character.wandIds.flatMap((id) => {
    const wand = state.wands.find((entry) => entry.id === id && entry.characterId === character.id);
    return wand ? [wand] : [];
  }).slice(0, 2) : [], [character, state.wands]);

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
    // offsetHeight is the untransformed layout box, so the battle scale is
    // applied exactly once by App's --game-board-space calculation.
    const reportHeight = () => onHeightChange(node.offsetHeight);
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

  // Registry 0.15 does not expose getItemAppearance; the local Inkra build does.
  const appearanceProps = import.meta.env.INKRA_LOCAL === true
    ? { getItemAppearance: getGameItemAppearance }
    : {};

  return <div className="wand-board" ref={boardRef}>
    <InventoryGrid<BoardItem>
      aria-label="当前角色法杖插槽"
      key={character?.id ?? activeCharacterId}
      className="wand-board__inventory"
      containers={containers}
      cellSize={56}
      disabled={state.phase === "battle"}
      allowRotation
      canPlace={({ source, target }) => source.id === target.id}
      onChange={onInventoryChange}
      labels={{
        instructions: "按空格选取物品，使用方向键移动，再按空格放下；按 R 旋转。",
        rotate: "旋转选中物品",
        pickedUp: (item) => `已选中 ${item}`,
        position: (item, container, column, row) => `${item} 移至第 ${column} 列、第 ${row} 行`,
        invalid: "此位置不可放置",
        requested: (item) => `已提交 ${item} 的布局操作`,
        cancelled: (item) => `已取消 ${item} 的移动`,
      }}
      getItemLabel={(item) => item.label ?? item.id}
      {...appearanceProps}
      renderItem={(item) => {
        const instance = state.items[item.id];
        const definition = instance && getDefinition(instance);
        return <span className="wand-board__item" title={item.label}>
          <span className="wand-board__item-icon"><AssetImage asset={resolveAsset(definition?.asset, { label: item.label ?? item.id, icon: item.kind === "spell" ? "✦" : "◇" })} /></span>
          <PencilText as="span" className="wand-board__item-label" seed="wand-board-item-label">{String(item.label)}</PencilText>
        </span>;
      }}
    />
  </div>;
}
