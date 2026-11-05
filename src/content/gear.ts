import type { CharacterStatBonuses, Element, GearDefinition, GearInstance, Grade } from "../contracts";
import { gradeOrder, gradePower } from "./grades";

const cell = (x: number, y: number) => ({ x, y });
const asset = (id: string, label: string, color: string) => ({ key: `gear.${id}`, label, color });
const elements: readonly Element[] = ["fire", "wood", "metal", "water", "earth", "light", "dark", "lightning", "wind", "undead"];
const statKeys = [
  "attack", "castSpeedPercent", "projectileSpeedPercent", "range", "accuracy", "critChance",
  "critMultiplier", "luck", "maxMana", "manaRegen", "gatheringPercent",
] as const satisfies readonly (keyof Omit<CharacterStatBonuses, "elementBonuses">)[];

function freezeGear(definition: GearDefinition): GearDefinition {
  for (const coordinate of definition.shape) Object.freeze(coordinate);
  Object.freeze(definition.shape);
  Object.freeze(definition.asset);
  if (definition.statBonuses.elementBonuses) Object.freeze(definition.statBonuses.elementBonuses);
  Object.freeze(definition.statBonuses);
  return Object.freeze(definition);
}

export const gearDefinitions: Readonly<Record<string, GearDefinition>> = Object.freeze({
  "apprentice-hat": freezeGear({
    id: "apprentice-hat", name: "学徒帽", slot: "head", shape: [cell(0, 0)],
    asset: asset("apprentice-hat", "提升法力上限与回复", "#8a9bb5"),
    statBonuses: { maxMana: 15, manaRegen: 0.5 }, level: 1, grade: "common",
  }),
  "astrologer-hood": freezeGear({
    id: "astrologer-hood", name: "占星兜帽", slot: "head", shape: [cell(0, 0)],
    asset: asset("astrologer-hood", "提升暴击与法力上限", "#80729f"),
    statBonuses: { critChance: 0.03, maxMana: 10 }, level: 1, grade: "common",
  }),
  "rune-robe": freezeGear({
    id: "rune-robe", name: "魔纹袍", slot: "body", shape: [cell(0, 0)],
    asset: asset("rune-robe", "提升法力回复与上限", "#719a89"),
    statBonuses: { manaRegen: 1, maxMana: 10 }, level: 1, grade: "common",
  }),
  "heartguard-armor": freezeGear({
    id: "heartguard-armor", name: "护心甲", slot: "body", shape: [cell(0, 0)],
    asset: asset("heartguard-armor", "提升攻击与精准", "#9a756b"),
    statBonuses: { attack: 3, accuracy: 0.03 }, level: 1, grade: "common",
  }),
  "swift-boots": freezeGear({
    id: "swift-boots", name: "轻行靴", slot: "feet", shape: [cell(0, 0)],
    asset: asset("swift-boots", "提升施法频率与飞弹速度", "#7f9aa0"),
    statBonuses: { castSpeedPercent: 5, projectileSpeedPercent: 10 }, level: 1, grade: "common",
  }),
  "farwatch-boots": freezeGear({
    id: "farwatch-boots", name: "远望靴", slot: "feet", shape: [cell(0, 0)],
    asset: asset("farwatch-boots", "提升射程与精准", "#7587a3"),
    statBonuses: { range: 3, accuracy: 0.02 }, level: 1, grade: "common",
  }),
  "copper-ring": freezeGear({
    id: "copper-ring", name: "铜戒", slot: "accessory", shape: [cell(0, 0)],
    asset: asset("copper-ring", "提升攻击与暴击", "#b77c4c"),
    statBonuses: { attack: 2, critChance: 0.02 }, level: 1, grade: "common",
  }),
  "gatherer-charm": freezeGear({
    id: "gatherer-charm", name: "采集符", slot: "accessory", shape: [cell(0, 0)],
    asset: asset("gatherer-charm", "提升队伍金币收入", "#a4965d"),
    statBonuses: { gatheringPercent: 10 }, level: 1, grade: "common",
  }),
  "spring-pendant": freezeGear({
    id: "spring-pendant", name: "灵泉坠", slot: "accessory", shape: [cell(0, 0)],
    asset: asset("spring-pendant", "提升法力上限与回复", "#68a5a0"),
    statBonuses: { maxMana: 20, manaRegen: 1 }, level: 1, grade: "common",
  }),
  "ember-circlet": freezeGear({
    id: "ember-circlet", name: "余烬冠环", slot: "head", shape: [cell(0, 0)],
    asset: asset("ember-circlet", "提升火系强度与暴击伤害", "#c57952"),
    statBonuses: { critMultiplier: 0.2, elementBonuses: { fire: 0.12 } }, level: 1, grade: "common",
  }),
  "frost-lens": freezeGear({
    id: "frost-lens", name: "霜晶目镜", slot: "head", shape: [cell(0, 0)],
    asset: asset("frost-lens", "提升精准、法力上限与水系强度", "#6ba9bf"),
    statBonuses: { accuracy: 0.04, maxMana: 12, elementBonuses: { water: 0.08 } }, level: 1, grade: "common",
  }),
  "sage-crown": freezeGear({
    id: "sage-crown", name: "贤者冠冕", slot: "head", shape: [cell(0, 0)],
    asset: asset("sage-crown", "提升法力回复与木系强度", "#759b68"),
    statBonuses: { manaRegen: 0.8, elementBonuses: { wood: 0.08 } }, level: 1, grade: "common",
  }),
  "windweave-mantle": freezeGear({
    id: "windweave-mantle", name: "风织法衣", slot: "body", shape: [cell(0, 0)],
    asset: asset("windweave-mantle", "提升施法频率、飞弹速度与风系强度", "#67a69d"),
    statBonuses: { castSpeedPercent: 4, projectileSpeedPercent: 8, elementBonuses: { wind: 0.05 } }, level: 1, grade: "common",
  }),
  "heartwood-vest": freezeGear({
    id: "heartwood-vest", name: "心木护衣", slot: "body", shape: [cell(0, 0)],
    asset: asset("heartwood-vest", "提升攻击、法力上限与土系强度", "#9a8060"),
    statBonuses: { attack: 2.5, maxMana: 12, elementBonuses: { earth: 0.05 } }, level: 1, grade: "common",
  }),
  "gale-greaves": freezeGear({
    id: "gale-greaves", name: "疾风胫甲", slot: "feet", shape: [cell(0, 0)],
    asset: asset("gale-greaves", "提升射程与飞弹速度", "#739ca4"),
    statBonuses: { range: 1.5, projectileSpeedPercent: 15 }, level: 1, grade: "common",
  }),
  "tracker-boots": freezeGear({
    id: "tracker-boots", name: "寻迹短靴", slot: "feet", shape: [cell(0, 0)],
    asset: asset("tracker-boots", "提升精准与幸运", "#998b64"),
    statBonuses: { accuracy: 0.03, luck: 2 }, level: 1, grade: "common",
  }),
  "fortune-knot": freezeGear({
    id: "fortune-knot", name: "丰收结绳", slot: "accessory", shape: [cell(0, 0)],
    asset: asset("fortune-knot", "提升幸运与金币采集", "#b1944d"),
    statBonuses: { luck: 3, gatheringPercent: 3 }, level: 1, grade: "common",
  }),
  "starfall-signet": freezeGear({
    id: "starfall-signet", name: "星陨印戒", slot: "accessory", shape: [cell(0, 0)],
    asset: asset("starfall-signet", "提升暴击与雷系强度", "#8177b3"),
    statBonuses: { critChance: 0.025, critMultiplier: 0.3, elementBonuses: { lightning: 0.08 } }, level: 1, grade: "common",
  }),
});

function validGrade(value: unknown): value is Grade {
  return typeof value === "string" && gradeOrder.includes(value as Grade);
}

function resolveGrade(requested: unknown, definitionGrade: unknown): Grade {
  if (validGrade(requested)) return requested;
  if (validGrade(definitionGrade)) return definitionGrade;
  return "common";
}

function scaledBonuses(source: CharacterStatBonuses, ratio: number): CharacterStatBonuses {
  const result: CharacterStatBonuses = {};
  for (const key of statKeys) {
    if (!Object.hasOwn(source, key)) continue;
    const value: unknown = source[key];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const scaled = value * ratio;
    if (Number.isFinite(scaled)) result[key] = scaled;
  }
  if (source.elementBonuses && typeof source.elementBonuses === "object" && !Array.isArray(source.elementBonuses)) {
    const bonuses: Partial<Record<Element, number>> = {};
    for (const element of elements) {
      if (!Object.hasOwn(source.elementBonuses, element)) continue;
      const value: unknown = source.elementBonuses[element];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      const scaled = value * ratio;
      if (Number.isFinite(scaled)) bonuses[element] = scaled;
    }
    if (Object.keys(bonuses).length) result.elementBonuses = bonuses;
  }
  return result;
}

export function createGearFromDefinition(
  definition: GearDefinition,
  id: string,
  grade: Grade = definition.grade,
): GearInstance {
  const resolvedGrade = resolveGrade(grade, definition.grade);
  const baseGrade = resolveGrade(definition.grade, "common");
  const ratio = gradePower[resolvedGrade] / gradePower[baseGrade];
  return {
    id, definitionId: definition.id, name: definition.name, slot: definition.slot, characterId: null,
    level: definition.level, grade: resolvedGrade, statBonuses: scaledBonuses(definition.statBonuses, ratio),
  };
}
