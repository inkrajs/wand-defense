import assert from 'node:assert/strict';
import test from 'node:test';
import type { ContentCatalog, RewardOption } from '../contracts';
import { demoContent } from './demo';
import { gradeOrder } from './grades';
import { createWaveRewards } from './rewards';
import {
  dedupeRewardOffers,
  fillUniqueRewardOffers,
  getRewardOfferKey,
  rewardBuffValues,
  sampleWaveRewards,
} from './randomRewards';

function sequence(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

const input = { wave: 7, characterCount: 1, wandCount: 1, content: demoContent };
const buff = (id: string, type: NonNullable<RewardOption['effect']>['type'],
  grade: RewardOption['grade'] = 'common', value = 10): RewardOption => ({
  id, kind: 'buff', label: id, grade, effect: { type, value },
});
const item = (id: string, definitionId: string, grade: RewardOption['grade'] = 'common'): RewardOption => ({
  id, kind: 'item', definitionId, label: id, grade,
});
const coins = (id: string, amount: number, grade: RewardOption['grade'] = 'common'): RewardOption => ({
  id, kind: 'coins', amount, label: id, grade,
});

test('a constant zero draw returns four distinct buffs instead of repeating the attack stat', () => {
  const cards = sampleWaveRewards({ ...input, random: () => 0 });
  assert.equal(cards.length, 4);
  assert.deepEqual(cards.map(card => card.id), ['reward-7-0', 'reward-7-1', 'reward-7-2', 'reward-7-3']);
  assert.ok(cards.every(card => card.kind === 'buff' && card.grade === 'common'));
  assert.deepEqual(cards.map(card => card.effect?.type), ['attackPercent', 'maxMana', 'manaRegen', 'rangePercent']);
  assert.equal(new Set(cards.map(getRewardOfferKey)).size, 4);
});

test('semantic keys ignore buff grade and value, coin amount, and item presentation while distinguishing definitions', () => {
  assert.equal(getRewardOfferKey(buff('buff-low', 'attackPercent', 'common', 10)),
    getRewardOfferKey(buff('buff-high', 'attackPercent', 'mythic', 50)));
  assert.equal(getRewardOfferKey(buff('luck-low', 'luck', 'common', 1)), 'buff:luck');
  assert.equal(getRewardOfferKey(buff('luck-high', 'luck', 'mythic', 8)), 'buff:luck');
  assert.equal(getRewardOfferKey(buff('gather-low', 'gatheringPercent', 'common', 5)), 'buff:gatheringPercent');
  assert.equal(getRewardOfferKey(buff('gather-high', 'gatheringPercent', 'mythic', 25)), 'buff:gatheringPercent');
  assert.equal(getRewardOfferKey(coins('coin-10', 10)), getRewardOfferKey(coins('coin-15', 15, 'rare')));
  assert.equal(getRewardOfferKey(item('spell-a', 'fireball', 'common')), getRewardOfferKey(item('spell-b', 'fireball', 'mythic')));
  assert.notEqual(getRewardOfferKey(item('spell-a', 'fireball')), getRewardOfferKey(item('spell-b', 'spark')));
  assert.equal(getRewardOfferKey({ id: 'char-a', kind: 'character', label: '同行者 A' }),
    getRewardOfferKey({ id: 'char-b', kind: 'character', label: '同行者 B' }));
  assert.equal(getRewardOfferKey({ id: 'wand-a', kind: 'wand', label: '法杖 A' }),
    getRewardOfferKey({ id: 'wand-b', kind: 'wand', label: '法杖 B' }));
  assert.notEqual(getRewardOfferKey({ id: 'character', kind: 'character', label: '同行者' }),
    getRewardOfferKey({ id: 'wand', kind: 'wand', label: '法杖' }));

  const firstBuff = buff('first', 'attackPercent', 'common', 10);
  const sameStat = dedupeRewardOffers([firstBuff, buff('second', 'attackPercent', 'mythic', 50)]);
  assert.equal(sameStat.length, 1);
  assert.equal(sameStat[0].id, 'first');
  assert.equal(sameStat[0], firstBuff);
  const coinOffers = dedupeRewardOffers([coins('ten', 10), coins('fifteen', 15)]);
  assert.deepEqual(coinOffers.map(card => card.id), ['ten']);
  const magicOffers = dedupeRewardOffers([item('first', 'spark'), item('second', 'fireball')]);
  assert.deepEqual(magicOffers.map(card => card.definitionId), ['spark', 'fireball']);
});

test('filling keeps first unique objects and slots, replacing duplicate offers with fresh stable IDs', () => {
  const firstItem = item('slot-fireball', 'fireball', 'rare');
  const duplicateItem = item('old-duplicate-slot', 'fireball', 'mythic');
  const laterBuff = buff('slot-attack', 'attackPercent');
  const laterCoins = coins('slot-coins', 20);
  const original = [firstItem, duplicateItem, laterBuff, laterCoins];
  const cards = fillUniqueRewardOffers(original, { ...input, random: () => 0 });

  assert.equal(cards.length, 4);
  assert.equal(cards[0], firstItem);
  assert.equal(cards[1].id, 'old-duplicate-slot:unique-v1');
  assert.notEqual(cards[1].id, duplicateItem.id, 'replacement must not reuse an old slot ID');
  assert.equal(cards[2], laterBuff);
  assert.equal(cards[3], laterCoins);
  assert.deepEqual(cards.map(getRewardOfferKey), [
    'item:fireball', 'buff:maxMana', 'buff:attackPercent', 'coins',
  ]);
  assert.equal(new Set(cards.map(getRewardOfferKey)).size, cards.length);
});

test('complete unique existing offers preserve references and consume no random values', () => {
  const existing = [
    buff('a', 'attackPercent'), buff('b', 'maxMana'), buff('c', 'manaRegen'), buff('d', 'rangePercent'),
  ];
  let draws = 0;
  const cards = fillUniqueRewardOffers(existing, { ...input, random: () => { draws++; return 0; } });
  assert.deepEqual(cards, existing);
  cards.forEach((card, index) => assert.equal(card, existing[index]));
  assert.equal(draws, 0);
});

test('different unique offers with repeated legacy IDs keep IDs unique without replacing the first card', () => {
  const first = buff('shared-slot', 'attackPercent');
  const second = item('shared-slot', 'fireball');
  const third = coins('shared-slot', 10);
  const cards = fillUniqueRewardOffers([first, second, third], { ...input, random: () => 0 }, 3);
  assert.equal(cards[0], first);
  assert.deepEqual(cards.map(card => card.id), [
    'shared-slot', 'shared-slot:unique-v1', 'shared-slot:unique-v2',
  ]);
  assert.equal(new Set(cards.map(card => card.id)).size, 3);
  assert.deepEqual(cards.slice(0, 3), [first, { ...second, id: 'shared-slot:unique-v1' }, { ...third, id: 'shared-slot:unique-v2' }]);
});

test('replacement IDs reserve every old slot ID, including IDs belonging to other duplicate slots', () => {
  const firstBuff = buff('keep-buff', 'attackPercent');
  const firstItem = item('keep-item', 'fireball');
  const oldIds = ['repeat', 'repeat:unique-v1'];
  const existing = [
    firstBuff,
    buff(oldIds[0], 'attackPercent'),
    firstItem,
    item(oldIds[1], 'fireball'),
  ];
  const random = () => 0;
  const cards = fillUniqueRewardOffers(existing, { ...input, random });
  const repeatedRun = fillUniqueRewardOffers(existing, { ...input, random });

  assert.equal(cards[0], firstBuff);
  assert.equal(cards[2], firstItem);
  assert.deepEqual(cards.map(card => card.id), repeatedRun.map(card => card.id));
  assert.ok(oldIds.every(id => !cards.some(card => card.id === id)));
  assert.equal(new Set(cards.map(card => card.id)).size, cards.length);
  assert.equal(new Set(cards.map(getRewardOfferKey)).size, cards.length);
});

test('different magic definitions can fill multiple item slots and grades remain independently sampled', () => {
  const itemOnly = sampleWaveRewards({ ...input, random: () => 0.5 });
  assert.equal(itemOnly.length, 4);
  assert.ok(itemOnly.every(card => card.kind === 'item'));
  assert.equal(new Set(itemOnly.map(card => card.definitionId)).size, 4);

  const gradeRolls = [0.3, 0.7, 0.88, 0.96, 0.985, 0.999];
  const types = Object.keys(rewardBuffValues) as (keyof typeof rewardBuffValues)[];
  for (const [typeIndex, type] of types.entries()) for (const [rank, gradeRoll] of gradeRolls.entries()) {
    const cards = fillUniqueRewardOffers([], {
      ...input, random: sequence([0, (typeIndex + 0.5) / types.length, gradeRoll]),
    }, 1);
    assert.equal(cards[0].grade, gradeOrder[rank]);
    assert.deepEqual(cards[0].effect, { type, value: rewardBuffValues[type][rank] });
    assert.ok(cards[0].description);
    assert.ok(cards[0].details?.length);
  }
});

test('luck and gathering have six grade values and duplicate offers ignore amount and grade', () => {
  assert.deepEqual(rewardBuffValues.luck, [1, 2, 3, 4, 6, 8]);
  assert.deepEqual(rewardBuffValues.gatheringPercent, [5, 8, 10, 15, 20, 25]);
  const firstLuck = buff('luck-first', 'luck', 'common', 1);
  const duplicateLuck = buff('luck-duplicate', 'luck', 'mythic', 8);
  const firstGathering = buff('gathering-first', 'gatheringPercent', 'common', 5);
  const duplicateGathering = buff('gathering-duplicate', 'gatheringPercent', 'mythic', 25);
  const deduped = dedupeRewardOffers([firstLuck, duplicateLuck, firstGathering, duplicateGathering]);
  assert.deepEqual(deduped, [firstLuck, firstGathering]);
  assert.equal(deduped[0], firstLuck);
  assert.equal(deduped[1], firstGathering);

  const cards = fillUniqueRewardOffers([], {
    ...input, random: sequence([0, 1, 0, 0, 1, 0]),
  }, 2);
  assert.equal(cards.filter(card => card.kind === 'buff' && card.effect?.type === 'luck').length, 1);
  assert.equal(new Set(cards.map(getRewardOfferKey)).size, cards.length);
});

test('default seeded reward generation is deterministic for the same wave', () => {
  assert.deepEqual(createWaveRewards(23, 1, 1, demoContent), createWaveRewards(23, 1, 1, demoContent));
});

test('the finite pool returns fewer offers when eligible semantics run out', () => {
  const empty: ContentCatalog = { spells: {}, arcana: {}, recipes: [], sequences: {} };
  const cards = fillUniqueRewardOffers([], {
    ...input, characterCount: 3, wandCount: 6, canHeal: false, cooldownCapped: true,
    content: empty, random: () => 0,
  }, 10);
  assert.equal(cards.length, 7, 'six distinct buffs plus one coin offer exhaust this eligible pool');
  assert.equal(new Set(cards.map(getRewardOfferKey)).size, 7);
  assert.deepEqual(cards.map(getRewardOfferKey), [
    'buff:attackPercent', 'buff:maxMana', 'buff:manaRegen', 'buff:rangePercent', 'buff:luck', 'buff:gatheringPercent', 'coins',
  ]);
});

test('ineligible recruit, wand, heal and item candidates are excluded before finite draws', () => {
  const empty: ContentCatalog = { spells: {}, arcana: {}, recipes: [], sequences: {} };
  for (let roll = 0; roll <= 100; roll++) {
    const cards = sampleWaveRewards({ ...input, characterCount: 3, wandCount: 6, canHeal: false, content: empty, random: () => roll / 100 });
    assert.equal(cards.length, 4);
    assert.ok(cards.every(card => card.kind === 'buff' || card.kind === 'coins'));
    assert.equal(new Set(cards.map(getRewardOfferKey)).size, cards.length);
  }
});

test('nonfinite and out-of-range random values stay within the finite unique pool and valid grades', () => {
  for (const value of [NaN, Infinity, -Infinity, -1, 1, Number.MAX_VALUE]) {
    const cards = sampleWaveRewards({ ...input, random: () => value });
    assert.equal(cards.length, 4);
    assert.equal(new Set(cards.map(getRewardOfferKey)).size, 4);
    assert.ok(cards.every(card => card.grade !== undefined && gradeOrder.includes(card.grade)));
    for (const card of cards) {
      assert.ok(card.label);
      if (card.effect) assert.ok(Number.isFinite(card.effect.value) && card.effect.value > 0);
      if (card.amount !== undefined) assert.ok(Number.isFinite(card.amount) && card.amount > 0);
    }
  }
});

test('cooldown-capped sampling removes only that buff semantic and keeps deterministic type coverage', () => {
  const otherTypes = ['attackPercent', 'maxMana', 'manaRegen', 'rangePercent', 'luck', 'gatheringPercent'] as const;
  for (const [index, type] of otherTypes.entries()) {
    const cards = fillUniqueRewardOffers([], {
      ...input, cooldownCapped: true, random: sequence([0, (index + 0.5) / otherTypes.length, 0]),
    }, 1);
    assert.equal(cards[0].kind, 'buff');
    assert.equal(cards[0].effect?.type, type);
    assert.equal(cards[0].effect?.value, rewardBuffValues[type][0]);
  }
  const upperBoundary = fillUniqueRewardOffers([], { ...input, cooldownCapped: true, random: sequence([0, 1, 0]) }, 1);
  assert.equal(upperBoundary[0].effect?.type, 'gatheringPercent');
  const uncapped = fillUniqueRewardOffers([], { ...input, random: sequence([0, 0.65, 0]) }, 1);
  assert.equal(uncapped[0].effect?.type, 'cooldownPercent');
});
