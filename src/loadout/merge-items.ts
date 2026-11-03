import type {
  Command, CommandTransition, ContentCatalog, GameState, Grade, ItemInstance, Placement
} from "../contracts";
import { gradeOrder } from "../content/grades";
import { commit, maxItemCooldown, reject } from "./transition";

export type MergeItemsCommand = Extract<Command, { type: "mergeItems" }>;

type ItemLocation =
  | { kind: "backpack"; index: number }
  | { kind: "wand"; wandIndex: number; placementIndex: number; placement: Placement };

interface ValidMerge {
  target: ItemInstance;
  definitionId: string;
  grade: Grade;
  level: number;
  targetLocation: ItemLocation;
}

function locationOf(state: GameState, itemId: string): ItemLocation | undefined {
  const locations: ItemLocation[] = [];
  state.backpack.forEach((id, index) => {
    if (id === itemId) locations.push({ kind: "backpack", index });
  });
  state.wands.forEach((wand, wandIndex) => wand.placements.forEach((placement, placementIndex) => {
    if (placement.itemId === itemId) locations.push({ kind: "wand", wandIndex, placementIndex, placement });
  }));
  return locations.length === 1 ? locations[0] : undefined;
}

function definitionMatches(item: ItemInstance, content: ContentCatalog): boolean {
  if (item.kind === "spell") return Object.hasOwn(content.spells, item.definitionId);
  if (item.kind === "arcana") return Object.hasOwn(content.arcana, item.definitionId);
  return false;
}

function validateMerge(
  state: GameState,
  sourceItemId: string,
  targetItemId: string,
  content: ContentCatalog,
  outputId?: string
): ValidMerge | undefined {
  if (state.phase === "defeat" || (state.phase === "battle" && !state.paused)) return undefined;
  if (sourceItemId === targetItemId) return undefined;

  const source = state.items[sourceItemId];
  const target = state.items[targetItemId];
  if (!source || !target || source.id !== sourceItemId || target.id !== targetItemId) return undefined;
  if (source.kind !== target.kind || source.definitionId !== target.definitionId || source.grade !== target.grade) return undefined;
  if (!definitionMatches(source, content) || !definitionMatches(target, content)) return undefined;

  const gradeIndex = gradeOrder.indexOf(source.grade);
  if (gradeIndex < 0 || gradeIndex >= gradeOrder.length - 1) return undefined;
  const sourceLocation = locationOf(state, sourceItemId);
  const targetLocation = locationOf(state, targetItemId);
  if (!sourceLocation || !targetLocation) return undefined;
  if (outputId !== undefined && Object.hasOwn(state.items, outputId)) return undefined;

  return {
    target,
    definitionId: target.definitionId,
    grade: gradeOrder[gradeIndex + 1],
    level: Math.max(source.level, target.level),
    targetLocation
  };
}

/** Pure eligibility check for UI candidate selection; it never mutates state. */
export function canMergeItems(
  state: GameState,
  sourceItemId: string,
  targetItemId: string,
  content: ContentCatalog
): boolean {
  return validateMerge(state, sourceItemId, targetItemId, content) !== undefined;
}

export function applyMergeItemsCommand(
  state: GameState,
  command: MergeItemsCommand,
  content: ContentCatalog
): CommandTransition {
  if (state.phase === "defeat") return reject(state, command, "DEFEAT", "失败后不能合并物品");
  if (state.phase === "battle" && !state.paused) return reject(state, command, "LOADOUT_REQUIRES_PAUSE", "请先暂停战斗再合并物品");

  const outputId = `${command.id}:merged`;
  const merge = validateMerge(state, command.sourceItemId, command.targetItemId, content, outputId);
  if (!merge) {
    if (Object.hasOwn(state.items, outputId)) return reject(state, command, "OUTPUT_ID_COLLISION", "合并产物实例 ID 已存在");
    return reject(state, command, "ITEMS_NOT_MERGEABLE", "所选物品不满足合并条件");
  }

  const output: ItemInstance = {
    id: outputId,
    definitionId: merge.definitionId,
    kind: merge.target.kind,
    level: merge.level,
    grade: merge.grade
  };
  const items = { ...state.items };
  delete items[command.sourceItemId];
  delete items[command.targetItemId];
  items[outputId] = output;

  const backpack = state.backpack.flatMap((id, index) => {
    if (id === command.sourceItemId) return [];
    if (merge.targetLocation.kind === "backpack" && index === merge.targetLocation.index) return [outputId];
    return [id];
  });
  const wands = state.wands.map((wand, wandIndex) => ({
    ...wand,
    placements: wand.placements.flatMap((placement, placementIndex) => {
      if (placement.itemId === command.sourceItemId) return [];
      if (merge.targetLocation.kind === "wand" && wandIndex === merge.targetLocation.wandIndex && placementIndex === merge.targetLocation.placementIndex) {
        return [{ ...placement, itemId: outputId }];
      }
      return [placement];
    }),
    cooldowns: Object.fromEntries(Object.entries(wand.cooldowns).filter(([id]) => id !== command.sourceItemId && id !== command.targetItemId))
  }));

  const maxCooldown = maxItemCooldown(state, [command.sourceItemId, command.targetItemId]);
  if (maxCooldown > 0) {
    let cooldownWandIndex: number | undefined;
    if (merge.targetLocation.kind === "wand") {
      cooldownWandIndex = merge.targetLocation.wandIndex;
    } else {
      cooldownWandIndex = state.wands.findIndex(wand =>
        [command.sourceItemId, command.targetItemId].some(id => {
          const value = wand.cooldowns[id];
          return Number.isFinite(value) && value >= 0 && value === maxCooldown;
        })
      );
      if (cooldownWandIndex < 0) cooldownWandIndex = state.wands.length > 0 ? 0 : undefined;
    }
    if (cooldownWandIndex !== undefined) {
      wands[cooldownWandIndex] = {
        ...wands[cooldownWandIndex],
        cooldowns: { ...wands[cooldownWandIndex].cooldowns, [outputId]: maxCooldown }
      };
    }
  }

  return commit(state, command, { items, backpack, wands }, "itemsMerged", {
    sourceItemId: command.sourceItemId,
    targetItemId: command.targetItemId,
    outputItemId: outputId,
    definitionId: merge.definitionId,
    grade: merge.grade
  });
}
