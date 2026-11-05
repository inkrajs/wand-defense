import type { AreaSpec, Cell, ConstructSpec, RecipeDefinition, SpellDefinition } from "../contracts";

const rectangle = (width: number, height: number): Cell[] =>
  Array.from({ length: width * height }, (_, i) => ({ x: i % width, y: Math.floor(i / width) }));
const bar = rectangle(2, 1);
const square = rectangle(2, 2);
const block = rectangle(3, 2);
const colors = { metal: "#b7bdc9", wood: "#84ac70", earth: "#bf9874" };
type Element = keyof typeof colors;
type Spec = Omit<SpellDefinition, "id" | "name" | "element" | "asset" | "grade" | "level">;

function spell(id: string, name: string, element: Element, spec: Spec): SpellDefinition {
  return { id, name, element, asset: { key: `spell.${id}`, label: name, color: colors[element] },
    grade: "common", level: 1, ...spec };
}

function shot(power: number, manaCost: number, cooldownMs: number, speed = 105, range = 42) {
  return { effect: "projectile" as const, power, manaCost, cooldownMs, speed, range };
}
function area(power: number, manaCost: number, cooldownMs: number, spec: AreaSpec) {
  return { effect: "area" as const, power, manaCost, cooldownMs, range: 38, area: spec };
}
function field(radius: number, durationMs: number, tickMs: number, maxTargets: number): AreaSpec {
  return { mode: "field", anchor: "target", radius, delayMs: 180, durationMs, tickMs, maxTargets };
}
function construct(effect: "building" | "summon", power: number, manaCost: number,
  cooldownMs: number, range: number, spec: ConstructSpec) {
  return { effect, power, manaCost, cooldownMs, range, construct: spec };
}

export const approvedSpells: Record<string, SpellDefinition> = {
  "armor-round": spell("armor-round", "穿甲弹", "metal", {
    ...shot(23, 11, 1650), shape: bar, rewardMinWave: 6,
    impact: { type: "pierce", maxTargets: 2, falloff: .62 }, onHit: { armorPierce: .48 },
    description: "向目标发射硬芯弹，忽略48%护甲，穿透首个目标后威力衰减。",
  }),
  "tungsten-core": spell("tungsten-core", "钨芯弹", "metal", {
    ...shot(38, 19, 2800, 142, 49), shape: square, rewardMinWave: 13,
    onHit: { armorPierce: .76, knockback: 4 },
    description: "高速钨芯弹集中打击首个目标，忽略76%护甲并击退敌人。",
  }),
  "armor-cannon": spell("armor-cannon", "穿甲炮", "metal", {
    ...shot(66, 35, 5200, 125, 56), shape: block, rewardMinWave: 23,
    impact: { type: "pierce", maxTargets: 5, falloff: .82 }, onHit: { armorPierce: .7, knockback: 3 },
    description: "重炮弹贯穿一列敌人，最多命中5个，沿途每个目标均承受穿甲冲击。",
  }),
  "autocannon": spell("autocannon", "速射炮", "metal", {
    ...construct("building", 14, 29, 8000, 26, {
      hp: 65, durationMs: 10000, attackIntervalMs: 400, maxAlive: 1,
      attackMode: "projectile", behavior: "attack", projectileSpeed: 145,
    }), shape: square, rewardMinWave: 11,
    description: "部署一座固定炮台，存续10秒，每0.4秒向射程内敌人射击。",
  }),
  "metal-tempest": spell("metal-tempest", "金属风暴", "metal", {
    ...area(13, 53, 10200, {
      ...field(12, 3000, 360, 8),
      finish: { mode: "rays", radius: 19, durationMs: 450, maxTargets: 7, rayPairs: 3, rayWidth: 2, powerMultiplier: 2 },
    }), onHit: { armorPierce: .26 }, shape: block, rewardMinWave: 22,
    description: "密集弹雨持续切割目标区域，结束时从中心射出三对贯射线。",
  }),
  "grenade-cannon": spell("grenade-cannon", "榴弹炮", "metal", {
    ...area(42, 28, 4100, { mode: "strike", radius: 10, delayMs: 420, durationMs: 300, maxTargets: 7, anchor: "target" }),
    shape: square, rewardMinWave: 13, fusionElements: ["fire", "earth"],
    onHit: { knockback: 5 },
    description: "锁定目标所在位置，延迟落下一枚榴弹，爆炸会击退周围敌人。",
  }),
  "saturation-barrage": spell("saturation-barrage", "饱和轰炸", "metal", {
    ...area(27, 57, 11000, {
      mode: "strike", radius: 8, delayMs: 550, durationMs: 350, maxTargets: 6, anchor: "target",
      shower: { count: 6, intervalMs: 240, spread: 14 },
    }), shape: block, rewardMinWave: 24, fusionElements: ["fire", "earth"],
    description: "在锁定区域连续投下6枚榴弹，每枚独立爆炸，覆盖范围比单发榴弹炮更广。",
  }),
  "steel-squad": spell("steel-squad", "钢铁小队", "metal", {
    ...construct("summon", 14, 38, 10500, 23, {
      hp: 66, durationMs: 12500, attackIntervalMs: 1050, maxAlive: 2, baseCount: 2,
      behavior: "attack", attackMode: "projectile", moveSpeed: 9, projectileSpeed: 110,
    }), shape: square, rewardMinWave: 15, onHit: { armorPierce: .25 },
    description: "召出两名能移动的钢铁射手，远距离穿甲射击，各自拥有生命值。",
  }),
  "steel-legion": spell("steel-legion", "钢铁军团", "metal", {
    ...construct("summon", 28, 64, 15500, 4, {
      hp: 135, durationMs: 18000, attackIntervalMs: 1150, maxAlive: 3, baseCount: 3,
      behavior: "attack", attackMode: "contact", moveSpeed: 11, bodySize: "large",
    }), shape: block, rewardMinWave: 25, onHit: { armorPierce: .35, knockback: 3 },
    description: "召出三名重装步兵，向敌人推进，用近战穿甲攻击击退敌人。",
  }),

  "thorn-grove": spell("thorn-grove", "荆棘林", "wood", {
    ...area(5, 17, 4400, field(7, 2500, 500, 6)), shape: square, rewardMinWave: 7,
    onHit: { slow: { multiplier: .56, durationMs: 760 } },
    description: "在目标脚下种出荆棘，周期性刺伤并缠缓经过的敌人。",
  }),
  "thorn-forest": spell("thorn-forest", "荆棘森林", "wood", {
    ...area(9, 36, 7500, {
      ...field(13, 3400, 520, 8), expandDuringMs: 1500,
      finish: { mode: "ring", radius: 14, durationMs: 650, maxTargets: 8, powerMultiplier: 2.1,
        onHit: { slow: { multiplier: .45, durationMs: 950 } } },
    }), shape: block, rewardMinWave: 16,
    description: "荆棘向外蔓延，持续刺伤敌人，结束时向外扫出一圈缠根。",
  }),
  "ancient-tree-guard": spell("ancient-tree-guard", "古树守卫", "wood", {
    ...construct("summon", 26, 40, 10000, 5, {
      hp: 165, durationMs: 18000, attackIntervalMs: 1350, maxAlive: 1,
      attackMode: "contact", behavior: "attack", moveSpeed: 7, bodySize: "large",
    }), shape: square, rewardMinWave: 13, onHit: { slow: { multiplier: .54, durationMs: 1350 } },
    description: "召出一棵耐久较高的古树，主动拦敌，挥枝使敌人减速。",
  }),
  "ent-legion": spell("ent-legion", "树人军团", "wood", {
    ...construct("summon", 21, 62, 15000, 5, {
      hp: 105, durationMs: 17000, attackIntervalMs: 950, maxAlive: 3, baseCount: 3,
      attackMode: "contact", behavior: "attack", moveSpeed: 13,
    }), shape: block, rewardMinWave: 23,
    onHit: { knockback: 3 },
    description: "三名轻捷树人一同上阵，接近并反复击退敌人。",
  }),
  "life-spring": spell("life-spring", "生命之泉", "wood", {
    ...construct("building", 9, 29, 9200, 14, {
      hp: 56, durationMs: 7500, attackIntervalMs: 1150, maxAlive: 1,
      attackMode: "contact", behavior: "heal",
    }), shape: square, rewardMinWave: 12,
    description: "放下一口可被摧毁的泉眼，周期性治疗射程内较近的受伤友军或领地。",
  }),
  "world-tree": spell("world-tree", "世界树", "wood", {
    ...construct("building", 18, 68, 21000, 18, {
      hp: 215, durationMs: 18000, attackIntervalMs: 1700, maxAlive: 1, bodySize: "large",
      attackMode: "contact", behavior: "heal",
    }), shape: block, rewardMinWave: 26,
    description: "栽下世界树抵挡敌军，并周期性治疗射程内较近的受伤友军或领地。",
  }),

  "fault-line": spell("fault-line", "断层", "earth", {
    ...area(27, 20, 3400, {
      mode: "strike", anchor: "target", radius: 8, delayMs: 420, durationMs: 310, maxTargets: 6,
      finish: { mode: "ring", radius: 11, durationMs: 450, maxTargets: 5, powerMultiplier: .55, onHit: { knockback: 4 } },
    }), shape: square, rewardMinWave: 8,
    description: "在目标脚下震开断层，接着向外扩散一圈能击退敌人的余震。",
  }),
  landslide: spell("landslide", "山崩", "earth", {
    ...area(13, 37, 7200, {
      ...field(8, 2800, 470, 7), mode: "vortex", moveSpeed: 13,
    }), onHit: { knockback: 4 }, shape: square, rewardMinWave: 15,
    description: "滚动的岩堆向敌人推进，沿途反复撞伤并推开敌人。",
  }),
  "plate-collision": spell("plate-collision", "板块碰撞", "earth", {
    ...area(15, 61, 12500, {
      ...field(12, 2900, 520, 8), mode: "vortex", moveSpeed: 0, pullRadius: 19, pullStrength: 9,
      finish: { mode: "strike", radius: 14, durationMs: 500, maxTargets: 9, powerMultiplier: 4.2 },
    }), shape: block, rewardMinWave: 25,
    description: "两侧地壳向震中挤压并牵引敌人，最后在中心爆发一次强烈撞击。",
  }),
  "rock-wall": spell("rock-wall", "岩墙", "earth", {
    ...construct("building", 3, 22, 8000, 4, {
      hp: 150, durationMs: 8500, attackIntervalMs: 1350, maxAlive: 1,
      attackMode: "contact", behavior: "attack", bodySize: "large",
    }), shape: square, rewardMinWave: 8, onHit: { knockback: 4 },
    description: "立起一堵承伤岩墙，接近墙体的敌人会被岩块推开。",
  }),
  "stone-fortress": spell("stone-fortress", "岩石堡垒", "earth", {
    ...construct("building", 16, 42, 13000, 18, {
      hp: 110, durationMs: 13000, attackIntervalMs: 1150, maxAlive: 2, baseCount: 2,
      attackMode: "projectile", behavior: "attack", projectileSpeed: 62, bodySize: "large",
    }), shape: block, rewardMinWave: 18,
    description: "筑起两座能承伤的固定石堡，各自向敌人投射岩弹。",
  }),
  "mantle-impact": spell("mantle-impact", "地幔冲击", "earth", {
    ...area(36, 40, 8100, {
      mode: "eruption", anchor: "target", radius: 12, delayMs: 520, durationMs: 400, maxTargets: 7,
      finish: { mode: "field", radius: 10, durationMs: 1700, tickMs: 450, maxTargets: 6, powerMultiplier: .23 },
    }), shape: square, rewardMinWave: 17, fusionElements: ["fire"],
    description: "地幔冲破地表，短延时打击目标区域，随后留下周期灼伤的高温地带。",
  }),
  "core-eruption": spell("core-eruption", "地核喷发", "earth", {
    ...area(48, 68, 13700, {
      mode: "eruption", anchor: "target", radius: 14, delayMs: 680, durationMs: 470, maxTargets: 8,
      finish: { mode: "ring", radius: 20, durationMs: 650, maxTargets: 8, powerMultiplier: .62,
        onHit: { knockback: 6 },
        next: { mode: "field", radius: 15, durationMs: 2600, tickMs: 520, maxTargets: 8, powerMultiplier: .22 } },
    }), shape: block, rewardMinWave: 27, fusionElements: ["fire"],
    description: "地核喷发后向外推出冲击波，震中最后留下一片持续伤害的灼热地带。",
  }),
};

const recipe = (output: string, inputs: string[], layout?: RecipeDefinition["layout"]): RecipeDefinition => ({
  id: `${output}-recipe`, name: approvedSpells[output].name, inputs, output, requireAdjacency: true,
  ...(layout ? { layout } : {}),
});

export const approvedRecipes: RecipeDefinition[] = [
  recipe("armor-round", ["steel-needle", "pierce"]),
  recipe("tungsten-core", ["armor-round", "dense-rock"]),
  recipe("armor-cannon", ["tungsten-core", "grenade-cannon", "deep-pierce"]),
  recipe("autocannon", ["forged-bullet", "rapid-cycle"]),
  recipe("metal-tempest", ["autocannon", "armor-round", "quadruple"]),
  recipe("grenade-cannon", ["grenade-shell", "armor-round"]),
  recipe("saturation-barrage", ["grenade-cannon", "autocannon", "sextuple"]),
  recipe("steel-squad", ["iron-guardian", "autocannon"]),
  recipe("steel-legion", ["steel-squad", "steel-squad", "greater-amplify"]),
  recipe("thorn-grove", ["root-snare", "thorn-seed"]),
  recipe("thorn-forest", ["thorn-grove", "thorn-grove", "root-feed"], [
    { x: 0, y: 0, rotation: 0 }, { x: 2, y: 0, rotation: 0 }, { x: 1, y: 2, rotation: 0 },
  ]),
  recipe("ancient-tree-guard", ["thorn-guardian", "thorn-grove"]),
  recipe("ent-legion", ["ancient-tree-guard", "thorn-forest", "triple"]),
  recipe("life-spring", ["renewal", "restorative-totem"]),
  recipe("world-tree", ["life-spring", "ancient-tree-guard", "thorn-forest"]),
  recipe("fault-line", ["earth-spikes", "dense-rock"]),
  recipe("landslide", ["fault-line", "mud-patch"]),
  recipe("plate-collision", ["landslide", "earthquake", "gravity-core"]),
  recipe("rock-wall", ["dense-rock", "pebble"]),
  recipe("stone-fortress", ["rock-wall", "rock-wall", "capacity"]),
  recipe("mantle-impact", ["fault-line", "magma-pool"]),
  recipe("core-eruption", ["mantle-impact", "landslide", "gravity-core"]),
];
