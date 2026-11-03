import type { GameState } from "../contracts";

/** The single saved stream used by combat rolls and kill drops. */
export function nextCombatRandom(state:GameState):number {
  state.rngState=(Math.imul(state.rngState,1664525)+1013904223)>>>0;
  return state.rngState/0x1_0000_0000;
}
