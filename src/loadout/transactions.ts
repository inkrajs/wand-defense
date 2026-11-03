import type {
  Cell, Command, CommandTransition, ContentCatalog, GameState,
  ItemInstance, Placement, WandInstance
} from "../contracts";
import { areAdjacent, placementCells, validatePlacement } from "./geometry";

import { commit, reject, maxItemCooldown } from "./transition";
import { applyMergeItemsCommand } from "./merge-items";
import { applyDiscardCommand } from "./discard";
import { applyGearCommand } from "./gear";
import { applyClearWandCommand } from "./clear-wand";
import { applyWandEquipmentCommand } from "./equipment";

function shapeFor(item: ItemInstance, content: ContentCatalog): Cell[] | undefined {
  const def = item.kind === "spell" ? content.spells[item.definitionId] : content.arcana[item.definitionId];
  return def?.shape;
}

function itemLocation(state: GameState, itemId: string): { backpack: number; placements: Array<{ wand: WandInstance; placement: Placement }> } {
  const placements: Array<{ wand: WandInstance; placement: Placement }> = [];
  for (const wand of state.wands) for (const placement of wand.placements) {
    if (placement.itemId === itemId) placements.push({ wand, placement });
  }
  return { backpack: state.backpack.filter(id => id === itemId).length, placements };
}

function occupiedCells(state: GameState, wand: WandInstance, content: ContentCatalog, exceptId?: string): Cell[] {
  return wand.placements.flatMap(p => {
    if (p.itemId === exceptId) return [];
    const item = state.items[p.itemId];
    const shape = item && shapeFor(item, content);
    return shape ? placementCells(shape, p) : [];
  });
}

function validSource(state: GameState, itemId: string, wandId: string): { ok: true; from: "backpack" | "wand"; sourceWand?: WandInstance } | { ok: false; code: string; message: string } {
  if (!state.items[itemId]) return { ok: false, code: "ITEM_NOT_FOUND", message: `物品 ${itemId} 不存在` };
  const location = itemLocation(state, itemId);
  if (location.backpack + location.placements.length !== 1) return { ok: false, code: "ITEM_LOCATION_INVALID", message: `物品 ${itemId} 必须且只能有一个位置` };
  if (location.backpack === 1) return { ok: true, from: "backpack" };
  const { wand, placement } = location.placements[0];
  if (wand.id !== wandId) return { ok: false, code: "CROSS_WAND_MOVE", message: "不能直接在不同法杖之间移动物品" };
  if (placement.itemId !== itemId) return { ok: false, code: "ITEM_LOCATION_INVALID", message: "物品位置无效" };
  return { ok: true, from: "wand", sourceWand: wand };
}

function multisetEquals(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const counts = new Map<string, number>();
  for (const id of a) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const id of b) {
    const n = counts.get(id) ?? 0;
    if (!n) return false;
    counts.set(id, n - 1);
  }
  return true;
}

/** Validate using the existing pure equipment transactions, then publish one atomic swap. */
function applySlotEquipment(state: GameState, command: Extract<Command, {type: "equipWand"}>): CommandTransition {
  const requestedSlot = command.slot;
  if (requestedSlot !== 0 && requestedSlot !== 1) return reject(state, command, "INVALID_SLOT", "法杖槽位必须为0或1");
  const targets = state.characters.filter(character => character.id === command.characterId);
  if (targets.length !== 1) return reject(state, command, "CHARACTER_NOT_FOUND", "目标角色不存在或ID不唯一");
  const target = targets[0];
  if (target.wandIds.length > 2) return reject(state, command, "INVALID_SLOT", "目标法杖槽位无效");
  const slot = Math.min(requestedSlot, target.wandIds.length);
  const replacedWandId = target.wandIds[slot];
  if (replacedWandId === command.wandId) return reject(state, command, "ALREADY_EQUIPPED", "法杖已在该槽位");
  const incoming = state.wands.find(wand => wand.id === command.wandId);
  if (!incoming) return reject(state, command, "WAND_NOT_FOUND", "法杖不存在");
  let staged = state;
  if (incoming.characterId !== null) {
    const detached = applyWandEquipmentCommand(staged, {id: command.id, type: "unequipWand", wandId: incoming.id});
    if (detached.result.status !== "executed") return reject(state, command, detached.result.code ?? "WAND_OWNERSHIP_INVALID", "来源法杖归属无效");
    staged = detached.state;
  }
  if (replacedWandId !== undefined) {
    const replaced = staged.wands.find(wand => wand.id === replacedWandId);
    if (replaced?.characterId !== target.id) return reject(state, command, "WAND_OWNERSHIP_INVALID", "目标法杖归属无效");
    const detached = applyWandEquipmentCommand(staged, {id: command.id, type: "unequipWand", wandId: replacedWandId});
    if (detached.result.status !== "executed") return reject(state, command, detached.result.code ?? "WAND_OWNERSHIP_INVALID", "目标法杖归属无效");
    staged = detached.state;
  }
  const equipped = applyWandEquipmentCommand(staged, {id: command.id, type: "equipWand", wandId: command.wandId, characterId: target.id});
  if (equipped.result.status !== "executed") return reject(state, command, equipped.result.code ?? "WAND_OWNERSHIP_INVALID", "装备法杖失败");
  const retainedIds = target.wandIds.filter(id => id !== command.wandId && id !== replacedWandId);
  const actualSlot = Math.min(slot, retainedIds.length);
  retainedIds.splice(actualSlot, 0, command.wandId);
  const characters = equipped.state.characters.map(character => character.id === target.id ? {...character, wandIds: retainedIds} : character);
  return commit(state, command, {characters, wands: equipped.state.wands}, "wandEquipped", {
    wandId: command.wandId, characterId: target.id, fromCharacterId: incoming.characterId,
    slot: actualSlot, ...(replacedWandId !== undefined ? {replacedWandId} : {}),
  });
}

export function applyLoadoutCommand(state: GameState, command: Command, content: ContentCatalog): CommandTransition {
  if (!["placeItem", "removeItem", "clearWand", "mergeRecipe", "equipWand", "unequipWand", "mergeItems", "discardItem", "discardWand", "equipGear", "unequipGear", "discardGear"].includes(command.type)) {
    return reject(state, command, "UNSUPPORTED_COMMAND", "此模块不处理该命令");
  }
  if (state.phase === "defeat") return reject(state, command, "DEFEAT", "失败后不能调整构筑");
  if (state.phase === "battle" && !state.paused) return reject(state, command, "LOADOUT_REQUIRES_PAUSE", "请先暂停战斗再调整法杖");

  switch (command.type) {
    case "placeItem": {
      if (![0, 1, 2, 3].includes(command.rotation)) return reject(state, command, "INVALID_ROTATION", "旋转值必须为 0、1、2 或 3");
      const wand = state.wands.find(w => w.id === command.wandId);
      if (!wand) return reject(state, command, "WAND_NOT_FOUND", `法杖 ${command.wandId} 不存在`);
      const item = state.items[command.itemId];
      const source = validSource(state, command.itemId, wand.id);
      if (!source.ok) return reject(state, command, source.code, source.message);
      const shape = item && shapeFor(item, content);
      if (!shape) return reject(state, command, "CONTENT_NOT_FOUND", "物品定义不存在");
      const placement: Placement = { itemId: item.id, x: command.x, y: command.y, rotation: command.rotation };
      const cells = placementCells(shape, placement);
      const checked = validatePlacement(wand.width, wand.height, cells, occupiedCells(state, wand, content, item.id));
      if (!checked.valid) return reject(state, command, checked.code ?? "INVALID_PLACEMENT", "该位置超出法杖或与其他物品重叠");
      const remaining = maxItemCooldown(state, [item.id]);
      const wands = state.wands.map(w => {
        const cooldowns = { ...w.cooldowns };
        delete cooldowns[item.id];
        if (w.id === wand.id) cooldowns[item.id] = remaining;
        return w.id === wand.id
          ? { ...w, placements: [...w.placements.filter(p => p.itemId !== item.id), placement], cooldowns }
          : { ...w, cooldowns };
      });
      const backpack = source.from === "backpack" ? state.backpack.filter(id => id !== item.id) : state.backpack;
      return commit(state, command, { wands, backpack }, "itemPlaced", { itemId: item.id, wandId: wand.id, x: placement.x, y: placement.y, rotation: placement.rotation });
    }
    case "removeItem": {
      const wand = state.wands.find(w => w.id === command.wandId);
      if (!wand) return reject(state, command, "WAND_NOT_FOUND", `法杖 ${command.wandId} 不存在`);
      const source = validSource(state, command.itemId, wand.id);
      if (!source.ok) return reject(state, command, source.code, source.message);
      if (source.from !== "wand") return reject(state, command, "ITEM_NOT_ON_WAND", "物品不在指定法杖上");
      const wands = state.wands.map(w => w.id !== wand.id ? w : {
        ...w, placements: w.placements.filter(p => p.itemId !== command.itemId)
      });
      return commit(state, command, { wands, backpack: [...state.backpack, command.itemId] }, "itemRemoved", { itemId: command.itemId, wandId: wand.id });
    }
    case "mergeRecipe": {
      const wand = state.wands.find(w => w.id === command.wandId);
      if (!wand) return reject(state, command, "WAND_NOT_FOUND", `法杖 ${command.wandId} 不存在`);
      const recipe = content.recipes.find(r => r.id === command.recipeId);
      if (!recipe || !state.knowledge.recipeIds.includes(command.recipeId)) return reject(state, command, "RECIPE_UNKNOWN", "尚未发现该配方");
      if (new Set(command.itemIds).size !== command.itemIds.length || !multisetEquals(command.itemIds.map(id => state.items[id]?.definitionId ?? ""), recipe.inputs)) {
        return reject(state, command, "RECIPE_INPUTS_MISMATCH", "所选物品与配方材料不完全一致");
      }
      if (command.itemIds.some(id => !state.items[id] || !shapeFor(state.items[id], content))) return reject(state, command, "CONTENT_NOT_FOUND", "合成材料定义不存在");
      const sources = command.itemIds.map(id => validSource(state, id, wand.id));
      const invalid = sources.find(s => !s.ok);
      if (invalid && !invalid.ok) return reject(state, command, invalid.code, invalid.message);
      if (sources.some(s => s.ok && s.from !== "wand")) return reject(state, command, "INPUT_NOT_ON_WAND", "合成材料必须都在指定法杖上");
      const placements = command.itemIds.map(id => wand.placements.find(p => p.itemId === id));
      if (placements.some(p => !p)) return reject(state, command, "INPUT_NOT_ON_WAND", "合成材料必须都在指定法杖上");
      if (recipe.requireAdjacency) {
        const cellSets = placements.map(p => {
          const item = p && state.items[p.itemId];
          const shape = item && shapeFor(item, content);
          return p && shape ? placementCells(shape, p) : [];
        });
        const reached = new Set([0]);
        const queue = [0];
        while (queue.length) {
          const i = queue.shift()!;
          for (let j = 0; j < cellSets.length; j++) {
            if (!reached.has(j) && areAdjacent(cellSets[i], cellSets[j])) { reached.add(j); queue.push(j); }
          }
        }
        if (reached.size !== cellSets.length) return reject(state, command, "INPUTS_NOT_ADJACENT", "所选材料没有构成四边连通的组合");
      }
      const outputId = `${command.id}:output`;
      if (state.items[outputId]) return reject(state, command, "OUTPUT_ID_COLLISION", "合成产物实例 ID 已存在");
      const [kind, definition] = content.spells[recipe.output] ? ["spell", content.spells[recipe.output]] as const : content.arcana[recipe.output] ? ["arcana", content.arcana[recipe.output]] as const : [undefined, undefined] as const;
      if (!kind || !definition) return reject(state, command, "OUTPUT_NOT_FOUND", "配方产物定义不存在");
      const output: ItemInstance = { id: outputId, definitionId: recipe.output, kind, level: definition.level, grade: definition.grade };
      const items = { ...state.items, [outputId]: output };
      for (const id of command.itemIds) delete items[id];
      const wands = state.wands.map(w => w.id !== wand.id ? w : {
        ...w, placements: w.placements.filter(p => !command.itemIds.includes(p.itemId)),
        cooldowns: Object.fromEntries(Object.entries(w.cooldowns).filter(([id]) => !command.itemIds.includes(id)))
      });
      const recipeIds = state.knowledge.recipeIds;
      const knowledge = {
        ...state.knowledge,
        spellIds: kind === "spell" ? [...new Set([...state.knowledge.spellIds, recipe.output])] : state.knowledge.spellIds,
        arcanaIds: kind === "arcana" ? [...new Set([...state.knowledge.arcanaIds, recipe.output])] : state.knowledge.arcanaIds,
        recipeIds
      };
      return commit(state, command, { items, wands, backpack: [...state.backpack, outputId], knowledge }, "recipeMerged", { recipeId: recipe.id, consumedItemIds: [...command.itemIds], outputItemId: outputId });
    }
    case "clearWand":
      return applyClearWandCommand(state, command);
    case "equipGear":
    case "unequipGear":
    case "discardGear":
      return applyGearCommand(state, command, content);
    case "discardItem":
    case "discardWand":
      return applyDiscardCommand(state, command);
    case "mergeItems":
      return applyMergeItemsCommand(state, command, content);
    case "equipWand":
      return command.slot !== undefined ? applySlotEquipment(state, command) : applyWandEquipmentCommand(state, command);
    case "unequipWand":
      return applyWandEquipmentCommand(state, command);
    default:
      return reject(state, command, "UNSUPPORTED_COMMAND", "此模块不处理该命令");
  }
}
