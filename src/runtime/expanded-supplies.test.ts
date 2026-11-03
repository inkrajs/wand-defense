import assert from "node:assert/strict";
import test from "node:test";
import type { ContentCatalog, GameState, Grade } from "../contracts";
import { getCharacterStats } from "../content/characters";
import { createSupplyFromDefinition, supplyDefinitions } from "../content/supplies";
import { createFixtureState } from "./mock";
import { applySupplyCommand } from "./supplies";

const catalog: ContentCatalog = {
  spells: {}, arcana: {}, recipes: [], sequences: {}, items: supplyDefinitions,
};

function stateWithSupply(definitionId: string, grade: Grade = "common"): GameState {
  const state = createFixtureState();
  state.phase = "reward";
  state.supplies = {
    "supply-1": createSupplyFromDefinition(supplyDefinitions[definitionId], "supply-1", grade),
  };
  return state;
}

function use(state: GameState, id = "use-supply") {
  return applySupplyCommand(state, { id, type: "useItem", itemId: "supply-1" }, catalog);
}

function assertNoEffect(state: GameState, result: ReturnType<typeof use>): void {
  assert.equal(result.result.status, "rejected");
  assert.equal(result.state, state);
  assert.deepEqual(result.events, []);
  assert.ok(state.supplies?.["supply-1"]);
}

test("territoryRestore applies one grade-scaled value to health and shield, clamping each independently", () => {
  const state = stateWithSupply("restoration-elixir", "uncommon");
  state.territory.hp = 10;
  state.territory.maxHp = 100;
  state.territory.shield = 10;
  state.territory.maxShield = 100;

  const restored = use(state);
  assert.equal(restored.result.status, "executed");
  assert.equal(restored.state.territory.hp, 41.25);
  assert.equal(restored.state.territory.shield, 41.25);
  assert.equal(restored.events[0].data.effectType, "territoryRestore");
  assert.equal(restored.events[0].data.amount, 62.5);

  const clamped = stateWithSupply("restoration-elixir");
  clamped.territory.hp = 99;
  clamped.territory.maxHp = 100;
  clamped.territory.shield = 49;
  clamped.territory.maxShield = 50;
  const nearFull = use(clamped);
  assert.equal(nearFull.result.status, "executed");
  assert.equal(nearFull.state.territory.hp, 100);
  assert.equal(nearFull.state.territory.shield, 50);
  assert.equal(nearFull.events[0].data.amount, 2);
});

test("territory percentage supplies scale by quality, cap at 100 percent, and clamp actual restoration", () => {
  const health = stateWithSupply("vitality-essence", "uncommon");
  health.territory.hp = 100;
  health.territory.maxHp = 200;
  const healed = use(health);
  assert.equal(healed.result.status, "executed");
  assert.equal(healed.state.territory.hp, 162.5); // 25% × 1.25 × 200 maximum HP.
  assert.equal(healed.events[0].data.amount, 62.5);

  const shield = stateWithSupply("aegis-essence", "rare");
  shield.territory.shield = 20;
  shield.territory.maxShield = 80;
  const protectedState = use(shield);
  assert.equal(protectedState.result.status, "executed");
  assert.equal(protectedState.state.territory.shield, 50); // 25% × 1.5 × 80 maximum shield.
  assert.equal(protectedState.events[0].data.amount, 30);

  const capped = stateWithSupply("vitality-essence", "mythic");
  const customItems = {
    ...catalog.items,
    "vitality-essence": {
      ...catalog.items!["vitality-essence"],
      effect: { type: "territoryHealPercent", value: 50 },
    },
  } satisfies NonNullable<ContentCatalog["items"]>;
  capped.territory.hp = 1;
  capped.territory.maxHp = 100;
  const cappedUse = applySupplyCommand(capped, { id: "cap", type: "useItem", itemId: "supply-1" }, { ...catalog, items: customItems });
  assert.equal(cappedUse.result.status, "executed");
  assert.equal(cappedUse.state.territory.hp, 100);
  assert.equal(cappedUse.events[0].data.amount, 99);
});

test("partyManaPercent uses each final maxMana after personal growth and equipped gear", () => {
  const state = stateWithSupply("mana-surge", "uncommon");
  const first = state.characters[0];
  first.level = 3;
  first.growthProfileId = "fire";
  first.maxMana = 100;
  first.mana = 100;
  first.gearIds = { body: "mana-armor" };
  state.gear = {
    "mana-armor": {
      id: "mana-armor", name: "法力甲", slot: "body", characterId: first.id,
      level: 1, grade: "common", statBonuses: { maxMana: 20 },
    },
  };
  state.characters.push({
    ...structuredClone(first), id: "character-2", name: "伙伴", level: 2,
    growthProfileId: "balanced", maxMana: 50, mana: 54, gearIds: undefined, wandIds: [],
  });
  assert.equal(getCharacterStats(state, first.id, catalog)?.final.maxMana, 130);
  assert.equal(getCharacterStats(state, "character-2", catalog)?.final.maxMana, 55);

  const restored = use(state);
  assert.equal(restored.result.status, "executed");
  assert.deepEqual(restored.state.characters.map(character => character.mana), [130, 55]);
  assert.equal(restored.events[0].data.effectType, "partyManaPercent");
  assert.equal(restored.events[0].data.amount, 31);
  assert.deepEqual(restored.events[0].data.targets, [
    { characterId: first.id, amount: 30 },
    { characterId: "character-2", amount: 1 },
  ]);
});

test("cooldownAdvance reduces positive equipped and null-owner backpack wand ledger entries atomically", () => {
  const state = stateWithSupply("hourglass-dust", "uncommon");
  state.wands[0].cooldowns = { "spell-a": 600, "preserved-ledger": 1800, ready: 0 };
  const second = structuredClone(state.wands[0]);
  second.id = "wand-bag";
  second.name = "背包法杖";
  second.characterId = null;
  second.placements = [];
  second.cooldowns = { "spell-b": 1600, "other-ledger": 300, "backpack-ledger": 500 };
  state.wands.push(second);

  const advanced = use(state);
  assert.equal(advanced.result.status, "executed");
  assert.deepEqual(advanced.state.wands.map(wand => wand.cooldowns), [
    { "spell-a": 0, "preserved-ledger": 550, ready: 0 },
    { "spell-b": 350, "other-ledger": 0, "backpack-ledger": 0 },
  ]);
  assert.equal(advanced.state.wands[1].characterId, null);
  assert.equal(advanced.events[0].data.effectType, "cooldownAdvance");
  assert.equal(advanced.events[0].data.amount, 3900);

  const noCooldown = stateWithSupply("hourglass-dust");
  noCooldown.wands[0].cooldowns = { ready: 0 };
  assertNoEffect(noCooldown, use(noCooldown));

  const malformed = stateWithSupply("hourglass-dust");
  malformed.wands[0].cooldowns = { broken: Number.NaN, valid: 300 };
  const before = structuredClone(malformed);
  assertNoEffect(malformed, use(malformed));
  assert.deepEqual(malformed, before);
});

test("percentage above 100 and zero-effect restoration reject without consuming the supply", () => {
  const state = stateWithSupply("vitality-essence");
  const invalidContent: ContentCatalog = {
    ...catalog,
    items: {
      ...catalog.items,
      "vitality-essence": {
        ...catalog.items!["vitality-essence"],
        effect: { type: "territoryHealPercent", value: 100.01 },
      },
    },
  };
  const invalid = applySupplyCommand(state, { id: "invalid-percent", type: "useItem", itemId: "supply-1" }, invalidContent);
  assertNoEffect(state, invalid);

  const full = stateWithSupply("aegis-essence");
  assertNoEffect(full, use(full));
});

test("each new supply obeys phase and defeated-territory gates, then commits once without unrelated side effects", () => {
  const scenarios: Array<{ definitionId: string; prepare: (state: GameState) => void }> = [
    { definitionId: "restoration-elixir", prepare: state => { state.territory.hp = 20; state.territory.shield = 5; } },
    { definitionId: "mana-surge", prepare: state => { state.characters[0].mana = 0; } },
    { definitionId: "hourglass-dust", prepare: state => { state.wands[0].cooldowns = { "ledger-spell": 800 }; } },
    { definitionId: "vitality-essence", prepare: state => { state.territory.hp = 10; } },
    { definitionId: "aegis-essence", prepare: state => { state.territory.shield = 5; } },
  ];

  for (const { definitionId, prepare } of scenarios) {
    const running = stateWithSupply(definitionId);
    prepare(running);
    running.phase = "battle";
    running.paused = false;
    const runningBefore = structuredClone(running);
    assertNoEffect(running, use(running, `running-${definitionId}`));
    assert.deepEqual(running, runningBefore);

    const defeated = stateWithSupply(definitionId);
    prepare(defeated);
    defeated.territory.hp = 0;
    const defeatedBefore = structuredClone(defeated);
    assertNoEffect(defeated, use(defeated, `defeated-${definitionId}`));
    assert.deepEqual(defeated, defeatedBefore);

    const state = stateWithSupply(definitionId);
    prepare(state);
    state.coins = 123;
    state.xp = 456;
    state.playerLevel = 7;
    state.gameTimeMs = 9876;
    state.supplies!["kept-supply"] = createSupplyFromDefinition(supplyDefinitions["health-potion"], "kept-supply");
    const before = structuredClone(state);
    const beforeProgress = state.characters.map(({ id, level, xp, grade, sequenceId, growthProfileId }) => ({ id, level, xp, grade, sequenceId, growthProfileId }));
    const beforeWandShape = state.wands.map(({ id, characterId, level, grade, placements, statBonuses }) => ({ id, characterId, level, grade, placements, statBonuses }));

    const result = use(state, `commit-${definitionId}`);
    assert.equal(result.result.status, "executed", definitionId);
    assert.equal(result.state.revision, before.revision + 1, definitionId);
    assert.equal(result.state.nextEventSeq, before.nextEventSeq + 1, definitionId);
    assert.equal(result.events.length, 1, definitionId);
    assert.equal(result.events[0].seq, before.nextEventSeq, definitionId);
    assert.equal(result.events[0].gameTimeMs, before.gameTimeMs, definitionId);
    assert.equal(result.events[0].type, "itemUsed", definitionId);
    assert.equal(result.state.gameTimeMs, before.gameTimeMs, definitionId);
    assert.deepEqual(result.state.supplies, { "kept-supply": before.supplies!["kept-supply"] }, definitionId);
    assert.equal(result.state.coins, before.coins, definitionId);
    assert.equal(result.state.xp, before.xp, definitionId);
    assert.equal(result.state.playerLevel, before.playerLevel, definitionId);
    assert.deepEqual(result.state.runStatistics, before.runStatistics, definitionId);
    assert.deepEqual(result.state.knowledge, before.knowledge, definitionId);
    assert.deepEqual(result.state.backpack, before.backpack, definitionId);
    assert.deepEqual(result.state.items, before.items, definitionId);
    assert.deepEqual(result.state.characters.map(({ id, level, xp, grade, sequenceId, growthProfileId }) => ({ id, level, xp, grade, sequenceId, growthProfileId })), beforeProgress, definitionId);
    assert.deepEqual(result.state.wands.map(({ id, characterId, level, grade, placements, statBonuses }) => ({ id, characterId, level, grade, placements, statBonuses })), beforeWandShape, definitionId);
    assert.deepEqual(state, before, `${definitionId}: input state must stay unchanged`);
  }
});
