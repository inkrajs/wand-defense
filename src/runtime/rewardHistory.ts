import type { ClaimedReward, GameState, RewardOption } from '../contracts';
import { gradeOrder } from '../content/grades';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max = 4096): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
const natural = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const kinds = ['buff', 'item', 'heal', 'coins', 'character', 'wand'];
const buffs = ['attackPercent', 'maxMana', 'manaRegen', 'rangePercent', 'cooldownPercent', 'luck', 'gatheringPercent'];

/** Copy only bounded reward schema fields, never arbitrary event payload properties. */
export function snapshotRewardOption(value: unknown): RewardOption | undefined {
  if (!record(value) || !text(value.id, 160) || !text(value.label) || !kinds.includes(value.kind as string)) return;
  if (value.definitionId !== undefined && !text(value.definitionId, 160)) return;
  if (value.grade !== undefined && !gradeOrder.includes(value.grade as NonNullable<RewardOption['grade']>)) return;
  if (value.amount !== undefined && !finite(value.amount)) return;
  if (value.description !== undefined && !text(value.description)) return;
  if (value.effect !== undefined && (!record(value.effect) || !buffs.includes(value.effect.type as string) || !finite(value.effect.value) || value.effect.value <= 0)) return;
  if (value.details !== undefined && (!Array.isArray(value.details) || value.details.length > 64 || !value.details.every(detail => record(detail) && text(detail.label, 256) && text(detail.value)))) return;
  const result: RewardOption = { id: value.id, kind: value.kind as RewardOption['kind'], label: value.label };
  if (typeof value.definitionId === 'string') result.definitionId = value.definitionId;
  if (value.grade !== undefined) result.grade = value.grade as RewardOption['grade'];
  if (typeof value.amount === 'number') result.amount = value.amount;
  if (typeof value.description === 'string') result.description = value.description;
  if (record(value.effect)) result.effect = { type: value.effect.type as NonNullable<RewardOption['effect']>['type'], value: value.effect.value as number };
  if (Array.isArray(value.details)) result.details = value.details.map(detail => ({ label: detail.label, value: detail.value }));
  return result;
}

export function createClaimedReward(reward: RewardOption, wave: number, gameTimeMs: number, eventSeq: number): ClaimedReward {
  return { id: `reward-claim-${eventSeq}`, wave, gameTimeMs, reward: structuredClone(reward) };
}

/** Restore only evidence retained by the checkpoint. No inference from bonuses, seeds or current inventory. */
export function restoreRewardHistory(state: GameState): { rewardHistory: ClaimedReward[]; rewardHistoryComplete: boolean } {
  const history: ClaimedReward[] = [];
  const ids = new Set<string>();
  if (Array.isArray(state.rewardHistory)) {
    let complete = state.rewardHistoryComplete === true;
    for (const entry of state.rewardHistory) {
      const reward = record(entry) ? snapshotRewardOption(entry.reward) : undefined;
      if (!record(entry) || !text(entry.id, 256) || !natural(entry.wave) || !finite(entry.gameTimeMs) || !reward || ids.has(entry.id)) { complete = false; continue; }
      ids.add(entry.id);
      history.push({id: entry.id, wave: entry.wave, gameTimeMs: entry.gameTimeMs, reward});
    }
    return {rewardHistory: history, rewardHistoryComplete: complete};
  }
  const events = state.events;
  let restartIndex = -1;
  events.forEach((event, index) => { if (event.type === 'game.restarted') restartIndex = index; });
  const retained = restartIndex >= 0 ? events.slice(restartIndex) : events;
  let complete = state.rewardHistory === undefined && (retained.length === 0
    ? state.wave === 0 && state.nextEventSeq === 1
    : (retained[0].seq === 1 || retained[0].type === 'game.restarted') && retained.at(-1)!.seq === state.nextEventSeq - 1);
  let previousSeq: number | undefined;
  let offer: {wave: number; rewards: RewardOption[]} | undefined;
  for (const event of retained) {
    if (!natural(event.seq) || !finite(event.gameTimeMs) || (previousSeq !== undefined && event.seq !== previousSeq + 1)) complete = false;
    previousSeq = event.seq;
    if (event.type === 'reward.offered') {
      if (!record(event.data) || !natural(event.data.wave) || !Array.isArray(event.data.rewards) || event.data.rewards.length > 64) { complete = false; offer = undefined; continue; }
      const rewards = event.data.rewards.map(snapshotRewardOption);
      if (rewards.some(reward => !reward)) complete = false;
      offer = { wave: event.data.wave, rewards: rewards.filter((reward): reward is RewardOption => !!reward) };
    } else if (event.type === 'reward.claimed') {
      const matches = record(event.data) && text(event.data.rewardId, 160)
        ? offer?.rewards.filter(reward => reward.id === event.data.rewardId) ?? [] : [];
      if (matches.length === 1 && offer && natural(event.seq) && finite(event.gameTimeMs)
          && (event.data.kind === undefined || event.data.kind === matches[0].kind)) {
        const entry = createClaimedReward(matches[0], offer.wave, event.gameTimeMs, event.seq);
        if (ids.has(entry.id)) complete = false;
        else { ids.add(entry.id); history.push(entry); }
      } else complete = false;
      offer = undefined;
    }
  }
  return {rewardHistory: history, rewardHistoryComplete: complete};
}
