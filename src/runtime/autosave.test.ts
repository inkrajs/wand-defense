import assert from "node:assert/strict";
import test from "node:test";
import type { GameEvent } from "../contracts";
import { shouldPersistRunChange } from "./session";
import { createGameRuntime } from "./index";
import { loadRun, saveRun } from "./session";

const event = (type: string): GameEvent => ({ seq: 1, type, gameTimeMs: 0, data: {} });

test("combat effects and paused combat edits do not replace the saved wave entry", () => {
  for (const type of ["damage", "spellCast", "enemyKilled", "pause.changed", "backpack.changed", "speed.changed", "wandCleared"])
    assert.equal(shouldPersistRunChange({ phase: "battle" }, [event(type)]), false, type);
  assert.equal(shouldPersistRunChange({ phase: "battle" }, []), false, "pagehide/HMR must retain wave entry");
  assert.equal(shouldPersistRunChange({ phase: "battle" }, [event("waveStarted")]), true);
});

test("preparation, reward and defeat persist immediately", () => {
  for (const phase of ["ready", "reward", "defeat"] as const)
    assert.equal(shouldPersistRunChange({ phase }, []), true, phase);
});

test("refresh retries the same wave without carrying partial battle gains or resetting the run", () => {
  const data = new Map<string, string>(); let writes = 0;
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem(key: string, value: string) { data.set(key, value); writes++; } };
  const checkpoint = createGameRuntime().checkpoint(); checkpoint.state.wave = 21; checkpoint.state.coins = 152;
  checkpoint.state.characters[0].baseStats!.attack = 100000;
  checkpoint.state.characters[0].baseStats!.range = 200;
  const runtime = createGameRuntime(undefined, checkpoint);
  saveRun(storage, runtime.checkpoint());
  runtime.subscribe((state, events) => { if (shouldPersistRunChange(state, events)) saveRun(storage, runtime.checkpoint()); });
  const start = { id: "start-22", type: "startWave" as const };
  const receipt = runtime.dispatch(start);
  const entry = runtime.getState(); assert.equal(entry.wave, 22);
  for (let i = 0; i < 200 && runtime.getState().runStatistics!.enemiesDefeated === 0; i++) runtime.tick(50);
  assert.ok(runtime.getState().gameTimeMs > entry.gameTimeMs);
  assert.ok(runtime.getState().runStatistics!.enemiesDefeated > 0);
  assert.ok(runtime.getState().xp > entry.xp);
  assert.equal(runtime.getState().phase, "battle");
  assert.equal(writes, 2);
  const restored = createGameRuntime(undefined, loadRun(storage));
  assert.deepEqual(restored.getState(), entry);
  assert.deepEqual(restored.dispatch(start), receipt);
  assert.deepEqual(restored.getState(), entry);
  assert.equal(restored.getState().id, entry.id); assert.equal(restored.getState().coins, 152);
  restored.tick(50); assert.equal(restored.getState().wave, 22); assert.equal(restored.getState().phase, "battle");
  runtime.dispatch({ id: "fresh-run", type: "restart" });
  assert.equal(loadRun(storage)?.state.wave, 0); assert.equal(writes, 3);
});
