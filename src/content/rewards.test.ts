import assert from "node:assert/strict";
import test from "node:test";
import { createWaveRewards, rewardGrades } from "./rewards";
import { demoContent } from "./demo";

test("the first four waves offer each new direct attack spell", () => {
  const expected = ["water-bolt", "wind-blade", "lightning-bolt", "rock-shot"];
  for (const [index, definitionId] of expected.entries()) {
    const item = createWaveRewards(index + 1, 1, 1, demoContent).find(option => option.kind === "item");
    assert.ok(item, `wave ${index + 1} should offer an item`);
    assert.equal(item.definitionId, definitionId);
    assert.equal(item.kind, "item");
    assert.ok(Object.hasOwn(demoContent.spells, definitionId), `${definitionId} should be a spell definition`);
    const definition = demoContent.spells[definitionId];
    assert.equal(definition.effect, "projectile");
    assert.equal(item.grade, definition.grade);
    assert.equal(item.label, definition.name);
    assert.ok(item.details?.some(detail => detail.label === "占用格数" && detail.value === String(definition.shape.length)));
  }
});

test("the ten-wave item cycle keeps existing rewards and repeats from wave eleven", () => {
  const expected = [
    "water-bolt", "wind-blade", "lightning-bolt", "rock-shot", "amplify",
    "double", "metal-needle", "regrowth", "split", "focus",
  ];
  const itemId = (wave: number) => createWaveRewards(wave, 1, 1, demoContent)
    .find(option => option.kind === "item")?.definitionId;
  assert.deepEqual(expected.map((_, index) => itemId(index + 1)), expected);
  for (let wave = 1; wave <= 10; wave++) assert.equal(itemId(wave + 10), itemId(wave));
  assert.equal(itemId(21), itemId(1));
});

test("non-item reward choices and their grade progression stay unchanged", () => {
  assert.deepEqual(rewardGrades.map(({ grade, attackPercent }) => [grade, attackPercent]), [
    ["common", 10], ["uncommon", 15], ["rare", 20], ["epic", 30], ["legendary", 40], ["mythic", 50],
  ]);
  const tierWaves = [1, 4, 7, 10, 13, 16];
  assert.deepEqual(tierWaves.map(wave => {
    const buff = createWaveRewards(wave, 1, 1, demoContent)[0];
    return [buff.kind, buff.grade, buff.effect?.value];
  }), [
    ["buff", "common", 10], ["buff", "uncommon", 15], ["buff", "rare", 20],
    ["buff", "epic", 30], ["buff", "legendary", 40], ["buff", "mythic", 50],
  ]);

  const waveOne = createWaveRewards(1, 1, 1, demoContent);
  const waveFour = createWaveRewards(4, 1, 1, demoContent);
  const fullRoster = createWaveRewards(11, 3, 6, demoContent);
  assert.deepEqual(waveOne.filter(option => option.kind !== "item").map(option => [option.kind, option.grade, option.amount]), [
    ["buff", "common", undefined], ["heal", "common", 35], ["character", "rare", undefined],
  ]);
  assert.deepEqual(waveFour.filter(option => option.kind !== "item").map(option => [option.kind, option.grade, option.amount]), [
    ["buff", "uncommon", undefined], ["heal", "common", 35], ["wand", "uncommon", undefined],
  ]);
  assert.deepEqual(fullRoster.filter(option => option.kind !== "item").map(option => [option.kind, option.grade, option.amount]), [
    ["buff", "epic", undefined], ["heal", "common", 35], ["coins", "uncommon", 20],
  ]);
  assert.deepEqual(waveOne.find(option => option.kind === "heal")?.details, [
    { label: "恢复量", value: "35" }, { label: "恢复上限", value: "不超过生命上限" }, { label: "护盾", value: "不恢复" },
  ]);
});
