import assert from "node:assert/strict";
import test from "node:test";
import type { ContentCatalog, GearDefinition } from "../contracts";
import { applyGearCommand } from "../loadout/gear";
import { compileWand } from "../loadout/compile";
import { getCharacterStats } from "./characters";
import { createFixtureState } from "../runtime/mock";
import { gradePower } from "./grades";
import { createGearFromDefinition, gearDefinitions } from "./gear";

const testContent: ContentCatalog = {
  spells: {
    spark: {
      id: "spark", name: "Test Spark", element: "fire", shape: [{ x: 0, y: 0 }],
      asset: { key: "spell.test-spark", label: "Test Spark", color: "#f80" },
      effect: "projectile", power: 10, manaCost: 4, cooldownMs: 1000, range: 20, speed: 100,
      level: 1, grade: "common",
    },
  },
  arcana: {},
  recipes: [],
  sequences: {
    "fire-9": { id: "fire-9", pathwayId: "fire", number: 9, name: "Fire", bonuses: {}, requirements: [] },
  },
  gear: { ...gearDefinitions },
};

const expandedIds = [
  "ember-circlet", "frost-lens", "sage-crown", "windweave-mantle", "heartwood-vest",
  "gale-greaves", "tracker-boots", "fortune-knot", "starfall-signet",
] as const;

function baseState() {
  const state = createFixtureState();
  state.gear = {};
  state.characters[0].baseStats = {
    attack: 0, gatheringPercent: 0, castSpeedPercent: 0, range: 0, projectileSpeedPercent: 0,
    accuracy: 0.8, critChance: 0, critMultiplier: 1.5, luck: 0, elementBonuses: {},
  };
  return state;
}

test("gear catalog contains eighteen stable, varied, level-one common definitions", () => {
  assert.equal(Object.keys(gearDefinitions).length, 18);
  assert.deepEqual(expandedIds.filter(id => !Object.hasOwn(gearDefinitions, id)), []);
  const counts = { head: 0, body: 0, feet: 0, accessory: 0 };
  const assetKeys = new Set<string>();
  for (const definition of Object.values(gearDefinitions)) {
    counts[definition.slot]++;
    assert.equal(definition.id in gearDefinitions, true);
    assert.equal(definition.level, 1);
    assert.equal(definition.grade, "common");
    assert.equal(definition.shape.length, 1);
    assert.ok(definition.asset.key.startsWith("gear."));
    assert.ok(!assetKeys.has(definition.asset.key));
    assetKeys.add(definition.asset.key);
    assert.ok(Object.keys(definition.statBonuses).length > 0);
  }
  assert.deepEqual(counts, { head: 5, body: 4, feet: 4, accessory: 5 });
});

test("each new gear equips through the real transaction and affects character stats and compilation", () => {
  for (const id of expandedIds) {
    const definition = gearDefinitions[id];
    const state = baseState();
    const instanceId = `instance-${id}`;
    state.gear = { [instanceId]: createGearFromDefinition(definition, instanceId) };
    const statsBefore = getCharacterStats(state, "character-1", testContent)!;
    const spellBefore = compileWand(state, "wand-1", testContent)!.spells[0];
    const result = applyGearCommand(state, {
      id: `equip-${id}`, type: "equipGear", gearId: instanceId, characterId: "character-1",
    }, testContent);

    assert.equal(result.result.status, "executed", id);
    const statsAfter = getCharacterStats(result.state, "character-1", testContent)!;
    const spellAfter = compileWand(result.state, "wand-1", testContent)!.spells[0];
    const bonuses = definition.statBonuses;
    for (const [key, value] of Object.entries(bonuses)) {
      if (key === "elementBonuses") {
        for (const [element, amount] of Object.entries(value!)) {
          assert.equal(statsAfter.equipment.elementBonuses[element as keyof typeof statsAfter.equipment.elementBonuses], amount, `${id}:${element}`);
          if (element === "fire") assert.ok(spellAfter.power > spellBefore.power, `${id}:fire power`);
        }
        continue;
      }
      assert.equal((statsAfter.equipment as unknown as Record<string, number>)[key], value, `${id}:${key}`);
      switch (key) {
        case "attack": assert.ok(spellAfter.power > spellBefore.power, `${id}:attack power`); break;
        case "castSpeedPercent": assert.ok(spellAfter.cooldownMs < spellBefore.cooldownMs, `${id}:cooldown`); break;
        case "projectileSpeedPercent": assert.ok(spellAfter.speed! > spellBefore.speed!, `${id}:projectile speed`); break;
        case "range": assert.ok(spellAfter.range > spellBefore.range, `${id}:range`); break;
        case "accuracy": assert.ok(spellAfter.attackRoll.accuracy > spellBefore.attackRoll.accuracy, `${id}:accuracy`); break;
        case "critChance": assert.ok(spellAfter.attackRoll.critChance > spellBefore.attackRoll.critChance, `${id}:crit chance`); break;
        case "critMultiplier": assert.ok(spellAfter.attackRoll.critMultiplier > spellBefore.attackRoll.critMultiplier, `${id}:crit multiplier`); break;
        case "luck": assert.ok(spellAfter.attackRoll.sourceLuck > spellBefore.attackRoll.sourceLuck, `${id}:luck`); break;
        case "maxMana": assert.ok(statsAfter.final.maxMana > statsBefore.final.maxMana, `${id}:max mana`); break;
        case "manaRegen": assert.ok(statsAfter.final.manaRegen > statsBefore.final.manaRegen, `${id}:mana regen`); break;
        case "gatheringPercent": assert.ok(statsAfter.equipment.gatheringPercent > statsBefore.equipment.gatheringPercent, `${id}:gathering`); break;
      }
    }
  }
});

test("new gear grade scaling preserves definitions and deep-copies element bonuses", () => {
  for (const id of expandedIds) {
    const definition: GearDefinition = gearDefinitions[id];
    const before = structuredClone(definition);
    const instance = createGearFromDefinition(definition, `rare-${id}`, "rare");
    const ratio = gradePower.rare / gradePower[definition.grade];
    assert.notStrictEqual(instance.statBonuses, definition.statBonuses);
    for (const [key, value] of Object.entries(definition.statBonuses)) {
      if (key === "elementBonuses") {
        assert.notStrictEqual(instance.statBonuses!.elementBonuses, definition.statBonuses.elementBonuses);
        const instanceElements = instance.statBonuses!.elementBonuses!;
        for (const [element, bonus] of Object.entries(value!)) {
          assert.equal(instanceElements[element as keyof typeof instanceElements], (bonus as number) * ratio);
        }
        const element = Object.keys(value!)[0] as keyof typeof instanceElements;
        instanceElements[element] = 99;
        assert.equal(definition.statBonuses.elementBonuses?.[element], before.statBonuses.elementBonuses?.[element]);
      } else {
        assert.equal((instance.statBonuses as Record<string, number>)[key], (value as number) * ratio, `${id}:${key}`);
      }
    }
    assert.deepEqual(definition, before, id);
  }
});
