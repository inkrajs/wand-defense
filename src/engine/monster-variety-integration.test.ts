import assert from "node:assert/strict";
import test from "node:test";
import { demoContent } from "../content/demo";
import { getMonsterSize, monsterDefinitions } from "../content/monsters";
import { createInitialState } from "../runtime/initial";
import { accumulateBattleStatistics, createRunStatistics } from "../runtime/runStatistics";
import { stepBattle } from "./index";
import { advanceEnemies, getWaveSpec } from "./waves";

function wave28() {
  const state = createInitialState();
  state.phase = "battle";
  state.wave = 28;
  state.waveSpawnRemaining = getWaveSpec(28).count;
  return state;
}

function spawnRest(state: ReturnType<typeof wave28>) {
  while (state.waveSpawnRemaining > 0) {
    state.spawnRemainingMs = 0;
    advanceEnemies(state, 1, () => {});
  }
  return state;
}

test("an existing wave 28 save spawns seven ordinary species with reproducible bodies and parameters", () => {
  const state = wave28();
  for (let index = 0; index < 9; index++) {
    state.spawnRemainingMs = 0;
    advanceEnemies(state, 1, () => {});
  }
  const saved = JSON.parse(JSON.stringify(state)) as typeof state;
  const expected = spawnRest(state);
  const resumed = spawnRest(saved);
  assert.deepEqual(resumed, expected);
  const ordinary = expected.entities.filter(entity => !entity.definitionId.startsWith("boss-"));
  assert.equal(new Set(ordinary.map(entity => entity.definitionId)).size, 7);
  assert.equal(new Set(ordinary.map(entity => monsterDefinitions[entity.definitionId].asset.color)).size, 7);
  assert.ok(new Set(ordinary.map(entity => entity.speed)).size > 1);
  assert.ok(new Set(ordinary.map(entity => entity.maxHp)).size > 1);
  assert.ok(ordinary.every(entity => entity.y < 0 && getMonsterSize(entity).hitRadius > 0));
  assert.equal(expected.entities.length, getWaveSpec(28).count);
  assert.ok(expected.entities.length <= 60);
});

test("new ordinary species retain real kill XP, ordinary loot and nonboss run statistics", () => {
  const spawned = spawnRest(wave28());
  const unique = new Map(spawned.entities.filter(entity => !entity.definitionId.startsWith("boss-"))
    .map(entity => [entity.definitionId, entity]));
  assert.equal(unique.size, 7);
  const state = wave28();
  state.waveSpawnRemaining = 0;
  state.entities = [...unique.values()].map(entity => ({ ...entity, x: 50, y: 50, speed: 0, moveSpeed: 0, damage: 0 }));
  state.items["spark-1"].definitionId = "thunderstorm";
  state.characters[0].manaRegen = 0;
  const expectedXp = state.entities.reduce((sum, entity) => sum + Math.max(1, Math.round(entity.maxHp / 8)), 0);
  const content = { ...demoContent, spells: { ...demoContent.spells,
    thunderstorm: { ...demoContent.spells.thunderstorm, power: 1_000_000 } } };
  const cast = stepBattle(state, 50, content);
  const result = stepBattle(cast.state, 400, content);
  const kills = result.events.filter(event => event.type === "enemyKilled");
  assert.equal(kills.length, 7);
  assert.equal(result.state.xp, expectedXp);
  assert.equal(result.state.characters[0].xp, expectedXp);
  assert.ok(kills.every(event => unique.has(event.data.definitionId as string)
    && event.data.sourceCharacterId === "character-1" && event.data.xpCharacterId === "character-1"));
  const stats = accumulateBattleStatistics(createRunStatistics(), result.events, result.state.coins - state.coins);
  assert.equal(stats.enemiesDefeated, 7);
  assert.equal(stats.bossesDefeated, 0);
  const drops = result.events.filter(event => event.type === "lootGranted");
  assert.ok(drops.some(event => event.data.kind === "gear"));
  assert.ok(drops.every(event => kills.some(kill => kill.data.entityId === event.data.enemyId)));
  assert.equal(stepBattle(result.state, 400, content).events.length, 0);
});
