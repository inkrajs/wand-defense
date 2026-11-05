import assert from "node:assert/strict";
import test from "node:test";
import type { ContentCatalog, RewardOption } from "../contracts";
import { demoContent } from "./demo";
import { fieldSpellDefinitions } from "./fieldSpells";
import { expandedArcanaDescriptions } from "./expandedArcana";
import { expandedSpellDefinitions } from "./expandedSpells";
import { enrichMagicReward } from "./magicDescriptions";

const contentWithFieldSpells: ContentCatalog = {
  ...demoContent,
  spells: { ...demoContent.spells, ...fieldSpellDefinitions, ...expandedSpellDefinitions },
};

function itemReward(definitionId: string, description = "通用旧说明"): RewardOption {
  return {
    id: `reward-${definitionId}`, kind: "item", definitionId, label: "奖励标签", grade: "rare",
    description, details: [
      { label: "等级", value: "2" },
      { label: "品级", value: "rare" },
      { label: "占格", value: "3" },
    ],
  };
}

function description(definitionId: string, content: ContentCatalog = contentWithFieldSpells): string {
  return enrichMagicReward(itemReward(definitionId), content).description ?? "";
}

test("worldfall describes its giant primary impact and accompanying meteors", () => {
  assert.match(description("worldfall"), /巨型陨石以3倍威力/);
  assert.match(description("worldfall"), /伴随5颗小流星/);
  assert.match(description("meteor-shower-large"), /接连落下5颗陨石/);
});

test("every spell and arcana in the current catalog receives a specific non-generic description", () => {
  const ids = [...Object.keys(contentWithFieldSpells.spells), ...Object.keys(contentWithFieldSpells.arcana)];
  assert.equal(ids.length, Object.keys(contentWithFieldSpells.spells).length + Object.keys(contentWithFieldSpells.arcana).length);
  const descriptions = ids.map(id => description(id));
  assert.ok(descriptions.every(value => value.length > 0 && value.length <= 75 && value !== "通用旧说明"));
  assert.ok(descriptions.every(value => !/按配置|不承诺|不治疗角色|当前效果|独特魔法光泽/.test(value)));
  assert.equal(new Set(descriptions).size, ids.length, "each catalog item should have distinguishable copy");
});

test("projectile copy follows actual impact configuration and does not invent fireball splash", () => {
  assert.match(description("fireball"), /逐渐加速/);
  assert.match(description("fireball"), /接触目标后造成伤害/);
  assert.match(description("fireball"), /灼烧每0\.6秒造成威力20%伤害，持续2\.4秒/);
  assert.doesNotMatch(description("fireball"), /溅射|范围|周围目标|爆炸/);

  for (const id of ["cinder-burst", "gale-burst", "dark-orb"]) {
    assert.match(description(id), /命中后伤害周围敌人/);
  }
  for (const id of ["flame-lance", "stone-spike", "iron-disc"]) {
    assert.match(description(id), /沿直线穿透目标，最多命中/);
  }
  const changed = structuredClone(demoContent);
  changed.spells.spark.impact = { type: "chain", radius: 5, maxTargets: 2, falloff: 0.5 };
  assert.match(description("spark", changed), /发射火花命中后跳向附近敌人/);
  changed.spells.spark.effect = "heal";
  assert.equal(description("spark", changed), "恢复领地生命。");
});

test("chain effect copy describes immediate contact, hop falloff and target cap", () => {
  const chainContent = structuredClone(contentWithFieldSpells);
  for (const id of ["arc-chain", "spark-hop", "thunder-chain", "storm-net"]) {
    const spell = chainContent.spells[id];
    spell.effect = "chain";
    assert.equal(spell.impact?.type, "chain");
    assert.match(description(id, chainContent), /立即命中目标，再向附近敌人逐跳传导/);
    assert.ok(spell.impact?.type === "chain");
    assert.match(description(id, chainContent), new RegExp(`每跳伤害乘以${spell.impact.falloff}`));
    assert.match(description(id, chainContent), new RegExp(`最多命中${spell.impact.maxTargets}个目标`));
    assert.doesNotMatch(description(id, chainContent), /发射|飞行中/);
  }
});

test("water hits, territory healing and shields describe only their implemented targets", () => {
  assert.equal(description("water-bolt"), "发射水弹攻击目标，冲洗命中处附近血迹；命中后敌人移动速度变为75%，持续1.2秒。");
  assert.equal(description("tidal-orb"), "潮涌命中后伤害周围目标，并冲洗附近血迹。");
  assert.doesNotMatch(description("fireball"), /冲洗附近血迹/);

  for (const id of ["regrowth", "renewal"]) {
    assert.match(description(id), /恢复.*领地生命/);
  }
  assert.equal(description("regrowth"), "恢复领地生命。");
  assert.equal(description("renewal"), "以较高法力消耗恢复更多领地生命。");
  assert.match(description("ward"), /为领地增加护盾/);
  assert.equal(description("ward"), "为领地增加护盾。");
});

test("beam and arcana copy follows pulse, burst, split, amplify and focus behavior", () => {
  for (const id of ["solar-ray", "ember-ray", "void-ray"]) {
    assert.match(description(id), new RegExp(`${demoContent.spells[id].name}沿固定方向持续脉冲攻击线内敌人`));
  }
  assert.match(description("amplify"), /增强相邻法术的力量/);
  assert.equal(description("double"), "相邻攻击法术分2次连发；治疗与护盾效果重复生效。");
  assert.equal(description("quadruple"), "相邻攻击法术分4次连发；治疗与护盾效果重复生效。");
  assert.equal(description("sextuple"), "相邻攻击法术分6次连发；治疗与护盾效果重复生效。");
  assert.equal(description("split"), "相邻飞弹、光束与雷链同时分支，区域法术可展开多个落点或环。");
  assert.match(description("focus"), /力量与射程/);
});

test("new arcana modifiers describe haste, efficiency, reach, projectile velocity and area coverage", () => {
  const expected: Record<string, string> = {
    haste: "缩短相邻法术的冷却时间。",
    efficiency: "降低相邻法术的法力消耗。",
    reach: "增加相邻法术的射程。",
    velocity: "提高相邻飞弹的飞行速度。",
    area: "扩大相邻法术的区域、溅射与连锁范围，并加宽光束。",
  };
  for (const [id, value] of Object.entries(expected)) {
    assert.ok(demoContent.arcana[id], `demo catalog should include ${id}`);
    assert.equal(description(id), value);
  }
  assert.doesNotMatch(description("velocity"), /攻击速度/);
  assert.doesNotMatch(description("area"), /普通飞弹|所有飞弹|增加伤害/);

  const unsupported = structuredClone(demoContent);
  unsupported.arcana.unknown = {
    ...unsupported.arcana.haste, id: "unknown", modifier: "unknown",
  } as never;
  assert.equal(description("unknown", unsupported), "通用旧说明");
});

test("new modifier copy uses the configured pierce, slow, burn, knockback, duration, capacity and precision values", () => {
  for (const id of ["pierce", "slow", "burn", "knockback", "duration", "capacity", "precision"]) {
    assert.ok(demoContent.arcana[id], `${id} exists in the demo catalog`);
    assert.equal(description(id), expandedArcanaDescriptions[id]);
  }
});

test("summon and building copy follows construct behavior, lifetime, cost and on-hit configuration", () => {
  assert.equal(description("ember-familiar"), "召唤烬火灵，发射弹体攻击敌人，持续10秒；灼烧每0.6秒造成威力20%伤害，持续1.2秒。");
  assert.equal(description("frost-wisp"), "召唤霜缕灵，发射弹体攻击敌人，持续10秒；命中后敌人移动速度变为75%，持续1.2秒。");
  assert.equal(description("thorn-guardian"), "召唤荆棘卫士，近战攻击敌人，持续14秒。");
  assert.equal(description("ember-turret"), "部署烬火炮台（6金币），持续16秒远程攻击敌人；灼烧每0.6秒造成威力15%伤害，持续1.2秒。");
  assert.equal(description("frost-pylon"), "部署霜纹塔（8金币），持续18秒远程攻击敌人；命中后敌人移动速度变为80%，持续1秒。");
  assert.equal(description("restorative-totem"), "部署复苏图腾（10金币），持续20秒治疗附近友军。");
});

test("area spell copy follows strike, expanding ring and ground eruption timing", () => {
  assert.equal(description("thunder-strike"), "落雷锁定地面位置，延迟后落下攻击范围内敌人。");
  assert.equal(description("frost-ring"), "以角色为中心扩散冰环，命中周围敌人；命中后敌人移动速度变为50%，持续1.8秒。");
  assert.equal(description("earth-spikes"), "地刺预兆后从地面刺出，攻击范围内敌人。");
  for (const id of ["thunder-strike", "frost-ring", "earth-spikes"]) {
    assert.doesNotMatch(description(id), /减速|冻结|角色生命|飞弹/);
  }
});

test("field spells describe periodic hits, screen-wide weather and moving vortex behavior", () => {
  assert.equal(description("fire-field-bolt"), "发射火场弹，命中后展开持续领域，周期伤害附近敌人。");
  assert.equal(description("thunder-field-bolt"), "发射雷场弹，命中或飞抵射程后展开持续领域，周期伤害附近敌人。");
  assert.equal(description("thunderstorm"), "雷暴覆盖屏内全域，持续周期伤害敌人。");
  assert.equal(description("moving-storm"), "风暴移动牵引周围敌人，持续造成周期伤害。");
  for (const id of ["fire-field-bolt", "thunder-field-bolt", "thunderstorm", "moving-storm"]) {
    assert.doesNotMatch(description(id), /召唤|宠物|生命值/);
  }
});

test("on-hit additions describe only their configured knockback, slow and burn effects", () => {
  assert.deepEqual(demoContent.spells["wind-blade"].onHit, { knockback: 2 });
  assert.equal(description("wind-blade"), "发射风刃攻击目标，命中后造成伤害；命中时击退敌人。");

  assert.deepEqual(demoContent.spells["water-bolt"].onHit, { slow: { multiplier: 0.75, durationMs: 1200 } });
  assert.match(description("water-bolt"), /移动速度变为75%，持续1\.2秒/);
  assert.deepEqual(contentWithFieldSpells.spells["frost-ring"].onHit, { slow: { multiplier: 0.5, durationMs: 1800 } });
  assert.equal(description("frost-ring"), "以角色为中心扩散冰环，命中周围敌人；命中后敌人移动速度变为50%，持续1.8秒。");

  assert.deepEqual(demoContent.spells.fireball.onHit, { burn: { powerRatio: 0.2, durationMs: 2400, tickMs: 600 } });
  assert.equal(description("fireball"), "火球飞行中逐渐加速，接触目标后造成伤害；灼烧每0.6秒造成威力20%伤害，持续2.4秒。");
  assert.deepEqual(demoContent.spells["ember-ray"].onHit, { burn: { powerRatio: 0.15, durationMs: 1800, tickMs: 600 } });
  assert.equal(description("ember-ray"), "炎流沿固定方向持续脉冲攻击线内敌人；灼烧每0.6秒造成威力15%伤害，持续1.8秒。");

  for (const id of ["spark", "water-bolt", "wind-blade", "fireball", "ember-ray"]) {
    assert.doesNotMatch(description(id), /溅射|范围攻击|烧伤叠加|再次暴击/);
  }
});

test("enrichment returns a new object, preserves reward fields and cloned details, and leaves source untouched", () => {
  const reward = itemReward("fireball");
  const before = structuredClone(reward);
  const enriched = enrichMagicReward(reward, demoContent);
  assert.notEqual(enriched, reward);
  assert.notEqual(enriched.details, reward.details);
  assert.notEqual(enriched.details?.[0], reward.details?.[0]);
  assert.equal(enriched.id, reward.id);
  assert.equal(enriched.kind, reward.kind);
  assert.equal(enriched.definitionId, reward.definitionId);
  assert.equal(enriched.label, reward.label);
  assert.equal(enriched.grade, reward.grade);
  assert.equal(enriched.amount, reward.amount);
  assert.deepEqual(enriched.effect, reward.effect);
  assert.deepEqual(enriched.details, before.details);
  assert.equal(reward.description, before.description);
  assert.deepEqual(reward, before);
});

test("unknown definitions, reserved prototype IDs and non-item rewards retain their content", () => {
  const unknown = itemReward("missing-magic", "Keep this text");
  const unknownResult = enrichMagicReward(unknown, demoContent);
  assert.notEqual(unknownResult, unknown);
  assert.deepEqual(unknownResult, unknown);

  for (const definitionId of ["__proto__", "constructor", "prototype"]) {
    const reward = itemReward(definitionId, "Reserved text");
    assert.deepEqual(enrichMagicReward(reward, demoContent), reward);
  }

  const inheritedSpell = { id: "constructor", name: "Secret", effect: "heal" } as never;
  const spells = Object.create({ constructor: inheritedSpell }) as ContentCatalog["spells"];
  const content = { ...demoContent, spells };
  const constructorReward = itemReward("constructor", "No prototype lookup");
  assert.deepEqual(enrichMagicReward(constructorReward, content), constructorReward);

  const unsupported = structuredClone(demoContent);
  unsupported.spells.spark.effect = "building";
  unsupported.spells["solar-ray"].beam = undefined;
  unsupported.spells["frost-ring"].area = undefined;
  assert.equal(description("spark", unsupported), "通用旧说明");
  assert.equal(description("solar-ray", unsupported), "通用旧说明");
  assert.equal(description("frost-ring", unsupported), "通用旧说明");

  const nonItem: RewardOption = {
    id: "reward-heal", kind: "heal", amount: 10, label: "Heal", description: "Keep non-item copy",
    details: [{ label: "amount", value: "10" }],
  };
  assert.deepEqual(enrichMagicReward(nonItem, demoContent), nonItem);
});
