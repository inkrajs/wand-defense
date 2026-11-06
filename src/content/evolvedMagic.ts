import type { ArcanaDefinition, Cell, Element, RecipeDefinition, SpellDefinition } from "../contracts";

const row = (width: number): Cell[] => Array.from({ length: width }, (_, x) => ({ x, y: 0 }));
const square: Cell[] = [...row(2), { x: 0, y: 1 }, { x: 1, y: 1 }];
const spell = (id: string, name: string, element: Element, color: string,
  spec: Omit<SpellDefinition, "id" | "name" | "element" | "asset" | "grade" | "level">): SpellDefinition => ({
  id, name, element, asset: { key: `spell.${id}`, label: name, color }, grade: "common", level: 1, ...spec,
});
const shot = (power: number, manaCost: number, cooldownMs: number, speed = 60) => ({
  effect: "projectile" as const, power, manaCost, cooldownMs, speed, range: 28,
});
const field = (power: number, manaCost: number, radius: number, tickMs: number) => ({
  effect: "area" as const, power, manaCost, cooldownMs: 3600, range: 32,
  area: { mode: "field" as const, radius, tickMs, durationMs: 2000, delayMs: 0, maxTargets: 7, anchor: "target" as const },
});
const summon = (power: number, manaCost: number, hp: number, ranged = false) => ({
  effect: "summon" as const, power, manaCost, cooldownMs: 8500, range: ranged ? 21 : 3,
  construct: {
    hp, durationMs: 17000, attackIntervalMs: ranged ? 1050 : 850, maxAlive: 2,
    behavior: "attack" as const, attackMode: ranged ? "projectile" as const : "contact" as const,
    moveSpeed: ranged ? 6 : 11, ...(ranged ? { projectileSpeed: 78 } : {}),
  },
});

export const evolvedSpells: Record<string, SpellDefinition> = {
  "fire-sprout": spell("fire-sprout", "火苗", "fire", "#e77a51", {
    ...field(3, 10, 4, 500), shape: row(2), rewardMinWave: 3,
    onHit: { burn: { powerRatio: .2, tickMs: 500, durationMs: 1000 } },
  }),
  "frost-shot": spell("frost-shot", "冰弹", "water", "#85c9df", {
    ...shot(8, 7, 950), shape: row(2), rewardMinWave: 3, onHit: { slow: { multiplier: .58, durationMs: 1350 } },
  }),
  "clay-shot": spell("clay-shot", "陶土", "earth", "#be875f", {
    ...shot(17, 8, 1450, 42), shape: row(2), fusionElements: ["fire"], rewardMinWave: 3, onHit: { knockback: 3 },
    adjacentPower: { targetId: "rock-shot", multiplier: 1.15 },
    description: "投掷陶土击退敌人，并使四边相邻的岩弹威力提升15%。",
  }),
  "magma-pool": spell("magma-pool", "岩浆池", "fire", "#f36b43", {
    ...field(8, 22, 7, 500), shape: square, fusionElements: ["earth"], rewardMinWave: 9,
    onHit: { burn: { powerRatio: .3, durationMs: 1500, tickMs: 500 } },
  }),
  "forged-bullet": spell("forged-bullet", "子弹", "metal", "#a8adb9", {
    ...shot(26, 12, 1800, 130), shape: row(3), fusionElements: ["fire", "earth"], rewardMinWave: 6,
    impact: { type: "pierce", maxTargets: 4, falloff: .75 }, onHit: { armorPierce: .35 },
  }),
  "grenade-shell": spell("grenade-shell", "榴弹", "metal", "#bf9d75", {
    ...shot(29, 20, 3000, 53), shape: square, fusionElements: ["fire", "earth"], rewardMinWave: 10,
    impact: { type: "splash", radius: 8, maxTargets: 8 },
  }),
  "mud-patch": spell("mud-patch", "泥沼", "earth", "#a58b66", {
    ...field(3, 14, 6, 550), shape: square, fusionElements: ["water"], rewardMinWave: 4,
    onHit: { slow: { multiplier: .63, durationMs: 750 } },
  }),
  "steel-needle": spell("steel-needle", "钢针", "metal", "#c1c9d4", {
    ...shot(13, 6, 850, 120), shape: row(2), rewardMinWave: 3, impact: { type: "pierce", maxTargets: 2, falloff: .8 },
  }),
  "static-field": spell("static-field", "静电场", "lightning", "#e2c969", {
    ...field(5, 15, 5, 400), shape: square, fusionElements: ["wind"], rewardMinWave: 5,
  }),
  "dust-blade": spell("dust-blade", "砂刃", "wind", "#ac967b", {
    ...shot(12, 8, 1150, 95), shape: row(2), fusionElements: ["earth"], rewardMinWave: 4,
    impact: { type: "pierce", maxTargets: 3, falloff: .7 }, onHit: { knockback: 2 },
  }),
  "ghost-light": spell("ghost-light", "鬼火", "dark", "#b17bbf", {
    ...field(5, 17, 6, 500), shape: square, fusionElements: ["fire"], rewardMinWave: 6,
    area: { mode: "vortex", radius: 6, delayMs: 0, durationMs: 2800, tickMs: 500, maxTargets: 6, anchor: "target", moveSpeed: 9 },
  }),
  "bramble-trap": spell("bramble-trap", "铁蒺藜", "wood", "#88946e", {
    ...field(5, 16, 5, 450), shape: square, fusionElements: ["metal"], rewardMinWave: 5,
    onHit: { slow: { multiplier: .7, durationMs: 950 }, armorPierce: .2 },
  }),
  "root-snare": spell("root-snare", "藤蔓", "wood", "#80a465", {
    ...field(4, 13, 5, 500), shape: row(2), rewardMinWave: 4,
    onHit: { slow: { multiplier: .55, durationMs: 1100 } },
  }),
  "lucent-ring": spell("lucent-ring", "耀环", "light", "#e1cb78", {
    effect: "area", power: 20, manaCost: 18, cooldownMs: 3100, range: 19, shape: square, rewardMinWave: 6,
    area: { mode: "ring", radius: 19, delayMs: 150, durationMs: 600, maxTargets: 7 },
    onHit: { knockback: 3 },
  }),
  "gloom-mist": spell("gloom-mist", "暗雾", "dark", "#9873b4", {
    ...field(4, 12, 5, 500), shape: row(2), rewardMinWave: 4, onHit: { armorPierce: .2 },
  }),
  "bone-chip": spell("bone-chip", "骨片", "undead", "#b7accc", {
    ...shot(8, 4, 750, 86), shape: row(1), onHit: { armorPierce: .12 },
  }),
  "grave-echo": spell("grave-echo", "墓响", "undead", "#a993c5", {
    ...field(2, 6, 3, 500), shape: row(1), cooldownMs: 1800,
  }),
  "skeleton-guard": spell("skeleton-guard", "骷髅兵", "undead", "#b7accc", {
    ...summon(12, 17, 45), shape: row(2), rewardMinWave: 4,
  }),
  "skeleton-archer": spell("skeleton-archer", "骷髅射手", "undead", "#baa8d1", {
    ...summon(10, 22, 31, true), shape: square, rewardMinWave: 7, fusionElements: ["metal"],
  }),
  "skeleton-mage": spell("skeleton-mage", "骷髅法师", "undead", "#a47bc1", {
    ...summon(11, 28, 33, true), shape: square, rewardMinWave: 9, fusionElements: ["dark"],
    impact: { type: "splash", radius: 4, maxTargets: 4 },
  }),
  "bone-legion": spell("bone-legion", "骸骨列阵", "undead", "#c5b7d6", {
    ...summon(13, 37, 55), shape: [...row(3), { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }], rewardMinWave: 16,
    construct: { ...summon(13, 37, 55).construct, baseCount: 3, maxAlive: 3 },
    cooldownMs: 14000, description: "依次召出三名近战骷髅，各自拥有生命值，最多存在17秒。",
  }),
  "corpse-burst": spell("corpse-burst", "尸爆", "undead", "#b17bbf", {
    effect: "area", power: 32, manaCost: 23, cooldownMs: 4500, range: 38,
    shape: square, rewardMinWave: 11, fusionElements: ["dark"], remainsAction: "detonate",
    area: { mode: "strike", radius: 8, delayMs: 250, durationMs: 300, maxTargets: 7 },
    description: "消耗一处敌方遗骸，短暂延迟后炸伤周围最多7个敌人。该遗骸不能再用于复生。",
  }),
  reanimate: spell("reanimate", "复生", "undead", "#a993c5", {
    ...summon(14, 24, 42), shape: square, rewardMinWave: 10, remainsAction: "reanimate",
    description: "消耗射程内一处敌人遗骸，在原地召出亡灵骷髅。没有遗骸时不消耗法力。",
    range: 40,
  }),
  rebirth: spell("rebirth", "重生", "undead", "#b9c996", {
    ...summon(0, 32, 1), shape: square, fusionElements: ["wood"], rewardMinWave: 14, remainsAction: "rebirth",
    description: "让射程内己方阵亡的召唤物以原形回归，恢复一半生命，最多存续10秒。每个单位只能重生一次。",
    range: 40,
  }),
};

const affinity = (id: string, name: string, affinities: Partial<Record<Element, number>>, diagonal = false): ArcanaDefinition => ({
  id, name, shape: row(2), asset: { key: `arcana.${id}`, label: name, color: "#c3a073" },
  modifier: "affinity", value: 1, affinities, diagonal, level: 1, grade: "common", rewardMinWave: diagonal ? 8 : 4,
});

export const evolvedArcana: Record<string, ArcanaDefinition> = {
  kindling: affinity("kindling", "助燃", { fire: .3, wood: -.2 }),
  "thermal-draft": affinity("thermal-draft", "热流", { wind: .35, fire: -.12, wood: -.12 }),
  oxidation: affinity("oxidation", "氧化", { metal: .22 }, true),
  reduction: affinity("reduction", "还原", { fire: .24, metal: .24, wood: -.24 }, true),
  "root-feed": affinity("root-feed", "滋养", { wood: .3, fire: -.15 }),
  "arc-coil": affinity("arc-coil", "雷磁符", { lightning: .25, metal: .25, earth: -.15 }),
  condense: {
    id: "condense", name: "凝聚", shape: row(1), asset: { key: "arcana.condense", label: "凝聚", color: "#eaa575" },
    modifier: "condense", value: .8, level: 1, grade: "common", rewardMinWave: 12,
  },
  "range-trigger": {
    id: "range-trigger", name: "末程符", shape: row(1), asset: { key: "arcana.range-trigger", label: "末程符", color: "#b29ad1" },
    modifier: "rangeTrigger", value: 1, level: 1, grade: "common", rewardMinWave: 8,
  },
  "rapid-cycle": {
    id: "rapid-cycle", name: "疾咏", shape: row(2), asset: { key: "arcana.rapid-cycle", label: "疾咏", color: "#86aaca" },
    modifier: "haste", value: .7, level: 1, grade: "common", rewardMinWave: 7,
    description: "相邻法术的基础冷却缩短30%。",
  },
  "deep-pierce": {
    id: "deep-pierce", name: "贯甲", shape: row(2), asset: { key: "arcana.deep-pierce", label: "贯甲", color: "#aeb8bf" },
    modifier: "pierce", value: 3, level: 1, grade: "common", rewardMinWave: 8,
    description: "使相邻兼容飞弹额外穿透3个敌人。",
  },
};

const recipe = (output: string, inputs: string[], layout?: RecipeDefinition["layout"]): RecipeDefinition => ({
  id: `${output}-recipe`, name: (evolvedSpells[output] ?? evolvedArcana[output]).name, inputs, output,
  requireAdjacency: true, ...(layout ? { layout } : {}),
});

export const evolvedRecipes: RecipeDefinition[] = [
  recipe("fire-sprout", ["spark", "ember-seed"]),
  recipe("frost-shot", ["water-bolt", "frost-drop"]),
  recipe("clay-shot", ["ember-seed", "pebble"]),
  recipe("magma-pool", ["clay-shot", "fireball", "tiny-area"]),
  recipe("forged-bullet", ["clay-shot", "iron-spark", "pierce"]),
  recipe("grenade-shell", ["forged-bullet", "fireball", "tiny-area"]),
  recipe("mud-patch", ["water-bolt", "pebble"]),
  recipe("steel-needle", ["metal-needle", "iron-spark"]),
  recipe("static-field", ["static-spark", "gust", "tiny-area"]),
  recipe("dust-blade", ["wind-blade", "pebble"]),
  recipe("ghost-light", ["fire-sprout", "night-mote"]),
  recipe("root-snare", ["thorn-seed", "regrowth"]),
  recipe("bramble-trap", ["root-snare", "iron-spark"]),
  recipe("lucent-ring", ["ward", "light-arrow", "tiny-area"]),
  recipe("gloom-mist", ["dark-orb", "night-mote"]),
  recipe("skeleton-guard", ["bone-chip", "grave-echo"]),
  recipe("skeleton-archer", ["skeleton-guard", "steel-needle"]),
  recipe("skeleton-mage", ["skeleton-guard", "ghost-light"]),
  recipe("reanimate", ["skeleton-mage", "grave-echo", "duration"]),
  recipe("corpse-burst", ["grave-echo", "gloom-mist", "area"]),
  recipe("bone-legion", ["skeleton-guard", "reanimate", "triple"]),
  recipe("rebirth", ["reanimate", "renewal", "greater-amplify"]),
  recipe("kindling", ["ember-seed", "thorn-seed"], [{ x: 0, y: 0, rotation: 0 }, { x: 1, y: 0, rotation: 0 }]),
  recipe("thermal-draft", ["ember-seed", "thorn-seed"], [{ x: 0, y: 0, rotation: 0 }, { x: 0, y: 1, rotation: 0 }]),
  recipe("oxidation", ["spark", "iron-spark"]),
  recipe("reduction", ["oxidation", "kindling"]),
  recipe("root-feed", ["regrowth", "water-bolt"]),
  recipe("arc-coil", ["oxidation", "static-spark"]),
  recipe("condense", ["greater-amplify", "focus"]),
  recipe("range-trigger", ["timer-trigger", "reach"]),
  recipe("rapid-cycle", ["haste", "efficiency"]),
  recipe("deep-pierce", ["pierce", "steel-needle"]),
];
