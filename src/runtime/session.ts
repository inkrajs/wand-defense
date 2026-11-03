import type { RuntimeCheckpoint } from "./index";

export const RUN_STORAGE_KEY = "wand-defense:run:v1";
export type RunStorage = Pick<Storage, "getItem" | "setItem">;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Versioned, per-tab checkpoint; never sent through the player-visible protocol. */
export function loadRun(storage?: RunStorage): RuntimeCheckpoint | undefined {
  try {
    const raw = storage?.getItem(RUN_STORAGE_KEY);
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

export function saveRun(storage: RunStorage | undefined, checkpoint: RuntimeCheckpoint): boolean {
  if (!storage) return false;
  try { storage.setItem(RUN_STORAGE_KEY, JSON.stringify(checkpoint)); return true; }
  catch { return false; }
}
