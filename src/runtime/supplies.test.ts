import assert from "node:assert/strict";
import test from "node:test";
import type { ContentCatalog, GameState, Grade, SupplyDefinition, SupplyInstance } from "../contracts";
import { getCharacterStats } from "../content/characters";
import { createFixtureState } from "./mock";
import { applySupplyCommand } from "./supplies";

const supplyDefinition = (
  id: string,
  type: SupplyDefinition["effect"]["type"],
  value: number,
): SupplyDefinition => ({
  id, name: id, level: 1, grade: "common", shape: [{ x: 0, y: 0 }],
  asset: { key: id, label: id }, effect: { type, value },
});

const catalog: ContentCatalog = {
  spells: {}, arcana: {}, recipes: [], sequences: {},
  items: {
    heal: supplyDefinition("heal", "territoryHeal", 40),
    shield: supplyDefinition("shield", "territoryShield", 20),
    mana: supplyDefinition("mana", "partyMana", 20),
    invalid: supplyDefinition("invalid", "territoryHeal", Number.NaN),
    overflow: supplyDefinition("overflow", "territoryHeal", Number.MAX_VALUE),
  },
};

function instance(id: string, definitionId: string, grade: Grade = "common", level = 1): SupplyInstance {
  return { id, definitionId, grade, level };
}

function readyState(): GameState {
  const state = createFixtureState();
  state.phase = "reward";
  state.paused = false;
  state.supplies = {
    "heal-1": instance("heal-1", "heal"),
    "shield-1": instance("shield-1", "shield"),
    "mana-1": instance("mana-1", "mana", "uncommon"),
  };
  return state;
}

function use(state: GameState, itemId: string, id = `use-${itemId}`) {
  return applySupplyCommand(state, { id, type: "useItem", itemId }, catalog);
}

function assertRejectedUnchanged(state: GameState, result: ReturnType<typeof use>): void {
  assert.equal(result.result.status, "rejected");
  assert.equal(result.state, state);
  assert.deepEqual(result.events, []);
}

test("territory healing and shield supplies scale by grade and clamp to missing capacity", () => {
  const healState = readyState();
  healState.territory.hp = 92;
  const healed = use(healState, "heal-1");
  assert.equal(healed.result.status, "executed");
  assert.equal(healed.state.territory.hp, 100);
  assert.equal(healed.state.supplies?.["heal-1"], undefined);
  assert.deepEqual(healed.events[0].data, {
    commandId: "use-heal-1", itemId: "heal-1", definitionId: "heal",
    effectType: "territoryHeal", amount: 8,
  });

  const shieldState = readyState();
  shieldState.territory.shield = 7;
  shieldState.territory.maxShield = 10;
  const shielded = use(shieldState, "shield-1");
  assert.equal(shielded.result.status, "executed");
  assert.equal(shielded.state.territory.shield, 10);
  assert.equal(shielded.events[0].data.amount, 3);

  const scaledState = readyState();
  scaledState.territory.hp = 20;
  scaledState.supplies!["heal-1"].grade = "uncommon";
  const scaled = use(scaledState, "heal-1");
  assert.equal(scaled.result.status, "executed");
  assert.equal(scaled.state.territory.hp, 70);
  assert.equal(scaled.events[0].data.amount, 50); // 40 base × 1.25 rarity ratio, with room to apply it all.
});

test("party mana uses each character's final growth and equipment maxMana and consumes one supply", () => {
  const state = readyState();
  const first = state.characters[0];
  first.level = 3;
  first.growthProfileId = "fire";
  first.maxMana = 100;
  first.mana = 120;
  first.gearIds = { body: "mana-armor" };
  state.gear = {
    "mana-armor": {
      id: "mana-armor", name: "法力甲", slot: "body", characterId: first.id,
      level: 1, grade: "common", statBonuses: { maxMana: 20 },
    },
  };
  state.characters.push({ ...structuredClone(first), id: "character-2", name: "伙伴", level: 1, growthProfileId: "balanced", mana: 100, gearIds: undefined, wandIds: [] });
  const firstMaxMana = getCharacterStats(state, first.id, catalog)!.final.maxMana;
  const secondMaxMana = getCharacterStats(state, "character-2", catalog)!.final.maxMana;
  assert.equal(firstMaxMana, 130); // 100 base + 10 growth + 20 equipped gear.
  assert.equal(secondMaxMana, 100);

  const used = use(state, "mana-1");
  assert.equal(used.result.status, "executed");
  assert.deepEqual(used.state.characters.map(character => character.mana), [130, 100]);
  assert.equal(used.state.supplies?.["mana-1"], undefined);
  assert.deepEqual(used.events[0].data, {
    commandId: "use-mana-1", itemId: "mana-1", definitionId: "mana",
    effectType: "partyMana", amount: 10,
    targets: [
      { characterId: first.id, amount: 10 },
      { characterId: "character-2", amount: 0 },
    ],
  });
});

test("full resources, defeated territory, malformed values, and aliased supply IDs are rejected without consumption", () => {
  const full = readyState();
  full.territory.hp = full.territory.maxHp;
  assertRejectedUnchanged(full, use(full, "heal-1"));

  const dead = readyState();
  dead.territory.hp = 0;
  assertRejectedUnchanged(dead, use(dead, "heal-1"));

  const defeat = readyState();
  defeat.phase = "defeat";
  defeat.territory.hp = 0;
  assertRejectedUnchanged(defeat, use(defeat, "heal-1"));

  for (const [id, grade] of [["nan", "common"], ["overflow", "mythic"]] as const) {
    const state = readyState();
    const definitionId = id === "nan" ? "invalid" : "overflow";
    state.supplies![`${id}-1`] = instance(`${id}-1`, definitionId, grade);
    assertRejectedUnchanged(state, use(state, `${id}-1`));
  }

  const invalidLevel = readyState();
  invalidLevel.supplies!["heal-1"].level = 0.5;
  assertRejectedUnchanged(invalidLevel, use(invalidLevel, "heal-1"));

  const alias = readyState();
  alias.supplies!["other-key"] = instance("heal-1", "heal");
  assertRejectedUnchanged(alias, use(alias, "heal-1"));

  const inherited = readyState();
  inherited.supplies = Object.create({ "inherited-1": instance("inherited-1", "heal") }) as NonNullable<GameState["supplies"]>;
  const inheritedRegistry = inherited.supplies;
  const inheritedOwnKeys = Object.keys(inheritedRegistry);
  assertRejectedUnchanged(inherited, use(inherited, "inherited-1"));
  assert.equal(inherited.supplies, inheritedRegistry);
  assert.deepEqual(Object.keys(inherited.supplies!), inheritedOwnKeys);
});

test("party potion rejects when everyone is full; running battle rejects and paused battle permits use", () => {
  const full = readyState();
  full.characters[0].mana = getCharacterStats(full, full.characters[0].id, catalog)!.final.maxMana;
  assertRejectedUnchanged(full, use(full, "mana-1"));

  const malformedMana = readyState();
  malformedMana.characters[0].mana = -1;
  assertRejectedUnchanged(malformedMana, use(malformedMana, "mana-1"));

  const running = readyState();
  running.phase = "battle";
  running.paused = false;
  assertRejectedUnchanged(running, use(running, "heal-1"));

  const paused = readyState();
  paused.phase = "battle";
  paused.paused = true;
  paused.territory.hp = 90;
  assert.equal(use(paused, "heal-1").result.status, "executed");
});

test("discard removes only the selected actual instance, including one with a missing definition", () => {
  const state = readyState();
  state.supplies!["stale-1"] = instance("stale-1", "removed-definition");
  const backpack = structuredClone(state.backpack);
  const items = structuredClone(state.items);
  const knowledge = structuredClone(state.knowledge);
  const runStatistics = structuredClone(state.runStatistics);

  const discarded = applySupplyCommand(state, { id: "discard-stale", type: "discardSupply", itemId: "stale-1" }, catalog);
  assert.equal(discarded.result.status, "executed");
  assert.equal(discarded.state.supplies?.["stale-1"], undefined);
  assert.ok(discarded.state.supplies?.["heal-1"]);
  assert.deepEqual(discarded.state.backpack, backpack);
  assert.deepEqual(discarded.state.items, items);
  assert.deepEqual(discarded.state.knowledge, knowledge);
  assert.deepEqual(discarded.state.runStatistics, runStatistics);
  assert.deepEqual(discarded.events[0].data, {
    commandId: "discard-stale", itemId: "stale-1", definitionId: "removed-definition",
  });
});
