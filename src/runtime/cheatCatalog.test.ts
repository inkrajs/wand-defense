import assert from "node:assert/strict";
import test from "node:test";
import type { Command, GameState } from "../contracts";
import { demoContent } from "../content/demo";
import { experienceThreshold } from "../content/progression";
import { getCharacterStats } from "../content/characters";
import { applyCatalogCheat, CHEAT_TARGET_LEVEL, isCatalogCheatAction } from "./cheatCatalog";
import { createInitialState } from "./initial";

type CatalogAction = Extract<Command, { type: "cheat" }>;
function enabledState(): GameState {
  const state = createInitialState();
  state.cheats = { unlocked: true, enabled: true };
  return state;
}
function command(id: string, action: CatalogAction["action"], extra: Record<string, unknown> = {}): CatalogAction {
  return { id, type: "cheat", action, ...extra } as CatalogAction;
}

test("catalog cheat action guard recognizes the eight batches and character level action only", () => {
  for (const action of ["grantAllMagic", "maxMagic", "grantAllWands", "maxWands", "grantAllGear", "maxGear", "grantAllSupplies", "maxSupplies", "levelCharacter"]) {
    assert.equal(isCatalogCheatAction(action), true);
  }
  for (const action of ["heal", "revive", "grantSpell", "grantGear", "unknown"]) assert.equal(isCatalogCheatAction(action), false);
  assert.equal(CHEAT_TARGET_LEVEL, 50);
});

test("magic grant fills missing definitions once, discovers recipes and preserves prior instances", () => {
  const state = enabledState();
  const before = structuredClone(state);
  const result = applyCatalogCheat(state, command("grant-magic", "grantAllMagic"), demoContent);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(state, before);
  for (const [id, definition] of Object.entries(demoContent.spells)) {
    const instances: GameState["items"][string][] = Object.values(result.state.items).filter(item => item.kind === "spell" && item.definitionId === id);
    assert.equal(instances.length, 1, id);
    assert.equal(instances[0].grade, definition.grade);
    assert.equal(instances[0].level, definition.level);
  }
  for (const [id, definition] of Object.entries(demoContent.arcana)) {
    const instances: GameState["items"][string][] = Object.values(result.state.items).filter(item => item.kind === "arcana" && item.definitionId === id);
    assert.equal(instances.length, 1, id);
    assert.equal(instances[0].grade, definition.grade);
  }
  assert.deepEqual(result.state.items["spark-1"], before.items["spark-1"]);
  assert.ok(demoContent.recipes.every(recipe => result.state.knowledge.recipeIds.includes(recipe.id)));
  assert.equal(result.state.runStatistics!.spellsAcquired - before.runStatistics!.spellsAcquired, Object.keys(demoContent.spells).length - 1);
  assert.equal(result.state.runStatistics!.arcanaAcquired - before.runStatistics!.arcanaAcquired, Object.keys(demoContent.arcana).length - 1);

  const second = applyCatalogCheat(result.state, command("grant-magic-again", "grantAllMagic"), demoContent);
  assert.equal(second.ok, true);
  if (second.ok) {
    assert.deepEqual(second.events, []);
    assert.deepEqual(second.state.items, result.state.items);
    assert.deepEqual(second.state.backpack, result.state.backpack);
    assert.deepEqual(second.state.runStatistics, result.state.runStatistics);
  }
});

test("wand, gear and supply grants fill catalogs without duplicating existing dimensions or instances", () => {
  const state = enabledState();
  const wandBefore = state.wands[0];
  const wands = applyCatalogCheat(state, command("grant-wands", "grantAllWands"), demoContent);
  assert.equal(wands.ok, true);
  if (!wands.ok) return;
  assert.equal(wands.state.wands.filter(wand => wand.width === 3 && wand.height === 3).length, 1);
  assert.equal(wands.state.wands.filter(wand => wand.width === 4 && wand.height === 4).length, 1);
  assert.equal(wands.state.wands.filter(wand => wand.width === 5 && wand.height === 5).length, 1);
  assert.deepEqual(wands.state.wands[0], wandBefore);

  const gear = applyCatalogCheat(wands.state, command("grant-gear", "grantAllGear"), demoContent);
  assert.equal(gear.ok, true);
  if (!gear.ok) return;
  for (const id of Object.keys(demoContent.gear ?? {})) assert.equal(Object.values(gear.state.gear ?? {}).filter(value => value.definitionId === id).length, 1, id);
  const supplies = applyCatalogCheat(gear.state, command("grant-supplies", "grantAllSupplies"), demoContent);
  assert.equal(supplies.ok, true);
  if (!supplies.ok) return;
  for (const id of Object.keys(demoContent.items ?? {})) assert.equal(Object.values(supplies.state.supplies ?? {}).filter(value => value.definitionId === id).length, 1, id);
  assert.deepEqual(supplies.state.knowledge.gearIds?.slice().sort(), Object.keys(demoContent.gear ?? {}).sort());
  assert.deepEqual(supplies.state.knowledge.itemIds?.slice().sort(), Object.keys(demoContent.items ?? {}).sort());
});

test("max actions raise only levels, preserve grade/layout/ownership and do not alter spell strength", () => {
  const state = enabledState();
  state.items["spark-1"].level = 60;
  state.items["amplify-1"].grade = "mythic";
  state.gear = { gear: { id: "gear", definitionId: "copper-ring", name: "Ring", slot: "accessory", characterId: "character-1", level: 1, grade: "rare", statBonuses: { attack: 2 } } };
  state.characters[0].gearIds = { accessory: "gear" };
  state.supplies = { supply: { id: "supply", definitionId: "mana-potion", level: 1, grade: "epic" } };
  const spellBefore = getCharacterStats(state, "character-1", demoContent)!.final.attack;
  const maxed = applyCatalogCheat(state, command("max-magic", "maxMagic"), demoContent);
  assert.equal(maxed.ok, true);
  if (!maxed.ok) return;
  assert.equal(maxed.state.items["spark-1"].level, 60);
  assert.equal(maxed.state.items["amplify-1"].grade, "mythic");
  const wandMaxed = applyCatalogCheat(maxed.state, command("max-wands", "maxWands"), demoContent);
  assert.equal(wandMaxed.ok, true);
  if (!wandMaxed.ok) return;
  const gearMaxed = applyCatalogCheat(wandMaxed.state, command("max-gear", "maxGear"), demoContent);
  assert.equal(gearMaxed.ok, true);
  if (!gearMaxed.ok) return;
  const suppliesMaxed = applyCatalogCheat(gearMaxed.state, command("max-supplies", "maxSupplies"), demoContent);
  assert.equal(suppliesMaxed.ok, true);
  if (!suppliesMaxed.ok) return;
  assert.equal(suppliesMaxed.state.items["amplify-1"].level, 50);
  assert.equal(suppliesMaxed.state.wands[0].level, 50);
  assert.equal(suppliesMaxed.state.gear!.gear.level, 50);
  assert.equal(suppliesMaxed.state.gear!.gear.grade, "rare");
  assert.equal(suppliesMaxed.state.gear!.gear.characterId, "character-1");
  assert.equal(suppliesMaxed.state.supplies!.supply.level, 50);
  assert.equal(suppliesMaxed.state.supplies!.supply.grade, "epic");
  assert.deepEqual(suppliesMaxed.state.wands[0].placements, state.wands[0].placements);
  assert.equal(getCharacterStats(suppliesMaxed.state, "character-1", demoContent)!.final.attack, spellBefore);
});

test("level character raises cumulative XP, refills effective mana and preserves the rest of the team", () => {
  const state = enabledState();
  state.characters[0].xp = 10;
  state.characters.push({ ...structuredClone(state.characters[0]), id: "second", name: "Second", wandIds: [], gearIds: {}, mana: 7 });
  state.xp = 987;
  const before = structuredClone(state);
  const result = applyCatalogCheat(state, command("level-two", "levelCharacter", { characterId: "character-1", levels: 2 }), demoContent);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const character = result.state.characters[0];
  assert.equal(character.level, 3);
  assert.equal(character.xp, experienceThreshold(2));
  assert.equal(character.mana, getCharacterStats(result.state, character.id, demoContent)!.final.maxMana);
  assert.equal(result.state.playerLevel, 3);
  assert.equal(result.state.xp, before.xp);
  assert.deepEqual(result.state.characters[1], before.characters[1]);
  assert.deepEqual(result.state.runStatistics, { ...before.runStatistics!, levelsGained: before.runStatistics!.levelsGained + 2 });
  assert.deepEqual(result.events, [
    { type: "characterLevelUp", data: { characterId: character.id, previousLevel: 1, level: 2 } },
    { type: "characterLevelUp", data: { characterId: character.id, previousLevel: 2, level: 3 } },
  ]);
  assert.equal(result.events.some(event => event.type === "character.levelReward"), false);
  assert.deepEqual(state, before);
});

test("locked, malformed XP, invalid levels, catalog factories and colliding long IDs fail atomically", () => {
  const locked = createInitialState();
  const lockedBefore = structuredClone(locked);
  assert.deepEqual(applyCatalogCheat(locked, command("locked", "grantAllMagic"), demoContent), { ok: false, code: "CHEATS_LOCKED" });
  assert.deepEqual(locked, lockedBefore);

  const invalidXp = enabledState();
  invalidXp.characters[0].xp = experienceThreshold(invalidXp.characters[0].level);
  const invalidXpBefore = structuredClone(invalidXp);
  const xpResult = applyCatalogCheat(invalidXp, command("bad-xp", "levelCharacter", { characterId: "character-1" }), demoContent);
  assert.deepEqual(xpResult, { ok: false, code: "INVALID_CHARACTER_XP" });
  assert.deepEqual(invalidXp, invalidXpBefore);
  for (const levels of [0, 101, 1.5, NaN, Infinity]) {
    const before = structuredClone(invalidXp);
    const result = applyCatalogCheat(invalidXp, command(`bad-${String(levels)}`, "levelCharacter", { characterId: "character-1", levels }), demoContent);
    assert.equal(result.ok, false);
    assert.deepEqual(invalidXp, before);
  }

  const malformed = structuredClone(demoContent);
  malformed.gear!["bad-slot"] = { ...malformed.gear!["copper-ring"], id: "bad-slot", slot: "invalid" as never };
  const malformedState = enabledState();
  const malformedBefore = structuredClone(malformedState);
  assert.deepEqual(applyCatalogCheat(malformedState, command("bad-gear", "grantAllGear"), malformed), { ok: false, code: "INVALID_CATALOG" });
  assert.deepEqual(malformedState, malformedBefore);

  const longId = "cmd".repeat(53) + "x";
  assert.equal(longId.length, 160);
  const grant = applyCatalogCheat(enabledState(), command(longId, "grantAllMagic"), demoContent);
  assert.equal(grant.ok, true);
  if (grant.ok) assert.ok(Object.keys(grant.state.items).every(id => id.length <= 160));

  const unsupported = applyCatalogCheat(enabledState(), command("unsupported", "heal"), demoContent);
  assert.deepEqual(unsupported, { ok: false, code: "CHEAT_UNAVAILABLE" });
});
