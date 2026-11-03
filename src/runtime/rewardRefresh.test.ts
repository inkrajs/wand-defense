import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState } from "./initial";
import { getRewardRefreshQuote, normalizeRewardRefresh } from "./rewardRefresh";

function reward(wave = 1) {
  const state = createInitialState();
  state.phase = "reward";
  state.wave = wave;
  state.coins = 100;
  state.rewards = [{ id: "offer", kind: "coins", label: "金币", amount: 10 }];
  return state;
}

test("free refresh allowances change at wave ten boundaries and restart every wave", () => {
  for (const [wave, free] of [[1, 0], [9, 0], [10, 1], [19, 1], [20, 2], [31, 3]]) {
    assert.equal(getRewardRefreshQuote(reward(wave)).freeTotal, free);
  }
  const saved = Object.freeze({ wave: 10, freeUsed: 1, paidCount: 4, refreshCount: 7 });
  assert.deepEqual(normalizeRewardRefresh(saved, 10), saved);
  assert.deepEqual(normalizeRewardRefresh(saved, 11), { wave: 11, freeUsed: 0, paidCount: 4, refreshCount: 7 });
  assert.notEqual(normalizeRewardRefresh(saved, 10), saved);
});

test("free refreshes take priority without changing the global paid price", () => {
  const state = reward(20);
  state.coins = 0;
  state.rewardRefresh = { wave: 20, freeUsed: 1, paidCount: 5, refreshCount: 8 };
  assert.deepEqual(getRewardRefreshQuote(state), {
    freeTotal: 2, freeRemaining: 1, paidCount: 5, nextPaidCost: 243, cost: 0, canRefresh: true,
  });
  state.rewardRefresh.freeUsed = 2;
  assert.equal(getRewardRefreshQuote(state).cost, 243);
  assert.equal(getRewardRefreshQuote(state).canRefresh, false);
  state.coins = 243;
  assert.equal(getRewardRefreshQuote(state).canRefresh, true);
  state.wave = 21;
  assert.equal(getRewardRefreshQuote(state).cost, 0);
  assert.equal(getRewardRefreshQuote(state).nextPaidCost, 243);
});

test("paid prices follow one run-wide exponential sequence with a safe integer limit", () => {
  const state = reward();
  for (const [paidCount, expected] of [[0, 1], [1, 3], [2, 9], [3, 27], [33, 5_559_060_566_555_523]]) {
    state.rewardRefresh = { wave: 1, freeUsed: 0, paidCount, refreshCount: 0 };
    assert.equal(getRewardRefreshQuote(state).nextPaidCost, expected);
  }
  state.rewardRefresh!.paidCount = 34;
  assert.equal(getRewardRefreshQuote(state).nextPaidCost, null);
  assert.equal(getRewardRefreshQuote(state).cost, null);
  assert.equal(getRewardRefreshQuote(state).canRefresh, false);
  state.wave = 10;
  assert.equal(getRewardRefreshQuote(state).nextPaidCost, null);
  assert.equal(getRewardRefreshQuote(state).cost, 0);
  assert.equal(getRewardRefreshQuote(state).canRefresh, true);
});

test("malformed counters normalize to zero and values never leak a mutable object", () => {
  for (const value of [null, undefined, [], "saved", 1]) {
    assert.deepEqual(normalizeRewardRefresh(value, 10), { wave: 10, freeUsed: 0, paidCount: 0, refreshCount: 0 });
  }
  for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "3", {}]) {
    assert.deepEqual(normalizeRewardRefresh({ wave: 10, freeUsed: value, paidCount: value, refreshCount: value }, 10),
      { wave: 10, freeUsed: 0, paidCount: 0, refreshCount: 0 });
  }
  const max = Number.MAX_SAFE_INTEGER;
  assert.deepEqual(normalizeRewardRefresh({ wave: 10, freeUsed: max, paidCount: max, refreshCount: max }, 10),
    { wave: 10, freeUsed: max, paidCount: max, refreshCount: max });
  assert.equal(normalizeRewardRefresh(undefined, Infinity).wave, 0);
  assert.equal(normalizeRewardRefresh(undefined, -10).wave, 0);
});

test("quotes reject unavailable offers, wrong phases, unsafe balances and exhausted refresh IDs", () => {
  const state = reward();
  state.coins = 0;
  assert.equal(getRewardRefreshQuote(state).canRefresh, false);
  state.coins = 1;
  assert.equal(getRewardRefreshQuote(state).canRefresh, true);
  state.phase = "battle";
  assert.equal(getRewardRefreshQuote(state).canRefresh, false);
  state.phase = "reward";
  state.rewards = [];
  assert.equal(getRewardRefreshQuote(state).canRefresh, false);
  state.rewards = reward().rewards;
  for (const coins of [NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    state.coins = coins;
    assert.equal(getRewardRefreshQuote(state).canRefresh, false);
  }
  state.coins = 1;
  state.wave = 10;
  state.rewardRefresh = { wave: 10, freeUsed: 0, paidCount: 0, refreshCount: Number.MAX_SAFE_INTEGER };
  assert.equal(getRewardRefreshQuote(state).cost, 0);
  assert.equal(getRewardRefreshQuote(state).canRefresh, false);
});

test("quoting is deterministic and leaves state, counters and RNG untouched", () => {
  const state = reward(31);
  state.rewardRefresh = { wave: 30, freeUsed: 3, paidCount: 2, refreshCount: 5 };
  const original = structuredClone(state);
  const first = getRewardRefreshQuote(state);
  assert.deepEqual(getRewardRefreshQuote(state), first);
  assert.deepEqual(state, original);
  assert.equal(first.freeRemaining, 3);
  assert.equal(first.nextPaidCost, 9);
});
