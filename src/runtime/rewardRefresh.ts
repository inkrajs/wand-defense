import type { GameState, RewardRefreshQuote, RewardRefreshState } from "../contracts";

const safeCounter = (value: unknown): number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;

function normalizeWave(wave: number): number {
  return Number.isFinite(wave) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(wave))) : 0;
}

/** Only free usage resets across waves. Run-wide counters survive checkpoints. */
export function normalizeRewardRefresh(value: unknown, wave: number): RewardRefreshState {
  const currentWave = normalizeWave(wave);
  const saved = value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
  return {
    wave: currentWave,
    freeUsed: saved?.wave === currentWave ? safeCounter(saved.freeUsed) : 0,
    paidCount: safeCounter(saved?.paidCount),
    refreshCount: safeCounter(saved?.refreshCount),
  };
}

/** Pure quote: no coins, counters, offers or random state are changed. */
export function getRewardRefreshQuote(state: GameState): RewardRefreshQuote {
  const refresh = normalizeRewardRefresh(state.rewardRefresh, state.wave);
  const freeTotal = Math.floor(refresh.wave / 10);
  const freeRemaining = Math.max(0, freeTotal - refresh.freeUsed);
  const price = 3 ** refresh.paidCount;
  const nextPaidCost = Number.isSafeInteger(price) && price > 0 ? price : null;
  const cost = freeRemaining > 0 ? 0 : nextPaidCost;
  return {
    freeTotal,
    freeRemaining,
    paidCount: refresh.paidCount,
    nextPaidCost,
    cost,
    canRefresh: state.phase === "reward" && Array.isArray(state.rewards) && state.rewards.length > 0
      && refresh.refreshCount < Number.MAX_SAFE_INTEGER && cost !== null
      && Number.isSafeInteger(state.coins) && state.coins >= cost,
  };
}
