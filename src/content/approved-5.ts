import type { AreaSpec, ConstructSpec, Element, RecipeDefinition, SpellDefinition } from "../contracts";

type Effect = Pick<SpellDefinition, "effect" | "power" | "manaCost" | "cooldownMs" | "range">
  & Partial<Pick<SpellDefinition, "area" | "beam" | "construct" | "impact" | "onHit" | "speed" | "fusionElements">>;

const colors: Record<Element, string> = {
  fire: "#e87953", water: "#7dbfd5", metal: "#aebbc9", wood: "#85a772", earth: "#bf9368",
  lightning: "#d8c36e", wind: "#72b6a9", light: "#e4cb77", dark: "#a785c4", undead: "#bcb1d3",
};

function spell(id: string, name: string, element: Element, wave: number, description: string, effect: Effect): SpellDefinition {
  const width = wave >= 24 ? 3 : 2;
  return {
    id, name, element, description, rewardMinWave: wave, grade: "common", level: 1,
    asset: { key: `spell.${id}`, label: name, color: colors[element] },
    shape: Array.from({ length: width * 2 }, (_, i) => ({ x: i % width, y: Math.floor(i / width) })),
    ...effect,
  };
}

const field = (radius: number, durationMs: number, tickMs = 500): AreaSpec =>
  ({ mode: "field", anchor: "target", radius, delayMs: 150, durationMs, tickMs, maxTargets: 8 });
const vortex = (radius: number, durationMs: number, pullStrength: number, moveSpeed = 0): AreaSpec =>
  ({ ...field(radius, durationMs), mode: "vortex", pullRadius: radius + 4, pullStrength, moveSpeed });
const ring = (radius: number, durationMs = 700): AreaSpec =>
  ({ mode: "ring", radius, delayMs: 150, durationMs, maxTargets: 8 });
const finish = (mode: "strike" | "ring" | "field", radius: number, powerMultiplier: number, durationMs = 500) =>
  ({ mode, radius, powerMultiplier, durationMs, maxTargets: 8 });
const area = (power: number, manaCost: number, cooldownMs: number, spec: AreaSpec): Effect =>
  ({ effect: "area", power, manaCost, cooldownMs, range: 42, area: spec });
const beam = (power: number, manaCost: number, cooldownMs: number, range: number, spec: NonNullable<SpellDefinition["beam"]>): Effect =>
  ({ effect: "beam", power, manaCost, cooldownMs, range, beam: spec });
const shot = (power: number, manaCost: number, cooldownMs: number, speed: number, impact: SpellDefinition["impact"]): Effect =>
  ({ effect: "projectile", power, manaCost, cooldownMs, speed, range: 36, impact });
const shield = (power: number, manaCost: number, cooldownMs: number): Effect =>
  ({ effect: "shield", power, manaCost, cooldownMs, range: 20 });
const construct = (effect: "summon" | "building", power: number, manaCost: number, cooldownMs: number, range: number, spec: ConstructSpec): Effect =>
  ({ effect, power, manaCost, cooldownMs, range, construct: spec });
const spectral = (hp: number, durationMs: number, count: number, ranged: boolean): ConstructSpec =>
  ({ hp, durationMs, maxAlive: count, baseCount: count, behavior: "attack", attackIntervalMs: ranged ? 1400 : 950,
    attackMode: ranged ? "projectile" : "contact", moveSpeed: ranged ? 7 : 12, ...(ranged ? { projectileSpeed: 85 } : {}) });
const wall = (hp: number, durationMs: number, count: number, behavior: ConstructSpec["behavior"]): ConstructSpec =>
  ({ hp, durationMs, maxAlive: count, baseCount: count, behavior, attackIntervalMs: 1700, attackMode: "contact",
    bodySize: "large", placement: behavior === "shield" ? "caster" : "target" });
const slow = (multiplier: number, durationMs: number) => ({ slow: { multiplier, durationMs } });
const burn = { burn: { powerRatio: .22, durationMs: 1200, tickMs: 600 } };

export const approvedSpells: Record<string, SpellDefinition> = Object.fromEntries([
  spell("scorched-earth", "焦土", "fire", 12, "在目标脚下留下焦土，持续灼伤经过的敌人。", {
    ...area(6, 20, 4700, field(9, 3000, 600)), onHit: burn,
  }),
  spell("molten-hell", "熔土地狱", "fire", 30, "熔融区域向外扩张，结束时从中心喷出一圈高温冲击。", {
    ...area(10, 55, 11300, { ...field(9, 4200, 700), expandDuringMs: 1800,
      finish: finish("ring", 19, 3.4, 700) }), onHit: burn, fusionElements: ["earth"],
  }),
  spell("flame-lash", "炎鞭", "fire", 10, "用近距离火鞭横扫前方，命中时灼烧敌人。", {
    ...beam(5, 18, 3650, 19, { width: 2.5, durationMs: 900, tickMs: 100, maxTargets: 4, rotationPerSecond: 30 }),
    onHit: burn,
  }),
  spell("fire-serpent", "火蛇", "fire", 24, "从敌群附近放出游走的火蛇，在消散处留下短暂余焰。", {
    ...area(10, 36, 8100, { ...vortex(6, 2800, 0, 11), tickMs: 350,
      finish: { ...finish("field", 8, .8, 1600), tickMs: 400 } }), onHit: burn,
  }),

  spell("ice-mist", "冰雾", "water", 10, "凝结成缓慢扩张的冰雾，使进入雾中的敌人减速。", {
    ...area(4, 17, 3900, { ...field(6, 2400, 600), expandDuringMs: 950 }), onHit: slow(.65, 850),
  }),
  spell("blizzard", "暴风雪", "water", 29, "在目标周边连续落下冰雪，分批伤害并减速敌人。", {
    ...area(19, 48, 9400, { mode: "strike", radius: 6, delayMs: 250, durationMs: 350, maxTargets: 6,
      shower: { count: 6, intervalMs: 240, spread: 15 } }), onHit: slow(.52, 1200), fusionElements: ["wind"],
  }),
  spell("water-spiral", "水旋", "water", 12, "在目标附近放出游走的水涡，卷动并打湿沿途敌人。", {
    ...area(5, 21, 4100, vortex(6, 2300, 6, 9)),
  }),
  spell("deep-sea-vortex", "深海漩涡", "water", 31, "两股水涡沿场地游走，各自在消失时向外推出急流。", {
    ...area(8, 57, 11700, { ...vortex(7, 3300, 10, 6), vortexPairSeparation: 12,
      finish: { ...finish("ring", 10, 2.1), onHit: { knockback: 5 } } }),
  }),

  spell("gear-disc", "齿轮", "metal", 10, "飞出一枚厚重的齿轮，穿过前两名敌人时保留大部分威力。", {
    ...shot(19, 12, 2400, 54, { type: "pierce", maxTargets: 2, falloff: .9 }),
  }),
  spell("blade-wheel", "刀轮", "metal", 18, "向敌群抛出旋刃，命中或飞到尽头后留在原地切割。", {
    ...shot(8, 24, 4600, 60, { type: "field", radius: 6, maxTargets: 5, durationMs: 2400, tickMs: 400, trigger: "either" }),
  }),
  spell("cutting-storm", "切割风暴", "metal", 31, "放出游走的刀轮旋涡，散开时沿两个轴向扫射。", {
    ...area(10, 51, 10500, { ...vortex(8, 2700, 4, 10),
      finish: { mode: "rays", radius: 17, rayPairs: 2, rayWidth: .9, durationMs: 800, tickMs: 400, maxTargets: 5, powerMultiplier: 1.7 } }),
    onHit: { armorPierce: .35 },
  }),
  spell("magnetic-needle", "磁针", "metal", 13, "磁针命中时向近处传导，短暂减速并忽略部分护甲。", {
    ...shot(18, 17, 3500, 90, { type: "chain", radius: 7, maxTargets: 3, falloff: .62 }),
    onHit: { ...slow(.78, 900), armorPierce: .25 }, fusionElements: ["lightning"],
  }),
  spell("magnetic-storm", "磁暴", "metal", 29, "磁场将附近敌人拽向中心，随后从中心释放破甲冲击。", {
    ...area(9, 49, 10000, { ...vortex(7, 2300, 14),
      finish: { ...finish("strike", 7, 4), onHit: { armorPierce: .55 } } }), fusionElements: ["lightning"],
  }),

  spell("spore", "孢子", "wood", 8, "孢子落地后短暂停留，使接触到的敌人行动迟缓。", {
    ...shot(4, 11, 3000, 40, { type: "field", radius: 4, maxTargets: 4, durationMs: 1600, tickMs: 400, trigger: "either" }),
    onHit: slow(.8, 750),
  }),
  spell("spore-cloud", "孢子云", "wood", 17, "在敌群中升起扩张孢子云，持续伤害并减速其中的敌人。", {
    ...area(6, 23, 5200, { ...field(7, 3000, 600), expandDuringMs: 1300 }), onHit: slow(.72, 850),
  }),
  spell("fungal-spread", "真菌蔓延", "wood", 28, "两片移动的孢子云散播菌丝，消散处各自留下持续伤害区。", {
    ...area(8, 46, 10500, { ...vortex(7, 2300, 0, 9), tickMs: 450, vortexPairSeparation: 10,
      finish: { ...finish("field", 8, .9, 2000), tickMs: 500 } }), onHit: slow(.66, 900),
  }),

  spell("sand-dust", "砂尘", "earth", 8, "向敌人掷出砂团，命中时扬起砂尘并减缓近处敌人。", {
    ...shot(13, 11, 2600, 70, { type: "splash", radius: 5, maxTargets: 5 }), onHit: slow(.82, 1100),
  }),
  spell("quicksand", "流沙", "earth", 17, "把目标下方变成流沙，越过边缘的敌人会被拉向中心。", {
    ...area(5, 22, 5500, vortex(7, 3000, 9)), onHit: slow(.57, 800),
  }),
  spell("sandstorm", "沙暴", "earth", 30, "移动风沙穿透部分护甲，停歇时向外推开卷入的敌人。", {
    ...area(9, 48, 10800, { ...vortex(10, 3800, 7, 11),
      finish: { ...finish("ring", 16, 2, 700), onHit: { knockback: 5 } } }),
    onHit: { armorPierce: .3 }, fusionElements: ["wind"],
  }),

  spell("electric-charge", "电荷", "lightning", 8, "投出带电粒子，命中后向最近的敌人传导一次。", {
    ...shot(11, 10, 2200, 110, { type: "chain", radius: 9, maxTargets: 2, falloff: .7 }),
  }),
  spell("electrostatic-shield", "静电护盾", "lightning", 16, "将电荷集中在领地边缘，立即补回一部分已有护盾。", {
    ...shield(28, 24, 5400),
  }),
  spell("ion-shield", "离子护盾", "lightning", 27, "设置离子装置，在其存续期间反复为附近的领地护盾充能。", {
    ...construct("building", 12, 46, 9800, 22, wall(140, 9000, 1, "shield")), fusionElements: ["light"],
  }),

  spell("wind-pressure", "风压", "wind", 9, "把迎面气流压成冲击圈，短距离推开近处敌人。", {
    ...area(16, 15, 3200, ring(13, 500)), onHit: { knockback: 4 },
  }),
  spell("vacuum-blade", "真空刃", "wind", 17, "射出窄而快速的真空刃，沿直线连续穿透敌人。", {
    ...shot(28, 22, 3500, 150, { type: "pierce", maxTargets: 5, falloff: .77 }), onHit: { armorPierce: .35 },
  }),
  spell("vacuum-storm", "真空风暴", "wind", 30, "游走的低压风眼卷动敌群，结束时释放数道穿行的风刃。", {
    ...area(9, 52, 10900, { ...vortex(9, 2800, 11, 9),
      finish: { mode: "rays", radius: 19, rayPairs: 3, rayWidth: .8, durationMs: 600, tickMs: 300, maxTargets: 4, powerMultiplier: 1.9 } }),
  }),

  spell("starlight", "星光", "light", 9, "向敌人投下短促的星光，片刻后照亮并伤害命中区域。", {
    ...area(23, 16, 3700, { mode: "strike", radius: 5, delayMs: 350, durationMs: 350, maxTargets: 5 }),
  }),
  spell("stellar-glow", "星辉", "light", 19, "星辉从敌群中心向两侧旋转扫过，连续穿透路径上的敌人。", {
    ...beam(8, 29, 5900, 23, { width: 1.5, durationMs: 2100, tickMs: 420, maxTargets: 6,
      rotationPerSecond: 95, bidirectional: true, anchor: "target" }),
  }),
  spell("aurora", "极光", "light", 30, "极光带持续照射敌群，消散时从中心折射出四束光。", {
    ...area(8, 50, 10200, { ...field(11, 2600, 520),
      finish: { mode: "rays", radius: 23, rayPairs: 2, rayWidth: 1.4, durationMs: 900, tickMs: 450, maxTargets: 5, powerMultiplier: 2 } }),
  }),

  spell("living-shadow", "暗影", "dark", 9, "暗影飞弹命中后散开，伤害并减缓爆心附近的敌人。", {
    ...shot(17, 13, 2750, 51, { type: "splash", radius: 4, maxTargets: 5 }), onHit: slow(.73, 1000),
  }),
  spell("shadow-double", "影子分身", "dark", 19, "召出独立战斗的影子分身，以近身攻击牵制敌人。", {
    ...construct("summon", 18, 30, 8800, 4, spectral(85, 12500, 1, false)), onHit: slow(.82, 1000),
  }),
  spell("shadow-legion", "暗影军团", "dark", 31, "召来三名远程影子，向最近的敌人射出减速飞弹。", {
    ...construct("summon", 13, 59, 15000, 21, spectral(70, 15000, 3, true)), onHit: slow(.78, 950),
  }),

  spell("bone-armor", "骨甲", "undead", 9, "把碎骨覆在领地护盾上，立即恢复一部分护盾。", {
    ...shield(20, 16, 4600),
  }),
  spell("bone-wall", "骨墙", "undead", 18, "在前线竖起骨墙，承受敌人的攻击并反击近敌。", {
    ...construct("building", 10, 29, 8300, 7, wall(175, 13000, 1, "attack")),
  }),
  spell("bone-prison", "骨牢", "undead", 29, "先从敌群脚下升起骨刺，命中处随后形成持续减速的骨牢。", {
    ...area(27, 47, 11100, { mode: "strike", radius: 8, delayMs: 300, durationMs: 350, maxTargets: 8,
      finish: { ...finish("field", 9, .22, 2600), tickMs: 520, onHit: slow(.52, 1000) } }),
  }),
  spell("ghost", "幽魂", "undead", 11, "召来一只游荡的幽魂，从远处向最近的敌人投射魂火。", {
    ...construct("summon", 12, 20, 7400, 22, spectral(53, 11000, 1, true)),
  }),
  spell("revenant", "怨灵", "undead", 19, "召来近身怨灵，它以穿透部分护甲的攻击纠缠敌人。", {
    ...construct("summon", 23, 32, 9300, 4, spectral(104, 13500, 1, false)), onHit: { armorPierce: .35 },
  }),
  spell("ghost-legion", "幽灵军团", "undead", 32, "召来三只幽灵，魂火命中后分向附近敌人。", {
    ...construct("summon", 11, 63, 15900, 23, spectral(75, 14500, 3, true)),
    impact: { type: "chain", radius: 6, maxTargets: 2, falloff: .57 },
  }),
].map(definition => [definition.id, definition]));

const paths: Record<string, string[]> = {
  "scorched-earth": ["fire-curtain", "fire-field-bolt"],
  "molten-hell": ["scorched-earth", "lava-geyser", "greater-burn"],
  "flame-lash": ["flame-lance", "velocity"],
  "fire-serpent": ["flame-lash", "fire-tornado", "duration"],
  "ice-mist": ["frost-drop", "steam-cloud"],
  blizzard: ["ice-mist", "frost-nova", "moving-storm"],
  "water-spiral": ["riptide", "water-blade"],
  "deep-sea-vortex": ["water-spiral", "tsunami", "greater-area"],
  "gear-disc": ["iron-disc", "iron-spark"],
  "blade-wheel": ["gear-disc", "gear-disc", "duration"],
  "cutting-storm": ["blade-wheel", "autocannon", "moving-storm"],
  "magnetic-needle": ["steel-needle", "arc-coil"],
  "magnetic-storm": ["magnetic-needle", "emp", "greater-area"],
  spore: ["thorn-seed", "root-feed"],
  "spore-cloud": ["spore", "spore", "area"],
  "fungal-spread": ["spore-cloud", "thorn-forest", "duration"],
  "sand-dust": ["pebble", "dust-blade"],
  quicksand: ["sand-dust", "mud-patch"],
  sandstorm: ["quicksand", "tornado", "greater-area"],
  "electric-charge": ["static-spark", "spark-hop"],
  "electrostatic-shield": ["electric-charge", "ward"],
  "ion-shield": ["electrostatic-shield", "emp", "prism-barrier"],
  "wind-pressure": ["gale-burst", "gust"],
  "vacuum-blade": ["wind-pressure", "piercing-gale"],
  "vacuum-storm": ["vacuum-blade", "tornado", "greater-area"],
  starlight: ["glimmer", "lucent-ring"],
  "stellar-glow": ["starlight", "light-convergence"],
  aurora: ["stellar-glow", "prism-ray", "wind-circulation"],
  "living-shadow": ["night-mote", "gloom-mist"],
  "shadow-double": ["living-shadow", "ghost-light", "condense"],
  "shadow-legion": ["shadow-double", "shadow-double", "triple"],
  "bone-armor": ["bone-chip", "ward"],
  "bone-wall": ["bone-armor", "skeleton-guard", "capacity"],
  "bone-prison": ["bone-wall", "bone-wall", "root-snare"],
  ghost: ["grave-echo", "ghost-light"],
  revenant: ["ghost", "skeleton-mage"],
  "ghost-legion": ["revenant", "ghost", "bone-legion"],
};

export const approvedRecipes: RecipeDefinition[] = Object.entries(paths).map(([output, inputs]) => ({
  id: `${output}-recipe`, name: approvedSpells[output].name, output, inputs, requireAdjacency: true,
}));
