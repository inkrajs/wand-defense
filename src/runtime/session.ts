import type { RuntimeCheckpoint } from "./index";
import type { GameEvent, GameState } from "../contracts";

/** Save each wave's entry and outcome; refreshing combat retries its saved entry. */
export function shouldPersistRunChange(state: Pick<GameState, "phase">, events: readonly GameEvent[]): boolean {
  return state.phase !== "battle" || events.some(event => event.type === "waveStarted");
}

export const RUN_STORAGE_KEY = "wand-defense:run:v1";
export const RUN_RECOVERY_STORAGE_KEY = "wand-defense:run:recovery:v1";
export type RunStorage = Pick<Storage, "getItem" | "setItem">;
export type RunReadResult =
  | { status: "loaded"; checkpoint: RuntimeCheckpoint }
  | { status: "empty" | "rejected" | "unavailable" };
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function parseRun(raw: string | null): RuntimeCheckpoint | undefined {
  try {
    if (!raw) return;
    const saved: unknown = JSON.parse(raw);
    if (!record(saved) || saved.checkpointVersion !== 1 || !record(saved.state) ||
      typeof saved.pausedBeforeBackpack !== "boolean" || !Array.isArray(saved.results)) return;
    const state = saved.state;
    if (state.schemaVersion !== 1 || typeof state.id !== "string" ||
      !["ready", "battle", "reward", "defeat"].includes(String(state.phase)) ||
      !Number.isSafeInteger(state.revision) || !Number.isSafeInteger(state.nextEventSeq) ||
      typeof state.paused !== "boolean" || typeof state.backpackOpen !== "boolean" ||
      !record(state.territory) || !record(state.items) || !record(state.knowledge) || !record(state.cheats) ||
      !["characters", "wands", "backpack", "entities", "rewards", "events"].every(key => Array.isArray(state[key])) ||
      !saved.results.every(entry => Array.isArray(entry) && entry.length === 2 &&
        typeof entry[0] === "string" && record(entry[1]) &&
        ["accepted", "executed", "rejected"].includes(String(entry[1].status)))) return;
    return saved as unknown as RuntimeCheckpoint;
  } catch { return; }
}

/** Read without writes, retaining the reason a checkpoint could not be loaded. */
export function readRun(storage?: RunStorage): RunReadResult {
  if (!storage) return { status: "unavailable" };
  try {
    const raw = storage.getItem(RUN_STORAGE_KEY);
    if (raw === null) return { status: "empty" };
    const checkpoint = parseRun(raw);
    return checkpoint ? { status: "loaded", checkpoint } : { status: "rejected" };
  } catch { return { status: "unavailable" }; }
}

/** Prefer the durable run; migrate a valid tab save only when no durable run exists. */
export function readPersistentRun(storage?: RunStorage, legacyTabStorage?: RunStorage): RunReadResult {
  const persisted = readRun(storage);
  if (persisted.status !== "empty") return persisted;
  const legacy = readRun(legacyTabStorage);
  if (legacy.status !== "loaded") return persisted;
  // Keep the tab record intact, including when a quota/write failure prevents
  // migration. The loaded game can continue and retry saving on its next change.
  saveRun(storage, legacy.checkpoint);
  return legacy;
}

/** Compatibility wrapper for callers that only need a valid checkpoint. */
export function loadRun(storage?: RunStorage): RuntimeCheckpoint | undefined {
  const result = readRun(storage);
  return result.status === "loaded" ? result.checkpoint : undefined;
}

export function saveRun(storage: RunStorage | undefined, checkpoint: RuntimeCheckpoint): boolean {
  if (!storage) return false;
  try {
    const serialized = JSON.stringify(checkpoint);
    const previous = storage.getItem(RUN_STORAGE_KEY);
    if (previous !== null && !parseRun(previous)) {
      // Keep the exact rejected record before replacing it. One recovery slot is
      // intentional: never evict different evidence to make a fresh run fit.
      const recovery = storage.getItem(RUN_RECOVERY_STORAGE_KEY);
      if (recovery !== null && recovery !== previous) return false;
      if (recovery === null) storage.setItem(RUN_RECOVERY_STORAGE_KEY, previous);
      if (storage.getItem(RUN_RECOVERY_STORAGE_KEY) !== previous) return false;
    }
    storage.setItem(RUN_STORAGE_KEY, serialized);
    return true;
  }
  catch { return false; }
}
