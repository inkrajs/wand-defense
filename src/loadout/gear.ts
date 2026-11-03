import type {
  Command, CommandTransition, ContentCatalog, GameState, GearInstance, GearSlot
} from "../contracts";
import { commit, reject } from "./transition";

export type GearCommand = Extract<Command, { type: "equipGear" | "unequipGear" | "discardGear" }>;
const GEAR_SLOTS: readonly GearSlot[] = ["head", "body", "feet", "accessory"];

interface LocatedGear {
  gear: GearInstance;
  owner?: GameState["characters"][number];
}

function checkGear(state: GameState, gearId: string, content: ContentCatalog, requireDefinition = true):
  | { value: LocatedGear }
  | { code: string; message: string } {
  const registry = state.gear;
  if (!registry) return { code: "GEAR_NOT_FOUND", message: `装备 ${gearId} 不存在` };

  for (const [key, record] of Object.entries(registry)) {
    if (!record || typeof record !== "object" || typeof record.id !== "string" || record.id !== key) {
      return { code: "GEAR_OWNERSHIP_INVALID", message: "装备实例记录 ID 与装备表键不一致" };
    }
    if (!GEAR_SLOTS.includes(record.slot)) return { code: "GEAR_SLOT_INVALID", message: "装备记录包含无效部位" };
  }

  if (!Object.hasOwn(registry, gearId)) {
    const aliased = Object.values(registry).some(record => record?.id === gearId);
    return aliased
      ? { code: "GEAR_OWNERSHIP_INVALID", message: "装备实例 ID 与装备表键不一致" }
      : { code: "GEAR_NOT_FOUND", message: `装备 ${gearId} 不存在` };
  }
  const gear = registry[gearId];

  if (requireDefinition && gear.definitionId !== undefined) {
    const definitions = content.gear;
    if (!definitions || !Object.hasOwn(definitions, gear.definitionId)) {
      return { code: "GEAR_DEFINITION_NOT_FOUND", message: "装备定义不存在" };
    }
    const definition = definitions[gear.definitionId];
    if (definition.id !== gear.definitionId || definition.slot !== gear.slot) {
      return { code: "GEAR_SLOT_MISMATCH", message: "装备实例与定义的部位不一致" };
    }
  }

  const declarations = state.characters.flatMap(character =>
    Object.entries(character.gearIds ?? {})
      .filter(([, declaredId]) => declaredId === gearId)
      .map(([slot]) => ({ character, slot }))
  );

  if (gear.characterId === null) {
    if (declarations.length !== 0) return { code: "GEAR_OWNERSHIP_INVALID", message: "未装备的装备不能被角色声明" };
    return { value: { gear } };
  }

  const owners = state.characters.filter(character => character.id === gear.characterId);
  if (owners.length !== 1 || declarations.length !== 1
    || declarations[0].character.id !== gear.characterId || declarations[0].slot !== gear.slot) {
    return { code: "GEAR_OWNERSHIP_INVALID", message: "装备归属必须与角色部位声明双向一致且唯一" };
  }
  return { value: { gear, owner: owners[0] } };
}

function targetCharacter(state: GameState, characterId: string):
  | { value: GameState["characters"][number] }
  | { code: string; message: string } {
  const matches = state.characters.filter(character => character.id === characterId);
  if (matches.length !== 1) return { code: "CHARACTER_NOT_FOUND", message: `角色 ${characterId} 不存在或 ID 不唯一` };
  return { value: matches[0] };
}

function validatePhase(state: GameState, command: GearCommand): CommandTransition | undefined {
  if (state.phase === "defeat") return reject(state, command, "DEFEAT", "失败后不能调整装备");
  if (state.phase !== "ready" && state.phase !== "reward" && !(state.phase === "battle" && state.paused)) {
    return reject(state, command, "LOADOUT_REQUIRES_PAUSE", "请先暂停战斗再调整装备");
  }
  return undefined;
}

function applyEquip(
  state: GameState,
  command: Extract<GearCommand, { type: "equipGear" }>,
  content: ContentCatalog
): CommandTransition {
  const sourceResult = checkGear(state, command.gearId, content);
  if (!("value" in sourceResult)) return reject(state, command, sourceResult.code, sourceResult.message);
  const source = sourceResult.value;
  const targetResult = targetCharacter(state, command.characterId);
  if (!("value" in targetResult)) return reject(state, command, targetResult.code, targetResult.message);
  const target = targetResult.value;
  if (source.owner?.id === target.id) return reject(state, command, "ALREADY_EQUIPPED", "该装备已由此角色穿戴");

  const replacedGearId = target.gearIds?.[source.gear.slot];
  let replaced: LocatedGear | undefined;
  if (replacedGearId !== undefined) {
    const replacedResult = checkGear(state, replacedGearId, content);
    if (!("value" in replacedResult)) return reject(state, command, replacedResult.code, replacedResult.message);
    replaced = replacedResult.value;
    if (replaced.gear.slot !== source.gear.slot || replaced.owner?.id !== target.id) {
      return reject(state, command, "GEAR_OWNERSHIP_INVALID", "目标部位的现有装备归属无效");
    }
  }

  const gear = { ...state.gear! };
  if (replaced) gear[replaced.gear.id] = { ...replaced.gear, characterId: null };
  gear[source.gear.id] = { ...source.gear, characterId: target.id };

  const characters = state.characters.map(character => {
    const isOwner = source.owner?.id === character.id;
    const isTarget = character.id === target.id;
    if (!isOwner && !isTarget) return character;
    const gearIds = { ...(character.gearIds ?? {}) };
    if (isOwner) delete gearIds[source.gear.slot];
    if (isTarget) gearIds[source.gear.slot] = source.gear.id;
    return { ...character, gearIds };
  });

  return commit(state, command, { gear, characters }, "gearEquipped", {
    gearId: source.gear.id,
    characterId: target.id,
    fromCharacterId: source.owner?.id ?? null,
    slot: source.gear.slot,
    ...(replaced ? { replacedGearId: replaced.gear.id } : {})
  });
}

function applyUnequip(
  state: GameState,
  command: Extract<GearCommand, { type: "unequipGear" }>,
  content: ContentCatalog
): CommandTransition {
  const result = checkGear(state, command.gearId, content, false);
  if (!("value" in result)) return reject(state, command, result.code, result.message);
  const { gear, owner } = result.value;
  if (!owner) return reject(state, command, "ALREADY_UNEQUIPPED", "该装备尚未穿戴");

  const gearIds = { ...(owner.gearIds ?? {}) };
  delete gearIds[gear.slot];
  const characters = state.characters.map(character => character.id === owner.id ? { ...character, gearIds } : character);
  const nextGear = { ...state.gear!, [gear.id]: { ...gear, characterId: null } };
  return commit(state, command, { gear: nextGear, characters }, "gearUnequipped", {
    gearId: gear.id,
    fromCharacterId: owner.id,
    slot: gear.slot
  });
}

function applyDiscard(
  state: GameState,
  command: Extract<GearCommand, { type: "discardGear" }>,
  content: ContentCatalog
): CommandTransition {
  const result = checkGear(state, command.gearId, content, false);
  if (!("value" in result)) return reject(state, command, result.code, result.message);
  const { gear, owner } = result.value;
  if (owner || gear.characterId !== null) return reject(state, command, "GEAR_EQUIPPED", "穿戴中的装备不能丢弃");

  const nextGear = { ...state.gear! };
  delete nextGear[gear.id];
  return commit(state, command, { gear: nextGear }, "gearDiscarded", {
    gearId: gear.id,
    ...(gear.definitionId !== undefined ? { definitionId: gear.definitionId } : {})
  });
}

export function applyGearCommand(
  state: GameState,
  command: GearCommand,
  content: ContentCatalog
): CommandTransition {
  const phaseError = validatePhase(state, command);
  if (phaseError) return phaseError;
  switch (command.type) {
    case "equipGear": return applyEquip(state, command, content);
    case "unequipGear": return applyUnequip(state, command, content);
    case "discardGear": return applyDiscard(state, command, content);
    default: return reject(state, command, "UNSUPPORTED_COMMAND", "此模块不处理该命令");
  }
}
