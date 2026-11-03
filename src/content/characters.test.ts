import assert from "node:assert/strict";
import test from "node:test";
import type { CharacterBaseStats, GameState, WandInstance } from "../contracts";
import { demoContent } from "./demo";
import { createInitialState } from "../runtime/initial";
import { createCharacterBaseStats, getCharacterStats, normalizeCharacterStats } from "./characters";

function fixture(): GameState {
  return createInitialState();
}

test("neutral defaults and stats migration are detached, field-wise, and idempotent", () => {
  const first = createCharacterBaseStats();
  const second = createCharacterBaseStats();
  assert.deepEqual(first, {
    attack: 0, gatheringPercent: 0, castSpeedPercent: 0, range: 0, accuracy: 1, critChance: 0,
    projectileSpeedPercent: 0, critMultiplier: 1.5, luck: 0, elementBonuses: {},
  });
  first.elementBonuses.fire = 0.5;
  assert.deepEqual(second.elementBonuses, {});

  const state = fixture();
  const character = state.characters[0] as GameState["characters"][number] & { baseStats?: unknown; gearIds?: unknown };
  character.baseStats = {
    attack: 7, castSpeedPercent: 12, range: "bad", accuracy: 0.8,
    critChance: 2, critMultiplier: 3, luck: 4,
    elementBonuses: { fire: 0.25, water: -2, unknown: 9 },
  } as unknown as CharacterBaseStats;
  character.gearIds = undefined;
  character.mana = 33;
  character.maxMana = 100;
  character.manaRegen = 12;
  const beforeOtherStats = { mana: character.mana, maxMana: character.maxMana, manaRegen: character.manaRegen, xp: character.xp, id: character.id };

  normalizeCharacterStats(state);
  const normalized = character.baseStats as ReturnType<typeof createCharacterBaseStats>;
  assert.deepEqual(normalized, {
    attack: 7, gatheringPercent: 0, castSpeedPercent: 12, range: 0, projectileSpeedPercent: 0, accuracy: 0.8, critChance: 0,
    critMultiplier: 3, luck: 4, elementBonuses: { fire: 0.25 },
  });
  const firstNormalized = structuredClone(normalized);
  normalizeCharacterStats(state);
  assert.deepEqual(character.baseStats, firstNormalized);
  assert.deepEqual({ mana: character.mana, maxMana: character.maxMana, manaRegen: character.manaRegen, xp: character.xp, id: character.id }, beforeOtherStats);
  assert.notEqual(normalized.elementBonuses, (state.characters[0].baseStats as ReturnType<typeof createCharacterBaseStats>).elementBonuses);

  const legacy = fixture();
  (legacy.characters[0] as unknown as { baseStats: unknown }).baseStats = { elementBonuses: null };
  normalizeCharacterStats(legacy);
  assert.deepEqual(legacy.characters[0].baseStats, createCharacterBaseStats());
  assert.notEqual(legacy.characters[0].baseStats!.elementBonuses, createCharacterBaseStats().elementBonuses);

  const malformedSpeed = fixture();
  for (const invalid of [Number.POSITIVE_INFINITY, -90.01, 10_000.01]) {
    (malformedSpeed.characters[0] as unknown as { baseStats: unknown }).baseStats = { projectileSpeedPercent: invalid };
    normalizeCharacterStats(malformedSpeed);
    assert.equal(malformedSpeed.characters[0].baseStats!.projectileSpeedPercent, 0);
  }
});

test("stats aggregate only bidirectionally owned, slot-valid, unique equipment", () => {
  const state = fixture();
  const character = state.characters[0];
  character.baseStats = {
    attack: 10, castSpeedPercent: 20, range: 5, projectileSpeedPercent: 10, accuracy: 0.6,
    critChance: 0.2, critMultiplier: 2, luck: 3, elementBonuses: { fire: 0.2 },
  };
  character.wandIds = ["wand-1", "wand-2", "wand-2"];
  state.wands[0].statBonuses = {
    attack: 2, castSpeedPercent: 10, range: 4, accuracy: 0.2,
    projectileSpeedPercent: 20,
    critChance: 0.1, critMultiplier: 0.5, luck: 2, maxMana: 5, manaRegen: 3,
    elementBonuses: { fire: 0.3, dark: -0.25 },
  };
  state.wands.push({ ...structuredClone(state.wands[0]), id: "wand-2", characterId: "other", statBonuses: { projectileSpeedPercent: 900 } });
  state.gear = {
    helm: { id: "helm", name: "helm", slot: "head", characterId: character.id, level: 1, grade: "common", statBonuses: { attack: 1, maxMana: 10 } },
    body: { id: "body", name: "body", slot: "head", characterId: character.id, level: 1, grade: "common", statBonuses: { attack: 100 } },
    boots: { id: "boots", name: "boots", slot: "feet", characterId: "other", level: 1, grade: "common", statBonuses: { range: 100 } },
    charm: { id: "charm", name: "charm", slot: "accessory", characterId: character.id, level: 1, grade: "common", statBonuses: { manaRegen: 2, projectileSpeedPercent: 2 } },
  };
  character.gearIds = { head: "helm", body: "helm", feet: "boots", accessory: "charm" };
  state.runBonuses = { attackPercent: 50, maxMana: 30, manaRegen: 4, rangePercent: -25, cooldownPercent: 25 };
  state.luck = 4;

  const stats = getCharacterStats(state, character.id)!;
  assert.equal(stats.equipment.attack, 3);
  assert.equal(stats.equipment.range, 4);
  assert.equal(stats.equipment.projectileSpeedPercent, 22);
  assert.equal(stats.equipment.maxMana, 15);
  assert.equal(stats.equipment.manaRegen, 5);
  assert.equal(stats.equipment.accuracy, 0.2);
  assert.equal(stats.equipment.critMultiplier, 0.5);
  assert.deepEqual(stats.run, { attackPercent: 50, gatheringPercent: 0, maxMana: 30, manaRegen: 4, rangePercent: -25, cooldownPercent: 25 });
  assert.deepEqual(stats.sequence.elementBonuses, { fire: 0.1 });
  assert.equal(stats.final.attack, 19.5);
  assert.equal(stats.final.range, 6.75);
  assert.equal(stats.final.projectileSpeedPercent, 32);
  assert.equal(stats.final.projectileSpeedMultiplier, 1.32);
  assert.equal(stats.final.castSpeedPercent, 30);
  assert.ok(Math.abs(stats.final.cooldownMultiplier - (1 / 1.3 * 0.75)) < 1e-12);
  assert.equal(stats.final.accuracy, 0.8);
  assert.ok(Math.abs(stats.final.critChance - 0.3) < 1e-12);
  assert.equal(stats.final.critMultiplier, 2.5);
  assert.equal(stats.final.luck, 5);
  assert.equal(stats.final.totalLuck, 9);
  assert.ok(Math.abs(stats.final.elementBonuses.fire! - 0.65) < 1e-12);
  assert.equal(stats.final.elementBonuses.dark, -0.25);
  assert.equal(stats.final.maxMana, 115);
  assert.equal(stats.final.manaRegen, 17);
  assert.equal(stats.final.mana, character.mana);

  stats.base.elementBonuses.fire = 99;
  stats.equipment.elementBonuses.dark = 99;
  stats.sequence.elementBonuses.fire = 99;
  assert.equal(character.baseStats!.elementBonuses.fire, 0.2);
  assert.equal(state.wands[0].statBonuses!.elementBonuses!.dark, -0.25);
  assert.equal(demoContent.sequences[character.sequenceId].bonuses.fire, 0.1);
});

test("stats recalculate after ownership changes, never double-add run mana, and return undefined for unknown IDs", () => {
  const state = fixture();
  state.runBonuses = { attackPercent: 0, maxMana: 30, manaRegen: 4 };
  const character = state.characters[0];
  character.maxMana = 130;
  character.mana = 100;
  character.manaRegen = 16;
  state.wands[0].statBonuses = { attack: 5, maxMana: 20, manaRegen: 2 };

  const equipped = getCharacterStats(state, character.id)!;
  assert.equal(equipped.final.maxMana, 150);
  assert.equal(equipped.final.manaRegen, 18);
  assert.equal(equipped.final.mana, 100);

  character.wandIds = [];
  const unequipped = getCharacterStats(state, character.id)!;
  assert.equal(unequipped.equipment.attack, 0);
  assert.equal(unequipped.equipment.maxMana, 0);
  assert.equal(unequipped.final.maxMana, 130);
  assert.equal(unequipped.final.manaRegen, 16);
  assert.equal(getCharacterStats(state, "missing"), undefined);
  assert.notEqual(equipped.base.elementBonuses, unequipped.base.elementBonuses);
});

test("final stats clamp additive values and malformed sequence or run data safely", () => {
  const state = fixture();
  state.characters[0].baseStats = {
    attack: 1, castSpeedPercent: 0, range: 1, projectileSpeedPercent: 25, accuracy: 0.9,
    critChance: 0.9, critMultiplier: 9, luck: 1, elementBonuses: { fire: -0.5 },
  };
  state.wands[0].statBonuses = {
    attack: -5, range: -3, projectileSpeedPercent: 80, accuracy: 0.5, critChance: 0.5,
    critMultiplier: 5, luck: -3, elementBonuses: { fire: -0.75 },
    unexpectedMultiplier: 900,
  } as unknown as WandInstance["statBonuses"];
  state.runBonuses = { attackPercent: -200, maxMana: Number.NaN, manaRegen: 0, rangePercent: 0, cooldownPercent: 200 };
  const stats = getCharacterStats(state, state.characters[0].id)!;
  assert.equal(stats.final.attack, 0);
  assert.equal(stats.final.range, 0);
  assert.equal(stats.final.projectileSpeedPercent, 105);
  assert.equal(stats.final.projectileSpeedMultiplier, 2.05);
  assert.equal(stats.final.accuracy, 1);
  assert.equal(stats.final.critChance, 1);
  assert.equal(stats.final.critMultiplier, 10);
  assert.equal(stats.final.luck, 0);
  assert.equal(stats.final.elementBonuses.fire, -1);
  assert.equal(stats.run.maxMana, 0);
  assert.ok(Math.abs(stats.final.cooldownMultiplier - 0.3) < 1e-12);
  assert.equal("unexpectedMultiplier" in stats.equipment, false);
});

test("extreme finite inputs and unknown bonus keys cannot produce non-finite output", () => {
  const state = fixture();
  const character = state.characters[0];
  character.baseStats = {
    attack: Number.MAX_VALUE, castSpeedPercent: 10_000, range: Number.MAX_VALUE,
    projectileSpeedPercent: 10_000,
    accuracy: 1, critChance: 1, critMultiplier: 10, luck: Number.MAX_VALUE,
    elementBonuses: { fire: Number.MAX_VALUE },
  };
  state.wands[0].statBonuses = {
    attack: Number.MAX_VALUE, range: Number.MAX_VALUE, luck: Number.MAX_VALUE,
    projectileSpeedPercent: Number.MAX_VALUE,
    maxMana: Number.MAX_VALUE, manaRegen: Number.MAX_VALUE,
    elementBonuses: { fire: Number.MAX_VALUE }, unknown: Number.MAX_VALUE,
  } as unknown as WandInstance["statBonuses"];
  state.runBonuses = { attackPercent: Number.MAX_VALUE, rangePercent: Number.MAX_VALUE, maxMana: Number.MAX_VALUE, manaRegen: Number.MAX_VALUE, cooldownPercent: Number.MAX_VALUE };
  const content = structuredClone(demoContent);
  content.sequences[character.sequenceId].bonuses.fire = Number.MAX_VALUE;

  const stats = getCharacterStats(state, character.id, content)!;
  const values = [
    ...Object.values(stats.base).filter((value): value is number => typeof value === "number"),
    ...Object.values(stats.base.elementBonuses),
    ...Object.values(stats.equipment).filter((value): value is number => typeof value === "number"),
    ...Object.values(stats.equipment.elementBonuses),
    ...Object.values(stats.run),
    ...Object.values(stats.sequence.elementBonuses),
    ...Object.values(stats.final).filter((value): value is number => typeof value === "number"),
    ...Object.values(stats.final.elementBonuses),
  ];
  assert.ok(values.every(Number.isFinite));
  assert.equal(stats.equipment.attack, 1_000_000);
  assert.equal(stats.final.attack, 1_000_000);
  assert.equal(stats.final.range, 1_000_000);
  assert.equal(stats.final.projectileSpeedPercent, 10_000);
  assert.equal(stats.final.projectileSpeedMultiplier, 101);
  assert.ok(Number.isFinite(stats.final.projectileSpeedMultiplier) && stats.final.projectileSpeedMultiplier > 0);
  assert.equal(stats.final.castSpeedPercent, 10_000);
  assert.ok(Math.abs(stats.final.cooldownMultiplier - (0.3 / 101)) < 1e-12);
  assert.equal(stats.final.mana, character.mana);
  assert.equal(stats.final.luck, 1_000_000);
  assert.equal(stats.final.totalLuck, 1_000_000);
  assert.equal(stats.final.elementBonuses.fire, 1_000_000);
  assert.equal("unknown" in stats.equipment, false);
});

test("growth combines with base, equipment, and already-applied run mana without mutating progression", () => {
  const state = fixture();
  const character = state.characters[0];
  character.level = 2;
  character.growthProfileId = "fire";
  character.baseStats = {
    attack: 10, gatheringPercent: 0, castSpeedPercent: 0, range: 1, projectileSpeedPercent: 0,
    accuracy: 1, critChance: 0, critMultiplier: 1.5, luck: 0, elementBonuses: {},
  };
  character.maxMana = 130;
  character.mana = 90;
  character.manaRegen = 16;
  character.xp = 77;
  state.wands[0].statBonuses = {
    attack: 3, castSpeedPercent: 2, range: 0.2, projectileSpeedPercent: 5,
    maxMana: 10, manaRegen: 0.5,
  };
  state.runBonuses = { attackPercent: 50, maxMana: 30, manaRegen: 4, rangePercent: 25, cooldownPercent: 20 };

  const original = structuredClone({ baseStats: character.baseStats, level: character.level, xp: character.xp, mana: character.mana, maxMana: character.maxMana, manaRegen: character.manaRegen });
  const stats = getCharacterStats(state, character.id)!;
  assert.deepEqual(stats.growth, {
    attack: 2, castSpeedPercent: 1.5, range: 0.1,
    projectileSpeedPercent: 0.5, maxMana: 5, manaRegen: 0.25,
  });
  assert.equal(stats.final.attack, 22.5);
  assert.ok(Math.abs(stats.final.range - 1.625) < 1e-12);
  assert.equal(stats.final.castSpeedPercent, 3.5);
  assert.equal(stats.final.projectileSpeedPercent, 5.5);
  assert.equal(stats.final.projectileSpeedMultiplier, 1.055);
  assert.ok(Math.abs(stats.final.cooldownMultiplier - (0.8 / 1.035)) < 1e-12);
  assert.equal(stats.final.maxMana, 145);
  assert.equal(stats.final.manaRegen, 16.75);
  assert.equal(stats.final.mana, 90);
  assert.deepEqual({ baseStats: character.baseStats, level: character.level, xp: character.xp, mana: character.mana, maxMana: character.maxMana, manaRegen: character.manaRegen }, original);

  normalizeCharacterStats(state);
  normalizeCharacterStats(state);
  assert.equal(character.growthProfileId, "fire");
  assert.deepEqual({ baseStats: character.baseStats, level: character.level, xp: character.xp, mana: character.mana, maxMana: character.maxMana, manaRegen: character.manaRegen }, original);
});

test("character migration resolves unknown growth profile without changing xp or resources", () => {
  const state = fixture();
  const character = state.characters[0];
  character.sequenceId = "wood-9";
  character.growthProfileId = "not-a-profile";
  character.level = 12;
  character.xp = 456;
  character.mana = 8;
  character.maxMana = 130;
  character.manaRegen = 16;

  normalizeCharacterStats(state);
  assert.equal(character.growthProfileId, "wood");
  const growth = getCharacterStats(state, character.id)!.growth;
  assert.equal(growth.attack, 8.25);
  assert.equal(growth.maxMana, 110);
  assert.equal(growth.manaRegen, 5.5);
  assert.equal(character.level, 12);
  assert.equal(character.xp, 456);
  assert.equal(character.mana, 8);
  assert.equal(character.maxMana, 130);
  assert.equal(character.manaRegen, 16);
});

test("resource sources split consistent inclusive values without adding run rewards again", () => {
  const state=fixture(), character=state.characters[0];
  character.maxMana=130; character.manaRegen=16;
  state.runBonuses={attackPercent:0,maxMana:30,manaRegen:4};
  const stats=getCharacterStats(state,character.id)!;
  assert.deepEqual(stats.resourceSources.character,{maxMana:100,manaRegen:12});
  assert.deepEqual(stats.resourceSources.run,{maxMana:30,manaRegen:4});
  assert.deepEqual(stats.resourceSources.combined,{maxMana:130,manaRegen:16});
  assert.deepEqual(stats.resourceSources.status,{maxMana:"derived",manaRegen:"derived"});
  assert.equal(stats.final.maxMana,130);
  assert.equal(stats.final.manaRegen,16);
});

test("inconsistent historical resource totals remain combined instead of inventing negative base values", () => {
  const state=fixture(), character=state.characters[0];
  character.maxMana=20; character.manaRegen=2; character.mana=7; character.level=3;
  state.runBonuses={attackPercent:0,maxMana:30,manaRegen:4};
  const before=structuredClone(state);
  const stats=getCharacterStats(state,character.id)!;
  assert.deepEqual(stats.resourceSources.character,{maxMana:null,manaRegen:null});
  assert.deepEqual(stats.resourceSources.run,{maxMana:null,manaRegen:null});
  assert.deepEqual(stats.resourceSources.combined,{maxMana:20,manaRegen:2});
  assert.deepEqual(stats.resourceSources.status,{maxMana:"combined",manaRegen:"combined"});
  assert.equal(stats.final.maxMana,30);
  assert.equal(stats.final.manaRegen,2.5);
  stats.resourceSources.combined.maxMana=999;
  assert.equal(getCharacterStats(state,character.id)!.resourceSources.combined.maxMana,20);
  assert.deepEqual(state,before);
});

test("resource provenance is per field and malformed or saturated values cannot establish a base", () => {
  const state=fixture(), character=state.characters[0];
  character.maxMana=130; character.manaRegen=2;
  state.runBonuses={attackPercent:0,maxMana:30,manaRegen:4};
  assert.deepEqual(getCharacterStats(state,character.id)!.resourceSources.status,
    {maxMana:"derived",manaRegen:"combined"});
  for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_VALUE, -1]) {
    character.maxMana=invalid;
    const stats=getCharacterStats(state,character.id)!;
    assert.equal(stats.resourceSources.character.maxMana,null);
    assert.equal(stats.resourceSources.run.maxMana,null);
    assert.equal(stats.resourceSources.status.maxMana,"combined");
    assert.ok(Number.isFinite(stats.resourceSources.combined.maxMana));
    assert.ok(Number.isFinite(stats.final.maxMana));
  }
});
