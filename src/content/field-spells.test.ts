import assert from "node:assert/strict";
import test from "node:test";
import type { ContentCatalog, SpellDefinition } from "../contracts";
import { demoContent } from "./demo";
import { fieldSpellDefinitions } from "./fieldSpells";
import { enrichMagicReward } from "./magicDescriptions";

const content: ContentCatalog = {
  ...demoContent,
  spells: { ...demoContent.spells, ...fieldSpellDefinitions },
};

function spellDescription(id: string): string {
  return enrichMagicReward({
    id: `reward-${id}`, kind: "item", definitionId: id, label: id, grade: "common", description: "generic",
  }, content).description ?? "";
}

function assertCommonDefinition(spell: SpellDefinition): void {
  assert.equal(spell.level, 1);
  assert.equal(spell.grade, "common");
  assert.equal(spell.asset.key, `spell.${spell.id}`);
  assert.equal(spell.asset.label, spell.name);
}

function assertSquareShape(spell: SpellDefinition, size: number): void {
  assert.equal(spell.shape.length, size * size);
  const actual = new Set(spell.shape.map(cell => `${cell.x},${cell.y}`));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) assert.ok(actual.has(`${x},${y}`), `${spell.id} missing ${x},${y}`);
  }
}

test("fire-field-bolt creates a contact-triggered periodic fire field", () => {
  const spell = fieldSpellDefinitions["fire-field-bolt"];
  assertCommonDefinition(spell);
  assert.equal(spell.name, "火场弹");
  assert.equal(spell.element, "fire");
  assert.equal(spell.effect, "projectile");
  assert.deepEqual([spell.power, spell.manaCost, spell.cooldownMs, spell.range, spell.speed], [6, 12, 2400, 30, 60]);
  assertSquareShape(spell, 2);
  assert.deepEqual(spell.impact, {
    type: "field", radius: 6, durationMs: 2400, tickMs: 400, maxTargets: 5, trigger: "contact",
  });
  assert.equal(spellDescription(spell.id), "发射火场弹，命中后展开持续领域，周期伤害附近敌人。");
});

test("thunder-field-bolt triggers its periodic lightning field on contact or range", () => {
  const spell = fieldSpellDefinitions["thunder-field-bolt"];
  assertCommonDefinition(spell);
  assert.equal(spell.name, "雷场弹");
  assert.equal(spell.element, "lightning");
  assert.equal(spell.effect, "projectile");
  assert.deepEqual([spell.power, spell.manaCost, spell.cooldownMs, spell.range, spell.speed], [7, 14, 2600, 34, 85]);
  assertSquareShape(spell, 2);
  assert.deepEqual(spell.impact, {
    type: "field", radius: 5, durationMs: 2000, tickMs: 400, maxTargets: 6, trigger: "either",
  });
  assert.equal(spellDescription(spell.id), "发射雷场弹，命中或飞抵射程后展开持续领域，周期伤害附近敌人。");
});

test("thunderstorm is a fixed center field covering the whole screen", () => {
  const spell = fieldSpellDefinitions.thunderstorm;
  assertCommonDefinition(spell);
  assert.equal(spell.name, "雷暴");
  assert.equal(spell.element, "lightning");
  assert.equal(spell.effect, "area");
  assert.deepEqual([spell.power, spell.manaCost, spell.cooldownMs, spell.range, spell.speed], [8, 45, 8000, 100, undefined]);
  assertSquareShape(spell, 3);
  assert.deepEqual(spell.area, {
    mode: "field", radius: 75, delayMs: 0, durationMs: 2000, tickMs: 400, maxTargets: 64, anchor: "field",
  });
  assert.equal(spellDescription(spell.id), "雷暴覆盖屏内全域，持续周期伤害敌人。");
});

test("moving-storm is a caster-anchored moving vortex that pulls and periodically damages", () => {
  const spell = fieldSpellDefinitions["moving-storm"];
  assertCommonDefinition(spell);
  assert.equal(spell.name, "风暴");
  assert.equal(spell.element, "wind");
  assert.equal(spell.effect, "area");
  assert.deepEqual([spell.power, spell.manaCost, spell.cooldownMs, spell.range, spell.speed], [6, 24, 5000, 12, undefined]);
  assert.deepEqual(spell.shape, [
    { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 },
  ]);
  assert.deepEqual(spell.area, {
    mode: "vortex", radius: 8, delayMs: 0, durationMs: 4000, tickMs: 400, maxTargets: 8,
    anchor: "caster", moveSpeed: 12, pullRadius: 12, pullStrength: 8,
  });
  assert.equal(spellDescription(spell.id), "风暴移动牵引周围敌人，持续造成周期伤害。");
});

test("field spell definitions extend the spell collection by exactly four IDs", () => {
  assert.deepEqual(Object.keys(fieldSpellDefinitions).sort(), [
    "fire-field-bolt", "moving-storm", "thunder-field-bolt", "thunderstorm",
  ]);
  const previous = Object.fromEntries(Object.entries(demoContent.spells)
    .filter(([id]) => !Object.hasOwn(fieldSpellDefinitions, id)));
  assert.equal(Object.keys(content.spells).length, Object.keys(previous).length + 4);
  for (const [id, definition] of Object.entries(fieldSpellDefinitions)) {
    assert.equal(content.spells[id], definition);
    assert.equal(demoContent.spells[id], definition, `${id} is connected to the real catalog`);
  }
});
