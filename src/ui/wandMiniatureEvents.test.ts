import assert from "node:assert/strict";
import test from "node:test";
import type { GameEvent } from "../contracts";
import { createInitialState } from "../runtime/initial";
import { castFlashKey, collectNewCastFlashes, collectRunCastFlashes, isCastFlashActive } from "./wandMiniatureEvents";

function event(seq: number, type: string, sourceCharacterId: string, sourceItemId: string): GameEvent {
  return { seq, type, gameTimeMs: seq * 50, data: { sourceCharacterId, sourceItemId } };
}

test("new authoritative cast events resolve by equipped placement and coalesce per wand item", () => {
  const state = createInitialState();
  state.characters.push({ ...structuredClone(state.characters[0]), id: "character-2", name: "同行者", wandIds: ["wand-2"] });
  state.wands.push({ ...structuredClone(state.wands[0]), id: "wand-2", name: "同行法杖", characterId: "character-2", placements: [{ itemId: "spark-2", x: 0, y: 0, rotation: 0 }] });
  state.events = [
    event(1, "projectileSpawned", "character-1", "spark-1"),
    event(2, "spellCast", "character-1", "spark-1"),
    event(3, "projectileSpawned", "character-1", "spark-1"),
    event(4, "beamSpawned", "character-2", "spark-2"),
    event(5, "heal", "character-1", "spark-1"),
    event(6, "shieldRestored", "character-1", "spark-1"),
  ];
  state.nextEventSeq = 7;

  const batch = collectNewCastFlashes(state, 3);
  assert.equal(batch.nextSeq, 7);
  assert.deepEqual(new Set(batch.targets.map(target => castFlashKey(target.wandId, target.itemId))), new Set([
    castFlashKey("wand-1", "spark-1"),
    castFlashKey("wand-2", "spark-2"),
  ]));
  assert.deepEqual(collectNewCastFlashes(state, 7).targets, []);
});

test("events without a live unique equipped source are ignored", () => {
  const state = createInitialState();
  state.wands.push({ ...structuredClone(state.wands[0]), id: "wand-duplicate", name: "Duplicate", placements: [{ itemId: "spark-1", x: 1, y: 0, rotation: 0 }] });
  state.characters[0].wandIds.push("wand-duplicate");
  state.events = [
    event(1, "projectileSpawned", "missing-character", "spark-1"),
    event(2, "projectileSpawned", "character-1", "missing-item"),
    event(3, "projectileSpawned", "character-1", "spark-1"),
  ];
  state.nextEventSeq = 4;
  assert.deepEqual(collectNewCastFlashes(state, 1).targets, []);
});

test("run changes hide old flashes and start at the new run head without replaying history", () => {
  const previous = createInitialState();
  previous.id = "run-one";
  const next = structuredClone(previous);
  next.id = "run-two";
  next.events = [event(1, "projectileSpawned", "character-1", "spark-1")];
  next.nextEventSeq = 2;

  const switched = collectRunCastFlashes(next, { runId: previous.id, nextSeq: 1 });
  assert.equal(switched.runChanged, true);
  assert.deepEqual(switched.targets, []);
  assert.deepEqual(switched.cursor, { runId: "run-two", nextSeq: 2 });
  assert.equal(isCastFlashActive("run-two", "run-one", Date.now() + 300), false);

  next.events.push(event(2, "projectileSpawned", "character-1", "spark-1"));
  next.nextEventSeq = 3;
  const fresh = collectRunCastFlashes(next, switched.cursor);
  assert.equal(fresh.runChanged, false);
  assert.deepEqual(fresh.targets, [{ wandId: "wand-1", itemId: "spark-1" }]);
});
