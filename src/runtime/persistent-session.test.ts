import assert from "node:assert/strict";
import test from "node:test";
import { createGameRuntime } from "./index";
import { readPersistentRun, readRun, RUN_STORAGE_KEY, saveRun, type RunStorage } from "./session";

function store() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); } };
}

test("migrates the current tab checkpoint and restores it with a new empty tab session", () => {
  const durable = store(), tab = store(), runtime = createGameRuntime();
  const checkpoint = runtime.checkpoint();
  checkpoint.state.wave = 38;
  checkpoint.state.coins = 493;
  checkpoint.state.phase = "reward";
  saveRun(tab, checkpoint);
  assert.deepEqual(readPersistentRun(durable, tab), { status: "loaded", checkpoint });
  assert.deepEqual(readRun(tab), { status: "loaded", checkpoint });
  const afterBrowserRestart = readPersistentRun(durable, store());
  assert.deepEqual(afterBrowserRestart, { status: "loaded", checkpoint });
  if (afterBrowserRestart.status !== "loaded") assert.fail("missing durable run");
  const restored = createGameRuntime(undefined, afterBrowserRestart.checkpoint);
  assert.equal(restored.getState().wave, 38);
  assert.equal(restored.getState().coins, 493);
  assert.deepEqual(restored.getState().items, checkpoint.state.items);
  assert.deepEqual(restored.getState().characters, checkpoint.state.characters);
  runtime.dispose(); restored.dispose();
});

test("an existing durable save wins over an older tab, including an explicit new run", () => {
  const durable = store(), tab = store(), runtime = createGameRuntime();
  const old = runtime.checkpoint(); old.state.wave = 38;
  saveRun(tab, old);
  saveRun(durable, runtime.checkpoint());
  const result = readPersistentRun(durable, tab);
  assert.deepEqual(result, readRun(durable));
  if (result.status !== "loaded") assert.fail("missing durable run");
  assert.equal(result.checkpoint.state.wave, 0);
  runtime.dispose();
});

test("failed migration retains the tab checkpoint and can retry durable saving", () => {
  const durable = store(), tab = store(), runtime = createGameRuntime();
  const checkpoint = runtime.checkpoint(); checkpoint.state.wave = 20;
  saveRun(tab, checkpoint);
  const blocked: RunStorage = { getItem: durable.getItem, setItem() { throw new Error("quota"); } };
  assert.deepEqual(readPersistentRun(blocked, tab), { status: "loaded", checkpoint });
  assert.deepEqual(readRun(tab), { status: "loaded", checkpoint });
  assert.equal(durable.getItem(RUN_STORAGE_KEY), null);
  assert.equal(saveRun(durable, checkpoint), true);
  assert.deepEqual(readPersistentRun(durable, store()), { status: "loaded", checkpoint });
  runtime.dispose();
});

test("migration never overwrites rejected or temporarily unreadable durable evidence", () => {
  const durable = store(), tab = store(), runtime = createGameRuntime();
  saveRun(tab, runtime.checkpoint());
  durable.setItem(RUN_STORAGE_KEY, "broken original");
  assert.deepEqual(readPersistentRun(durable, tab), { status: "rejected" });
  assert.equal(durable.getItem(RUN_STORAGE_KEY), "broken original");
  const unavailable: RunStorage = { getItem() { throw new Error("blocked"); },
    setItem() { assert.fail("must not write after read failure"); } };
  assert.deepEqual(readPersistentRun(unavailable, tab), { status: "unavailable" });
  assert.deepEqual(readPersistentRun(store(), store()), { status: "empty" });
  runtime.dispose();
});
