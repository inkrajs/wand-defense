import type { ArcanaDefinition, RecipeDefinition } from "../contracts";
import type { TacticalModifier } from "../contracts/tactical-arcana";

type Definition = ArcanaDefinition;
type Branch = readonly [
  modifier: TacticalModifier, baseId: string, baseName: string, baseDescription: string, baseInputs: readonly string[],
  advancedId: string, advancedName: string, advancedDescription: string, advancedInputs: readonly string[],
];

const branches: readonly Branch[] = [
  ["charge", "charge-up", "蓄势", "让攻击法术以更长冷却换取更高的单次伤害。", ["amplify", "duration"],
    "overload", "过载", "提高攻击爆发，额外消耗法力并延长冷却。", ["charge-up", "greater-amplify"]],
  ["compression", "compression", "压缩", "把范围攻击压缩到更小的区域，提升其中的伤害。", ["area", "focus"],
    "compression-burst", "聚爆", "压缩持续领域，并在中心追加一次延迟爆炸。", ["compression", "aftershock"]],
  ["spread", "diffusion", "扩散", "扩大持续领域，降低每次脉冲的伤害。", ["tiny-area", "reach"],
    "proliferation", "蔓延", "持续领域逐步向外扩展，边缘附近的敌人会在后续脉冲受到伤害。", ["diffusion", "domain-expansion"]],
  ["branding", "brand", "烙印", "攻击留下短暂印记，下一次来自同一角色的攻击会引爆印记。", ["burn", "precision"],
    "detonation", "引爆", "消耗目标印记时冲击附近敌人；次级伤害不会继续引爆。", ["brand", "greater-burn"]],
  ["freezing", "freeze", "冻结", "水系攻击命中被减速的敌人时，短暂将其冻结。", ["slow", "frost-shot"],
    "ice-shatter", "碎冰", "命中被冻结的敌人时击碎冰层，造成一次额外伤害。", ["freeze", "icicle"]],
  ["conductivity", "electrify", "感电", "雷系攻击命中后在敌人体内积蓄电荷。", ["arc-coil", "static-spark"],
    "superconduct", "超导", "消耗已有电荷，向一个附近敌人放电并短暂削弱其护甲。", ["electrify", "emp"]],
  ["armorBreak", "armor-break", "破甲", "攻击命中后短暂降低目标对后续攻击的护甲防御。", ["pierce", "precision"],
    "weak-point", "弱点打击", "追击已被破甲的敌人，造成额外伤害并延长其破甲时间。", ["armor-break", "deep-pierce"]],
  ["returnFlight", "return-flight", "折返", "飞弹飞到射程终点后折回，回程可以再次命中。", ["range-trigger", "light-flight"],
    "circling-pursuit", "回旋追猎", "飞弹折返时可追击尚未命中的附近目标。", ["return-flight", "pursuit"]],
  ["fanShot", "fan-shot", "扇射", "同次施法沿三个分开的方向发射飞弹，单颗伤害降低。", ["split", "precision"],
    "rotating-volley", "轮转齐射", "分两轮扇射，第二轮错开角度，覆盖第一轮之间的空隙。", ["fan-shot", "quadruple"]],
  ["resplit", "second-split", "二次分裂", "首发飞弹命中时放出两颗弱裂弹，每次施法最多触发一次。", ["split", "hit-trigger"],
    "continuous-split", "连续分裂", "首发飞弹命中时分裂，第一颗裂弹命中后可再分裂一次。", ["second-split", "chain-ricochet"]],
  ["constructPayload", "spell-mount", "法术搭载", "召唤物优先以相邻飞弹法术作为攻击，召唤时支付额外法力。", ["capacity", "linked-cast"],
    "cooperative-casting", "协同召法", "召唤物保留本身攻击，并隔次攻击施放搭载法术。", ["spell-mount", "multi-linked-cast"]],
  ["reinforcement", "reinforcement", "增援", "再次召唤时优先治疗同来源召唤物，并补充其存在时间。", ["duration", "capacity"],
    "rally", "集结", "整顿多名现有召唤物的生命和存续时间；没有可整顿的单位时照常召唤。", ["reinforcement", "greater-amplify"]],
  ["symbiosis", "symbiosis", "共生", "召唤物施加有效伤害后回复自身少量生命。", ["efficiency", "root-feed"],
    "soul-link", "灵魂链接", "召唤物以造成的伤害治疗附近受损的友方召唤物。", ["symbiosis", "elemental-resonance"]],
  ["sacrifice", "sacrifice", "献祭", "消耗一个同来源的存活召唤物，立刻在其位置释放范围冲击。", ["martyrdom", "condense"],
    "soul-sacrifice", "灵魂献祭", "献祭时为附近召唤物回复生命，并在原处追加一次冲击。", ["sacrifice", "chain-martyrdom"]],
];

function makeArcana(modifier: TacticalModifier, id: string, name: string, description: string, tier: 1 | 2): Definition {
  return {
    id, name, description, modifier, value: tier,
    shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, ...(tier === 2 ? [{ x: 1, y: 1 }] : [])],
    grade: tier === 1 ? "rare" : "legendary", level: tier === 1 ? 12 : 24,
    rewardMinWave: tier === 1 ? 16 : 32,
    asset: { key: `arcana.${id}`, label: name, color: "#baa0d1" },
  };
}

export const approvedArcana: Record<string, Definition> = Object.fromEntries(branches.flatMap(
  ([modifier, baseId, baseName, baseDescription, , advancedId, advancedName, advancedDescription]) => [
    [baseId, makeArcana(modifier, baseId, baseName, baseDescription, 1)],
    [advancedId, makeArcana(modifier, advancedId, advancedName, advancedDescription, 2)],
  ],
));

function recipe(output: string, inputs: readonly string[]): RecipeDefinition {
  return { id: `${output}-recipe`, name: approvedArcana[output].name, inputs: [...inputs], output, requireAdjacency: true };
}

export const approvedRecipes = branches.flatMap(([, baseId, , , baseInputs, advancedId, , , advancedInputs]) =>
  [recipe(baseId, baseInputs), recipe(advancedId, advancedInputs)]);
