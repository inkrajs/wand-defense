import assert from "node:assert/strict";
import test from "node:test";
import type { CharacterStatBonuses, GearDefinition, Grade, SupplyDefinition } from "../contracts";
import { gradePower } from "./grades";
import { createGearFromDefinition, gearDefinitions } from "./gear";
import { createSupplyFromDefinition, supplyDefinitions } from "./supplies";

test("gear catalog retains two items per slot plus the single-cell gatherer accessory", () => {
  const definitions = Object.values(gearDefinitions);
  assert.equal(definitions.length, 9);
  const slots: Record<string, number> = {};
  for (const definition of definitions) slots[definition.slot] = (slots[definition.slot] ?? 0) + 1;
  assert.deepEqual(slots, { head: 2, body: 2, feet: 2, accessory: 3 });
  for (const definition of definitions) {
    assert.equal(definition.level, 1);
    assert.equal(definition.grade, "common");
    assert.deepEqual(definition.shape, [{ x: 0, y: 0 }]);
    assert.equal(definition.asset.key, `gear.${definition.id}`);
    assert.ok(definition.asset.label.length > 0);
    assert.doesNotMatch(definition.asset.label, /\d/);
  }
});

test("the three supply definitions expose only territory or party mana effects", () => {
  assert.deepEqual(Object.values(supplyDefinitions).map(({ id, name, effect }) => [id, name, effect]), [
    ["health-potion", "生命药水", { type: "territoryHeal", value: 40 }],
    ["shield-potion", "护盾药水", { type: "territoryShield", value: 30 }],
    ["mana-potion", "法力药水", { type: "partyMana", value: 50 }],
  ]);
  for (const definition of Object.values(supplyDefinitions)) {
    assert.equal(definition.level, 1);
    assert.equal(definition.grade, "common");
    assert.ok(definition.shape.length >= 1 && definition.shape.length <= 2);
    assert.equal(definition.asset.key, `item.${definition.id}`);
    assert.ok(definition.asset.label.length > 0);
    assert.doesNotMatch(definition.asset.label, /\d/);
  }
});

test("gear factory scales each defined bonus by the shared grade ratio and keeps base definitions intact", () => {
  const definition = gearDefinitions["apprentice-hat"];
  const before = structuredClone(definition);
  const ratio = gradePower.rare / gradePower[definition.grade];
  const gear = createGearFromDefinition(definition, "gear-instance", "rare");
  assert.deepEqual(gear, {
    id: "gear-instance", definitionId: definition.id, name: definition.name, slot: definition.slot,
    characterId: null, level: 1, grade: "rare",
    statBonuses: { maxMana: 15 * ratio, manaRegen: 0.5 * ratio },
  });
  assert.deepEqual(definition, before);
});

test("gear factory scales crit multiplier increments and owned element bonuses without sharing references", () => {
  const definition = structuredClone(gearDefinitions["copper-ring"]);
  definition.statBonuses = {
    critMultiplier: 0.2,
    elementBonuses: { fire: 0.1 },
  };
  const ratio = gradePower.epic / gradePower[definition.grade];
  const first = createGearFromDefinition(definition, "first", "epic");
  const second = createGearFromDefinition(definition, "second", "epic");
  assert.equal(first.statBonuses?.critMultiplier, 0.2 * ratio);
  assert.deepEqual(first.statBonuses?.elementBonuses, { fire: 0.1 * ratio });
  assert.notEqual(first.statBonuses, second.statBonuses);
  assert.notEqual(first.statBonuses?.elementBonuses, second.statBonuses?.elementBonuses);

  first.statBonuses!.critMultiplier = 99;
  first.statBonuses!.elementBonuses!.fire = 99;
  assert.equal(second.statBonuses?.critMultiplier, 0.2 * ratio);
  assert.deepEqual(second.statBonuses?.elementBonuses, { fire: 0.1 * ratio });
  assert.equal(definition.statBonuses.critMultiplier, 0.2);
  assert.deepEqual(definition.statBonuses.elementBonuses, { fire: 0.1 });
});

test("gear factory accepts only finite whitelisted own stat fields", () => {
  const definition = structuredClone(gearDefinitions["copper-ring"]);
  const bonuses = Object.assign(Object.create({ attack: 500, luck: 200 }), {
    critChance: 0.05,
    maxMana: Number.POSITIVE_INFINITY,
    rogue: 88,
    elementBonuses: Object.create({ fire: 0.75 }, { water: { value: 0.2, enumerable: true } }),
  }) as CharacterStatBonuses;
  definition.statBonuses = bonuses;
  const instance = createGearFromDefinition(definition, "filtered", "common");
  assert.deepEqual(instance.statBonuses, { critChance: 0.05, elementBonuses: { water: 0.2 } });
});

test("invalid factory grades fall back to the definition grade and then common", () => {
  const definition = structuredClone(gearDefinitions["copper-ring"]);
  definition.grade = "rare";
  const fallback = createGearFromDefinition(definition, "fallback", "invalid" as Grade);
  assert.equal(fallback.grade, "rare");
  assert.equal(fallback.statBonuses?.attack, (definition.statBonuses.attack ?? 0) * gradePower.rare / gradePower.rare);

  definition.grade = "invalid" as Grade;
  const common = createGearFromDefinition(definition, "common-fallback", "also-invalid" as Grade);
  assert.equal(common.grade, "common");
  assert.equal(common.statBonuses?.attack, definition.statBonuses.attack ?? 0);

  const supplyDefinition = structuredClone(supplyDefinitions["mana-potion"]);
  supplyDefinition.grade = "rare";
  assert.equal(createSupplyFromDefinition(supplyDefinition, "supply", "invalid" as Grade).grade, "rare");
});

test("supply factory returns only detached instance fields and never copies effect data", () => {
  const definition = supplyDefinitions["health-potion"];
  const before = structuredClone(definition);
  const first = createSupplyFromDefinition(definition, "supply-one", "epic");
  const second = createSupplyFromDefinition(definition, "supply-two", "epic");
  assert.deepEqual(first, { id: "supply-one", definitionId: "health-potion", level: 1, grade: "epic" });
  assert.deepEqual(Object.keys(first).sort(), ["definitionId", "grade", "id", "level"]);
  assert.notEqual(first, second);
  assert.deepEqual(definition, before);
});

test("shared definitions are deeply frozen while created instances remain independent", () => {
  assert.equal(Object.isFrozen(gearDefinitions), true);
  assert.equal(Object.isFrozen(gearDefinitions["apprentice-hat"]), true);
  assert.equal(Object.isFrozen(gearDefinitions["apprentice-hat"].shape), true);
  assert.equal(Object.isFrozen(gearDefinitions["apprentice-hat"].shape[0]), true);
  assert.equal(Object.isFrozen(gearDefinitions["apprentice-hat"].asset), true);
  assert.equal(Object.isFrozen(gearDefinitions["apprentice-hat"].statBonuses), true);
  assert.equal(Object.isFrozen(supplyDefinitions), true);
  assert.equal(Object.isFrozen(supplyDefinitions["health-potion"].effect), true);
  assert.equal(Reflect.set(gearDefinitions["apprentice-hat"].statBonuses, "maxMana", 999), false);
  assert.equal(Reflect.set(supplyDefinitions["health-potion"].effect, "value", 999), false);
});
