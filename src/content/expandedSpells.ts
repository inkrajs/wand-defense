import type { SpellDefinition } from "../contracts";

const cell = (x: number, y: number) => ({ x, y });
const asset = (id: string, label: string, color: string) => ({ key: `spell.${id}`, label, color });
const square = (size: number) => Array.from({ length: size * size }, (_, index) => cell(index % size, Math.floor(index / size)));

/** Extended attack, summon and building definitions consumed by the shared compiler and engine. */
export const expandedSpellDefinitions: Record<string, SpellDefinition> = {
  "piercing-gale": {
    id: "piercing-gale", name: "穿风刃", element: "wind", shape: [cell(0, 0), cell(1, 0), cell(2, 0)],
    asset: asset("piercing-gale", "穿风刃", "#69B7A5"), effect: "projectile",
    power: 14, manaCost: 8, cooldownMs: 1000, range: 30, speed: 95,
    impact: { type: "pierce", maxTargets: 4 }, onHit: { knockback: 2 }, level: 1, grade: "common",
  },
  "glacial-lance": {
    id: "glacial-lance", name: "冰棱贯刺", element: "water", shape: [cell(0, 0), cell(1, 0), cell(2, 0)],
    asset: asset("glacial-lance", "冰棱贯刺", "#80C9DF"), effect: "projectile",
    power: 16, manaCost: 9, cooldownMs: 1250, range: 32, speed: 85,
    impact: { type: "pierce", maxTargets: 3 }, onHit: { slow: { multiplier: 0.65, durationMs: 1600 } },
    level: 1, grade: "common",
  },
  "ember-comet": {
    id: "ember-comet", name: "烬星", element: "fire", shape: square(2),
    asset: asset("ember-comet", "烬星", "#E77A47"), effect: "projectile",
    power: 20, manaCost: 14, cooldownMs: 1800, range: 30, speed: 44,
    impact: { type: "splash", radius: 8, maxTargets: 6 },
    onHit: { burn: { powerRatio: 0.2, durationMs: 1800, tickMs: 600 } }, level: 1, grade: "common",
  },
  "solar-storm": {
    id: "solar-storm", name: "日耀风暴", element: "fire", shape: square(3),
    asset: asset("solar-storm", "日耀风暴", "#E6A84D"), effect: "area",
    power: 5, manaCost: 40, cooldownMs: 8000, range: 100,
    area: { mode: "field", radius: 75, delayMs: 0, durationMs: 2000, tickMs: 400, maxTargets: 64, anchor: "field" },
    onHit: { burn: { powerRatio: 0.15, durationMs: 1200, tickMs: 600 } }, level: 1, grade: "common",
  },
  "tidal-prison": {
    id: "tidal-prison", name: "潮汐囚笼", element: "water", shape: square(2),
    asset: asset("tidal-prison", "潮汐囚笼", "#4C9FC2"), effect: "area",
    power: 5, manaCost: 18, cooldownMs: 3000, range: 32,
    area: { mode: "field", radius: 8, delayMs: 0, durationMs: 1800, tickMs: 400, maxTargets: 8, anchor: "target" },
    onHit: { slow: { multiplier: 0.5, durationMs: 800 } }, level: 1, grade: "common",
  },
  "cinder-ring": {
    id: "cinder-ring", name: "余烬之环", element: "fire", shape: square(2),
    asset: asset("cinder-ring", "余烬之环", "#D95E3C"), effect: "area",
    power: 6, manaCost: 22, cooldownMs: 3500, range: 22,
    area: { mode: "ring", radius: 22, delayMs: 0, durationMs: 800, maxTargets: 8 },
    onHit: { burn: { powerRatio: 0.15, durationMs: 1200, tickMs: 600 } }, level: 1, grade: "common",
  },
  "repulse-wave": {
    id: "repulse-wave", name: "震退波", element: "wind", shape: square(2),
    asset: asset("repulse-wave", "震退波", "#6CB8A9"), effect: "area",
    power: 6, manaCost: 20, cooldownMs: 3000, range: 20,
    area: { mode: "ring", radius: 20, delayMs: 0, durationMs: 500, maxTargets: 8 },
    onHit: { knockback: 4 }, level: 1, grade: "common",
  },
  "prism-ray": {
    id: "prism-ray", name: "棱镜光束", element: "light", shape: [cell(0, 0), cell(1, 0), cell(2, 0)],
    asset: asset("prism-ray", "棱镜光束", "#E4D27B"), effect: "beam",
    power: 7, manaCost: 16, cooldownMs: 2800, range: 36,
    beam: { width: 3.5, durationMs: 1200, tickMs: 200, maxTargets: 6 },
    onHit: { slow: { multiplier: 0.8, durationMs: 900 } }, level: 1, grade: "common",
  },
  "storm-spear": {
    id: "storm-spear", name: "风暴之矛", element: "lightning", shape: [cell(0, 0), cell(1, 0), cell(2, 0)],
    asset: asset("storm-spear", "风暴之矛", "#9485D1"), effect: "chain",
    power: 18, manaCost: 15, cooldownMs: 2000, range: 34,
    impact: { type: "chain", radius: 18, maxTargets: 8, falloff: 0.82 }, level: 1, grade: "common",
  },
  "ember-familiar": {
    id: "ember-familiar", name: "烬火灵", element: "fire", shape: [cell(0, 0), cell(1, 0)],
    asset: asset("ember-familiar", "烬火灵", "#E6754D"), effect: "summon",
    power: 8, manaCost: 12, cooldownMs: 2400, range: 30,
    construct: { hp: 22, durationMs: 10000, attackIntervalMs: 1000, maxAlive: 3, attackMode: "projectile", behavior: "attack", moveSpeed: 10, projectileSpeed: 65, bodySize: "small" },
    onHit: { burn: { powerRatio: 0.2, durationMs: 1200, tickMs: 600 } }, level: 1, grade: "common",
  },
  "frost-wisp": {
    id: "frost-wisp", name: "霜缕灵", element: "water", shape: [cell(0, 0), cell(0, 1)],
    asset: asset("frost-wisp", "霜缕灵", "#83C4DE"), effect: "summon",
    power: 7, manaCost: 11, cooldownMs: 2200, range: 30,
    construct: { hp: 20, durationMs: 10000, attackIntervalMs: 1100, maxAlive: 3, attackMode: "projectile", behavior: "attack", moveSpeed: 11, projectileSpeed: 70, bodySize: "small" },
    onHit: { slow: { multiplier: 0.75, durationMs: 1200 } }, level: 1, grade: "common",
  },
  "thorn-guardian": {
    id: "thorn-guardian", name: "荆棘卫士", element: "wood", shape: square(2),
    asset: asset("thorn-guardian", "荆棘卫士", "#618C58"), effect: "summon",
    power: 14, manaCost: 16, cooldownMs: 3200, range: 3,
    construct: { hp: 55, durationMs: 14000, attackIntervalMs: 1200, maxAlive: 2, attackMode: "contact", behavior: "attack", moveSpeed: 8, bodySize: "normal" },
    level: 1, grade: "common",
  },
  "ember-turret": {
    id: "ember-turret", name: "烬火炮台", element: "fire", shape: square(2),
    asset: asset("ember-turret", "烬火炮台", "#C96043"), effect: "building",
    power: 10, manaCost: 14, cooldownMs: 3000, range: 34,
    construct: { hp: 65, durationMs: 16000, attackIntervalMs: 1200, maxAlive: 3, attackMode: "projectile", behavior: "attack", projectileSpeed: 72, coinCost: 6, bodySize: "small", placement: "target" },
    onHit: { burn: { powerRatio: 0.15, durationMs: 1200, tickMs: 600 } }, level: 1, grade: "common",
  },
  "frost-pylon": {
    id: "frost-pylon", name: "霜纹塔", element: "water", shape: square(2),
    asset: asset("frost-pylon", "霜纹塔", "#6AAFC9"), effect: "building",
    power: 8, manaCost: 14, cooldownMs: 3200, range: 32,
    construct: { hp: 75, durationMs: 18000, attackIntervalMs: 1400, maxAlive: 3, attackMode: "projectile", behavior: "attack", projectileSpeed: 68, coinCost: 8, bodySize: "small", placement: "target" },
    onHit: { slow: { multiplier: 0.8, durationMs: 1000 } }, level: 1, grade: "common",
  },
  "restorative-totem": {
    id: "restorative-totem", name: "复苏图腾", element: "wood", shape: square(3),
    asset: asset("restorative-totem", "复苏图腾", "#76A96A"), effect: "building",
    power: 6, manaCost: 18, cooldownMs: 4000, range: 24,
    construct: { hp: 90, durationMs: 20000, attackIntervalMs: 1600, maxAlive: 2, attackMode: "contact", behavior: "heal", coinCost: 10, bodySize: "normal", placement: "target" },
    level: 1, grade: "common",
  },
  meteor: {
    id: "meteor", name: "陨石术", element: "earth", fusionElements: ["fire", "earth"], shape: square(2),
    asset: asset("meteor", "陨石术", "#D88756"), effect: "area",
    power: 48, manaCost: 22, cooldownMs: 3000, range: 34,
    area: { mode: "strike", radius: 7, delayMs: 650, durationMs: 350, maxTargets: 8 },
    onHit: { burn: { powerRatio: 0.12, durationMs: 1800, tickMs: 600 } }, level: 1, grade: "common",
  },
  "meteor-shower-small": {
    id: "meteor-shower-small", name: "小流星雨", element: "earth", fusionElements: ["fire", "earth"], shape: square(2),
    asset: asset("meteor-shower-small", "小流星雨", "#D88756"), effect: "area",
    power: 22, manaCost: 32, cooldownMs: 4200, range: 34,
    area: { mode: "strike", radius: 4.5, delayMs: 650, durationMs: 350, maxTargets: 6, shower: { count: 3, intervalMs: 280, spread: 6 } },
    onHit: { burn: { powerRatio: 0.1, durationMs: 1200, tickMs: 600 } }, level: 1, grade: "common",
  },
  "meteor-shower-large": {
    id: "meteor-shower-large", name: "大流星雨", element: "earth", fusionElements: ["fire", "earth"], shape: square(3),
    asset: asset("meteor-shower-large", "大流星雨", "#D88756"), effect: "area",
    power: 28, manaCost: 48, cooldownMs: 6000, range: 36,
    area: { mode: "strike", radius: 6, delayMs: 650, durationMs: 350, maxTargets: 8, shower: { count: 5, intervalMs: 260, spread: 10 } },
    onHit: { burn: { powerRatio: 0.12, durationMs: 1800, tickMs: 600 } }, level: 1, grade: "common",
  },
  worldfall: {
    id: "worldfall", name: "灭世陨石", element: "earth", fusionElements: ["fire", "earth"], shape: square(3),
    asset: asset("worldfall", "灭世陨石", "#D88756"), effect: "area",
    power: 26, manaCost: 80, cooldownMs: 9000, range: 42,
    area: { mode: "strike", radius: 5.5, delayMs: 800, durationMs: 450, maxTargets: 8,
      shower: { count: 6, intervalMs: 160, spread: 12, primaryRadiusMultiplier: 3, primaryPowerMultiplier: 3 } },
    onHit: { burn: { powerRatio: 0.15, durationMs: 1800, tickMs: 600 } }, level: 1, grade: "common",
  },
  "ember-seed": {
    id: "ember-seed", name: "炽种", element: "fire", shape: [cell(0, 0)], asset: asset("ember-seed", "炽种", "#E97846"),
    effect: "projectile", power: 7, manaCost: 5, cooldownMs: 900, range: 23, speed: 55,
    onHit: { burn: { powerRatio: 0.2, durationMs: 1800, tickMs: 600 } }, level: 1, grade: "common",
  },
  "frost-drop": {
    id: "frost-drop", name: "霜滴", element: "water", shape: [cell(0, 0)], asset: asset("frost-drop", "霜滴", "#67B6D6"),
    effect: "projectile", power: 6, manaCost: 4, cooldownMs: 850, range: 24, speed: 65,
    onHit: { slow: { multiplier: 0.7, durationMs: 1300 } }, level: 1, grade: "common",
  },
  "thorn-seed": {
    id: "thorn-seed", name: "棘种", element: "wood", shape: [cell(0, 0)], asset: asset("thorn-seed", "棘种", "#6DA75B"),
    effect: "projectile", power: 8, manaCost: 4, cooldownMs: 900, range: 25, speed: 75,
    impact: { type: "pierce", maxTargets: 2, falloff: 0.65 }, level: 1, grade: "common",
  },
  "iron-spark": {
    id: "iron-spark", name: "铁砂", element: "metal", shape: [cell(0, 0)], asset: asset("iron-spark", "铁砂", "#AEB7BC"),
    effect: "projectile", power: 5, manaCost: 3, cooldownMs: 600, range: 27, speed: 100, level: 1, grade: "common",
  },
  "static-spark": {
    id: "static-spark", name: "静电", element: "lightning", shape: [cell(0, 0)], asset: asset("static-spark", "静电", "#C5AD4A"),
    effect: "chain", power: 6, manaCost: 5, cooldownMs: 1000, range: 23,
    impact: { type: "chain", radius: 8, maxTargets: 2, falloff: 0.6 }, level: 1, grade: "common",
  },
  gust: {
    id: "gust", name: "微风", element: "wind", shape: [cell(0, 0)], asset: asset("gust", "微风", "#6CB5A7"),
    effect: "projectile", power: 5, manaCost: 3, cooldownMs: 750, range: 23, speed: 95,
    onHit: { knockback: 2 }, level: 1, grade: "common",
  },
  pebble: {
    id: "pebble", name: "石子", element: "earth", shape: [cell(0, 0)], asset: asset("pebble", "石子", "#A88A67"),
    effect: "projectile", power: 13, manaCost: 6, cooldownMs: 1300, range: 24, speed: 45, level: 1, grade: "common",
  },
  glimmer: {
    id: "glimmer", name: "微光", element: "light", shape: [cell(0, 0)], asset: asset("glimmer", "微光", "#E3C76B"),
    effect: "shield", power: 8, manaCost: 6, cooldownMs: 2800, range: 20, level: 1, grade: "common",
  },
  "night-mote": {
    id: "night-mote", name: "暗烬", element: "dark", shape: [cell(0, 0)], asset: asset("night-mote", "暗烬", "#8870A9"),
    effect: "projectile", power: 12, manaCost: 6, cooldownMs: 1400, range: 26, speed: 48,
    onHit: { slow: { multiplier: 0.85, durationMs: 900 } }, level: 1, grade: "common",
  },
  "steam-cloud": {
    id: "steam-cloud", name: "蒸汽云", element: "water", fusionElements: ["fire", "water"], shape: square(2),
    asset: asset("steam-cloud", "蒸汽云", "#A8B5C2"), effect: "area", power: 4, manaCost: 20, cooldownMs: 3200, range: 30,
    area: { mode: "field", anchor: "target", radius: 7, delayMs: 0, durationMs: 2000, tickMs: 400, maxTargets: 6 },
    onHit: { slow: { multiplier: 0.8, durationMs: 900 } }, level: 1, grade: "common",
  },
  "conductive-tide": {
    id: "conductive-tide", name: "导电潮", element: "lightning", fusionElements: ["water", "lightning"], shape: square(2),
    asset: asset("conductive-tide", "导电潮", "#7AB9D5"), effect: "chain", power: 12, manaCost: 20, cooldownMs: 2400, range: 32,
    impact: { type: "chain", radius: 16, maxTargets: 4, falloff: 0.75 },
    onHit: { slow: { multiplier: 0.8, durationMs: 900 } }, level: 1, grade: "common",
  },
  "magma-lance": {
    id: "magma-lance", name: "熔岩刺", element: "fire", fusionElements: ["fire", "earth"], shape: [cell(0, 0), cell(1, 0), cell(2, 0)],
    asset: asset("magma-lance", "熔岩刺", "#D88452"), effect: "projectile", power: 24, manaCost: 16, cooldownMs: 1900, range: 34, speed: 75,
    impact: { type: "pierce", maxTargets: 3, falloff: 0.8 },
    onHit: { burn: { powerRatio: 0.18, durationMs: 1800, tickMs: 600 } }, level: 1, grade: "common",
  },
  "twilight-field": {
    id: "twilight-field", name: "暮光域", element: "dark", fusionElements: ["light", "dark"], shape: square(2),
    asset: asset("twilight-field", "暮光域", "#9E86B4"), effect: "area", power: 6, manaCost: 24, cooldownMs: 3800, range: 31,
    area: { mode: "field", anchor: "target", radius: 8, delayMs: 200, durationMs: 2000, tickMs: 500, maxTargets: 6 },
    level: 1, grade: "common",
  },
};
