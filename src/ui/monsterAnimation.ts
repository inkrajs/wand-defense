import { useEffect, useMemo, useRef, useState } from "react";
import type { GameState, Id } from "../contracts";

export const MONSTER_ATTACK_BOB_MS = 420;
const MAX_ACTIVE_MONSTER_BOBS = 32;

export type MonsterAttackCursor = { runId: Id; nextSeq: number };
export type MonsterAttackPulse = { entityId: Id; eventSeq: number };
export type MonsterAttackBatch = { nextSeq: number; pulses: MonsterAttackPulse[] };
export type RunMonsterAttackBatch = { cursor: MonsterAttackCursor; pulses: MonsterAttackPulse[]; runChanged: boolean };
type ActiveMonsterBob = { eventSeq: number; expiresAt: number };
type MonsterBobState = { runId: Id; active: ReadonlyMap<Id, ActiveMonsterBob> };

/** Collect only newly emitted, authoritative territory attacks from live enemy entities. */
export function collectNewMonsterAttacks(state: GameState, afterSeq: number): MonsterAttackBatch {
  const nextSeq = Number.isSafeInteger(state.nextEventSeq) ? Math.max(afterSeq, state.nextEventSeq) : afterSeq;
  const enemyIds = new Set(state.entities.filter(entity => entity.kind === "enemy").map(entity => entity.id));
  const pulses = new Map<Id, MonsterAttackPulse>();
  for (const event of state.events) {
    if (event.seq < afterSeq || event.seq >= nextSeq || event.type !== "territoryAttacked") continue;
    const entityId = event.data.sourceEntityId;
    if (typeof entityId !== "string" || !enemyIds.has(entityId)) continue;
    pulses.delete(entityId);
    pulses.set(entityId, { entityId, eventSeq: event.seq });
    while (pulses.size > MAX_ACTIVE_MONSTER_BOBS) {
      const oldest = pulses.keys().next().value;
      if (oldest === undefined) break;
      pulses.delete(oldest);
    }
  }
  return { nextSeq, pulses: [...pulses.values()] };
}

export function collectRunMonsterAttacks(state: GameState, cursor: MonsterAttackCursor): RunMonsterAttackBatch {
  if (cursor.runId !== state.id) {
    return { cursor: { runId: state.id, nextSeq: state.nextEventSeq }, pulses: [], runChanged: true };
  }
  const batch = collectNewMonsterAttacks(state, cursor.nextSeq);
  return { cursor: { runId: state.id, nextSeq: batch.nextSeq }, pulses: batch.pulses, runChanged: false };
}

/** Starts at the current event head, so retained history never replays on mount or run change. */
export function useMonsterAttackBobs(state: GameState): (entityId: Id) => number | undefined {
  const cursor = useRef<MonsterAttackCursor>({ runId: state.id, nextSeq: state.nextEventSeq });
  const [bobState, setBobState] = useState<MonsterBobState>(() => ({ runId: state.id, active: new Map() }));

  useEffect(() => {
    const batch = collectRunMonsterAttacks(state, cursor.current);
    cursor.current = batch.cursor;
    if (batch.runChanged) {
      setBobState({ runId: state.id, active: new Map() });
      return;
    }
    if (!batch.pulses.length) return;
    const deadline = Date.now() + MONSTER_ATTACK_BOB_MS;
    setBobState(previous => {
      const now = Date.now();
      const next = new Map([...((previous.runId === state.id) ? previous.active : [])]
        .filter(([, active]) => active.expiresAt > now));
      for (const pulse of batch.pulses) {
        next.delete(pulse.entityId);
        next.set(pulse.entityId, { eventSeq: pulse.eventSeq, expiresAt: deadline });
      }
      while (next.size > MAX_ACTIVE_MONSTER_BOBS) {
        const oldest = next.keys().next().value;
        if (oldest === undefined) break;
        next.delete(oldest);
      }
      return { runId: state.id, active: next };
    });
  }, [state.id, state.events, state.nextEventSeq, state.entities]);

  useEffect(() => {
    if (bobState.runId !== state.id || !bobState.active.size) return;
    const soonest = Math.min(...[...bobState.active.values()].map(active => active.expiresAt));
    const timer = setTimeout(() => {
      const now = Date.now();
      setBobState(previous => previous.runId !== state.id ? previous : {
        runId: state.id,
        active: new Map([...previous.active].filter(([, active]) => active.expiresAt > now)),
      });
    }, Math.max(0, soonest - Date.now()));
    return () => clearTimeout(timer);
  }, [bobState, state.id]);

  return useMemo(() => (entityId: Id) => {
    if (bobState.runId !== state.id) return undefined;
    const active = bobState.active.get(entityId);
    return active && active.expiresAt > Date.now() ? active.eventSeq : undefined;
  }, [bobState, state.id]);
}
