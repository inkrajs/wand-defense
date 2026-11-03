import type { CharacterInstance } from "../contracts";

export interface CharacterGrowthAttributes {
  attack: number;
  castSpeedPercent: number;
  range: number;
  projectileSpeedPercent: number;
  maxMana: number;
  manaRegen: number;
}

export type CharacterGrowthProfileId = "fire" | "wood" | "balanced";

export interface CharacterGrowth {
  profileId: CharacterGrowthProfileId;
  name: string;
  multipliers: CharacterGrowthAttributes;
  perLevel: CharacterGrowthAttributes;
  total: CharacterGrowthAttributes;
}

const LIMIT = 1_000_000;
const BASELINE: Readonly<CharacterGrowthAttributes> = Object.freeze({
  attack: 1,
  castSpeedPercent: 1,
  range: 0.1,
  projectileSpeedPercent: 0.5,
  maxMana: 5,
  manaRegen: 0.25,
});

const PROFILES: Readonly<Record<CharacterGrowthProfileId, {
  name: string;
  multipliers: Readonly<CharacterGrowthAttributes>;
}>> = Object.freeze({
  fire: {
    name: "火系",
    multipliers: Object.freeze({
      attack: 2, castSpeedPercent: 1.5, range: 1, projectileSpeedPercent: 1, maxMana: 1, manaRegen: 1,
    }),
  },
  wood: {
    name: "木系",
    multipliers: Object.freeze({
      attack: 0.75, castSpeedPercent: 1, range: 1, projectileSpeedPercent: 1, maxMana: 2, manaRegen: 2,
    }),
  },
  balanced: {
    name: "均衡",
    multipliers: Object.freeze({
      attack: 1, castSpeedPercent: 1, range: 1, projectileSpeedPercent: 1, maxMana: 1, manaRegen: 1,
    }),
  },
});

function isProfileId(value: unknown): value is CharacterGrowthProfileId {
  return value === "fire" || value === "wood" || value === "balanced";
}

function resolveProfileId(character: CharacterInstance): CharacterGrowthProfileId {
  if (isProfileId(character.growthProfileId)) return character.growthProfileId;
  const sequenceId = typeof character.sequenceId === "string" ? character.sequenceId.toLowerCase() : "";
  if (sequenceId.includes("wood")) return "wood";
  if (sequenceId.includes("fire")) return "fire";
  return "balanced";
}

function copyAttributes(value: Readonly<CharacterGrowthAttributes>): CharacterGrowthAttributes {
  return {
    attack: value.attack,
    castSpeedPercent: value.castSpeedPercent,
    range: value.range,
    projectileSpeedPercent: value.projectileSpeedPercent,
    maxMana: value.maxMana,
    manaRegen: value.manaRegen,
  };
}

function growthLevel(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value));
}

/** Calculate deterministic, detached, non-compounding per-level character growth. */
export function getCharacterGrowth(character: CharacterInstance): CharacterGrowth {
  const profileId = resolveProfileId(character);
  const profile = PROFILES[profileId];
  const multipliers = copyAttributes(profile.multipliers);
  const perLevel: CharacterGrowthAttributes = {
    attack: BASELINE.attack * multipliers.attack,
    castSpeedPercent: BASELINE.castSpeedPercent * multipliers.castSpeedPercent,
    range: BASELINE.range * multipliers.range,
    projectileSpeedPercent: BASELINE.projectileSpeedPercent * multipliers.projectileSpeedPercent,
    maxMana: BASELINE.maxMana * multipliers.maxMana,
    manaRegen: BASELINE.manaRegen * multipliers.manaRegen,
  };
  const levelsAboveOne = Math.min(LIMIT, growthLevel(character.level) - 1);
  const total = {} as CharacterGrowthAttributes;
  for (const key of Object.keys(perLevel) as (keyof CharacterGrowthAttributes)[]) {
    total[key] = Math.min(LIMIT, perLevel[key] * levelsAboveOne);
  }
  return { profileId, name: profile.name, multipliers, perLevel, total };
}
