import assert from "node:assert/strict";
import test from "node:test";
import type { GameState } from "../contracts";
import { demoContent } from "../content/demo";
import { createFixtureState } from "../runtime/mock";
import { applyLoadoutCommand, compileWand } from "./index";

function addSecondCharacter(state: GameState): void {
  state.characters.push({
    ...structuredClone(state.characters[0]),
    id: "character-2",
    name: "伙伴",
    sequenceId: "fire-8",
    wandIds: [],
  });
}

function prepare(): GameState {
  const state = createFixtureState();
  state.phase = "reward";
  state.paused = true;
  state.backpackOpen = true;
  state.wands[0].cooldowns["spark-1"] = 321;
  addSecondCharacter(state);
  return state;
}

test("unequip stores the wand and re-equipping it preserves its layout and recompiles for its new owner", () => {
  const state = prepare();
  const wandBefore = structuredClone(state.wands[0]);
  const previousCompiled = compileWand(state, "wand-1", demoContent);
  assert.equal(previousCompiled?.spells[0].power, 11);

  const removed = applyLoadoutCommand(state, { id: "unequip-1", type: "unequipWand", wandId: "wand-1" }, demoContent);
  assert.equal(removed.result.status, "executed");
  assert.equal(removed.state.wands[0].characterId, null);
  assert.deepEqual(removed.state.characters.map(character => character.wandIds), [[], []]);
  assert.deepEqual(removed.state.wands[0].placements, wandBefore.placements);
  assert.deepEqual(removed.state.wands[0].cooldowns, wandBefore.cooldowns);
  assert.equal(compileWand(removed.state, "wand-1", demoContent), undefined);

  const equipped = applyLoadoutCommand(removed.state, { id: "equip-1", type: "equipWand", wandId: "wand-1", characterId: "character-2" }, demoContent);
  assert.equal(equipped.result.status, "executed");
  assert.equal(equipped.state.wands[0].characterId, "character-2");
  assert.deepEqual(equipped.state.wands[0].placements, wandBefore.placements);
  assert.deepEqual(equipped.state.wands[0].cooldowns, wandBefore.cooldowns);
  assert.equal(compileWand(equipped.state, "wand-1", demoContent)?.spells[0].power, 12);

  assert.deepEqual(removed.events.map(({ seq, gameTimeMs }) => [seq, gameTimeMs]), [[state.nextEventSeq, state.gameTimeMs]]);
  assert.deepEqual(equipped.events.map(({ seq, gameTimeMs }) => [seq, gameTimeMs]), [[state.nextEventSeq + 1, state.gameTimeMs]]);
  assert.equal(equipped.state.revision, state.revision + 2);
});

test("invalid ownership, full targets, and repeated unequip are rejected without changing state or events", () => {
  const state = prepare();
  const full = structuredClone(state);
  full.characters[1].wandIds = ["wand-2", "wand-3"];
  full.wands.push(
    { ...structuredClone(full.wands[0]), id: "wand-2", characterId: "character-2", placements: [] },
    { ...structuredClone(full.wands[0]), id: "wand-3", characterId: "character-2", placements: [] },
  );
  const fullResult = applyLoadoutCommand(full, { id: "full", type: "equipWand", wandId: "wand-1", characterId: "character-2" }, demoContent);
  assert.equal(fullResult.result.status, "rejected");
  assert.equal(fullResult.state, full);
  assert.deepEqual(fullResult.events, []);

  const inconsistent = structuredClone(state);
  inconsistent.characters[1].wandIds = ["wand-1"];
  const duplicate = applyLoadoutCommand(inconsistent, { id: "duplicate", type: "unequipWand", wandId: "wand-1" }, demoContent);
  assert.equal(duplicate.result.status, "rejected");
  assert.equal(duplicate.state, inconsistent);
  assert.deepEqual(duplicate.events, []);

  const orphaned = structuredClone(state);
  orphaned.wands[0].characterId = null;
  const orphanedBefore = structuredClone(orphaned);
  const staleDeclaration = applyLoadoutCommand(orphaned, { id: "stale-declaration", type: "unequipWand", wandId: "wand-1" }, demoContent);
  assert.equal(staleDeclaration.result.status, "rejected");
  assert.equal(staleDeclaration.result.code, "WAND_OWNERSHIP_INVALID");
  assert.equal(staleDeclaration.state, orphaned);
  assert.deepEqual(orphaned, orphanedBefore);
  assert.deepEqual(staleDeclaration.events, []);

  const unequipped = applyLoadoutCommand(state, { id: "remove", type: "unequipWand", wandId: "wand-1" }, demoContent);
  const repeated = applyLoadoutCommand(unequipped.state, { id: "remove-again", type: "unequipWand", wandId: "wand-1" }, demoContent);
  assert.equal(repeated.result.status, "rejected");
  assert.equal(repeated.result.code, "ALREADY_UNEQUIPPED");
  assert.equal(repeated.state, unequipped.state);
  assert.deepEqual(repeated.events, []);
});

test("equipment changes require pausing an active battle", () => {
  const active = prepare();
  active.phase = "battle";
  active.paused = false;
  const denied = applyLoadoutCommand(active, { id: "battle-unequip", type: "unequipWand", wandId: "wand-1" }, demoContent);
  assert.equal(denied.result.status, "rejected");
  assert.equal(denied.state, active);
  assert.deepEqual(denied.events, []);

  active.paused = true;
  const allowed = applyLoadoutCommand(active, { id: "paused-unequip", type: "unequipWand", wandId: "wand-1" }, demoContent);
  assert.equal(allowed.result.status, "executed");
  assert.equal(allowed.state.wands[0].characterId, null);
});
