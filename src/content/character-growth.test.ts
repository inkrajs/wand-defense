import assert from "node:assert/strict";
import test from "node:test";
import type { CharacterInstance } from "../contracts";
import { getCharacterGrowth } from "./characterGrowth";

function character(overrides: Partial<CharacterInstance> = {}): CharacterInstance {
  return {
    id: "character-test", name: "Test", sequenceId: "unknown-path", wandIds: [],
    level: 1, grade: "common", growthProfileId: "balanced",
    mana: 10, maxMana: 10, manaRegen: 1,
    ...overrides,
  };
}

test("profiles calculate per-level and total growth with detached values", () => {
  const fire = getCharacterGrowth(character({ growthProfileId: "fire", level: 3 }));
  assert.equal(fire.profileId, "fire");
  assert.deepEqual(fire.perLevel, {
    attack: 2, castSpeedPercent: 1.5, range: 0.1,
    projectileSpeedPercent: 0.5, maxMana: 5, manaRegen: 0.25,
  });
  assert.deepEqual(fire.total, {
    attack: 4, castSpeedPercent: 3, range: 0.2,
    projectileSpeedPercent: 1, maxMana: 10, manaRegen: 0.5,
  });

  const wood = getCharacterGrowth(character({ growthProfileId: "wood", level: 3 }));
  assert.equal(wood.total.attack, 1.5);
  assert.equal(wood.total.maxMana, 20);
  assert.equal(wood.total.manaRegen, 1);
  assert.equal(wood.total.castSpeedPercent, 2);

  fire.perLevel.attack = 99;
  fire.multipliers.maxMana = 99;
  assert.equal(getCharacterGrowth(character({ growthProfileId: "fire", level: 3 })).perLevel.attack, 2);
});

test("missing or unknown profiles fall back from sequence IDs in wood, fire, balanced order", () => {
  assert.equal(getCharacterGrowth(character({ growthProfileId: undefined, sequenceId: "wood-path" })).profileId, "wood");
  assert.equal(getCharacterGrowth(character({ growthProfileId: "unknown", sequenceId: "fire-9" })).profileId, "fire");
  assert.equal(getCharacterGrowth(character({ growthProfileId: undefined, sequenceId: "unmapped" })).profileId, "balanced");
  assert.equal(getCharacterGrowth(character({ growthProfileId: "fire", sequenceId: "wood-path" })).profileId, "fire");
});

test("level one and malformed or extreme levels produce finite capped growth", () => {
  assert.deepEqual(getCharacterGrowth(character({ growthProfileId: "balanced", level: 1 })).total, {
    attack: 0, castSpeedPercent: 0, range: 0,
    projectileSpeedPercent: 0, maxMana: 0, manaRegen: 0,
  });
  assert.deepEqual(getCharacterGrowth(character({ growthProfileId: "fire", level: Number.NaN })).total, {
    attack: 0, castSpeedPercent: 0, range: 0,
    projectileSpeedPercent: 0, maxMana: 0, manaRegen: 0,
  });
  const extreme = getCharacterGrowth(character({ growthProfileId: "fire", level: Number.MAX_VALUE }));
  assert.ok(Object.values(extreme.total).every(value => Number.isFinite(value) && value >= 0 && value <= 1_000_000));
  assert.equal(extreme.total.attack, 1_000_000);
  assert.equal(extreme.total.maxMana, 1_000_000);
});
