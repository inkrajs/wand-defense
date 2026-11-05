import type { AreaSpec, Cell, Element, RecipeDefinition, SpellDefinition } from "../contracts";

type BranchElement = Extract<Element, "fire" | "water" | "lightning">;
const colors = { fire: "#e77548", water: "#78bbdc", lightning: "#d8be65" };
const tile = (width: number): Cell[] => Array.from({ length: width * 2 }, (_, i) => ({ x: i % width, y: Math.floor(i / width) }));
function spell(id: string, name: string, element: BranchElement, wave: number,
  spec: Pick<SpellDefinition, "effect" | "power" | "manaCost" | "cooldownMs" | "range"> & Partial<Pick<SpellDefinition,
    "area" | "beam" | "impact" | "onHit" | "speed" | "fusionElements" | "description">>): SpellDefinition {
  return { id, name, element, shape: tile(wave >= 23 ? 3 : 2), level: 1, grade: "common",
    rewardMinWave: wave, asset: { key: `spell.${id}`, label: name, color: colors[element] }, ...spec };
}
const area = (power: number, manaCost: number, cooldownMs: number, spec: AreaSpec) =>
  ({ effect: "area" as const, power, manaCost, cooldownMs, range: spec.mode === "ring" ? spec.radius : 42, area: spec });
const field = (radius: number, durationMs: number, tickMs: number, maxTargets = 7): AreaSpec =>
  ({ mode: "field", anchor: "target", radius, durationMs, tickMs, maxTargets, delayMs: 180 });
const strike = (radius: number, delayMs: number, maxTargets: number): AreaSpec =>
  ({ mode: "strike", radius, delayMs, maxTargets, durationMs: 350 });
const burn = { powerRatio: .22, durationMs: 1200, tickMs: 600 };
const chill = { multiplier: .58, durationMs: 950 };

export const approvedSpells: Record<string, SpellDefinition> = {
  "fire-curtain": spell("fire-curtain", "火幕", "fire", 7, {
    ...area(6, 19, 3400, field(6, 1800, 600)), onHit: { burn },
  }),
  "flame-wall": spell("flame-wall", "火墙", "fire", 13, {
    effect: "beam", power: 8, manaCost: 28, cooldownMs: 5100, range: 24,
    beam: { anchor: "target", width: 3, durationMs: 2100, tickMs: 525, maxTargets: 6, bidirectional: true }, onHit: { burn },
    description: "在目标位置沿施法方向铺设双向火墙，灼烧穿过火墙的敌人。",
  }),
  "inferno-bastion": spell("inferno-bastion", "炽炎壁垒", "fire", 24, {
    ...area(10, 46, 9200, { ...field(17, 2400, 600), anchor: "caster",
      finish: { mode: "ring", radius: 22, maxTargets: 8, durationMs: 500, powerMultiplier: 2.8, onHit: { knockback: 7 } } }),
    onHit: { burn }, description: "在施法者周围持续灼烧敌人，壁垒熄灭时爆发火环并击退敌人。",
  }),
  "fire-rain": spell("fire-rain", "火雨", "fire", 11, {
    ...area(13, 27, 5200, { ...strike(5, 380, 5), shower: { count: 4, intervalMs: 270, spread: 9 } }), onHit: { burn },
  }),
  "heavenfire": spell("heavenfire", "天火燎原", "fire", 25, {
    ...area(17, 53, 11000, { ...strike(6, 500, 6), shower: { count: 5, intervalMs: 330, spread: 16 },
      finish: { mode: "field", radius: 4, maxTargets: 5, durationMs: 1000, tickMs: 500, powerMultiplier: .32 } }),
    onHit: { burn }, description: "降下五次分散的火焰冲击，每处落点留下短暂的燃烧区。",
  }),
  "lava-geyser": spell("lava-geyser", "熔岩喷泉", "fire", 13, {
    ...area(29, 28, 5200, { ...strike(6, 500, 7), mode: "eruption" }),
    onHit: { burn, knockback: 4 }, fusionElements: ["earth"],
  }),
  "volcanic-eruption": spell("volcanic-eruption", "火山喷发", "fire", 25, {
    ...area(47, 56, 11500, { ...strike(10, 850, 8), mode: "eruption",
      finish: { mode: "field", radius: 11, durationMs: 2400, tickMs: 600, powerMultiplier: .2, maxTargets: 8 } }),
    onHit: { burn }, fusionElements: ["earth"], description: "延迟后猛烈喷发，随后留下持续灼烧敌人的岩浆区。",
  }),
  "fire-tornado": spell("fire-tornado", "火龙卷", "fire", 14, {
    ...area(7, 33, 5900, { ...field(6, 2600, 520), mode: "vortex", moveSpeed: 10, pullRadius: 9, pullStrength: 5 }),
    onHit: { burn }, fusionElements: ["wind"],
  }),
  "blazing-tempest": spell("blazing-tempest", "炽焰风暴", "fire", 26, {
    ...area(10, 58, 12200, { ...field(7, 2600, 650, 6), mode: "vortex", moveSpeed: 11, vortexPairSeparation: 13,
      finish: { mode: "ring", radius: 9, durationMs: 450, powerMultiplier: 2, maxTargets: 7 } }),
    onHit: { burn }, fusionElements: ["wind"], description: "两股移动火旋分别灼烧敌人，各自在消散处迸出一圈烈焰。",
  }),
  riptide: spell("riptide", "回潮", "water", 8, {
    ...area(5, 19, 3500, { ...field(5, 2000, 500), mode: "vortex", moveSpeed: 0, pullRadius: 9, pullStrength: 7 }),
    description: "在目标附近卷起回潮，牵引敌人并反复打湿。",
  }),
  tsunami: spell("tsunami", "海啸", "water", 17, {
    ...area(34, 34, 6800, { mode: "ring", radius: 24, maxTargets: 8, delayMs: 380, durationMs: 820 }),
    onHit: { knockback: 8 }, description: "蓄势后推出一圈巨浪，打湿并击退最多8个敌人。",
  }),
  "great-flood": spell("great-flood", "大洪水", "water", 27, {
    ...area(8, 58, 12400, { ...field(8, 3400, 680, 8), expandDuringMs: 1900,
      finish: { mode: "ring", radius: 14, durationMs: 500, maxTargets: 8, powerMultiplier: 3, onHit: { knockback: 7 } } }),
    onHit: { slow: { multiplier: .75, durationMs: 1050 } }, description: "洪水持续向外漫开、打湿并减速敌人，退潮时击退周围敌人。",
  }),
  icicle: spell("icicle", "冰棱", "water", 7, {
    effect: "projectile", power: 20, manaCost: 13, cooldownMs: 2100, range: 36, speed: 89,
    impact: { type: "pierce", maxTargets: 3, falloff: .75 }, onHit: { slow: chill },
  }),
  "frost-nova": spell("frost-nova", "霜冻新星", "water", 14, {
    ...area(24, 27, 5100, { mode: "ring", radius: 17, maxTargets: 8, delayMs: 160, durationMs: 550 }),
    onHit: { slow: { multiplier: .4, durationMs: 1750 } },
  }),
  "absolute-zero": spell("absolute-zero", "绝对零度", "water", 26, {
    ...area(7, 50, 10500, { ...field(12, 3000, 600, 8),
      finish: { mode: "strike", radius: 8, durationMs: 350, maxTargets: 8, powerMultiplier: 5 } }),
    onHit: { slow: { multiplier: .18, durationMs: 720 } }, description: "严寒区周期性压低敌人移速，结束时冰层碎裂并重创中心敌人。",
  }),
  "water-blade": spell("water-blade", "水刃", "water", 7, {
    effect: "projectile", power: 15, manaCost: 11, cooldownMs: 1500, range: 36, speed: 102,
    impact: { type: "pierce", maxTargets: 4, falloff: .72 }, onHit: { armorPierce: .22 },
  }),
  "pressure-jet": spell("pressure-jet", "高压水束", "water", 15, {
    effect: "beam", power: 10, manaCost: 30, cooldownMs: 5700, range: 44,
    beam: { width: 1.4, durationMs: 1800, tickMs: 450, maxTargets: 5 }, onHit: { armorPierce: .42, knockback: 2 },
  }),
  "abyssal-pressure": spell("abyssal-pressure", "深海高压", "water", 25, {
    ...area(12, 48, 9800, { ...field(7, 2200, 550), mode: "vortex", moveSpeed: 0, pullRadius: 11, pullStrength: 9,
      finish: { mode: "strike", radius: 5, durationMs: 350, maxTargets: 6, powerMultiplier: 4, onHit: { armorPierce: .65 } } }),
    description: "把敌人挤向深水中心，水域坍缩时对中心敌人造成高额破甲伤害。",
  }),
  "thunder-cloud": spell("thunder-cloud", "雷云", "lightning", 8, {
    ...area(8, 23, 4600, { ...field(7, 2100, 525), mode: "vortex", moveSpeed: 7, pullStrength: 0 }),
  }),
  "lightning-storm": spell("lightning-storm", "闪电风暴", "lightning", 23, {
    ...area(17, 47, 9700, { ...strike(6, 350, 7), shower: { count: 6, intervalMs: 230, spread: 15 } }),
    description: "依次向目标周围六个落点降下闪电，每次攻击最多命中7个敌人。",
  }),
  "ball-lightning": spell("ball-lightning", "球形闪电", "lightning", 9, {
    effect: "projectile", power: 8, manaCost: 21, cooldownMs: 4400, range: 39, speed: 37,
    impact: { type: "field", radius: 6, maxTargets: 6, durationMs: 1800, tickMs: 450, trigger: "either" },
  }),
  "ball-lightning-storm": spell("ball-lightning-storm", "雷球风暴", "lightning", 24, {
    ...area(10, 48, 9900, { ...field(5, 2600, 520, 6), mode: "vortex", moveSpeed: 13, pullStrength: 0, vortexPairSeparation: 11,
      finish: { mode: "rays", radius: 10, rayPairs: 2, rayWidth: .9, durationMs: 650, tickMs: 325, powerMultiplier: .8, maxTargets: 4 } }),
    description: "释放两颗游走雷球，消散时各自沿十字方向放电。",
  }),
  "emp": spell("emp", "电磁脉冲", "lightning", 12, {
    ...area(20, 26, 5200, { mode: "ring", radius: 17, maxTargets: 8, delayMs: 180, durationMs: 480 }),
    onHit: { slow: { multiplier: .55, durationMs: 1250 }, armorPierce: .4 }, fusionElements: ["metal"],
  }),
  "electromagnetic-storm": spell("electromagnetic-storm", "电磁风暴", "lightning", 26, {
    ...area(11, 53, 11000, { ...field(11, 2600, 650, 8),
      finish: { mode: "ring", radius: 17, durationMs: 500, maxTargets: 8, powerMultiplier: 2.6, onHit: { knockback: 5 } } }),
    onHit: { slow: { multiplier: .68, durationMs: 900 }, armorPierce: .45 }, fusionElements: ["metal"],
    description: "电磁场持续减速并穿透敌人护甲，消散时释放向外击退的脉冲。",
  }),
};

const recipe = (output: string, ...inputs: string[]): RecipeDefinition =>
  ({ id: `${output}-recipe`, name: approvedSpells[output].name, inputs, output, requireAdjacency: true });

export const approvedRecipes: RecipeDefinition[] = [
  recipe("fire-curtain", "fire-sprout", "ember-seed"),
  recipe("flame-wall", "fire-curtain", "fire-curtain"),
  recipe("inferno-bastion", "flame-wall", "fire-curtain", "greater-area"),
  recipe("fire-rain", "fireball", "fire-sprout", "triple"),
  recipe("heavenfire", "fire-rain", "flame-wall", "greater-area"),
  recipe("lava-geyser", "magma-pool", "clay-shot"),
  recipe("volcanic-eruption", "lava-geyser", "magma-pool", "greater-area"),
  recipe("fire-tornado", "fire-curtain", "wind-blade", "duration"),
  recipe("blazing-tempest", "fire-tornado", "fire-rain", "greater-area"),
  recipe("riptide", "tidal-orb", "water-bolt"),
  recipe("tsunami", "riptide", "tidal-orb", "area"),
  recipe("great-flood", "tsunami", "riptide", "greater-area"),
  recipe("icicle", "frost-shot", "frost-drop"),
  recipe("frost-nova", "icicle", "frost-ring"),
  recipe("absolute-zero", "frost-nova", "glacial-lance", "duration"),
  { ...recipe("water-blade", "water-bolt", "water-bolt"),
    layout: [{ x: 0, y: 0, rotation: 0 }, { x: 1, y: 0, rotation: 0 }] },
  recipe("pressure-jet", "water-blade", "water-blade", "focus"),
  recipe("abyssal-pressure", "pressure-jet", "riptide", "greater-amplify"),
  recipe("thunder-cloud", "static-field", "lightning-bolt"),
  recipe("lightning-storm", "thunder-cloud", "thunder-strike", "quadruple"),
  recipe("ball-lightning", "static-field", "static-spark"),
  recipe("ball-lightning-storm", "ball-lightning", "thunder-cloud", "quadruple"),
  recipe("emp", "arc-coil", "static-field"),
  recipe("electromagnetic-storm", "emp", "ball-lightning", "greater-area"),
];
