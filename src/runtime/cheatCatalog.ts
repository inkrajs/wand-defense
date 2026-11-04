import type {
  ArcanaDefinition, AssetRef, Cell, CharacterStatBonuses, Command, ContentCatalog, Element,
  GameState, Grade, ItemInstance, SpellDefinition
} from "../contracts";
import { getCharacterStats } from "../content/characters";
import { experienceThreshold } from "../content/progression";
import { gradeOrder } from "../content/grades";
import { discoverAvailableRecipes } from "../content/recipeKnowledge";
import { createGearFromDefinition } from "../content/gear";
import { createSupplyFromDefinition } from "../content/supplies";
import { createWandFromTemplate, wandTemplates } from "../content/wands";
import { addRunStatistic, createRunStatistics } from "./runStatistics";

export const CHEAT_TARGET_LEVEL = 50;

const catalogActions = new Set([
  "grantAllMagic", "maxMagic", "grantAllWands", "maxWands",
  "grantAllGear", "maxGear", "grantAllSupplies", "maxSupplies", "levelCharacter",
]);

export function isCatalogCheatAction(action: string): boolean {
  return catalogActions.has(action);
}

type CheatCommand = Extract<Command, { type: "cheat" }>;
type CatalogCheatCommand = Extract<CheatCommand, { action: "grantAllMagic" | "maxMagic" | "grantAllWands" | "maxWands" | "grantAllGear" | "maxGear" | "grantAllSupplies" | "maxSupplies" | "levelCharacter" }>;
export type CatalogCheatEvent = { type: string; data: Record<string, unknown> };
export type CatalogCheatResult =
  | { ok: true; state: GameState; events: CatalogCheatEvent[] }
  | { ok: false; code: string };

const failure = (code: string): CatalogCheatResult => ({ ok: false, code });
const validLevel = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 1;
const validGrade = (value: unknown): value is Grade => typeof value === "string" && gradeOrder.includes(value as Grade);
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const elements: readonly Element[] = ["fire", "wood", "metal", "water", "earth", "light", "dark", "lightning", "wind"];
const gearSlots = ["head", "body", "feet", "accessory"] as const;
const supplyEffects = ["territoryHeal", "territoryShield", "partyMana", "territoryRestore", "partyManaPercent", "cooldownAdvance", "territoryHealPercent", "territoryShieldPercent"] as const;
const percentageSupplyEffects = new Set(["partyManaPercent", "territoryHealPercent", "territoryShieldPercent"]);

function isCatalogCommand(command: CheatCommand): command is CatalogCheatCommand {
  return isCatalogCheatAction(command.action);
}

function addUniqueId(used: Set<string>, id: unknown): boolean {
  if (typeof id !== "string" || id.length === 0 || used.has(id)) return false;
  used.add(id);
  return true;
}

/** Validate all persisted instance identities and level metadata before any draft changes. */
function validateExistingState(state: GameState): string | undefined {
  const raw = state as unknown as Record<string, unknown>;
  if (!Array.isArray(raw.characters) || !Array.isArray(raw.wands) || !record(raw.items)
    || !Array.isArray(raw.backpack) || raw.backpack.some(id => typeof id !== "string" || id.length === 0)
    || !Array.isArray(raw.entities) || !Array.isArray(raw.rewards) || !record(raw.knowledge)
    || !record(raw.cheats)) return "INVALID_EXISTING_STATE";
  if (raw.gear !== undefined && !record(raw.gear)) return "INVALID_EXISTING_INSTANCE";
  if (raw.supplies !== undefined && !record(raw.supplies)) return "INVALID_EXISTING_INSTANCE";
  const ids = new Set<string>();
  for (const value of raw.characters) {
    if (!record(value)) return "INVALID_EXISTING_INSTANCE";
    if (!addUniqueId(ids, value.id) || !validLevel(value.level) || !validGrade(value.grade)
      || (value.gearIds !== undefined && !record(value.gearIds))) return "INVALID_EXISTING_INSTANCE";
  }
  for (const value of raw.wands) {
    if (!record(value)) return "INVALID_EXISTING_INSTANCE";
    if (!addUniqueId(ids, value.id) || !validLevel(value.level) || !validGrade(value.grade)
      || !Number.isSafeInteger(value.width) || (value.width as number) < 1
      || !Number.isSafeInteger(value.height) || (value.height as number) < 1
      || !Array.isArray(value.placements) || !record(value.cooldowns)) return "INVALID_EXISTING_INSTANCE";
  }
  for (const [key, value] of Object.entries(raw.items)) {
    if (!record(value) || key !== value.id || !addUniqueId(ids, value.id) || !validLevel(value.level) || !validGrade(value.grade)
      || (value.kind !== "spell" && value.kind !== "arcana") || typeof value.definitionId !== "string" || value.definitionId.length === 0) return "INVALID_EXISTING_INSTANCE";
  }
  if (raw.gear !== undefined) {
    for (const [key, value] of Object.entries(raw.gear)) {
      if (!record(value) || key !== value.id || !addUniqueId(ids, value.id) || !validLevel(value.level) || !validGrade(value.grade)) return "INVALID_EXISTING_INSTANCE";
    }
  }
  if (raw.supplies !== undefined) {
    for (const [key, value] of Object.entries(raw.supplies)) {
      if (!record(value) || key !== value.id || !addUniqueId(ids, value.id) || !validLevel(value.level) || !validGrade(value.grade)) return "INVALID_EXISTING_INSTANCE";
    }
  }
  for (const value of raw.entities) {
    if (!record(value) || !addUniqueId(ids, value.id)) return "INVALID_EXISTING_INSTANCE";
    if (value.level !== undefined && !validLevel(value.level)) return "INVALID_EXISTING_INSTANCE";
    if (value.grade !== undefined && !validGrade(value.grade)) return "INVALID_EXISTING_INSTANCE";
  }
  for (const value of raw.rewards) if (!record(value) || !addUniqueId(ids, value.id)) return "INVALID_EXISTING_INSTANCE";
  const knowledge = raw.knowledge;
  if (!record(knowledge)) return "INVALID_KNOWLEDGE";
  for (const key of ["spellIds", "arcanaIds", "recipeIds"] as const) {
    if (!Array.isArray(knowledge[key]) || (knowledge[key] as unknown[]).some(id => typeof id !== "string" || id.length === 0)) return "INVALID_KNOWLEDGE";
  }
  for (const key of ["gearIds", "itemIds"] as const) {
    if (knowledge[key] !== undefined && (!Array.isArray(knowledge[key]) || (knowledge[key] as unknown[]).some(id => typeof id !== "string" || id.length === 0))) return "INVALID_KNOWLEDGE";
  }
  return undefined;
}

function validDefinition<T extends { id: string; level: number; grade: Grade }>(key: string, value: T): boolean {
  return value !== null && typeof value === "object" && value.id === key && validLevel(value.level) && validGrade(value.grade);
}

function validateCatalog<T extends { id: string; level: number; grade: Grade }>(catalog: Record<string, T> | undefined): boolean {
  if (!catalog || !record(catalog)) return false;
  const ids = new Set<string>();
  for (const [key, definition] of Object.entries(catalog)) {
    if (!validDefinition(key, definition) || ids.has(definition.id)) return false;
    ids.add(definition.id);
  }
  return true;
}

function validateMagicCatalog(content: ContentCatalog): boolean {
  if (!validateCatalog(content.spells) || !validateCatalog(content.arcana)) return false;
  const spellIds = Object.keys(content.spells);
  const arcanaIds = Object.keys(content.arcana);
  if (arcanaIds.some(id => spellIds.includes(id))) return false;
  const ids = new Set([...spellIds, ...arcanaIds]);
  for (const definition of Object.values(content.spells)) {
    if (!validShape(definition.shape) || !validAsset(definition.asset) || !validFiniteNonnegative(definition.power)
      || !validFiniteNonnegative(definition.manaCost) || !validFiniteNonnegative(definition.cooldownMs)
      || !validFiniteNonnegative(definition.range)) return false;
  }
  for (const definition of Object.values(content.arcana)) {
    if (!validShape(definition.shape) || !validAsset(definition.asset) || !Number.isFinite(definition.value) || definition.value <= 0) return false;
  }
  if (!Array.isArray(content.recipes)) return false;
  const recipeIds = new Set<string>();
  for (const recipe of content.recipes) {
    if (!recipe || typeof recipe.id !== "string" || recipe.id.length === 0 || recipeIds.has(recipe.id)
      || !Array.isArray(recipe.inputs) || recipe.inputs.length === 0
      || recipe.inputs.some(id => typeof id !== "string" || !ids.has(id))
      || typeof recipe.output !== "string" || !ids.has(recipe.output)) return false;
    recipeIds.add(recipe.id);
  }
  return true;
}

function validFiniteNonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validShape(value: unknown): value is Cell[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  const cells = new Set<string>();
  for (const cell of value) {
    if (!record(cell) || !Number.isSafeInteger(cell.x) || !Number.isSafeInteger(cell.y)) return false;
    const key = `${cell.x},${cell.y}`;
    if (cells.has(key)) return false;
    cells.add(key);
  }
  return true;
}

function validAsset(value: unknown): value is AssetRef {
  return record(value) && typeof value.key === "string" && value.key.length > 0 && typeof value.label === "string";
}

function validGearBonuses(value: unknown): value is CharacterStatBonuses {
  if (!record(value)) return false;
  for (const [key, stat] of Object.entries(value)) {
    if (key === "elementBonuses") {
      if (!record(stat)) return false;
      for (const [element, bonus] of Object.entries(stat)) if (!elements.includes(element as Element) || !Number.isFinite(bonus)) return false;
    } else if (!new Set(["attack", "gatheringPercent", "castSpeedPercent", "projectileSpeedPercent", "range", "accuracy", "critChance", "critMultiplier", "luck", "maxMana", "manaRegen"]).has(key)
      || typeof stat !== "number" || !Number.isFinite(stat)) return false;
  }
  return true;
}

function validateGearCatalog(catalog: ContentCatalog["gear"]): boolean {
  if (!validateCatalog(catalog)) return false;
  for (const definition of Object.values(catalog!)) {
    if (!gearSlots.includes(definition.slot) || !validShape(definition.shape) || !validAsset(definition.asset)
      || !validGearBonuses(definition.statBonuses)) return false;
  }
  return true;
}

function validateSupplyCatalog(catalog: ContentCatalog["items"]): boolean {
  if (!validateCatalog(catalog)) return false;
  for (const definition of Object.values(catalog!)) {
    const effect = definition.effect;
    if (!validShape(definition.shape) || !validAsset(definition.asset) || !effect || !supplyEffects.includes(effect.type)
      || !Number.isFinite(effect.value) || effect.value <= 0
      || (percentageSupplyEffects.has(effect.type) && effect.value > 100)) return false;
  }
  return true;
}

function allInstanceIds(state: GameState): Set<string> {
  const ids = new Set<string>();
  state.characters.forEach(value => ids.add(value.id));
  state.wands.forEach(value => ids.add(value.id));
  Object.keys(state.items).forEach(id => ids.add(id));
  Object.keys(state.gear ?? {}).forEach(id => ids.add(id));
  Object.keys(state.supplies ?? {}).forEach(id => ids.add(id));
  state.entities.forEach(value => ids.add(value.id));
  state.rewards.forEach(value => ids.add(value.id));
  return ids;
}

function allocateId(used: Set<string>, commandId: string, kind: string, definitionId: string): string {
  const short = (value: string, prefixLength: number) => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619) >>> 0;
    return `${value.slice(0, prefixLength)}-${hash.toString(16).padStart(8, "0")}`;
  };
  const base = `cheat:${short(commandId, 24)}:${kind}:${short(definitionId, 48)}`;
  let id = base;
  let suffix = 1;
  while (used.has(id)) {
    const suffixText = `:${suffix++}`;
    id = `${base.slice(0, 160 - suffixText.length)}${suffixText}`;
  }
  used.add(id);
  return id;
}

function appendCatalogEvent(events: CatalogCheatEvent[], type: string, action: string, definitionIds: string[], instanceIds: string[]): void {
  if (instanceIds.length === 0) return;
  events.push({ type, data: { action, definitionIds, instanceIds } });
}

function grantMagic(draft: GameState, command: CatalogCheatCommand, content: ContentCatalog, events: CatalogCheatEvent[]): string | undefined {
  if (!validateMagicCatalog(content)) return "INVALID_CATALOG";
  const used = allInstanceIds(draft);
  const addedSpellIds: string[] = [];
  const addedArcanaIds: string[] = [];
  const spellInstanceIds: string[] = [];
  const arcanaInstanceIds: string[] = [];

  const grant = (definitionId: string, definition: SpellDefinition | ArcanaDefinition, kind: "spell" | "arcana") => {
    if (Object.values(draft.items).some(item => item.kind === kind && item.definitionId === definitionId)) return;
    const id = allocateId(used, command.id, kind, definitionId);
    const item: ItemInstance = { id, definitionId, kind, level: definition.level, grade: definition.grade };
    draft.items[id] = item;
    draft.backpack.push(id);
    (kind === "spell" ? addedSpellIds : addedArcanaIds).push(definitionId);
    (kind === "spell" ? spellInstanceIds : arcanaInstanceIds).push(id);
  };
  for (const [id, definition] of Object.entries(content.spells)) grant(id, definition, "spell");
  for (const [id, definition] of Object.entries(content.arcana)) grant(id, definition, "arcana");

  draft.knowledge.spellIds = [...new Set([...draft.knowledge.spellIds, ...Object.keys(content.spells)])];
  draft.knowledge.arcanaIds = [...new Set([...draft.knowledge.arcanaIds, ...Object.keys(content.arcana)])];
  draft.knowledge.recipeIds = discoverAvailableRecipes(draft.knowledge, content);
  let statistics = draft.runStatistics ?? { ...createRunStatistics(), complete: false };
  if (addedSpellIds.length) statistics = addRunStatistic(statistics, "spellsAcquired", addedSpellIds.length);
  if (addedArcanaIds.length) statistics = addRunStatistic(statistics, "arcanaAcquired", addedArcanaIds.length);
  draft.runStatistics = statistics;
  appendCatalogEvent(events, "catalogGranted", "grantAllMagic", [...addedSpellIds, ...addedArcanaIds], [...spellInstanceIds, ...arcanaInstanceIds]);
  return undefined;
}

function grantWands(draft: GameState, command: CatalogCheatCommand, events: CatalogCheatEvent[]): string | undefined {
  const used = allInstanceIds(draft);
  const addedDefinitions: string[] = [];
  const addedIds: string[] = [];
  for (const [definitionId, template] of Object.entries(wandTemplates)) {
    if (!validLevel(template.level) || !validGrade(template.grade)
      || !Number.isSafeInteger(template.width) || template.width < 1 || !Number.isSafeInteger(template.height) || template.height < 1) return "INVALID_CATALOG";
    if (draft.wands.some(wand => wand.width === template.width && wand.height === template.height)) continue;
    const id = allocateId(used, command.id, "wand", definitionId);
    const wand = createWandFromTemplate(definitionId, id);
    if (!wand || wand.id !== id || wand.width !== template.width || wand.height !== template.height
      || wand.level !== template.level || wand.grade !== template.grade || wand.characterId !== null
      || !Array.isArray(wand.placements) || !record(wand.cooldowns)) return "INVALID_CATALOG";
    draft.wands.push(wand);
    addedDefinitions.push(definitionId);
    addedIds.push(id);
  }
  appendCatalogEvent(events, "catalogGranted", "grantAllWands", addedDefinitions, addedIds);
  return undefined;
}

function grantGear(draft: GameState, command: CatalogCheatCommand, content: ContentCatalog, events: CatalogCheatEvent[]): string | undefined {
  const definitions = content.gear;
  if (definitions === undefined) return undefined;
  if (!validateGearCatalog(definitions)) return "INVALID_CATALOG";
  const used = allInstanceIds(draft);
  const addedDefinitions: string[] = [];
  const addedIds: string[] = [];
  for (const [definitionId, definition] of Object.entries(definitions)) {
    if (Object.values(draft.gear ?? {}).some(gear => gear.definitionId === definitionId)) continue;
    const id = allocateId(used, command.id, "gear", definitionId);
    const gear = createGearFromDefinition(definition, id);
    if (gear.id !== id || gear.definitionId !== definitionId || gear.characterId !== null
      || gear.level !== definition.level || gear.grade !== definition.grade || gear.slot !== definition.slot
      || !validLevel(gear.level) || !validGrade(gear.grade) || !record(gear.statBonuses)) return "INVALID_CATALOG";
    draft.gear = { ...draft.gear, [id]: gear };
    addedDefinitions.push(definitionId);
    addedIds.push(id);
  }
  draft.knowledge.gearIds = [...new Set([...(draft.knowledge.gearIds ?? []), ...Object.keys(definitions)])];
  appendCatalogEvent(events, "catalogGranted", "grantAllGear", addedDefinitions, addedIds);
  return undefined;
}

function grantSupplies(draft: GameState, command: CatalogCheatCommand, content: ContentCatalog, events: CatalogCheatEvent[]): string | undefined {
  const definitions = content.items;
  if (definitions === undefined) return undefined;
  if (!validateSupplyCatalog(definitions)) return "INVALID_CATALOG";
  const used = allInstanceIds(draft);
  const addedDefinitions: string[] = [];
  const addedIds: string[] = [];
  for (const [definitionId, definition] of Object.entries(definitions)) {
    if (Object.values(draft.supplies ?? {}).some(supply => supply.definitionId === definitionId)) continue;
    const id = allocateId(used, command.id, "supply", definitionId);
    const supply = createSupplyFromDefinition(definition, id);
    if (supply.id !== id || supply.definitionId !== definitionId || supply.level !== definition.level
      || supply.grade !== definition.grade || !validLevel(supply.level) || !validGrade(supply.grade)) return "INVALID_CATALOG";
    draft.supplies = { ...draft.supplies, [id]: supply };
    addedDefinitions.push(definitionId);
    addedIds.push(id);
  }
  draft.knowledge.itemIds = [...new Set([...(draft.knowledge.itemIds ?? []), ...Object.keys(definitions)])];
  appendCatalogEvent(events, "catalogGranted", "grantAllSupplies", addedDefinitions, addedIds);
  return undefined;
}

function maxLevels<T extends { id: string; level: number }>(
  values: T[],
  setLevel: (id: string, level: number) => void,
  action: string,
  events: CatalogCheatEvent[]
): void {
  const changedIds: string[] = [];
  for (const value of values) {
    const level = Math.max(value.level, CHEAT_TARGET_LEVEL);
    if (level === value.level) continue;
    setLevel(value.id, level);
    changedIds.push(value.id);
  }
  appendCatalogEvent(events, "catalogMaxed", action, [], changedIds);
}

function levelCharacter(
  draft: GameState,
  command: Extract<CatalogCheatCommand, { action: "levelCharacter" }>,
  content: ContentCatalog,
  events: CatalogCheatEvent[]
): string | undefined {
  const levels = command.levels ?? 1;
  if (!Number.isSafeInteger(levels) || levels < 1 || levels > 100) return "INVALID_LEVEL_COUNT";
  const matches = draft.characters.filter(character => character.id === command.characterId);
  if (matches.length !== 1) return "CHARACTER_NOT_FOUND";
  const character = matches[0];
  if (!validLevel(character.level)) return "INVALID_CHARACTER_LEVEL";
  const previousLevel = character.level;
  const newLevel = previousLevel + levels;
  if (!validLevel(newLevel)) return "INVALID_CHARACTER_LEVEL";
  const oldXp = character.xp ?? (previousLevel === 1 ? 0 : experienceThreshold(previousLevel - 1));
  const oldLowerBound = previousLevel === 1 ? 0 : experienceThreshold(previousLevel - 1);
  const oldUpperBound = experienceThreshold(previousLevel);
  const newLowerBound = experienceThreshold(newLevel - 1);
  if (!Number.isSafeInteger(oldXp) || oldXp < oldLowerBound || oldXp >= oldUpperBound
    || !Number.isSafeInteger(oldLowerBound) || !Number.isSafeInteger(oldUpperBound)
    || !Number.isSafeInteger(newLowerBound)) return "INVALID_CHARACTER_XP";
  character.xp = Math.max(oldXp, newLowerBound);

  for (let level = previousLevel + 1; level <= newLevel; level++) {
    const priorLevel = level - 1;
    character.level = level;
    events.push({ type: "characterLevelUp", data: { characterId: character.id, previousLevel: priorLevel, level } });
  }
  if (draft.characters[0]?.id === character.id) draft.playerLevel = newLevel;
  const stats = getCharacterStats(draft, character.id, content);
  if (!stats || !Number.isFinite(stats.final.maxMana) || stats.final.maxMana < 0) return "INVALID_CHARACTER_STATS";
  character.mana = stats.final.maxMana;

  const baseStats = draft.runStatistics ?? { ...createRunStatistics(), complete: false };
  draft.runStatistics = addRunStatistic(baseStats, "levelsGained", levels);
  return undefined;
}

function applyAction(draft: GameState, command: CatalogCheatCommand, content: ContentCatalog): CatalogCheatEvent[] | string {
  const events: CatalogCheatEvent[] = [];
  switch (command.action) {
    case "grantAllMagic": {
      const error = grantMagic(draft, command, content, events);
      return error ?? events;
    }
    case "maxMagic":
      maxLevels(Object.values(draft.items), (id, level) => { draft.items[id] = { ...draft.items[id], level }; }, command.action, events);
      return events;
    case "grantAllWands": {
      const error = grantWands(draft, command, events);
      return error ?? events;
    }
    case "maxWands":
      maxLevels(draft.wands, (id, level) => {
        const index = draft.wands.findIndex(wand => wand.id === id);
        draft.wands[index] = { ...draft.wands[index], level };
      }, command.action, events);
      return events;
    case "grantAllGear": {
      const error = grantGear(draft, command, content, events);
      return error ?? events;
    }
    case "maxGear": {
      const gear = Object.values(draft.gear ?? {});
      maxLevels(gear, (id, level) => { draft.gear![id] = { ...draft.gear![id], level }; }, command.action, events);
      return events;
    }
    case "grantAllSupplies": {
      const error = grantSupplies(draft, command, content, events);
      return error ?? events;
    }
    case "maxSupplies": {
      const supplies = Object.values(draft.supplies ?? {});
      maxLevels(supplies, (id, level) => { draft.supplies![id] = { ...draft.supplies![id], level }; }, command.action, events);
      return events;
    }
    case "levelCharacter": {
      const error = levelCharacter(draft, command, content, events);
      return error ?? events;
    }
    default:
      return "CHEAT_UNAVAILABLE";
  }
}

export function applyCatalogCheat(
  state: GameState,
  command: CheatCommand,
  content: ContentCatalog
): CatalogCheatResult {
  if (!state || typeof state !== "object" || !record(state.cheats)) return failure("INVALID_EXISTING_STATE");
  if (!command || typeof command !== "object" || !isCatalogCommand(command)) return failure("CHEAT_UNAVAILABLE");
  if (!state.cheats.unlocked || !state.cheats.enabled) return failure("CHEATS_LOCKED");
  if (typeof command.id !== "string" || command.id.length === 0) return failure("INVALID_COMMAND_ID");
  const invalidState = validateExistingState(state);
  if (invalidState) return failure(invalidState);

  const draft = structuredClone(state);
  const result = applyAction(draft, command, content);
  if (typeof result === "string") return failure(result);
  const invalidDraft = validateExistingState(draft);
  if (invalidDraft) return failure(invalidDraft);
  return { ok: true, state: draft, events: result };
}
