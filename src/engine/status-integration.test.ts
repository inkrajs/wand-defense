import assert from "node:assert/strict";
import test from "node:test";
import type { CombatEntity } from "../contracts";
import { demoContent } from "../content/demo";
import { createInitialState } from "../runtime/initial";
import { stepBattle } from "./index";

function battle(definitionId: string, overrides: Partial<CombatEntity> = {}) {
  const state = createInitialState();
  state.phase = "battle";
  state.wave = 1;
  state.items["spark-1"].definitionId = definitionId;
  state.entities = [{ id: "target", definitionId: "enemy-basic", kind: "enemy", faction: "enemy",
    x: 50, y: 75, hp: 1000, maxHp: 1000, damage: 0, speed: 0, range: 0,
    cooldownMs: 1000, attackRemainingMs: 1000, ...overrides }];
  return state;
}

test("wind blade knocks its real contact target along the projectile direction", () => {
  let state = battle("wind-blade");
  for (let index = 0; index < 20 && !state.events.some(event => event.type === "damage"); index++) {
    state = stepBattle(state, 50, demoContent).state;
  }
  assert.ok(state.events.some(event => event.type === "damage"));
  assert.ok(state.entities[0].y < 75);
  assert.equal(state.entities[0].x, 50);
});

test("real accuracy misses cannot apply knockback or burn", () => {
  for (const id of ["wind-blade", "fireball"]) {
    const state = battle(id);
    state.characters[0].baseStats!.accuracy = 0;
    const result = stepBattle(state, 1000, demoContent);
    assert.ok(result.events.some(event => event.type === "attackMiss"));
    assert.equal(result.events.some(event => event.type === "damage" || event.type === "statusApplied" || event.type === "knockback"), false);
    assert.equal(result.state.entities[0].hp, 1000);
    assert.deepEqual([result.state.entities[0].x, result.state.entities[0].y], [50, 75]);
    assert.equal(result.state.entities[0].status, undefined);
  }
});

test("water contact slows actual enemy travel without changing its base speed or ramp", () => {
  let state = battle("water-bolt", { y: 80, speed: 10, moveSpeed: 10, moveRampMs: 0 });
  for (let index = 0; index < 20 && !state.entities[0].status?.slow; index++) {
    state = stepBattle(state, 50, demoContent).state;
  }
  assert.ok(state.entities[0].status?.slow);
  state.wands[0].placements = [];
  const plain = structuredClone(state);
  delete plain.entities[0].status;
  const slowed = stepBattle(state, 400, demoContent).state.entities[0];
  const normal = stepBattle(plain, 400, demoContent).state.entities[0];
  assert.ok(slowed.y < normal.y);
  assert.equal(slowed.speed, normal.speed);
  assert.equal(slowed.moveSpeed, normal.moveSpeed);
  assert.equal(slowed.moveRampMs, normal.moveRampMs);
});

test("a saved fireball burn kills later with original provenance and no new accuracy or critical roll", () => {
  let state = battle("fireball", { y: 80, hp: 36, maxHp: 80 });
  for (let index = 0; index < 30 && !state.entities[0].status?.burns?.length; index++) {
    state = stepBattle(state, 50, demoContent).state;
  }
  assert.equal(state.entities[0].status?.burns?.length, 1);
  state.wands[0].placements = [];
  state = JSON.parse(JSON.stringify(state)) as typeof state;
  const burn = state.entities[0].status!.burns![0];
  const seed = state.rngState;
  state.characters[0].baseStats!.accuracy = 0;
  state.characters[0].baseStats!.critChance = 1;
  const pulse = stepBattle(state, burn.tickRemainingMs, demoContent);
  const damage = pulse.events.filter(event => event.type === "damage");
  assert.equal(damage.length, 1);
  assert.equal(damage[0].data.statusType, "burn");
  assert.equal(damage[0].data.statusId, burn.id);
  assert.equal(damage[0].data.critical, false);
  assert.equal(damage[0].data.projectileId, undefined);
  assert.equal(pulse.state.rngState, seed);
  const killed = stepBattle(pulse.state, burn.tickMs, demoContent);
  const deaths = killed.events.filter(event => event.type === "enemyKilled");
  assert.equal(deaths.length, 1);
  assert.equal(deaths[0].data.sourceCharacterId, "character-1");
  assert.equal(deaths[0].data.sourceItemId, "spark-1");
  assert.equal(deaths[0].data.effect, "fireball");
  assert.equal(killed.state.characters[0].xp, 10);
  assert.equal(stepBattle(killed.state, 1000, demoContent).events.length, 0);
});
