import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState } from "../runtime/initial";
import { getMonsterSize } from "../content/monsters";
import { advanceEnemies, getWaveSpec } from "./waves";

test("normal enemies enter continuously from beyond the upper field instead of snapping to its edge", () => {
  const state = createInitialState(); state.phase = "battle"; state.wave = 1;
  state.waveSpawnRemaining = getWaveSpec(1).count; state.spawnRemainingMs = 0;
  advanceEnemies(state, 50, () => {});
  const enemy = state.entities[0];
  assert.ok(enemy.y < -getMonsterSize(enemy).hitRadius);
  const firstY = enemy.y, randomAfterSpawn = state.rngState;
  state.waveSpawnRemaining = 0;
  advanceEnemies(state, 50, () => {});
  assert.ok(enemy.y > firstY && enemy.y < 0);
  assert.ok(enemy.y - firstY <= enemy.speed * .05);
  for (let i = 0; i < 200 && enemy.y < 0; i++) advanceEnemies(state, 50, () => {});
  assert.ok(enemy.y >= 0);
  assert.equal(state.rngState, randomAfterSpawn, "entry animation consumes no extra gameplay randomness");
});

test("larger bosses also start with their full body beyond the field and preserve their spawn identity", () => {
  for (const wave of [5, 10, 100]) {
    const state = createInitialState(); state.phase = "battle"; state.wave = wave;
    const spec = getWaveSpec(wave), node = spec.bossNodes.at(-1)!;
    state.waveSpawnRemaining = spec.count - node.spawnIndex; state.spawnRemainingMs = 0;
    advanceEnemies(state, 1, () => {});
    const enemy = state.entities[0], size = getMonsterSize(enemy);
    assert.equal(enemy.definitionId, `boss-${node.tier}`);
    assert.ok(enemy.y < -(size.pixels / 6 + 1));
    state.waveSpawnRemaining = 0;
    const y = enemy.y; advanceEnemies(state, 50, () => {});
    assert.ok(enemy.y > y && enemy.y < 0);
  }
});
