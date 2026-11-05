import type { ArcanaDefinition, ContentCatalog, RewardOption, SpellDefinition } from "../contracts";
import { elementAppearances } from "./elements";
import { expandedArcanaDescriptions } from "./expandedArcana";

const reservedDefinitionIds = new Set(["__proto__", "constructor", "prototype"]);
const specificArcanaDescriptions = new Set([
  "hit-trigger", "timer-trigger", "short-reach", "light-flight", "tiny-area", "ember-core",
  "triple", "octuple", "greater-area", "greater-burn", "greater-reach", "greater-amplify", "supreme-amplify",
]);

const arcanaDescriptions: Readonly<Partial<Record<ArcanaDefinition["modifier"], string>>> = Object.freeze({
  condense: "连接两个相同的飞弹法术，合为一发，威力为合计的80%；消耗两份法力，冷却增加25%。",
  affinity: "改变周围法术的元素威力。",
  amplify: "增强相邻法术的力量。",
  double: "相邻攻击法术分次连发；治疗与护盾效果重复生效。",
  split: "相邻飞弹、光束与雷链同时分支，区域法术可展开多个落点或环。",
  focus: "增强相邻法术的力量与射程。",
  haste: "缩短相邻法术的冷却时间。",
  efficiency: "降低相邻法术的法力消耗。",
  reach: "增加相邻法术的射程。",
  velocity: "提高相邻飞弹的飞行速度。",
  area: "扩大相邻法术的区域、溅射与连锁范围，并加宽光束。",
  pierce: expandedArcanaDescriptions.pierce,
  slow: expandedArcanaDescriptions.slow,
  burn: expandedArcanaDescriptions.burn,
  knockback: expandedArcanaDescriptions.knockback,
  duration: expandedArcanaDescriptions.duration,
  capacity: expandedArcanaDescriptions.capacity,
  precision: expandedArcanaDescriptions.precision,
  hitTrigger: expandedArcanaDescriptions["hit-trigger"],
  rangeTrigger: "飞弹抵达射程末端时，在终点释放连接的法术。提前被敌人挡下时不释放。",
  timerTrigger: expandedArcanaDescriptions["timer-trigger"],
});

/** Returns a detached reward and describes only the current owned definition's behavior. */
export function enrichMagicReward(reward: RewardOption, content: ContentCatalog): RewardOption {
  const enriched = structuredClone(reward);
  if (reward.kind !== "item" || typeof reward.definitionId !== "string"
      || reservedDefinitionIds.has(reward.definitionId)) return enriched;

  const definitionId = reward.definitionId;
  if (Object.hasOwn(content.spells, definitionId)) {
    const description = describeSpell(content.spells[definitionId], content);
    if (description) enriched.description = description;
  } else if (Object.hasOwn(content.arcana, definitionId)) {
    const description = describeArcana(content.arcana[definitionId]);
    if (description) enriched.description = description;
  }
  return enriched;
}

function describeSpell(spell: SpellDefinition, content: ContentCatalog): string | undefined {
  if (spell.description) return spell.description;
  const behavior = describeSpellBehavior(spell, content);
  if (!behavior) return undefined;
  return appendOnHitDescription(behavior, spell.onHit);
}

function describeSpellBehavior(spell: SpellDefinition, content: ContentCatalog): string | undefined {
  switch (spell.effect) {
    case "projectile": {
      const behavior = describeImpact(spell);
      if (!behavior) return undefined;
      if (spell.element === "water") {
        if (spell.impact?.type === "splash") return `${spell.name}命中后伤害周围目标，并冲洗附近血迹。`;
        if (!spell.impact) return `发射${spell.name}攻击目标，冲洗命中处附近血迹。`;
        return `${behavior.replace(/[。；]$/, "")}，冲洗命中处附近血迹。`;
      }
      return behavior;
    }
    case "beam":
      return spell.beam ? `${spell.name}沿固定方向持续脉冲攻击线内敌人。` : undefined;
    case "chain":
      return spell.impact?.type === "chain"
        ? `立即命中目标，再向附近敌人逐跳传导，每跳伤害乘以${spell.impact.falloff}，最多命中${spell.impact.maxTargets}个目标。`
        : undefined;
    case "area":
      if (!spell.area) return undefined;
      if (spell.area.mode === "strike" && spell.area.shower) {
        const shower = spell.area.shower;
        if (shower.primaryRadiusMultiplier !== undefined || shower.primaryPowerMultiplier !== undefined) {
          return `巨型陨石以${shower.primaryPowerMultiplier ?? 1}倍威力轰击目标，伴随${Math.max(0, shower.count - 1)}颗小流星落在附近。`;
        }
        return `在目标附近接连落下${shower.count}颗陨石，分别造成范围伤害。`;
      }
      if (spell.area.mode === "strike") return `${spell.name}锁定地面位置，延迟后落下攻击范围内敌人。`;
      if (spell.area.mode === "ring") return `以角色为中心扩散${spell.name}，命中周围敌人。`;
      if (spell.area.mode === "eruption") return `${spell.name}预兆后从地面刺出，攻击范围内敌人。`;
      if (spell.area.mode === "field") return spell.area.anchor === "field"
        ? `${spell.name}覆盖屏内全域，持续周期伤害敌人。`
        : `${spell.name}覆盖区域，持续周期伤害附近敌人。`;
      if (spell.area.mode === "vortex") return `${spell.name}移动牵引周围敌人，持续造成周期伤害。`;
      return undefined;
    case "heal": {
      const reference = Object.hasOwn(content.spells, "regrowth") ? content.spells.regrowth : undefined;
      return reference?.effect === "heal" && spell.power > reference.power && spell.manaCost > reference.manaCost
        ? "以较高法力消耗恢复更多领地生命。"
        : "恢复领地生命。";
    }
    case "shield":
      return spell.id === "glimmer" ? "微光为领地提供少量护盾。" : "为领地增加护盾。";
    case "summon": {
      const construct = spell.construct;
      if (!construct) return undefined;
      const behavior = construct.behavior === "heal" ? "治疗附近友军"
        : construct.attackMode === "projectile" ? "发射弹体攻击敌人" : "近战攻击敌人";
      return `召唤${spell.name}，${behavior}，持续${formatSeconds(construct.durationMs)}秒。`;
    }
    case "building": {
      const construct = spell.construct;
      if (!construct) return undefined;
      const cost = Number.isFinite(construct.coinCost) && construct.coinCost! > 0 ? `（${construct.coinCost}金币）` : "";
      const behavior = construct.behavior === "heal" ? "治疗附近友军"
        : construct.attackMode === "projectile" ? "远程攻击敌人" : "近战攻击敌人";
      return `部署${spell.name}${cost}，持续${formatSeconds(construct.durationMs)}秒${behavior}。`;
    }
    default:
      return undefined;
  }
}

function appendOnHitDescription(behavior: string, onHit: SpellDefinition["onHit"]): string {
  if (!onHit) return behavior;
  const effects: string[] = [];
  if (Number.isFinite(onHit.knockback) && (onHit.knockback ?? 0) > 0) {
    effects.push("命中时击退敌人");
  }
  if (onHit.slow && Number.isFinite(onHit.slow.multiplier) && onHit.slow.multiplier > 0
      && Number.isFinite(onHit.slow.durationMs) && onHit.slow.durationMs > 0 && onHit.slow.multiplier < 1) {
    const speedPercent = Math.round(onHit.slow.multiplier * 100);
    effects.push(`命中后敌人移动速度变为${speedPercent}%，持续${formatSeconds(onHit.slow.durationMs)}秒`);
  }
  if (onHit.burn && Number.isFinite(onHit.burn.powerRatio) && onHit.burn.powerRatio > 0
      && Number.isFinite(onHit.burn.durationMs) && onHit.burn.durationMs > 0
      && Number.isFinite(onHit.burn.tickMs) && onHit.burn.tickMs > 0) {
    const powerPercent = Math.round(onHit.burn.powerRatio * 100);
    effects.push(`灼烧每${formatSeconds(onHit.burn.tickMs)}秒造成威力${powerPercent}%伤害，持续${formatSeconds(onHit.burn.durationMs)}秒`);
  }
  if (effects.length === 0) return behavior;
  return `${behavior.replace(/[。；]$/, "")}；${effects.join("；")}。`;
}

function formatSeconds(milliseconds: number): string {
  const value = milliseconds / 1000;
  return String(Number.isInteger(value) ? value : Number(value.toFixed(2)));
}

function describeImpact(spell: SpellDefinition): string | undefined {
  const impact = spell.impact;
  if (!impact) {
    return spell.id === "fireball"
      ? "火球飞行中逐渐加速，接触目标后造成伤害。"
      : `发射${spell.name}攻击目标，命中后造成伤害。`;
  }
  if (impact.type === "pierce") {
    return `发射${spell.name}沿直线穿透目标，最多命中${impact.maxTargets}个敌人。`;
  }
  if (impact.type === "splash") {
    return `发射${spell.name}攻击目标，命中后伤害周围敌人，最多${impact.maxTargets}个。`;
  }
  if (impact.type === "chain") {
    const attenuation = impact.falloff < 1 ? "，逐次降低伤害" : "";
    return `发射${spell.name}命中后跳向附近敌人${attenuation}，最多${impact.maxTargets}个目标。`;
  }
  if (impact.type === "field") {
    const trigger = impact.trigger === "contact" ? "命中后"
      : impact.trigger === "range" ? "飞抵射程后" : "命中或飞抵射程后";
    return `发射${spell.name}，${trigger}展开持续领域，周期伤害附近敌人。`;
  }
  return undefined;
}

function describeArcana(arcana: ArcanaDefinition): string | undefined {
  if (arcana.description) return arcana.description;
  if (arcana.modifier === "affinity" && arcana.affinities) {
    const changes = Object.entries(arcana.affinities).map(([element, value]) => {
      const label = elementAppearances[element as keyof typeof elementAppearances].name;
      return `${label}系威力${value > 0 ? "+" : ""}${Math.round(value * 100)}%`;
    });
    return `${arcana.diagonal ? "周围一圈（含斜角）" : "四边相邻"}的法术：${changes.join("、")}。`;
  }

  if (specificArcanaDescriptions.has(arcana.id)) return expandedArcanaDescriptions[arcana.id];
  if (arcana.modifier === "double") {
    const count = Number.isFinite(arcana.value) && arcana.value >= 1 ? Math.floor(arcana.value) : undefined;
    return count
      ? `相邻攻击法术分${count}次连发；治疗与护盾效果重复生效。`
      : arcanaDescriptions.double;
  }
  return Object.hasOwn(arcanaDescriptions, arcana.modifier)
    ? arcanaDescriptions[arcana.modifier]
    : undefined;
}
