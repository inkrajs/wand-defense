import assert from "node:assert/strict";
import test from "node:test";
import type { ContentCatalog, GameState, GearInstance } from "../contracts";
import { getCharacterStats } from "../content/characters";
import { createFixtureState } from "../runtime/mock";
import { applyGearCommand } from "./gear";

const content: ContentCatalog = {
  spells: {},
  arcana: {},
  recipes: [],
  sequences: {
    "fire-9": { id: "fire-9", pathwayId: "fire", number: 9, name: "Fire", bonuses: {}, requirements: [] }
  },
  gear: {
    "catalog-helm": { id: "catalog-helm", name: "Helm", slot: "head", level: 1, grade: "common", shape: [{ x: 0, y: 0 }], asset: { key: "helm", label: "Helm" }, statBonuses: { attack: 6 } },
    "catalog-charm": { id: "catalog-charm", name: "Charm", slot: "accessory", level: 1, grade: "common", shape: [{ x: 0, y: 0 }], asset: { key: "charm", label: "Charm" }, statBonuses: { attack: 5 } }
  }
};

function readyState(): GameState {
  const state = createFixtureState();
  state.phase = "reward";
  state.paused = false;
  state.backpackOpen = false;
  state.gear = {};
  return state;
}

function gear(id: string, slot: GearInstance["slot"], characterId: string | null, statBonuses: GearInstance["statBonuses"], definitionId?: string): GearInstance {
  return { id, name: id, slot, characterId, level: 1, grade: "common", statBonuses, ...(definitionId ? { definitionId } : {}) };
}

test("equipping legacy gear changes effective attack and max mana without mutating the input", () => {
  const state = readyState();
  state.gear = { helm: gear("helm", "head", null, { attack: 4, maxMana: 18 }) };
  const before = getCharacterStats(state, "character-1", content)!;
  const result = applyGearCommand(state, { id: "equip-helm", type: "equipGear", gearId: "helm", characterId: "character-1" }, content);

  assert.equal(result.result.status, "executed");
  assert.equal(result.state.characters[0].gearIds?.head, "helm");
  assert.equal(result.state.gear?.helm.characterId, "character-1");
  const after = getCharacterStats(result.state, "character-1", content)!;
  assert.equal(after.final.attack, before.final.attack + 4);
  assert.equal(after.final.maxMana, before.final.maxMana + 18);
  assert.equal(state.characters[0].gearIds, undefined);
  assert.equal(state.gear?.helm.characterId, null);
  assert.equal(result.events[0].type, "gearEquipped");
});

test("cross-owner equip replaces same-slot gear and transfers stat contribution atomically", () => {
  const state = readyState();
  const second = { ...structuredClone(state.characters[0]), id: "character-2", name: "Second", gearIds: { accessory: "source-charm" } };
  state.characters[0].gearIds = { accessory: "target-charm" };
  state.characters.push(second);
  state.gear = {
    "target-charm": gear("target-charm", "accessory", "character-1", { attack: 2 }),
    "source-charm": gear("source-charm", "accessory", "character-2", { attack: 5 })
  };
  const targetBefore = getCharacterStats(state, "character-1", content)!.final.attack;
  const sourceBefore = getCharacterStats(state, "character-2", content)!.final.attack;

  const result = applyGearCommand(state, { id: "transfer-charm", type: "equipGear", gearId: "source-charm", characterId: "character-1" }, content);
  assert.equal(result.result.status, "executed");
  assert.equal(result.state.characters[0].gearIds?.accessory, "source-charm");
  assert.equal(result.state.characters[1].gearIds?.accessory, undefined);
  assert.equal(result.state.gear?.["source-charm"].characterId, "character-1");
  assert.equal(result.state.gear?.["target-charm"].characterId, null);
  assert.equal(getCharacterStats(result.state, "character-1", content)!.final.attack, targetBefore + 3);
  assert.equal(getCharacterStats(result.state, "character-2", content)!.final.attack, sourceBefore - 5);
  assert.equal(result.events[0].data.replacedGearId, "target-charm");
});

test("failed gear commands preserve the original state and emit no events", () => {
  const state = readyState();
  state.phase = "battle";
  state.paused = false;
  state.gear = { helm: gear("helm", "head", null, { attack: 4 }, "missing-definition") };
  const before = structuredClone(state);
  const result = applyGearCommand(state, { id: "running-equip", type: "equipGear", gearId: "helm", characterId: "character-1" }, content);
  assert.equal(result.result.code, "LOADOUT_REQUIRES_PAUSE");
  assert.equal(result.state, state);
  assert.deepEqual(result.events, []);
  assert.deepEqual(state, before);

  state.phase = "reward";
  const invalid = applyGearCommand(state, { id: "missing-definition", type: "equipGear", gearId: "helm", characterId: "character-1" }, content);
  assert.equal(invalid.result.code, "GEAR_DEFINITION_NOT_FOUND");
  assert.equal(invalid.state, state);
  assert.deepEqual(invalid.events, []);
});

test("unequip returns gear to the shared gear registry and discard removes only unowned gear", () => {
  const state = readyState();
  state.characters[0].gearIds = { head: "catalog-helm-instance" };
  state.gear = {
    "catalog-helm-instance": gear("catalog-helm-instance", "head", "character-1", { attack: 6 }, "catalog-helm")
  };
  const equipped = getCharacterStats(state, "character-1", content)!.final.attack;
  const unequipped = applyGearCommand(state, { id: "take-off", type: "unequipGear", gearId: "catalog-helm-instance" }, content);
  assert.equal(unequipped.result.status, "executed");
  assert.equal(unequipped.state.characters[0].gearIds?.head, undefined);
  assert.equal(unequipped.state.gear?.["catalog-helm-instance"].characterId, null);
  assert.equal(getCharacterStats(unequipped.state, "character-1", content)!.final.attack, equipped - 6);

  const discarded = applyGearCommand(unequipped.state, { id: "discard-helm", type: "discardGear", gearId: "catalog-helm-instance" }, content);
  assert.equal(discarded.result.status, "executed");
  assert.equal(discarded.state.gear?.["catalog-helm-instance"], undefined);
  assert.ok(discarded.state.characters.every(character => !Object.values(character.gearIds ?? {}).includes("catalog-helm-instance")));
  assert.equal(discarded.state.events.at(-1)?.type, "gearDiscarded");
});

test("discarding equipped gear is rejected without removing its owner link", () => {
  const state = readyState();
  state.characters[0].gearIds = { accessory: "worn" };
  state.gear = { worn: gear("worn", "accessory", "character-1", { attack: 1 }) };
  const result = applyGearCommand(state, { id: "discard-worn", type: "discardGear", gearId: "worn" }, content);
  assert.equal(result.result.code, "GEAR_EQUIPPED");
  assert.equal(result.state, state);
  assert.deepEqual(result.events, []);
  assert.equal(state.characters[0].gearIds?.accessory, "worn");
});

test("unknown legacy definitions can still be unequipped and discarded safely", () => {
  const state = readyState();
  state.characters[0].gearIds = { feet: "orphaned-boots" };
  state.gear = { "orphaned-boots": gear("orphaned-boots", "feet", "character-1", { range: 2 }, "removed-content") };

  const unequipped = applyGearCommand(state, { id: "remove-orphan", type: "unequipGear", gearId: "orphaned-boots" }, content);
  assert.equal(unequipped.result.status, "executed");
  assert.equal(unequipped.state.characters[0].gearIds?.feet, undefined);
  assert.equal(unequipped.state.gear?.["orphaned-boots"].characterId, null);

  const discarded = applyGearCommand(unequipped.state, { id: "discard-orphan", type: "discardGear", gearId: "orphaned-boots" }, content);
  assert.equal(discarded.result.status, "executed");
  assert.equal(discarded.state.gear?.["orphaned-boots"], undefined);
});
