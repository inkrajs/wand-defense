import type { Command, CommandTransition, GameState } from "../contracts";
import { commit, reject } from "./transition";

export type WandEquipmentCommand = Extract<Command, { type: "equipWand" | "unequipWand" }>;

function findValidWand(state: GameState, command: WandEquipmentCommand):
  | { wand: GameState["wands"][number]; owner?: GameState["characters"][number] }
  | { error: CommandTransition } {
  const matches = state.wands.filter(wand => wand.id === command.wandId);
  if (matches.length !== 1) {
    return { error: reject(state, command, matches.length ? "WAND_OWNERSHIP_INVALID" : "WAND_NOT_FOUND", matches.length ? "法杖实例 ID 不唯一" : `法杖 ${command.wandId} 不存在`) };
  }

  const wand = matches[0];
  const declarations = state.characters.flatMap(character =>
    character.wandIds.filter(id => id === wand.id).map(() => character.id)
  );

  if (wand.characterId === null) {
    if (declarations.length !== 0) {
      return { error: reject(state, command, "WAND_OWNERSHIP_INVALID", "未装备法杖不能被角色声明") };
    }
    return { wand };
  }

  const owners = state.characters.filter(character => character.id === wand.characterId);
  if (owners.length !== 1 || declarations.length !== 1 || declarations[0] !== wand.characterId || !owners[0].wandIds.includes(wand.id)) {
    return { error: reject(state, command, "WAND_OWNERSHIP_INVALID", "法杖必须且只能由其归属角色声明一次") };
  }
  return { wand, owner: owners[0] };
}

/** Apply an equip/unequip operation as one immutable game-state transaction. */
export function applyWandEquipmentCommand(state: GameState, command: WandEquipmentCommand): CommandTransition {
  if (state.phase === "defeat") return reject(state, command, "DEFEAT", "失败后不能调整法杖装备");
  if (state.phase === "battle" && !state.paused) return reject(state, command, "LOADOUT_REQUIRES_PAUSE", "请先暂停战斗再调整法杖");

  const found = findValidWand(state, command);
  if ("error" in found) return found.error;
  const { wand, owner } = found;

  if (command.type === "unequipWand") {
    if (!owner) return reject(state, command, "ALREADY_UNEQUIPPED", "法杖尚未装备给角色");
    const characters = state.characters.map(character => character.id === owner.id
      ? { ...character, wandIds: character.wandIds.filter(id => id !== wand.id) }
      : character);
    const wands = state.wands.map(candidate => candidate.id === wand.id
      ? { ...candidate, characterId: null }
      : candidate);
    return commit(state, command, { characters, wands }, "wandUnequipped", {
      wandId: wand.id,
      fromCharacterId: owner.id
    });
  }

  const targets = state.characters.filter(character => character.id === command.characterId);
  if (targets.length !== 1) return reject(state, command, "CHARACTER_NOT_FOUND", `角色 ${command.characterId} 不存在或 ID 不唯一`);
  const target = targets[0];
  if (owner?.id === target.id) return reject(state, command, "ALREADY_EQUIPPED", "法杖已装备给该角色");
  if (target.wandIds.length >= 2) return reject(state, command, "WAND_CAPACITY", "每个角色最多装备两根法杖");
  if (target.wandIds.includes(wand.id)) return reject(state, command, "WAND_OWNERSHIP_INVALID", "目标角色已重复声明该法杖");

  const characters = state.characters.map(character => {
    if (owner && character.id === owner.id) {
      return { ...character, wandIds: character.wandIds.filter(id => id !== wand.id) };
    }
    if (character.id === target.id) return { ...character, wandIds: [...character.wandIds, wand.id] };
    return character;
  });
  const wands = state.wands.map(candidate => candidate.id === wand.id
    ? { ...candidate, characterId: target.id }
    : candidate);
  return commit(state, command, { characters, wands }, "wandEquipped", {
    wandId: wand.id,
    fromCharacterId: owner?.id ?? null,
    characterId: target.id
  });
}
