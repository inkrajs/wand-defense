import { useMemo } from "react";
import { InventoryGrid } from "@inkra/react";
import type { InventoryContainer, InventoryItem, InventoryChangeDetails } from "@inkra/react/inventory-grid";
import { AssetImage, resolveAsset } from "./assets";
import type { Command, CommandResult, GameState, ItemInstance } from "../contracts";
import { demoContent } from "../content/demo";
import "./WandBoard.css";

type Props = { state: GameState; dispatch: (command: Command) => CommandResult };
type BoardItem = InventoryItem & { kind: ItemInstance["kind"]; definitionId: string };

function getDefinition(item: Pick<ItemInstance, "kind" | "definitionId">) {
  return item.kind === "spell" ? demoContent.spells[item.definitionId] : demoContent.arcana[item.definitionId];
}

function quarterTurn(value: number): 0 | 1 | 2 | 3 {
  return (((value / 90) % 4 + 4) % 4) as 0 | 1 | 2 | 3;
}

export function WandBoard({ state, dispatch }: Props) {
  const firstCharacter = state.characters[0];
  const wand = state.wands.find((entry) => entry.characterId === firstCharacter?.id && firstCharacter.wandIds.includes(entry.id));

  const containers = useMemo<InventoryContainer<BoardItem>[]>(() => {
    const items: BoardItem[] = wand ? wand.placements.flatMap((placement) => {
      const instance = state.items[placement.itemId];
      if (!instance) return [];
      const definition = getDefinition(instance);
      return [{
        id: instance.id,
        label: resolveAsset(definition?.asset, { label: definition?.name ?? instance.definitionId, icon: instance.kind === "spell" ? "✦" : "◇" }).label,
        cells: definition?.shape ?? [{ x: 0, y: 0 }],
        position: { x: placement.x, y: placement.y },
        rotation: (placement.rotation * 90) as BoardItem["rotation"],
        rotatable: true,
        kind: instance.kind,
        definitionId: instance.definitionId,
      }];
    }) : [];
    return [{ id: "wand", label: wand?.name ?? "法杖", columns: wand?.width ?? 1, rows: wand?.height ?? 1, items }];
  }, [state.items, wand]);

  function onInventoryChange(_next: readonly InventoryContainer<BoardItem>[], details: InventoryChangeDetails) {
    if (!wand || details.to.containerId !== "wand") return;
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

  return <div className="wand-board">
    <InventoryGrid<BoardItem>
      aria-label={`${wand?.name ?? "法杖"}插槽`}
      className="wand-board__inventory"
      containers={containers}
      cellSize={56}
      disabled={state.phase === "battle"}
      allowRotation
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
      renderItem={(item) => {
        const instance = state.items[item.id];
        const definition = instance && getDefinition(instance);
        return <span className="wand-board__item" title={item.label}>
          <AssetImage asset={resolveAsset(definition?.asset, { label: item.label ?? item.id, icon: item.kind === "spell" ? "✦" : "◇" })} />
          <span>{item.label}</span>
        </span>;
      }}
    />
  </div>;
}
