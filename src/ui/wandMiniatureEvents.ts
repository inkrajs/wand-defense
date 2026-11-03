import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameEvent, GameState, Id } from "../contracts";

const FLASH_EVENT_TYPES = new Set(["projectileSpawned", "beamSpawned", "heal", "shieldRestored"]);
const FLASH_DURATION_MS = 420;
const MAX_ACTIVE_FLASHES = 64;

export type CastFlashTarget = { wandId: Id; itemId: Id };
export type CastFlashLookup = { has(wandId: Id, itemId: Id): boolean };
export type CastFlashBatch = { nextSeq: number; targets: CastFlashTarget[] };
export type CastFlashCursor = { runId: Id; nextSeq: number };
export type RunCastFlashBatch = { cursor: CastFlashCursor; targets: CastFlashTarget[]; runChanged: boolean };
type CastFlashState = { runId: Id; expiresAt: ReadonlyMap<string, number> };
const EMPTY_EXPIRES_AT: ReadonlyMap<string, number> = new Map();

export function castFlashKey(wandId: Id, itemId: Id): string {
  return JSON.stringify([wandId, itemId]);
}

/** Resolves only authoritative source fields and a unique live equipped placement. */
export function collectNewCastFlashes(state: GameState, afterSeq: number): CastFlashBatch {
  const nextSeq = Number.isSafeInteger(state.nextEventSeq) ? Math.max(afterSeq, state.nextEventSeq) : afterSeq;
  const fresh = state.events
    .filter(event => event.seq >= afterSeq && event.seq < nextSeq && FLASH_EVENT_TYPES.has(event.type))
    .sort((left, right) => left.seq - right.seq);
  const targets = new Map<string, CastFlashTarget>();
  for (const event of fresh) {
    const target = resolveCastFlashTarget(state, event);
    if (target) targets.set(castFlashKey(target.wandId, target.itemId), target);
  }
  return { nextSeq, targets: [...targets.values()] };
}

export function collectRunCastFlashes(state: GameState, cursor: CastFlashCursor): RunCastFlashBatch {
  if (cursor.runId !== state.id) {
    return { cursor: { runId: state.id, nextSeq: state.nextEventSeq }, targets: [], runChanged: true };
  }
  const batch = collectNewCastFlashes(state, cursor.nextSeq);
  return { cursor: { runId: state.id, nextSeq: batch.nextSeq }, targets: batch.targets, runChanged: false };
}

export function isCastFlashActive(currentRunId: Id, flashRunId: Id, expiresAt: number | undefined, now = Date.now()): boolean {
  return currentRunId === flashRunId && expiresAt !== undefined && expiresAt > now;
}

function resolveCastFlashTarget(state: GameState, event: GameEvent): CastFlashTarget | undefined {
  const characterId = event.data.sourceCharacterId;
  const itemId = event.data.sourceItemId;
  if (typeof characterId !== "string" || typeof itemId !== "string") return undefined;
  const character = state.characters.find(entry => entry.id === characterId);
  if (!character) return undefined;
  const equippedIds = new Set(character.wandIds);
  const matches = state.wands.filter(wand => equippedIds.has(wand.id)
    && wand.characterId === character.id
    && wand.placements.some(placement => placement.itemId === itemId));
  return matches.length === 1 ? { wandId: matches[0].id, itemId } : undefined;
}

/** Starts at the live sequence head, so mounting never replays retained history. */
export function useCastFlashes(state: GameState): CastFlashLookup {
  const cursor = useRef<CastFlashCursor>({ runId: state.id, nextSeq: state.nextEventSeq });
  const [flashState, setFlashState] = useState<CastFlashState>(() => ({ runId: state.id, expiresAt: new Map() }));

  useEffect(() => {
    const batch = collectRunCastFlashes(state, cursor.current);
    cursor.current = batch.cursor;
    if (batch.runChanged) {
      setFlashState({ runId: state.id, expiresAt: new Map() });
      return;
    }
    if (!batch.targets.length) return;
    const deadline = Date.now() + FLASH_DURATION_MS;
    setFlashState(previous => {
      const now = Date.now();
      const source = previous.runId === state.id ? previous.expiresAt : EMPTY_EXPIRES_AT;
      const next = new Map([...source].filter(([, expiry]) => expiry > now));
      for (const target of batch.targets) next.set(castFlashKey(target.wandId, target.itemId), deadline);
      while (next.size > MAX_ACTIVE_FLASHES) {
        const oldest = next.keys().next().value;
        if (oldest === undefined) break;
        next.delete(oldest);
      }
      return { runId: state.id, expiresAt: next };
    });
  }, [state.id, state.events, state.nextEventSeq, state.characters, state.wands]);

  useEffect(() => {
    if (flashState.runId !== state.id) return;
    const expiresAt = flashState.expiresAt;
    if (!expiresAt.size) return;
    const soonest = Math.min(...expiresAt.values());
    const timer = setTimeout(() => {
      const now = Date.now();
      setFlashState(previous => previous.runId !== state.id ? previous : {
        runId: state.id,
        expiresAt: new Map([...previous.expiresAt].filter(([, expiry]) => expiry > now)),
      });
    }, Math.max(0, soonest - Date.now()));
    return () => clearTimeout(timer);
  }, [flashState, state.id]);

  return useMemo(() => ({
    has(wandId: Id, itemId: Id) {
      const expiry = flashState.runId === state.id
        ? flashState.expiresAt.get(castFlashKey(wandId, itemId))
        : undefined;
      return isCastFlashActive(state.id, flashState.runId, expiry);
    },
  }), [flashState, state.id]);
}
