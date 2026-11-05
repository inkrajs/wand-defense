import type { ArcanaDefinition, RecipeDefinition } from "../contracts";

function arcana(
  id: string, name: string, modifier: ArcanaDefinition["modifier"], value: number,
  level: number, description: string,
): ArcanaDefinition {
  const tier = level <= 8 ? 1 : level <= 16 ? 2 : 3;
  return {
    id, name, modifier, value, level, description, rewardMinWave: level + 4,
    grade: tier === 1 ? "uncommon" : tier === 2 ? "epic" : "legendary",
    shape: Array.from({ length: tier }, (_, x) => ({ x, y: 0 })),
    asset: { key: `arcana.${id}`, label: name, color: "#b29ad1" },
  };
}

const definitions = [
  arcana("tracking", "追踪", "homing", 2.5, 6, "飞弹在飞行中转向原目标；目标消失后沿原方向前进。"),
  arcana("pursuit", "追猎", "pursuit", 5, 18, "飞弹转向更快，失去目标后可追向附近尚未命中的敌人。"),
  arcana("ricochet", "弹射", "ricochet", 2, 8, "普通飞弹命中后飞向邻敌，最多命中两个目标；弹射伤害衰减。"),
  arcana("chain-ricochet", "连环弹射", "ricochet", 4, 20, "飞弹可连续弹射，最多命中四个目标；每次弹射伤害衰减。"),
  arcana("mana-reclaim", "回收", "reclaim", .18, 8, "每次施法的首发飞弹造成伤害后返还部分施法法力，最多返还一次。"),
  arcana("greater-reclaim", "高效回收", "reclaim", .36, 20, "首发飞弹造成伤害后返还更多法力；分裂和连发不会增加返还次数。"),
  arcana("resonance", "共振", "resonance", .16, 8, "同时接触同主属性的攻击法术时，提升它们的威力。"),
  arcana("elemental-resonance", "元素共振", "elementalResonance", .28, 20, "同时接触有共同元素的攻击法术时提高威力，融合元素也可建立共振。"),
  arcana("aftershock", "余震", "aftershock", .35, 8, "攻击领域结束后原地追加一次弱震击，保留原法术已有的后续阶段。"),
  arcana("chain-aftershock", "连环余震", "aftershock", .52, 20, "攻击领域结束后追加两道由近到远的震击；已有后续阶段优先。"),
  arcana("martyrdom", "殉爆", "martyrdom", .65, 12, "召唤物被敌人击毁时原地爆炸，自然消失不触发。"),
  arcana("chain-martyrdom", "连环殉爆", "martyrdom", 1.1, 24, "召唤物被击毁时爆炸，并在短暂延迟后向外释放第二道冲击。"),
  arcana("domain-expansion", "领域展开", "domain", 1.45, 12, "扩大局部持续领域并延长存续，代价是提高法力消耗。"),
  arcana("total-domain", "全域领域", "domain", 2, 28, "将普通局部领域扩展到全场，脉冲伤害降低，法力和冷却增加。"),
  arcana("linked-cast", "连锁施法", "linkedCast", 1, 12, "连接一枚载体飞弹和一个独立载荷，命中或到达射程末端时释放载荷，支付两份法力。"),
  arcana("multi-linked-cast", "多重连锁", "linkedCast", 2, 24, "同时连接两种载荷，在首次命中处或射程末端各自释放，支付全部法力。"),
];

export const approvedArcana: Record<string, ArcanaDefinition> = Object.fromEntries(definitions.map(def => [def.id, def]));

const recipe = (output: string, ...inputs: string[]): RecipeDefinition => ({
  id: `${output}-recipe`, name: approvedArcana[output].name, output, inputs, requireAdjacency: true,
});

export const approvedRecipes: RecipeDefinition[] = [
  recipe("tracking", "precision", "light-flight"),
  recipe("pursuit", "tracking", "greater-reach"),
  recipe("ricochet", "split", "knockback"),
  recipe("chain-ricochet", "ricochet", "quadruple"),
  recipe("mana-reclaim", "efficiency", "hit-trigger"),
  recipe("greater-reclaim", "mana-reclaim", "rapid-cycle"),
  recipe("resonance", "amplify", "condense"),
  recipe("elemental-resonance", "resonance", "greater-amplify", "arc-coil"),
  recipe("aftershock", "range-trigger", "area"),
  recipe("chain-aftershock", "aftershock", "greater-area"),
  recipe("martyrdom", "hit-trigger", "corpse-burst"),
  recipe("chain-martyrdom", "martyrdom", "chain-aftershock"),
  recipe("domain-expansion", "greater-area", "duration"),
  recipe("total-domain", "domain-expansion", "greater-reach", "greater-amplify"),
  recipe("linked-cast", "hit-trigger", "condense"),
  recipe("multi-linked-cast", "linked-cast", "quadruple", "greater-amplify"),
];
