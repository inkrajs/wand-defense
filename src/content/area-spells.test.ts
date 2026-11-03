import assert from "node:assert/strict";
import test from "node:test";
import type { ContentCatalog, SpellDefinition } from "../contracts";
import { demoContent } from "./demo";
import { areaSpellDefinitions } from "./areaSpells";
import { enrichMagicReward } from "./magicDescriptions";

const content: ContentCatalog = { ...demoContent, spells: areaSpellDefinitions };

function assertFootprint(spell: SpellDefinition, width: number, height: number, cells: number): void {
  assert.equal(spell.shape.length, cells);
  assert.ok(Math.max(...spell.shape.map(cell => cell.x)) - Math.min(...spell.shape.map(cell => cell.x)) + 1 <= width);
  assert.ok(Math.max(...spell.shape.map(cell => cell.y)) - Math.min(...spell.shape.map(cell => cell.y)) + 1 <= height);
}

function assertAreaSpellDefaults(spell: SpellDefinition): void {
  assert.equal(spell.level, 1);
  assert.equal(spell.grade, "common");
  assert.equal(spell.asset.key, `spell.${spell.id}`);
  assert.equal(spell.asset.label, spell.name);
  assert.equal(spell.effect, "area");
  assert.equal(spell.speed, undefined);
  assert.equal(spell.impact, undefined);
}

function description(id: string): string {
  return enrichMagicReward({
    id: `reward-${id}`, kind: "item", definitionId: id, label: id, grade: "common", description: "generic",
  }, content).description ?? "";
}

test("thunder-strike is a delayed strike area spell with a compact L footprint", () => {
  assert.deepEqual(Object.keys(areaSpellDefinitions).sort(), ["earth-spikes", "frost-ring", "thunder-strike"]);
  const spell = areaSpellDefinitions["thunder-strike"];
  assert.equal(spell.id, "thunder-strike");
  assert.equal(spell.name, "落雷");
  assert.equal(spell.element, "lightning");
  assert.equal(spell.power, 24);
  assert.equal(spell.manaCost, 12);
  assert.equal(spell.cooldownMs, 1800);
  assert.equal(spell.range, 36);
  assert.deepEqual(spell.shape, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]);
  assertFootprint(spell, 3, 3, 3);
  assertAreaSpellDefaults(spell);
  assert.deepEqual(spell.area, { mode: "strike", radius: 3, delayMs: 300, durationMs: 250, maxTargets: 3 });
  assert.equal(description(spell.id), "落雷锁定地面位置，延迟后落下攻击范围内敌人。");
});

test("frost-ring is a short-lived expanding area ring with a 2 by 2 footprint", () => {
  const spell = areaSpellDefinitions["frost-ring"];
  assert.equal(spell.id, "frost-ring");
  assert.equal(spell.name, "冰环");
  assert.equal(spell.element, "water");
  assert.equal(spell.power, 12);
  assert.equal(spell.manaCost, 14);
  assert.equal(spell.cooldownMs, 2200);
  assert.equal(spell.range, 18);
  assertFootprint(spell, 2, 2, 4);
  assertAreaSpellDefaults(spell);
  assert.deepEqual(spell.area, { mode: "ring", radius: 18, delayMs: 0, durationMs: 650, maxTargets: 8 });
  assert.deepEqual(spell.onHit, { slow: { multiplier: 0.5, durationMs: 1800 } });
  assert.equal(description(spell.id), "以角色为中心扩散冰环，命中周围敌人；命中后敌人移动速度变为50%，持续1.8秒。");
});

test("earth-spikes is a warned eruption area spell with a horizontal three-cell footprint", () => {
  const spell = areaSpellDefinitions["earth-spikes"];
  assert.equal(spell.id, "earth-spikes");
  assert.equal(spell.name, "地刺");
  assert.equal(spell.element, "earth");
  assert.equal(spell.power, 30);
  assert.equal(spell.manaCost, 15);
  assert.equal(spell.cooldownMs, 2600);
  assert.equal(spell.range, 32);
  assert.deepEqual(spell.shape, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]);
  assertFootprint(spell, 3, 1, 3);
  assertAreaSpellDefaults(spell);
  assert.deepEqual(spell.area, { mode: "eruption", radius: 5, delayMs: 600, durationMs: 300, maxTargets: 5 });
  assert.equal(description(spell.id), "地刺预兆后从地面刺出，攻击范围内敌人。");
});
