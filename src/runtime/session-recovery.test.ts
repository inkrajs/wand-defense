import assert from "node:assert/strict";
import test from "node:test";
import { createGameRuntime } from "./index";
import { loadRun, readRun, saveRun, RUN_RECOVERY_STORAGE_KEY, RUN_STORAGE_KEY, type RunStorage } from "./session";

function store() {
  const data = new Map<string, string>();
  const writes: string[] = [];
  return { data, writes, getItem: (key: string) => data.get(key) ?? null,
    setItem(key: string, value: string) { writes.push(key); data.set(key, value); } };
}
const checkpoint = () => createGameRuntime().checkpoint();

test("read status distinguishes missing, rejected and unavailable records without writing", () => {
  const storage = store(), first = checkpoint();
  assert.deepEqual(readRun(), { status: "unavailable" });
  assert.deepEqual(readRun(storage), { status: "empty" });
  for (const raw of ["", "broken-json", JSON.stringify({ ...first, checkpointVersion: 2 })]) {
    storage.data.set(RUN_STORAGE_KEY, raw);
    assert.deepEqual(readRun(storage), { status: "rejected" });
    assert.equal(loadRun(storage), undefined);
    assert.equal(storage.getItem(RUN_STORAGE_KEY), raw);
  }
  storage.data.set(RUN_STORAGE_KEY, JSON.stringify(first));
  assert.deepEqual(readRun(storage), { status: "loaded", checkpoint: first });
  assert.deepEqual(loadRun(storage), first);
  const blocked: RunStorage = { ...storage, getItem: () => { throw new Error("read unavailable"); } };
  assert.deepEqual(readRun(blocked), { status: "unavailable" });
  assert.equal(loadRun(blocked), undefined);
  assert.deepEqual(storage.writes, []);
});

test("a transient read error stays distinguishable from an empty run after storage recovers", () => {
  const storage = store(), saved = checkpoint(); saved.state.wave = 11;
  storage.data.set(RUN_STORAGE_KEY, JSON.stringify(saved));
  let failed = false;
  const transient: RunStorage = { ...storage, getItem(key) {
    if (!failed) { failed = true; throw new Error("temporary read failure"); }
    return storage.getItem(key);
  } };
  const initial = readRun(transient);
  assert.deepEqual(initial, { status: "unavailable" });
  assert.deepEqual(readRun(transient), { status: "loaded", checkpoint: saved });
  assert.equal(initial.status, "unavailable");
  assert.equal(storage.writes.length, 0);
  assert.equal(JSON.parse(storage.getItem(RUN_STORAGE_KEY)!).state.wave, 11);
});

test("valid and absent run records save normally without disturbing recovery evidence", () => {
  const storage = store(), first = checkpoint();
  storage.data.set(RUN_RECOVERY_STORAGE_KEY, "older evidence");
  assert.equal(saveRun(storage, first), true);
  const next = structuredClone(first); next.state.wave = 11;
  assert.equal(saveRun(storage, next), true);
  assert.deepEqual(loadRun(storage), next);
  assert.equal(storage.getItem(RUN_RECOVERY_STORAGE_KEY), "older evidence");
  assert.deepEqual(storage.writes, [RUN_STORAGE_KEY, RUN_STORAGE_KEY]);
});

test("rejected JSON, versions, structure and empty records are preserved verbatim before replacement", () => {
  const first = checkpoint();
  for (const raw of ["  {broken-json\n", JSON.stringify({ ...first, checkpointVersion: 2 }),
    JSON.stringify({ ...first, state: { ...first.state, events: null } }), ""]) {
    const storage = store(); storage.data.set(RUN_STORAGE_KEY, raw);
    assert.equal(loadRun(storage), undefined);
    assert.equal(saveRun(storage, first), true);
    assert.equal(storage.getItem(RUN_RECOVERY_STORAGE_KEY), raw);
    assert.deepEqual(loadRun(storage), first);
    assert.deepEqual(storage.writes, [RUN_RECOVERY_STORAGE_KEY, RUN_STORAGE_KEY]);
  }
});

test("a different recovery record blocks overwrite; an identical recovery record permits retry", () => {
  const storage = store(), first = checkpoint();
  storage.data.set(RUN_STORAGE_KEY, "rejected original");
  storage.data.set(RUN_RECOVERY_STORAGE_KEY, "different evidence");
  assert.equal(saveRun(storage, first), false);
  assert.equal(storage.getItem(RUN_STORAGE_KEY), "rejected original");
  assert.equal(storage.getItem(RUN_RECOVERY_STORAGE_KEY), "different evidence");
  assert.deepEqual(storage.writes, []);
  storage.data.set(RUN_RECOVERY_STORAGE_KEY, "rejected original");
  assert.equal(saveRun(storage, first), true);
  assert.deepEqual(storage.writes, [RUN_STORAGE_KEY]);
});

test("read, backup write or backup verification failures never overwrite the original", () => {
  for (const failure of ["read", "recoveryRead", "backupWrite", "backupMissing"] as const) {
    const storage = store(), original = "unreadable original";
    storage.data.set(RUN_STORAGE_KEY, original);
    const guarded: RunStorage = {
      getItem(key) {
        if (failure === "read" || (failure === "recoveryRead" && key === RUN_RECOVERY_STORAGE_KEY)) throw new Error("read failed");
        return storage.getItem(key);
      },
      setItem(key, value) {
        if (key === RUN_RECOVERY_STORAGE_KEY) {
          if (failure === "backupWrite") throw new Error("quota");
          if (failure === "backupMissing") return;
        }
        storage.setItem(key, value);
      },
    };
    assert.equal(saveRun(guarded, checkpoint()), false);
    assert.equal(storage.data.get(RUN_STORAGE_KEY), original);
    assert.equal(storage.writes.includes(RUN_STORAGE_KEY), false);
  }
});

test("failed primary write retains both original and recovery and can be retried", () => {
  const storage = store(), first = checkpoint(), original = "rejected record";
  storage.data.set(RUN_STORAGE_KEY, original);
  const guarded: RunStorage = { getItem: storage.getItem, setItem(key, value) {
    if (key === RUN_STORAGE_KEY) throw new Error("quota");
    storage.setItem(key, value);
  } };
  assert.equal(saveRun(guarded, first), false);
  assert.equal(storage.getItem(RUN_STORAGE_KEY), original);
  assert.equal(storage.getItem(RUN_RECOVERY_STORAGE_KEY), original);
  assert.equal(saveRun(storage, first), true);
  assert.deepEqual(loadRun(storage), first);
});
