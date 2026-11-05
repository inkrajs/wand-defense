import type { Element, SpellDefinition } from "../contracts";

const square = (size: number) => Array.from({ length: size * size }, (_, index) => ({ x: index % size, y: Math.floor(index / size) }));
type Details = Omit<SpellDefinition, "id" | "name" | "element" | "shape" | "asset" | "level" | "grade">;
function spell(id: string, name: string, element: Element, color: string, size: number, details: Details): SpellDefinition {
  return { id, name, element, shape: square(size), asset: { key: `spell.${id}`, label: name, color },
    level: 1, grade: "common", rewardMinWave: size === 3 ? 15 : 6, ...details };
}

/** Playable spell definitions. Advanced effects use the same combat and combination pipeline. */
export const cataclysmSpells: Record<string, SpellDefinition> = {
  "dense-rock": spell("dense-rock", "重岩弹", "earth", "#b18d65", 2, {
    rewardMinWave: 4,
    description: "将岩弹压缩成沉重的岩块，飞行较慢，命中时造成伤害并击退敌人。",
    effect: "projectile", power: 55, manaCost: 18, cooldownMs: 2400, range: 30, speed: 28,
    onHit: { knockback: 4 },
  }),
  "gravity-core": spell("gravity-core", "引力核", "earth", "#b59b79", 2, {
    rewardMinWave: 8,
    description: "在敌人附近凝聚短暂的引力核，轻微牵引周围敌人并持续造成伤害。",
    effect: "area", power: 3, manaCost: 18, cooldownMs: 4500, range: 32,
    area: { mode: "vortex", anchor: "target", radius: 4, delayMs: 0, durationMs: 2000, tickMs: 500, maxTargets: 4, moveSpeed: 0, pullRadius: 9, pullStrength: 4 },
  }),
  "gravity-well": spell("gravity-well", "引力井", "dark", "#8e6bb5", 2, {
    fusionElements: ["dark", "earth"], rewardMinWave: 12,
    description: "在敌人附近形成引力井，牵引并持续伤害周围敌人。",
    effect: "area", power: 5, manaCost: 24, cooldownMs: 5500, range: 38,
    area: { mode: "vortex", anchor: "target", radius: 6, delayMs: 0, durationMs: 2800, tickMs: 400, maxTargets: 6, moveSpeed: 0, pullRadius: 13, pullStrength: 7 },
  }),
  "black-hole": spell("black-hole", "小黑洞", "dark", "#7951a0", 3, {
    description: "形成小黑洞，牵引并吞噬中心的残血敌人；结束时爆发，吞噬越多威力越强，最多计入8个。首领的吞噬门槛更低。",
    effect: "area", power: 8, manaCost: 75, cooldownMs: 11500, range: 48,
    area: { mode: "vortex", anchor: "target", radius: 8, delayMs: 0, durationMs: 4000, tickMs: 400, maxTargets: 8,
      moveSpeed: 0, pullRadius: 19, pullStrength: 14, consume: { radius: 3, healthRatio: 0.2 },
      finish: { mode: "strike", radius: 15, durationMs: 450, maxTargets: 8, powerMultiplier: 4, perConsumed: 0.15, maxConsumed: 8 } },
  }),
  "twin-black-holes": spell("twin-black-holes", "双生黑洞", "dark", "#8b62b0", 3, {
    rewardMinWave: 25,
    description: "同时形成两个黑洞，各自牵引、吞噬残血敌人，结束时分别爆发；首领的吞噬门槛更低。",
    effect: "area", power: 7, manaCost: 110, cooldownMs: 15000, range: 50,
    area: { mode: "vortex", anchor: "target", radius: 7, delayMs: 0, durationMs: 3600, tickMs: 400, maxTargets: 8,
      moveSpeed: 0, pullRadius: 17, pullStrength: 12, vortexPairSeparation: 14, consume: {radius: 3, healthRatio: 0.2},
      finish: {mode:"strike", radius:12, durationMs:400, maxTargets:8, powerMultiplier:3, perConsumed:0.15, maxConsumed:8} },
  }),
  "supermassive-black-hole": spell("supermassive-black-hole", "超级大黑洞", "dark", "#a27ac6", 3, {
    rewardMinWave: 35,
    description: "形成巨型黑洞，强力牵引大范围敌人并吞噬中心残血目标；结束时释放强烈爆发，首领的吞噬门槛更低。",
    effect: "area", power: 14, manaCost: 165, cooldownMs: 22000, range: 58,
    area: {mode:"vortex", anchor:"target", radius:14, delayMs:0, durationMs:4800, tickMs:400, maxTargets:8,
      moveSpeed:0, pullRadius:30, pullStrength:20, consume:{radius:5, healthRatio:0.3},
      finish:{mode:"strike", radius:25, durationMs:450, maxTargets:8, powerMultiplier:6, perConsumed:0.2, maxConsumed:10}},
  }),
  "helium-flash": spell("helium-flash", "氦闪", "fire", "#ed9850", 2, {
    fusionElements: ["earth", "lightning"], rewardMinWave: 25,
    description: "凝聚星核灼烧周围敌人，随后向四周释放八道穿透射线。",
    effect: "area", power: 22, manaCost: 75, cooldownMs: 13000, range: 45,
    area: { mode: "field", anchor: "target", radius: 10, delayMs: 0, durationMs: 1200, tickMs: 400, maxTargets: 8,
      finish: { mode: "rays", radius: 48, rayPairs: 4, rayWidth: 2.5, durationMs: 900, tickMs: 300, maxTargets: 8, powerMultiplier: 1.4 } },
    onHit: { burn: { powerRatio: 0.15, durationMs: 1200, tickMs: 600 } },
  }),
  "artificial-sun": spell("artificial-sun", "人造太阳", "fire", "#eda847", 3, {
    fusionElements: ["earth", "lightning", "water"], rewardMinWave: 35,
    description: "召唤太阳灼烧附近敌人并每秒消耗8法力；结束或法力不足时爆发，持续越久爆发越强。",
    effect: "area", power: 18, manaCost: 100, cooldownMs: 15000, range: 42,
    area: { mode: "field", anchor: "target", radius: 13, delayMs: 0, durationMs: 4000, tickMs: 400, maxTargets: 8, manaPerSecond: 8,
      finish: { mode: "strike", radius: 18, durationMs: 450, maxTargets: 8, powerMultiplier: 5, perSecond: 0.2,
        onHit: { burn: { powerRatio: 0.2, durationMs: 1800, tickMs: 600 } } } },
    onHit: { burn: { powerRatio: 0.15, durationMs: 1200, tickMs: 600 } },
  }),
  supernova: spell("supernova", "超新星爆发", "fire", "#ef8952", 3, {
    rewardMinWave: 45, description: "星核先短暂聚集并灼烧敌人，随后爆发出向外扩散的冲击波。",
    effect: "area", power: 13, manaCost: 70, cooldownMs: 10500, range: 46,
    area: { mode: "vortex", anchor: "target", radius: 8, delayMs: 0, durationMs: 1800, tickMs: 450, maxTargets: 8, moveSpeed: 0, pullRadius: 15, pullStrength: 6,
      finish: { mode: "ring", radius: 32, durationMs: 900, maxTargets: 8, powerMultiplier: 7,
        onHit: { burn: { powerRatio: 0.18, durationMs: 1800, tickMs: 600 } } } },
  }),
  pulsar: spell("pulsar", "脉冲星", "lightning", "#8bc4db", 2, {
    description: "在目标处形成脉冲星，两道射线围绕它旋转，持续扫射经过的敌人。",
    effect: "beam", power: 10, manaCost: 55, cooldownMs: 8500, range: 38,
    beam: { width: 2.5, durationMs: 3600, tickMs: 300, maxTargets: 8, rotationPerSecond: 100, bidirectional: true, anchor: "target" },
  }),
  "gamma-burst": spell("gamma-burst", "伽马射线暴", "light", "#f1d279", 3, {
    description: "向目标方向释放细长而强力的射线，持续穿透路径上的敌人。",
    effect: "beam", power: 24, manaCost: 65, cooldownMs: 10000, range: 100,
    beam: { width: 2, durationMs: 1500, tickMs: 300, maxTargets: 8 },
  }),
  "fission-bomb": spell("fission-bomb", "核弹", "metal", "#e9a454", 2, {
    fusionElements: ["fire", "metal"], description: "引发有限的连锁裂变，在邻近敌人间传递；每次裂变还会波及周围敌人。",
    effect: "chain", power: 22, manaCost: 32, cooldownMs: 6000, range: 36,
    impact: { type: "chain", radius: 11, maxTargets: 4, falloff: 0.8, blastRadius: 4, blastMaxTargets: 3 },
  }),
  "hydrogen-bomb": spell("hydrogen-bomb", "氢弹", "fire", "#e57950", 2, {
    fusionElements: ["fire", "metal"], description: "锁定敌人引发强烈爆炸，随后留下短暂的高温灼烧区域。",
    effect: "area", power: 75, manaCost: 65, cooldownMs: 10000, range: 42,
    area: { mode: "strike", radius: 14, delayMs: 800, durationMs: 300, maxTargets: 8,
      finish: { mode: "field", radius: 12, durationMs: 2400, tickMs: 400, maxTargets: 8, powerMultiplier: 0.12,
        onHit: { burn: { powerRatio: 0.2, durationMs: 1200, tickMs: 600 } } } },
  }),
  "three-phase-bomb": spell("three-phase-bomb", "三相弹", "fire", "#df7652", 3, {
    fusionElements: ["fire", "metal"], description: "先引发小范围裂变，随后爆发大范围冲击，最后留下持续伤害敌人的辐射区域。",
    effect: "area", power: 45, manaCost: 95, cooldownMs: 14000, range: 46,
    area: { mode: "strike", radius: 7, delayMs: 1000, durationMs: 300, maxTargets: 8,
      finish: { mode: "strike", radius: 20, durationMs: 350, maxTargets: 8, powerMultiplier: 2,
        next: { mode: "field", radius: 20, durationMs: 4000, tickMs: 500, maxTargets: 8, powerMultiplier: 0.12 } } },
  }),
  "twilight-orb": spell("twilight-orb", "辉蚀", "dark", "#aa8bc7", 2, {
    fusionElements: ["light"], rewardMinWave: 6,
    description: "光暗交织的飞弹命中后爆发，并短暂减缓附近敌人。",
    effect: "projectile", power: 25, manaCost: 15, cooldownMs: 2400, range: 34, speed: 50,
    impact: { type: "splash", radius: 5, maxTargets: 5 }, onHit: { slow: {multiplier: 0.8, durationMs: 1000} },
  }),
  "annihilation-orb": spell("annihilation-orb", "湮灭弹", "dark", "#a482c4", 2, {
    fusionElements: ["light"], rewardMinWave: 15,
    description: "集中光暗力量爆发，湮灭爆心内生命低于10%的敌人；首领门槛为2.5%。",
    effect: "projectile", power: 42, manaCost: 35, cooldownMs: 5500, range: 38, speed: 48,
    impact: { type: "splash", radius: 6, maxTargets: 6 }, onHit: { execute: { healthRatio: 0.1, bossMultiplier: 0.25, radius: 2.5 } },
  }),
  "antimatter-bomb": spell("antimatter-bomb", "反物质炸弹", "dark", "#9f78c7", 2, {
    fusionElements: ["dark", "light"], description: "发射炸弹造成范围伤害，爆心内生命低于25%的敌人会被湮灭；首领门槛为6.25%。",
    rewardMinWave: 35, effect: "projectile", power: 85, manaCost: 85, cooldownMs: 12000, range: 40, speed: 48,
    impact: { type: "splash", radius: 7, maxTargets: 8 },
    onHit: { execute: { healthRatio: 0.25, bossMultiplier: 0.25, radius: 3 } },
  }),
  "depleted-round": spell("depleted-round", "贫铀弹", "metal", "#adb9a7", 2, {
    description: "高速弹体连续穿透敌人，忽略75%护甲，每穿透一次伤害降低。",
    effect: "projectile", power: 42, manaCost: 24, cooldownMs: 3600, range: 55, speed: 150,
    impact: { type: "pierce", maxTargets: 5, falloff: 0.85 }, onHit: { armorPierce: 0.75 },
  }),
  railgun: spell("railgun", "电磁轨道炮", "metal", "#9cb8cf", 2, {
    fusionElements: ["metal", "lightning"], description: "沿直线射出高速穿透弹，忽略一半护甲，最多命中8个敌人。",
    effect: "projectile", power: 65, manaCost: 40, cooldownMs: 6500, range: 80, speed: 200,
    impact: { type: "pierce", maxTargets: 8, falloff: 0.9 }, onHit: { armorPierce: 0.5 },
  }),
  "god-rod": spell("god-rod", "上帝之杖", "metal", "#c4bba9", 3, {
    fusionElements: ["metal", "light", "lightning"], rewardMinWave: 35, description: "锁定敌人，短暂延迟后从高空落下重型金属弹，造成集中冲击并忽略70%护甲。",
    effect: "area", power: 180, manaCost: 70, cooldownMs: 11000, range: 65,
    area: { mode: "strike", radius: 5, delayMs: 1200, durationMs: 400, maxTargets: 5 }, onHit: { armorPierce: 0.7 },
  }),
  "vacuum-decay": spell("vacuum-decay", "真空衰变", "dark", "#b291d1", 3, {
    fusionElements: ["dark", "light"], rewardMinWave: 45, description: "从角色位置扩散衰变边界，伤害路径上的敌人并湮灭残血目标；首领门槛更低。",
    effect: "area", power: 65, manaCost: 100, cooldownMs: 15000, range: 80,
    area: { mode: "ring", radius: 80, delayMs: 0, durationMs: 1800, maxTargets: 8 },
    onHit: { execute: { healthRatio: 0.2, bossMultiplier: 0.25 } },
  }),
  "fire-sea": spell("fire-sea", "焚世火海", "fire", "#e76b42", 3, {
    description: "在敌人附近形成大片火海，持续灼烧其中的敌人。",
    effect: "area", power: 14, manaCost: 60, cooldownMs: 8500, range: 42,
    area: { mode: "field", anchor: "target", radius: 22, delayMs: 250, durationMs: 4000, tickMs: 500, maxTargets: 8 },
    onHit: { burn: { powerRatio: 0.2, durationMs: 1800, tickMs: 600 } },
  }),
  "ice-seal": spell("ice-seal", "寒潮封境", "water", "#78bedc", 3, {
    description: "形成寒潮区域，持续伤害并大幅减缓区域内敌人。",
    effect: "area", power: 9, manaCost: 52, cooldownMs: 8000, range: 40,
    area: { mode: "field", anchor: "target", radius: 19, delayMs: 200, durationMs: 3500, tickMs: 500, maxTargets: 8 },
    onHit: { slow: { multiplier: 0.3, durationMs: 800 } },
  }),
  "forest-prison": spell("forest-prison", "万木森狱", "wood", "#75af66", 3, {
    description: "在目标周围生长荆棘区域，持续伤害并大幅减缓敌人。",
    effect: "area", power: 12, manaCost: 48, cooldownMs: 8000, range: 38,
    area: { mode: "field", anchor: "target", radius: 16, delayMs: 200, durationMs: 3500, tickMs: 500, maxTargets: 8 },
    onHit: { slow: { multiplier: 0.4, durationMs: 1000 } },
  }),
  "blade-prison": spell("blade-prison", "千锋剑狱", "metal", "#b1bdc8", 3, {
    description: "在目标附近形成剑刃风暴，持续切割敌人并忽略部分护甲。",
    effect: "area", power: 16, manaCost: 58, cooldownMs: 9000, range: 38,
    area: { mode: "field", anchor: "target", radius: 16, delayMs: 200, durationMs: 3000, tickMs: 400, maxTargets: 8 },
    onHit: { armorPierce: 0.3 },
  }),
  earthquake: spell("earthquake", "地震", "earth", "#b18e66", 3, {
    description: "震动向外扩散的地面，多次伤害并击退范围内敌人。",
    effect: "area", power: 18, manaCost: 48, cooldownMs: 7500, range: 38,
    area: { mode: "field", anchor: "target", radius: 18, delayMs: 250, durationMs: 2400, tickMs: 400, maxTargets: 8, expandDuringMs: 2000 },
    onHit: { knockback: 2 },
  }),
  "thunder-prison": spell("thunder-prison", "九霄雷狱", "lightning", "#bf9cde", 3, {
    description: "闪电连续跳向附近敌人，每次跳跃会波及周围目标。",
    effect: "chain", power: 26, manaCost: 58, cooldownMs: 8000, range: 48,
    impact: { type: "chain", radius: 18, maxTargets: 8, falloff: 0.9, blastRadius: 3, blastMaxTargets: 2 },
  }),
  "sky-vortex": spell("sky-vortex", "天穹风眼", "wind", "#6dbdad", 3, {
    description: "在目标附近形成风眼，牵引敌人并持续伤害；结束时释放一圈冲击波。",
    effect: "area", power: 10, manaCost: 55, cooldownMs: 9000, range: 42,
    area: { mode: "vortex", anchor: "target", radius: 10, delayMs: 0, durationMs: 3500, tickMs: 500, maxTargets: 8,
      moveSpeed: 0, pullRadius: 20, pullStrength: 11,
      finish: { mode: "ring", radius: 20, durationMs: 650, maxTargets: 8, powerMultiplier: 4, onHit: { knockback: 4 } } },
  }),
  "eternal-night": spell("eternal-night", "永夜深渊", "dark", "#8c6aae", 3, {
    description: "黑暗领域持续侵蚀敌人并减速，范围内残血敌人会被吞没。",
    effect: "area", power: 13, manaCost: 65, cooldownMs: 9500, range: 42,
    area: { mode: "field", anchor: "target", radius: 18, delayMs: 0, durationMs: 3500, tickMs: 500, maxTargets: 8 },
    onHit: { slow: { multiplier: 0.6, durationMs: 800 }, execute: { healthRatio: 0.1, bossMultiplier: 0.25 } },
  }),
  "flame-elemental": spell("flame-elemental", "烈焰元素", "fire", "#e37b4f", 2, {
    description: "召唤会移动并发射火焰的元素，有生命值和存在时间，命中可灼烧敌人。",
    effect: "summon", power: 16, manaCost: 32, cooldownMs: 6000, range: 36,
    construct: { hp: 70, durationMs: 14000, attackIntervalMs: 900, maxAlive: 2, attackMode: "projectile", behavior: "attack", moveSpeed: 10, projectileSpeed: 80, bodySize: "normal" },
    onHit: { burn: { powerRatio: 0.2, durationMs: 1800, tickMs: 600 } },
  }),
  "iron-guardian": spell("iron-guardian", "钢铁卫士", "metal", "#aeb8bf", 2, {
    description: "召唤生命较高的近战卫士，主动接近敌人攻击并抵挡敌人的进攻。",
    effect: "summon", power: 26, manaCost: 40, cooldownMs: 7000, range: 3,
    construct: { hp: 150, durationMs: 16000, attackIntervalMs: 1300, maxAlive: 2, attackMode: "contact", behavior: "attack", moveSpeed: 8, bodySize: "large" },
    onHit: { armorPierce: 0.2 },
  }),
};
