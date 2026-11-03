import type { Command, CommandTransition, ContentCatalog, GameState, SupplyDefinition } from "../contracts";
import { gradePower } from "../content/grades";
import { getCharacterStats } from "../content/characters";
import { commit, reject } from "../loadout/transition";

type SupplyCommand = Extract<Command, { type: "useItem" | "discardSupply" }>;

function validSupplyRegistry(state: GameState): boolean {
  const supplies = state.supplies;
  if (!supplies) return false;
  const ids = new Set<string>();
  for (const [key, instance] of Object.entries(supplies)) {
    if (!instance || instance.id !== key || ids.has(instance.id)) return false;
    ids.add(instance.id);
  }
  return true;
}

function allowedPhase(state: GameState): boolean {
  return state.phase === "ready" || state.phase === "reward" || (state.phase === "battle" && state.paused);
}

function scaledEffectValue(instanceGrade: keyof typeof gradePower, definition: SupplyDefinition): number | undefined {
  const instancePower = gradePower[instanceGrade];
  const definitionPower = gradePower[definition.grade];
  const value = definition.effect.value * instancePower / definitionPower;
  return Number.isFinite(instancePower) && instancePower > 0 && Number.isFinite(definitionPower) && definitionPower > 0 &&
    Number.isFinite(definition.effect.value) && definition.effect.value > 0 && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

/** Apply use/discard of a supply as a single immutable runtime transaction. */
export function applySupplyCommand(
  state: GameState,
  command: SupplyCommand,
  content: ContentCatalog,
): CommandTransition {
  const commandType = (command as { type: string }).type;
  if (commandType !== "useItem" && commandType !== "discardSupply") return reject(state, command, "UNSUPPORTED_COMMAND", "此模块不处理该命令");
  if (!allowedPhase(state)) return reject(state, command, state.phase === "defeat" ? "DEFEAT" : "SUPPLY_REQUIRES_PAUSE", "当前阶段不能使用或丢弃药水");
  if (!validSupplyRegistry(state)) return reject(state, command, "SUPPLY_REGISTRY_INVALID", "药水实例索引必须唯一且与实例 ID 一致");

  const supplies = state.supplies!;
  if (!Object.hasOwn(supplies, command.itemId)) return reject(state, command, "SUPPLY_NOT_FOUND", "指定药水不存在");
  const instance = supplies[command.itemId];
  if (!instance || instance.id !== command.itemId) return reject(state, command, "SUPPLY_NOT_FOUND", "指定药水不存在");

  if (command.type === "discardSupply") {
    const nextSupplies = { ...supplies };
    delete nextSupplies[command.itemId];
    return commit(state, command, { supplies: nextSupplies }, "supplyDiscarded", {
      itemId: instance.id,
      definitionId: instance.definitionId,
    });
  }

  // Defeated territory cannot be revived by a supply, even if phase data is inconsistent.
  if (!Number.isFinite(state.territory.hp) || state.territory.hp <= 0) {
    return reject(state, command, "TERRITORY_DEFEATED", "领地已陷落，不能使用药水复活");
  }
  const definition = content.items?.[instance.definitionId];
  if (!definition || definition.id !== instance.definitionId) return reject(state, command, "SUPPLY_DEFINITION_NOT_FOUND", "药水定义不存在");
  if (!Number.isSafeInteger(instance.level) || instance.level < 1 || !Number.isSafeInteger(definition.level) || definition.level < 1) {
    return reject(state, command, "INVALID_SUPPLY_GROWTH", "药水等级无效");
  }
  const effect = (definition as { effect?: unknown }).effect;
  if (!effect || typeof effect !== "object" || !["territoryHeal", "territoryShield", "partyMana"].includes((effect as { type?: string }).type ?? "")) {
    return reject(state, command, "INVALID_SUPPLY_EFFECT", "药水效果类型无效");
  }
  const amount = scaledEffectValue(instance.grade, definition);
  if (amount === undefined) return reject(state, command, "INVALID_SUPPLY_EFFECT", "药水效果数值无效");

  switch (definition.effect.type) {
    case "territoryHeal": {
      const { hp, maxHp } = state.territory;
      if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || hp < 0 || maxHp < 0 || maxHp < hp) return reject(state, command, "INVALID_TERRITORY_RESOURCE", "领地生命值无效");
      const actual = Math.min(amount, Math.max(0, maxHp - hp));
      if (!Number.isFinite(actual) || actual <= 0) return reject(state, command, "NO_SUPPLY_EFFECT", "目标资源已满，药水没有效果");
      return consumeAndCommit(state, command, instance.id, definition, { territory: { ...state.territory, hp: hp + actual } }, actual);
    }
    case "territoryShield": {
      const shield = state.territory.shield ?? 0;
      const maxShield = state.territory.maxShield ?? 0;
      if (!Number.isFinite(shield) || !Number.isFinite(maxShield) || shield < 0 || maxShield < 0 || maxShield < shield) return reject(state, command, "INVALID_TERRITORY_RESOURCE", "领地护盾值无效");
      const actual = Math.min(amount, Math.max(0, maxShield - shield));
      if (!Number.isFinite(actual) || actual <= 0) return reject(state, command, "NO_SUPPLY_EFFECT", "目标资源已满，药水没有效果");
      return consumeAndCommit(state, command, instance.id, definition, {
        territory: { ...state.territory, shield: shield + actual, maxShield },
      }, actual);
    }
    case "partyMana": {
      const targets: Array<{ characterId: string; amount: number }> = [];
      let invalidCharacterResource = false;
      const characters = state.characters.map(character => {
        const maxMana = getCharacterStats(state, character.id, content)?.final.maxMana;
        if (!Number.isFinite(character.mana) || character.mana < 0 || !Number.isFinite(maxMana) || maxMana! < character.mana) {
          invalidCharacterResource = true;
          return character;
        }
        const actual = Math.min(amount, Math.max(0, maxMana! - character.mana));
        if (!Number.isFinite(actual)) {
          invalidCharacterResource = true;
          return character;
        }
        targets.push({ characterId: character.id, amount: actual });
        return actual > 0 ? { ...character, mana: character.mana + actual } : character;
      });
      if (invalidCharacterResource) return reject(state, command, "INVALID_CHARACTER_RESOURCE", "角色法力值无效");
      const total = targets.reduce((sum, target) => sum + target.amount, 0);
      if (!Number.isFinite(total) || total <= 0) return reject(state, command, "NO_SUPPLY_EFFECT", "队伍法力已满，药水没有效果");
      return consumeAndCommit(state, command, instance.id, definition, { characters }, total, targets);
    }
    default:
      return reject(state, command, "INVALID_SUPPLY_EFFECT", "药水效果类型无效");
  }
}

function consumeAndCommit(
  state: GameState,
  command: SupplyCommand,
  itemId: string,
  definition: SupplyDefinition,
  changes: Partial<GameState>,
  amount: number,
  targets?: Array<{ characterId: string; amount: number }>,
): CommandTransition {
  const supplies = { ...state.supplies! };
  delete supplies[itemId];
  const targetData = targets ? { targets } : {};
  return commit(state, command, { ...changes, supplies }, "itemUsed", {
    itemId,
    definitionId: definition.id,
    effectType: definition.effect.type,
    amount,
    ...targetData,
  });
}
