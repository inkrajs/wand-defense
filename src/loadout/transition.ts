import type { Command, CommandTransition, GameEvent, GameState } from "../contracts";

export function reject(state: GameState, command: Command, code: string, message: string): CommandTransition {
  return {
    state,
    events: [],
    result: { commandId: command.id, status: "rejected", revision: state.revision, code, message }
  };
}

export function commit(state: GameState, command: Command, changes: Partial<GameState>, type: string, data: Record<string, unknown>): CommandTransition {
  const event: GameEvent = {
    seq: state.nextEventSeq,
    type,
    gameTimeMs: state.gameTimeMs,
    data: { commandId: command.id, ...data }
  };
  const next: GameState = {
    ...state,
    ...changes,
    revision: state.revision + 1,
    nextEventSeq: state.nextEventSeq + 1,
    events: [...state.events, event]
  };
  return {
    state: next,
    events: [event],
    result: { commandId: command.id, status: "executed", revision: next.revision }
  };
}

/** Detached items retain their cooldown in a wand ledger until placed again. */
export function maxItemCooldown(state: GameState, itemIds: readonly string[]): number {
  let remaining = 0;
  for (const wand of state.wands) for (const id of itemIds) {
    const value = wand.cooldowns[id];
    if (Number.isFinite(value)) remaining = Math.max(remaining, value);
  }
  return remaining;
}
