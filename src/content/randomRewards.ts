import type { ContentCatalog, Grade, RewardKind, RewardOption } from '../contracts';
import { gradeDefinitions, gradeOrder } from './grades';
import { enrichMagicReward } from './magicDescriptions';

export const rewardBuffValues = {
  attackPercent: [10, 15, 20, 30, 40, 50],
  maxMana: [10, 15, 20, 25, 35, 50],
  manaRegen: [1, 2, 3, 4, 6, 8],
  rangePercent: [5, 8, 10, 15, 20, 25],
  cooldownPercent: [4, 6, 8, 10, 12, 15],
  luck: [1, 2, 3, 4, 6, 8],
  gatheringPercent: [5, 8, 10, 15, 20, 25],
} as const;

type BuffType = keyof typeof rewardBuffValues;
const buffTypes = Object.keys(rewardBuffValues) as BuffType[];
export const rewardLuckDescription = '提高击杀金币、装备掉落概率及清波奖励品质和稀有内容概率。';
const buffMetadata: Record<BuffType, { name: string; unit: string; description: string }> = {
  attackPercent: { name: '攻击提升', unit: '%', description: '提升本局全队攻击魔法伤害，同类加成相加。' },
  maxMana: { name: '法力上限', unit: '', description: '增加本局每名角色的法力上限。' },
  manaRegen: { name: '法力回复', unit: '/秒', description: '增加本局每名角色每秒回复的法力。' },
  rangePercent: { name: '射程提升', unit: '%', description: '提升本局全队法术射程，同类加成相加。' },
  cooldownPercent: { name: '冷却缩减', unit: '%', description: '缩短本局全队法术冷却，同类加成相加，总缩减上限70%。' },
  luck: { name: '幸运', unit: '', description: rewardLuckDescription },
  gatheringPercent: { name: '采集', unit: '%', description: '提升本局全队金币收入，包括击杀、清波和金币奖励，同类加成相加。' },
};
const gradeWeights = [60, 22, 12, 4, 1.5, 0.5] as const;
const healValues = [20, 30, 40, 50, 70, 100] as const;
const coinValues = [10, 15, 20, 30, 40, 60] as const;
const kindWeights: Readonly<Partial<Record<RewardKind, number>>> = Object.freeze({
  buff: 45, item: 35, heal: 10, character: 5, wand: 5, coins: 10,
});

export interface WaveRewardSampling {
  wave: number;
  characterCount: number;
  wandCount: number;
  content: ContentCatalog;
  random: () => number;
  canHeal?: boolean;
  cooldownCapped?: boolean;
  /** Run luck once plus the current team's personal luck; supplied by runtime. */
  luck?: number;
}

type OfferCandidate =
  | { key: string; kind: 'buff'; type: BuffType }
  | { key: string; kind: 'item'; definitionId: string; definition: { name: string; level: number; shape: { x: number; y: number }[] } }
  | { key: string; kind: 'heal' | 'character' | 'wand' | 'coins' };

type CandidatePool = Partial<Record<RewardKind, OfferCandidate[]>>;

function unitRandom(random: () => number): number {
  const value = random();
  return Number.isFinite(value) ? Math.min(1 - Number.EPSILON, Math.max(0, value)) : 0;
}

function weighted<T>(entries: readonly { value: T; weight: number }[], random: () => number): T {
  let remaining = unitRandom(random) * entries.reduce((sum, entry) => sum + entry.weight, 0);
  for (const entry of entries) {
    remaining -= entry.weight;
    if (remaining < 0) return entry.value;
  }
  return entries[entries.length - 1].value;
}

function definitionIdOr(reward: RewardOption, fallback: string): string {
  return typeof reward.definitionId === 'string' && reward.definitionId.length > 0
    ? reward.definitionId
    : fallback;
}

/** Semantic offer identity, independent of grade, amount, display copy and slot ID. */
export function getRewardOfferKey(reward: RewardOption): string {
  switch (reward.kind) {
    case 'buff': return `buff:${reward.effect?.type ?? 'unknown'}`;
    case 'coins': return 'coins';
    case 'item': return `item:${definitionIdOr(reward, 'unknown')}`;
    case 'heal': return 'heal:territory-hp';
    case 'character': return `character:${definitionIdOr(reward, 'default')}`;
    case 'wand': return `wand:${definitionIdOr(reward, 'default')}`;
  }
}

/** Keeps the first card for each semantic offer without cloning or editing it. */
export function dedupeRewardOffers(existing: readonly RewardOption[]): RewardOption[] {
  const seen = new Set<string>();
  return existing.filter(reward => {
    const key = getRewardOfferKey(reward);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildCandidatePools(
  { wave, characterCount, wandCount, content, canHeal = true, cooldownCapped = false }: WaveRewardSampling,
  excludedKeys: ReadonlySet<string>,
): CandidatePool {
  const pools: CandidatePool = {};
  const add = (candidate: OfferCandidate) => {
    if (excludedKeys.has(candidate.key)) return;
    (pools[candidate.kind] ??= []).push(candidate);
  };

  for (const type of buffTypes) {
    if (cooldownCapped && type === 'cooldownPercent') continue;
    add({ key: `buff:${type}`, kind: 'buff', type });
  }

  const seenItems = new Set<string>();
  for (const [definitionId, definition] of [...Object.entries(content.spells), ...Object.entries(content.arcana)]) {
    if ('rewardMinWave' in definition && Number.isFinite(definition.rewardMinWave)
        && wave < definition.rewardMinWave!) continue;
    const key = `item:${definitionId}`;
    if (seenItems.has(key)) continue;
    seenItems.add(key);
    add({ key, kind: 'item', definitionId, definition });
  }

  if (canHeal) add({ key: 'heal:territory-hp', kind: 'heal' });
  if (Number.isFinite(characterCount) && characterCount >= 0 && characterCount < 3) {
    add({ key: 'character:default', kind: 'character' });
  }
  if (Number.isFinite(wandCount) && wandCount >= 0
      && Number.isFinite(characterCount) && wandCount < characterCount * 2) {
    add({ key: 'wand:default', kind: 'wand' });
  }
  add({ key: 'coins', kind: 'coins' });
  return pools;
}

/** Diminishing returns, bounded even for malformed input; consumes no RNG. */
function luckStrength(luck: number | undefined): number {
  const value = typeof luck === 'number' && Number.isFinite(luck) ? Math.min(1_000_000, Math.max(0, luck)) : 0;
  return value / (value + 20);
}

function availableKinds(pools: CandidatePool, strength: number): { value: RewardKind; weight: number }[] {
  return (Object.keys(kindWeights) as RewardKind[])
    .filter(kind => (pools[kind]?.length ?? 0) > 0)
    .map(kind => ({ value: kind, weight: kindWeights[kind]!
      * (kind === 'item' || kind === 'character' || kind === 'wand' ? 1 + 2 * strength : 1) }));
}

function takeCandidate(pools: CandidatePool, random: () => number, strength: number): OfferCandidate | undefined {
  const kinds = availableKinds(pools, strength);
  if (kinds.length === 0) return undefined;
  const kind = weighted(kinds, random);
  const candidates = pools[kind]!;
  const index = Math.floor(unitRandom(random) * candidates.length);
  return candidates.splice(index, 1)[0];
}

function sampleGrade(random: () => number, strength: number): Grade {
  return weighted(gradeOrder.map((value, index) => ({ value, weight: gradeWeights[index] * (1 + 3 * index * strength) })), random);
}

function makeReward(candidate: OfferCandidate, wave: number, index: number, grade: Grade, content: ContentCatalog): RewardOption {
  const rank = gradeOrder.indexOf(grade);
  const common = { id: `reward-${wave}-${index}`, kind: candidate.kind, grade };
  const rarity = { label: '品级', value: gradeDefinitions[grade].name };
  if (candidate.kind === 'buff') {
    const value = rewardBuffValues[candidate.type][rank];
    const meta = buffMetadata[candidate.type];
    return {
      ...common, label: `${meta.name} +${value}${meta.unit}`, description: meta.description,
      effect: { type: candidate.type, value },
      details: [{ label: meta.name, value: `+${value}${meta.unit}` }, { label: '持续时间', value: '本局' }, rarity],
    };
  }
  if (candidate.kind === 'item') {
    return enrichMagicReward({
      ...common, definitionId: candidate.definitionId, label: candidate.definition.name,
      details: [
        { label: '等级', value: String(candidate.definition.level) },
        { label: '占用格数', value: String(candidate.definition.shape.length) },
        rarity,
      ],
    }, content);
  }
  if (candidate.kind === 'heal') {
    const amount = healValues[rank];
    return { ...common, amount, label: '生命恢复', description: `领地恢复${amount}点生命，不超过生命上限，不恢复护盾。`, details: [{ label: '恢复量', value: String(amount) }, rarity] };
  }
  if (candidate.kind === 'character') {
    return { ...common, label: '同行者', description: '招募一名角色，携带一根初始法杖。', details: [{ label: '初始等级', value: '1' }, rarity] };
  }
  if (candidate.kind === 'wand') {
    return { ...common, label: '备用法杖', description: '获得一根3×3法杖，存入共享装备背包。', details: [{ label: '初始状态', value: '未装备' }, rarity] };
  }
  const amount = coinValues[rank];
  return { ...common, amount, label: '金币', description: `获得${amount}金币。`, details: [{ label: '获得数量', value: String(amount) }, rarity] };
}

function uniqueId(base: string, usedIds: ReadonlySet<string>, reservedIds: ReadonlySet<string> = new Set()): string {
  if (!usedIds.has(base) && !reservedIds.has(base)) return base;
  for (let version = 1; ; version++) {
    const candidate = `${base}:unique-v${version}`;
    if (!usedIds.has(candidate) && !reservedIds.has(candidate)) return candidate;
  }
}

function replacementId(base: string, usedIds: ReadonlySet<string>, reservedIds: ReadonlySet<string>): string {
  for (let version = 1; ; version++) {
    const candidate = `${base}:unique-v${version}`;
    if (!usedIds.has(candidate) && !reservedIds.has(candidate)) return candidate;
  }
}

function safeWave(wave: number): number {
  return Number.isFinite(wave) ? Math.max(0, Math.floor(wave)) : 0;
}

/**
 * Preserves the first existing card for each semantic offer and fills duplicate or missing slots
 * from the finite remaining pool. Replaced cards receive stable new slot IDs.
 */
export function fillUniqueRewardOffers(
  existing: readonly RewardOption[],
  sampling: WaveRewardSampling,
  count = 4,
): RewardOption[] {
  const targetCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (targetCount === 0) return [];

  const slots: Array<RewardOption | undefined> = [];
  const replacementBases = new Map<number, { id: string; replacesDuplicate: boolean }>();
  const usedKeys = new Set<string>();
  const usedIds = new Set<string>();
  const reservedOldIds = new Set(existing.map(reward => reward.id));
  const slotCount = Math.min(targetCount, existing.length);

  for (let index = 0; index < slotCount; index++) {
    const reward = existing[index];
    const key = getRewardOfferKey(reward);
    if (usedKeys.has(key)) {
      replacementBases.set(index, { id: reward.id, replacesDuplicate: true });
      continue;
    }
    usedKeys.add(key);
    const id = usedIds.has(reward.id)
      ? uniqueId(reward.id, usedIds, reservedOldIds)
      : reward.id;
    slots[index] = id === reward.id ? reward : { ...reward, id };
    usedIds.add(id);
  }

  for (let index = slotCount; index < targetCount; index++) {
    replacementBases.set(index, { id: `reward-${safeWave(sampling.wave)}-${index}`, replacesDuplicate: false });
  }

  if (replacementBases.size === 0) {
    return slots.filter((reward): reward is RewardOption => reward !== undefined);
  }

  const pools = buildCandidatePools(sampling, usedKeys);
  const strength = luckStrength(sampling.luck);
  for (const [index, slot] of replacementBases) {
    const candidate = takeCandidate(pools, sampling.random, strength);
    if (!candidate) continue;
    usedKeys.add(candidate.key);
    const reward = makeReward(candidate, safeWave(sampling.wave), index, sampleGrade(sampling.random, strength), sampling.content);
    const id = slot.replacesDuplicate
      ? replacementId(slot.id, usedIds, reservedOldIds)
      : uniqueId(slot.id, usedIds, reservedOldIds);
    slots[index] = { ...reward, id };
    usedIds.add(id);
  }

  return slots.filter((reward): reward is RewardOption => reward !== undefined);
}

/** Four weighted draws without replacement over semantic offers, or fewer if the finite pool runs out. */
export function sampleWaveRewards(sampling: WaveRewardSampling): RewardOption[] {
  return fillUniqueRewardOffers([], sampling, 4);
}
