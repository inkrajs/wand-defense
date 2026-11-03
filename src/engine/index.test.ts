import assert from "node:assert/strict";
import test from "node:test";
import type { CombatEntity, GameState } from "../contracts";
import { demoContent } from "../content/demo";
import { createFixtureState } from "../runtime/mock";
import { startBattle, stepBattle } from "./index";
import { getWaveSpec } from "./waves";

function enemy(overrides: Partial<CombatEntity> = {}): CombatEntity {
  return { id: "target", definitionId: "enemy-basic", kind: "enemy", faction: "enemy", x: 50, y: 80,
    hp: 100, maxHp: 100, damage: 0, speed: 0, range: 1, cooldownMs: 1000, attackRemainingMs: 1000, ...overrides };
}
function battle(): GameState {
  const state = startBattle(createFixtureState(), demoContent).state;
  state.waveSpawnRemaining = 0;
  state.entities = [enemy()];
  return state;
}

test("pause and backpack freeze all battle clocks and state", () => {
  for (const flag of ["paused", "backpackOpen"] as const) {
    const state = battle(); state[flag] = true;
    assert.equal(stepBattle(state, 5000, demoContent).state, state);
  }
});
test("sequence applies once to real damage; simulation preserves input", () => {
  const state = battle(); const original = structuredClone(state);
  const result = stepBattle(state, 50, demoContent);
  assert.equal(result.state.entities.find(entity => entity.id === "target")?.hp, 89);
  assert.deepEqual(state, original);
  assert.equal(result.state.revision, state.revision + 1);
});
test("death rewards and wave completion settle once", () => {
  const state = battle(); state.entities = [enemy({ hp: 0 })];
  const result = stepBattle(state, 50, demoContent);
  assert.equal(result.events.filter(event => event.type === "enemyKilled").length, 1);
  assert.equal(result.events.filter(event => event.type === "waveCleared").length, 1);
  assert.equal(result.state.phase, "reward");
  assert.equal(result.state.xp, 13);
  const again = stepBattle(result.state, 1000, demoContent);
  assert.equal(again.state, result.state); assert.deepEqual(again.events, []);
});
test("same fixed steps are deterministic across tick batching", () => {
  const state = battle();
  const once = stepBattle(state, 1000, demoContent).state;
  let many = state;
  for (let i = 0; i < 20; i++) many = stepBattle(many, 50, demoContent).state;
  assert.deepEqual({ ...many, revision: 0 }, { ...once, revision: 0 });
});
test("healing restores territory and defeat takes precedence", () => {
  const state = battle(); state.territory.hp = 50;
  state.items = { heal: { id: "heal", definitionId: "regrowth", kind: "spell", level: 1, grade: "common" } };
  state.wands[0].placements = [{ itemId: "heal", x: 0, y: 0, rotation: 0 }];
  assert.ok(stepBattle(state, 50, demoContent).state.territory.hp > 50);
  state.territory.hp = 0;
  assert.equal(stepBattle(state, 50, demoContent).state.phase, "defeat");
});
test("boss priority is exclusive and high waves keep scaling", () => {
  assert.equal(getWaveSpec(5).bossTier, "minor");
  assert.equal(getWaveSpec(10).bossTier, "major");
  assert.equal(getWaveSpec(100).bossTier, "apex");
  const spawnAt = (wave: number) => {
    const state = battle(); state.wave = wave; state.waveSpawnRemaining = 1; state.entities = [];
    return stepBattle(state, 50, demoContent).state.entities.find(entity => entity.kind === "enemy")!;
  };
  assert.ok(spawnAt(200).maxHp > spawnAt(100).maxHp);
});
test("starter loadout can clear first wave without input", () => {
  let state = startBattle(createFixtureState(), demoContent).state;
  for (let i = 0; i < 1200 && state.phase === "battle"; i++) state = stepBattle(state, 50, demoContent).state;
  assert.equal(state.phase, "reward");
  assert.ok(state.territory.hp > 0);
});

test("double hits the same surviving target and charges mana once", () => {
  const state = battle();
  state.items.double = { id: "double", definitionId: "double", kind: "arcana", level: 1, grade: "common" };
  state.wands[0].placements.push({ itemId: "double", x: 1, y: 0, rotation: 0 });
  const result = stepBattle(state, 50, demoContent).state;
  assert.equal(result.entities.find(entity => entity.id === "target")?.hp, 78);
  assert.equal(result.characters[0].mana, 96);
});
test("multiple wands share personal mana and keep independent cooldowns", () => {
  const state = battle(); state.characters[0].mana = 4; state.characters[0].manaRegen = 0;
  state.items["spark-2"] = { ...state.items["spark-1"], id: "spark-2" };
  state.wands.push({ ...structuredClone(state.wands[0]), id: "wand-2", placements: [{ itemId: "spark-2", x: 0, y: 0, rotation: 0 }] });
  state.characters[0].wandIds.push("wand-2");
  const result = stepBattle(state, 50, demoContent).state;
  assert.equal(result.characters[0].mana, 0);
  assert.equal(result.wands[0].cooldowns["spark-1"], 700);
  assert.equal(result.wands[1].cooldowns["spark-2"], undefined);
});
