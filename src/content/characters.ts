import type {
  CharacterBaseStats,
  CharacterInstance,
  ContentCatalog,
  Element,
  GameState,
} from "../contracts";
import { getCharacterGrowth, type CharacterGrowthAttributes } from "./characterGrowth";
import { demoContent } from "./demo";

const ELEMENTS: readonly Element[] = [
  "fire", "wood", "metal", "water", "earth", "light", "dark", "lightning", "wind",
];
const GEAR_SLOTS = ["head", "body", "feet", "accessory"] as const;
const MAX_FLAT_STAT = 1_000_000;
const MAX_MULTIPLIER = 10_000;

export interface NormalizedCharacterBaseStats extends CharacterBaseStats {
  gatheringPercent: number;
  projectileSpeedPercent: number;
}

export interface CharacterEquipmentStats extends CharacterBaseStats {
  gatheringPercent: number;
  projectileSpeedPercent: number;
  maxMana: number;
  manaRegen: number;
}

export interface CharacterRunStats {
  gatheringPercent: number;
  attackPercent: number;
  maxMana: number;
  manaRegen: number;
  rangePercent: number;
  cooldownPercent: number;
}

export interface CharacterSequenceStats {
  elementBonuses: Partial<Record<Element, number>>;
}

export interface CharacterResourceSources {
  character: { maxMana: number | null; manaRegen: number | null };
  growth: { maxMana: number; manaRegen: number };
  equipment: { maxMana: number; manaRegen: number };
  run: { maxMana: number | null; manaRegen: number | null };
  /** Persisted character resources already combine intrinsic values with past run rewards. */
  combined: { maxMana: number; manaRegen: number };
  status: { maxMana: "derived" | "combined"; manaRegen: "derived" | "combined" };
  final: { maxMana: number; manaRegen: number };
}

export interface CharacterFinalStats {
  attack: number;
  attackMultiplier: number;
  range: number;
  rangeMultiplier: number;
  projectileSpeedPercent: number;
  projectileSpeedMultiplier: number;
  castSpeedPercent: number;
  cooldownMultiplier: number;
  accuracy: number;
  critChance: number;
  critMultiplier: number;
  luck: number;
  totalLuck: number;
  elementBonuses: Partial<Record<Element, number>>;
  mana: number;
  maxMana: number;
  manaRegen: number;
}

export interface CharacterStatsView {
  base: NormalizedCharacterBaseStats;
  growth: CharacterGrowthAttributes;
  equipment: CharacterEquipmentStats;
  run: CharacterRunStats;
  sequence: CharacterSequenceStats;
  resourceSources: CharacterResourceSources;
  final: CharacterFinalStats;
}

/** Neutral defaults are built per call so nested maps are never shared. */
export function createCharacterBaseStats(): NormalizedCharacterBaseStats {
  return {
    attack: 0,
    gatheringPercent: 0,
    castSpeedPercent: 0,
    range: 0,
    projectileSpeedPercent: 0,
    accuracy: 1,
    critChance: 0,
    critMultiplier: 1.5,
    luck: 0,
    elementBonuses: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validBaseNumber(key: keyof Omit<NormalizedCharacterBaseStats, "elementBonuses">, value: unknown): value is number {
  if (!finite(value)) return false;
  switch (key) {
    case "attack":
    case "range":
    case "luck":
    case "gatheringPercent": return value >= 0;
    case "castSpeedPercent": return value >= -90 && value <= 10_000;
    case "projectileSpeedPercent": return value >= -90 && value <= 10_000;
    case "accuracy":
    case "critChance": return value >= 0 && value <= 1;
    case "critMultiplier": return value >= 1 && value <= 10;
  }
}

function normalizeBase(value: unknown): NormalizedCharacterBaseStats {
  const defaults = createCharacterBaseStats();
  const source = isRecord(value) ? value : {};
  const result: NormalizedCharacterBaseStats = {
    attack: validBaseNumber("attack", source.attack) ? source.attack : defaults.attack,
    gatheringPercent: validBaseNumber("gatheringPercent", source.gatheringPercent) ? Math.min(MAX_FLAT_STAT, source.gatheringPercent) : 0,
    castSpeedPercent: validBaseNumber("castSpeedPercent", source.castSpeedPercent) ? source.castSpeedPercent : defaults.castSpeedPercent,
    range: validBaseNumber("range", source.range) ? source.range : defaults.range,
    projectileSpeedPercent: validBaseNumber("projectileSpeedPercent", source.projectileSpeedPercent) ? source.projectileSpeedPercent : defaults.projectileSpeedPercent,
    accuracy: validBaseNumber("accuracy", source.accuracy) ? source.accuracy : defaults.accuracy,
    critChance: validBaseNumber("critChance", source.critChance) ? source.critChance : defaults.critChance,
    critMultiplier: validBaseNumber("critMultiplier", source.critMultiplier) ? source.critMultiplier : defaults.critMultiplier,
    luck: validBaseNumber("luck", source.luck) ? source.luck : defaults.luck,
    elementBonuses: {},
  };
  if (isRecord(source.elementBonuses)) {
    for (const element of ELEMENTS) {
      const bonus = source.elementBonuses[element];
      if (finite(bonus) && bonus >= -1) result.elementBonuses[element] = bonus;
    }
  }
  return result;
}

/** Normalize legacy or malformed character base stats without touching other character state. */
export function normalizeCharacterStats(state: GameState): void {
  for (const character of state.characters) {
    character.baseStats = normalizeBase(character.baseStats);
    character.growthProfileId = getCharacterGrowth(character).profileId;
  }
}

function emptyEquipment(): CharacterEquipmentStats {
  return {
    attack: 0, gatheringPercent: 0, castSpeedPercent: 0, range: 0, projectileSpeedPercent: 0, accuracy: 0, critChance: 0,
    critMultiplier: 0, luck: 0, elementBonuses: {}, maxMana: 0, manaRegen: 0,
  };
}

function addBonuses(target: CharacterEquipmentStats, value: unknown): void {
  if (!isRecord(value)) return;
  const keys = ["attack", "castSpeedPercent", "range", "projectileSpeedPercent", "accuracy", "critChance", "critMultiplier", "luck", "maxMana", "manaRegen", "gatheringPercent"] as const;
  for (const key of keys) if (finite(value[key]) && (key !== "gatheringPercent" || value[key] >= 0)) target[key] = boundedSum(target[key], value[key]);
  if (isRecord(value.elementBonuses)) {
    for (const element of ELEMENTS) {
      const bonus = value.elementBonuses[element];
      if (finite(bonus)) target.elementBonuses[element] = boundedSum(target.elementBonuses[element] ?? 0, bonus);
    }
  }
}

function getEquipmentStats(state: GameState, character: CharacterInstance): CharacterEquipmentStats {
  const result = emptyEquipment();
  const seenWands = new Set<string>();
  for (const wand of state.wands) {
    if (seenWands.has(wand.id)) continue;
    if (wand.characterId !== character.id || !character.wandIds.includes(wand.id)) continue;
    seenWands.add(wand.id);
    addBonuses(result, wand.statBonuses);
  }

  const seenGear = new Set<string>();
  const gearIds = character.gearIds;
  const gearRegistry = state.gear;
  if (gearIds && gearRegistry) {
    for (const slot of GEAR_SLOTS) {
      const gearId = gearIds[slot];
      if (typeof gearId !== "string" || seenGear.has(gearId)) continue;
      const gear = gearRegistry[gearId];
      if (!gear || gear.id !== gearId || gear.slot !== slot || gear.characterId !== character.id) continue;
      seenGear.add(gearId);
      addBonuses(result, gear.statBonuses);
    }
  }
  return result;
}

function getRunStats(state: GameState): CharacterRunStats {
  const source = state.runBonuses;
  const numberOrZero = (value: unknown) => finite(value) ? clamp(value, -MAX_FLAT_STAT, MAX_FLAT_STAT) : 0;
  return {
    attackPercent: numberOrZero(source?.attackPercent),
    gatheringPercent: Math.max(0, numberOrZero(source?.gatheringPercent)),
    maxMana: numberOrZero(source?.maxMana),
    manaRegen: numberOrZero(source?.manaRegen),
    rangePercent: numberOrZero(source?.rangePercent),
    cooldownPercent: numberOrZero(source?.cooldownPercent),
  };
}

function cloneSequenceBonuses(value: unknown): Partial<Record<Element, number>> {
  const result: Partial<Record<Element, number>> = {};
  if (!isRecord(value)) return result;
  for (const element of ELEMENTS) if (finite(value[element])) result[element] = value[element];
  return result;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return value < 0 ? min : max;
  return Math.max(min, Math.min(max, value));
}

function boundedSum(current: number, increment: number): number {
  return clamp(current + clamp(increment, -MAX_FLAT_STAT, MAX_FLAT_STAT), -MAX_FLAT_STAT, MAX_FLAT_STAT);
}

function boundedResult(value: number): number {
  return clamp(value, -MAX_FLAT_STAT, MAX_FLAT_STAT);
}

function safeNonnegative(value: unknown): number {
  return finite(value) ? Math.max(0, value) : 0;
}

/** A negative or saturated residual cannot establish the historical intrinsic contribution. */
function resourceSource(value: unknown, runValue: unknown) {
  const combined = finite(value) ? clamp(value, -MAX_FLAT_STAT, MAX_FLAT_STAT) : 0;
  const run = runValue === undefined ? 0 : runValue;
  const derived = finite(value) && value >= 0 && value <= MAX_FLAT_STAT
    && finite(run) && run >= 0 && run <= value;
  return derived
    ? { character: value - run, run, combined, status: "derived" as const }
    : { character: null, run: null, combined, status: "combined" as const };
}

/** Build a detached, read-only-by-convention snapshot of a character's effective stats. */
export function getCharacterStats(
  state: GameState,
  characterId: string,
  content: ContentCatalog = demoContent,
): CharacterStatsView | undefined {
  const matches = state.characters.filter(character => character.id === characterId);
  if (matches.length !== 1) return undefined;
  const character = matches[0];
  const base = normalizeBase(character.baseStats);
  const growth = getCharacterGrowth(character);
  const equipment = getEquipmentStats(state, character);
  const run = getRunStats(state);
  const sequence = {
    elementBonuses: cloneSequenceBonuses(content.sequences[character.sequenceId]?.bonuses),
  };
  const attackMultiplier = clamp(1 + run.attackPercent / 100, 0, MAX_MULTIPLIER);
  const rangeMultiplier = clamp(1 + run.rangePercent / 100, 0, MAX_MULTIPLIER);
  const castSpeedPercent = clamp(base.castSpeedPercent + growth.total.castSpeedPercent + equipment.castSpeedPercent, -90, 10_000);
  const projectileSpeedPercent = clamp(base.projectileSpeedPercent + growth.total.projectileSpeedPercent + equipment.projectileSpeedPercent, -90, 10_000);
  const elementBonuses: Partial<Record<Element, number>> = {};
  for (const element of ELEMENTS) {
    const sequenceBonus = Math.max(-1, sequence.elementBonuses[element] ?? 0);
    const personal = Math.max(-1, (base.elementBonuses[element] ?? 0) + (equipment.elementBonuses[element] ?? 0));
    elementBonuses[element] = boundedResult((1 + personal) * (1 + sequenceBonus) - 1);
  }
  const baseAttack = Math.max(0, boundedResult(base.attack + growth.total.attack + equipment.attack));
  const baseRange = Math.max(0, boundedResult(base.range + growth.total.range + equipment.range));
  const rawMana = finite(character.mana) ? clamp(character.mana, -MAX_FLAT_STAT, MAX_FLAT_STAT) : 0;
  const maxManaSource = resourceSource(character.maxMana, state.runBonuses?.maxMana);
  const manaRegenSource = resourceSource(character.manaRegen, state.runBonuses?.manaRegen);
  const finalMaxMana = safeNonnegative(boundedResult((finite(character.maxMana) ? clamp(character.maxMana, -MAX_FLAT_STAT, MAX_FLAT_STAT) : 0) + growth.total.maxMana + equipment.maxMana));
  const finalManaRegen = safeNonnegative(boundedResult((finite(character.manaRegen) ? clamp(character.manaRegen, -MAX_FLAT_STAT, MAX_FLAT_STAT) : 0) + growth.total.manaRegen + equipment.manaRegen));
  return {
    base,
    growth: { ...growth.total },
    equipment,
    run,
    sequence,
    resourceSources: {
      character: { maxMana: maxManaSource.character, manaRegen: manaRegenSource.character },
      growth: { maxMana: growth.total.maxMana, manaRegen: growth.total.manaRegen },
      equipment: { maxMana: equipment.maxMana, manaRegen: equipment.manaRegen },
      run: { maxMana: maxManaSource.run, manaRegen: manaRegenSource.run },
      combined: { maxMana: maxManaSource.combined, manaRegen: manaRegenSource.combined },
      status: { maxMana: maxManaSource.status, manaRegen: manaRegenSource.status },
      final: { maxMana: finalMaxMana, manaRegen: finalManaRegen },
    },
    final: {
      attack: boundedResult(baseAttack * attackMultiplier),
      attackMultiplier,
      range: boundedResult(baseRange * rangeMultiplier),
      rangeMultiplier,
      projectileSpeedPercent,
      projectileSpeedMultiplier: 1 + projectileSpeedPercent / 100,
      castSpeedPercent,
      cooldownMultiplier: boundedResult(1 / (1 + castSpeedPercent / 100) * (1 - clamp(run.cooldownPercent, 0, 70) / 100)),
      accuracy: clamp(base.accuracy + equipment.accuracy, 0, 1),
      critChance: clamp(base.critChance + equipment.critChance, 0, 1),
      critMultiplier: clamp(base.critMultiplier + equipment.critMultiplier, 1, 10),
      luck: boundedResult(safeNonnegative(base.luck + equipment.luck)),
      totalLuck: boundedResult((finite(state.luck) ? clamp(state.luck, -MAX_FLAT_STAT, MAX_FLAT_STAT) : 0) + boundedResult(safeNonnegative(base.luck + equipment.luck))),
      elementBonuses,
      mana: rawMana,
      maxMana: finalMaxMana,
      manaRegen: finalManaRegen,
    },
  };
}
