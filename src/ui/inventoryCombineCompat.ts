import type { Command, CommandResult, GameState } from "../contracts";
import { demoContent } from "../content/demo";
import { canMergeItems } from "../loadout/merge-items";
import type { DockItem } from "./inventoryAdapter";

type CombineContext = { sourceItem: DockItem; targetItem: DockItem };
type CombineProps = { canCombine?: (context: CombineContext) => boolean; onCombine?: (context: CombineContext) => void };

/** Merge previews are available only in the local Inkra build that exposes the public combine API. */
export function localInventoryCombineCompat(
  localPackage: boolean,
  state: GameState,
  dispatch: (command: Command) => CommandResult,
  onResult: (result: CommandResult) => void,
): CombineProps {
  if (!localPackage) return {};
  return {
    canCombine: ({ sourceItem, targetItem }) => sourceItem.kind !== "wand"
      && targetItem.kind !== "wand"
      && canMergeItems(state, sourceItem.id, targetItem.id, demoContent),
    onCombine: ({ sourceItem, targetItem }) => {
      onResult(dispatch({
        id: `inventory-merge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: "mergeItems",
        sourceItemId: sourceItem.id,
        targetItemId: targetItem.id,
      }));
    },
  };
}
