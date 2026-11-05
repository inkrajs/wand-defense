import type { AreaSpec, Cell, ConstructSpec, RecipeDefinition, SpellDefinition } from "../contracts";

const colors = { wind: "#79bbaf", light: "#e6cd77", dark: "#ac88c9", undead: "#bdb0d2" };
type School = keyof typeof colors;
type Spec = Pick<SpellDefinition, "effect" | "power" | "manaCost" | "cooldownMs" | "range">
  & Partial<Pick<SpellDefinition, "area" | "beam" | "construct" | "impact" | "onHit" | "remainsAction" | "fusionElements">>;

function spell(id: string, name: string, element: School, width: number, height: number, rewardMinWave: number,
  description: string, spec: Spec): SpellDefinition {
  const shape: Cell[] = Array.from({ length: width * height }, (_, index) => ({ x: index % width, y: Math.floor(index / width) }));
  return { id, name, element, shape, rewardMinWave, description, level: 1, grade: "common",
    asset: { key: `spell.${id}`, label: name, color: colors[element] }, ...spec };
}

function area(power: number, manaCost: number, cooldownMs: number, geometry: AreaSpec, onHit?: SpellDefinition["onHit"]): Spec {
  return { effect: "area", power, manaCost, cooldownMs, range: 44, area: geometry, onHit };
}
function vortex(radius: number, durationMs: number, pullStrength: number, moveSpeed: number): AreaSpec {
  return { mode: "vortex", anchor: "target", radius, delayMs: 150, durationMs, tickMs: 500, maxTargets: 8,
    moveSpeed, pullStrength, pullRadius: radius + 3 };
}
function beam(power: number, manaCost: number, cooldownMs: number, geometry: NonNullable<SpellDefinition["beam"]>): Spec {
  return { effect: "beam", power, manaCost, cooldownMs, range: 52, beam: geometry };
}
function construct(effect: "summon" | "building", power: number, manaCost: number, cooldownMs: number, config: ConstructSpec): Spec {
  return { effect, power, manaCost, cooldownMs, range: config.behavior === "shield" ? 14 : config.attackMode === "contact" ? 4 : 28, construct: config };
}
const shieldTower = (hp: number, durationMs: number, attackIntervalMs: number): ConstructSpec =>
  ({ hp, durationMs, attackIntervalMs, maxAlive: 1, behavior: "shield", attackMode: "contact" });
const undead = (hp: number, count: number, durationMs: number, ranged = false): ConstructSpec =>
  ({ hp, durationMs, attackIntervalMs: ranged ? 1250 : 1000, maxAlive: count, baseCount: count, behavior: "attack",
    attackMode: ranged ? "projectile" : "contact", moveSpeed: ranged ? 7 : 11, ...(ranged ? { projectileSpeed: 80 } : {}) });

export const approvedSpells: Record<string, SpellDefinition> = Object.fromEntries([
  spell("wind-swirl", "风旋", "wind", 2, 2, 8, "在敌群附近形成小型旋风，向中心卷动敌人。", area(5, 14, 3400, vortex(5, 1700, 7, 0))),
  spell("tornado", "龙卷风", "wind", 2, 2, 17, "龙卷风沿战场移动，把沿途敌人卷向风眼。", area(8, 28, 5700, vortex(7, 3000, 10, 13))),
  spell("hurricane", "飓风", "wind", 3, 3, 34, "飓风沿途卷入敌人，结束时爆发一圈向外击退的狂风。", area(11, 53, 9800, {
    ...vortex(12, 4200, 14, 9), finish: { mode: "ring", radius: 17, durationMs: 800, maxTargets: 14,
      powerMultiplier: 2.2, onHit: { knockback: 6 } },
  })),
  spell("wind-wall", "风墙", "wind", 2, 2, 11, "脚下卷起向外扩散的风墙，推开逼近的敌人。", area(17, 18, 4100, {
    mode: "ring", anchor: "caster", radius: 16, delayMs: 0, durationMs: 650, maxTargets: 10,
  }, { knockback: 5 })),
  spell("storm-bulwark", "风暴壁垒", "wind", 3, 2, 22, "在身边维持一道回旋风障，反复击退靠近的敌人。", area(5, 31, 6800, {
    mode: "field", anchor: "caster", radius: 13, delayMs: 0, durationMs: 3000, tickMs: 500, maxTargets: 8,
  }, { knockback: 4 })),
  spell("wind-circulation", "环流", "wind", 2, 2, 21, "两股旋风在目标两侧成形，分别牵引周围敌人。", area(7, 34, 7200, {
    ...vortex(6, 2900, 9, 0), vortexPairSeparation: 13,
  })),
  spell("atmospheric-circulation", "大气环流", "wind", 3, 3, 37, "两股环流沿战场移动，消散后各留下短暂的减速气流。", area(10, 62, 11500, {
    ...vortex(10, 3900, 12, 7), vortexPairSeparation: 20,
    finish: { mode: "field", radius: 10, durationMs: 2000, tickMs: 500, maxTargets: 8, powerMultiplier: .5,
      onHit: { slow: { multiplier: .65, durationMs: 700 } } },
  })),
  spell("light-convergence", "聚光", "light", 2, 2, 10, "在目标处聚起光束，连续照射经过光束的敌人。", beam(8, 17, 3300, {
    anchor: "target", width: 3, durationMs: 850, tickMs: 250, maxTargets: 4,
  })),
  spell("laser", "激光", "light", 2, 2, 19, "从施法者位置射出窄光束，集中烧穿一列敌人。", {
    ...beam(16, 27, 4900, { width: 2, durationMs: 1250, tickMs: 250, maxTargets: 6 }), onHit: { armorPierce: .4 },
  }),
  spell("high-energy-laser", "高能激光", "light", 3, 3, 36, "双向高能光束缓慢扫过战场，灼烧并穿透护甲。", {
    ...beam(23, 61, 10200, { width: 5, durationMs: 2000, tickMs: 400, maxTargets: 10, bidirectional: true, rotationPerSecond: .65 }),
    onHit: { armorPierce: .55, burn: { powerRatio: .24, durationMs: 1100, tickMs: 550 } },
  }),
  spell("light-bulwark", "光明壁垒", "light", 2, 2, 12, "展开光明壁垒，一次补充领地护盾。", {
    effect: "shield", power: 25, manaCost: 20, cooldownMs: 5200, range: 16,
  }),
  spell("prism-barrier", "棱镜屏障", "light", 2, 2, 23, "在防线附近部署棱镜，存续期间周期为领地补充护盾。", construct("building", 8, 35, 9100, shieldTower(66, 10500, 1300))),
  spell("sanctuary", "圣域", "light", 3, 3, 37, "在防线附近部署圣域核心，存续期间持续补充领地护盾。", {
    ...construct("building", 11, 61, 15000, shieldTower(125, 15500, 1050)), fusionElements: ["wood"],
  }),
  spell("eclipse-mark", "蚀印", "dark", 2, 2, 11, "射出蚀印，穿过敌人并对其造成持续暗蚀伤害。", {
    effect: "projectile", power: 17, manaCost: 16, cooldownMs: 2800, range: 38,
    impact: { type: "pierce", maxTargets: 3, falloff: .75 },
    onHit: { burn: { powerRatio: .28, durationMs: 1800, tickMs: 600 } },
  }),
  spell("annihilation-mark", "湮灭印记", "dark", 3, 2, 24, "印记命中时溅射周围敌人，并处决爆心内的残血目标。", {
    effect: "projectile", power: 34, manaCost: 34, cooldownMs: 6200, range: 44,
    impact: { type: "splash", radius: 7, maxTargets: 7 },
    onHit: { execute: { healthRatio: .16, bossMultiplier: .2, radius: 3 } },
  }),
  spell("void-rift", "虚空裂隙", "dark", 2, 2, 15, "在敌人脚下打开裂隙，短暂延迟后持续减速并侵蚀敌人。", area(7, 20, 4400, {
    mode: "field", anchor: "target", radius: 7, delayMs: 350, durationMs: 2500, tickMs: 500, maxTargets: 7,
  }, { slow: { multiplier: .65, durationMs: 650 } })),
  spell("void-tempest", "虚空风暴", "dark", 2, 2, 26, "裂隙化成游走风暴，牵引并削穿聚集敌人的护甲。", area(10, 40, 7800, vortex(10, 3600, 12, 10), { armorPierce: .4 })),
  spell("event-horizon", "事件视界", "dark", 3, 3, 44, "固定的视界吞噬中心残血敌人，收束爆发随吞噬数增强。", area(12, 78, 14200, {
    ...vortex(14, 4500, 19, 0), consume: { radius: 4, healthRatio: .18 },
    finish: { mode: "strike", radius: 16, durationMs: 250, maxTargets: 14, powerMultiplier: 2.5, perConsumed: .25, maxConsumed: 5 },
  })),
  spell("dark-star", "暗星", "dark", 2, 2, 20, "召出不断扩张的暗星，缓慢将敌人拖向中心。", area(9, 32, 6500, {
    ...vortex(9, 3500, 10, 0), expandDuringMs: 2200,
  })),
  spell("dark-star-burst", "暗星爆发", "dark", 3, 3, 37, "暗星扩张并聚怪，熄灭时从中心向多方向喷发暗光。", area(12, 60, 11000, {
    ...vortex(13, 4200, 13, 0), expandDuringMs: 2200,
    finish: { mode: "rays", radius: 25, durationMs: 600, maxTargets: 12, powerMultiplier: 2.8, rayPairs: 3, rayWidth: 4 },
  })),
  spell("bone-siege", "骸骨围城", "undead", 2, 2, 22, "消耗敌方遗骸引爆，并在原处留下减速的骸骨阵。", {
    ...area(33, 37, 7200, { mode: "strike", anchor: "target", radius: 8, delayMs: 300, durationMs: 250, maxTargets: 8,
      finish: { mode: "field", radius: 8, durationMs: 2400, tickMs: 600, maxTargets: 8, powerMultiplier: .23,
        onHit: { slow: { multiplier: .7, durationMs: 800 } } } }), remainsAction: "detonate",
  }),
  spell("undead-army", "亡灵军团", "undead", 2, 2, 31, "召出四名近战亡灵，分别拦截逼近防线的敌人。", construct("summon", 17, 51, 14200, undead(70, 4, 17000))),
  spell("undead-scourge", "亡灵天灾", "undead", 3, 3, 44, "消耗敌方遗骸，在原地召出高耐久亡灵拦截敌群。", {
    ...construct("summon", 32, 74, 16200, undead(148, 3, 21000)), remainsAction: "reanimate", range: 48,
  }),
  spell("bone-sorcerer", "骸骨法师", "undead", 2, 2, 16, "召出骸骨法师，以穿透骨矢攻击同一条线上的敌人。", {
    ...construct("summon", 18, 34, 9500, undead(47, 1, 17000, true)), impact: { type: "pierce", maxTargets: 3, falloff: .7 },
  }),
  spell("lich", "巫妖", "undead", 3, 2, 29, "召出巫妖，法弹在命中后向附近敌人连锁跳跃。", {
    ...construct("summon", 25, 52, 12300, undead(72, 1, 21000, true)),
    impact: { type: "chain", radius: 8, maxTargets: 4, falloff: .72 },
  }),
  spell("bone-dragon", "骨龙", "undead", 2, 2, 26, "召出骨龙发射腐蚀弹，命中处留下持续伤害的毒雾。", {
    ...construct("summon", 21, 50, 12500, { ...undead(110, 1, 19000, true), bodySize: "large" }),
    impact: { type: "field", radius: 5, maxTargets: 5, durationMs: 1800, tickMs: 600, trigger: "contact" },
  }),
  spell("ancient-bone-dragon", "远古骨龙", "undead", 3, 3, 43, "召出远古骨龙，骨焰爆发溅射并灼烧成群敌人。", {
    ...construct("summon", 37, 76, 17000, { ...undead(190, 1, 23000, true), attackIntervalMs: 1650, bodySize: "large" }),
    impact: { type: "splash", radius: 8, maxTargets: 8 }, onHit: { burn: { powerRatio: .3, durationMs: 1500, tickMs: 500 } },
  }),
].map(definition => [definition.id, definition]));

const paths: Record<string, string[]> = {
  "wind-swirl": ["gale-burst", "gust"],
  tornado: ["wind-swirl", "moving-storm"],
  hurricane: ["tornado", "wind-circulation", "greater-area"],
  "wind-wall": ["gale-burst", "dust-blade"],
  "storm-bulwark": ["wind-wall", "duration", "moving-storm"],
  "wind-circulation": ["wind-swirl", "moving-storm", "double"],
  "atmospheric-circulation": ["wind-circulation", "storm-bulwark", "greater-area"],
  "light-convergence": ["solar-ray", "focus"],
  laser: ["light-convergence", "prism-ray"],
  "high-energy-laser": ["laser", "greater-amplify", "greater-reach"],
  "light-bulwark": ["ward", "lucent-ring"],
  "prism-barrier": ["light-bulwark", "prism-ray"],
  sanctuary: ["prism-barrier", "renewal", "greater-amplify"],
  "eclipse-mark": ["gloom-mist", "void-ray"],
  "annihilation-mark": ["eclipse-mark", "annihilation-orb"],
  "void-rift": ["gloom-mist", "twilight-field"],
  "void-tempest": ["void-rift", "black-hole"],
  "event-horizon": ["void-tempest", "supermassive-black-hole", "annihilation-mark"],
  "dark-star": ["eclipse-mark", "gravity-well"],
  "dark-star-burst": ["dark-star", "twin-black-holes", "greater-area"],
  "bone-siege": ["bone-legion", "corpse-burst"],
  "undead-army": ["bone-siege", "reanimate", "triple"],
  "undead-scourge": ["undead-army", "lich", "rebirth"],
  "bone-sorcerer": ["skeleton-mage", "corpse-burst"],
  lich: ["bone-sorcerer", "reanimate"],
  "bone-dragon": ["bone-sorcerer", "bone-legion", "gravity-core"],
  "ancient-bone-dragon": ["bone-dragon", "lich", "rebirth"],
};

export const approvedRecipes: RecipeDefinition[] = Object.entries(paths).map(([output, inputs]) => ({
  id: `${output}-recipe`, name: approvedSpells[output].name, output, inputs, requireAdjacency: true,
}));
