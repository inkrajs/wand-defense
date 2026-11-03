import assert from "node:assert/strict";
import test from "node:test";
import type { CombatEntity, GameState } from "../contracts";
import { demoContent } from "../content/demo";
import { createFixtureState } from "../runtime/mock";
import { startBattle, stepBattle } from "./index";
import { getWaveSpec } from "./waves";
import { PROJECTILE_LIMITS } from "./projectiles";

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
test("casting pays once; compiled sequence and run bonus damage is saved for later contact", () => {
  const state = battle();
  state.runBonuses = { attackPercent: 10 };
  const original = structuredClone(state);
  const cast = stepBattle(state, 50, demoContent);
  assert.equal(cast.state.entities.find(entity => entity.id === "target")?.hp, 100);
  assert.equal(cast.state.characters[0].mana, 96);
  const projectile = cast.state.entities.find(entity => entity.kind === "projectile")!;
  assert.ok(projectile);
  assert.ok(Math.abs(projectile.damage - 12.1) < 1e-10);
  assert.equal(cast.events.some(event => event.type === "damage"), false);
  cast.state.runBonuses!.attackPercent = 1000;
  const result = stepBattle(cast.state, 100, demoContent);
  assert.ok(Math.abs(result.state.entities.find(entity => entity.id === "target")!.hp - 87.9) < 1e-10);
  assert.equal(result.events.filter(event => event.type === "damage").length, 1);
  assert.deepEqual(state, original);
  assert.equal(result.state.revision, state.revision + 2);
});
test("death rewards and wave completion settle once", () => {
  const state = battle();
  state.entities = [enemy({ hp: 0 }), {
    ...enemy({ id: "projectile-1", kind: "projectile", faction: "player" }),
    originX: 50, originY: 84, targetX: 50, targetY: 80,
  }];
  const result = stepBattle(state, 50, demoContent);
  assert.equal(result.events.filter(event => event.type === "enemyKilled").length, 1);
  assert.equal(result.events.filter(event => event.type === "waveCleared").length, 1);
  assert.equal(result.state.phase, "reward");
  assert.equal(result.state.xp, 13);
  assert.equal(result.state.entities.length, 0);
  const again = stepBattle(result.state, 1000, demoContent);
  assert.equal(again.state, result.state); assert.deepEqual(again.events, []);
});
test("clearing a wave refills every character once; reward ticks cannot settle it again", () => {
  const state = battle();
  state.characters[0].mana = 3;
  state.characters.push({ ...structuredClone(state.characters[0]), id: "character-2", name: "第二角色",
    wandIds: [], mana: 0, maxMana: 77 });
  state.entities = [enemy({ hp: 0 })];

  const cleared = stepBattle(state, 50, demoContent);
  assert.equal(cleared.state.phase, "reward");
  assert.deepEqual(cleared.state.characters.map(character => character.mana), [100, 77]);
  const coins = cleared.state.coins;
  const xp = cleared.state.xp;
  const later = stepBattle(cleared.state, 1000, demoContent);
  assert.equal(later.state, cleared.state);
  assert.equal(later.state.coins, coins);
  assert.equal(later.state.xp, xp);
  assert.deepEqual(later.events, []);
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
test("defeat does not refill mana and removes projectiles", () => {
  const state = battle();
  state.characters[0].mana = 3;
  state.territory.hp = 0;
  state.entities.push({ ...enemy({ id: "attacker", y: 92, damage: 1, attackRemainingMs: 0 }),
    kind: "enemy", faction: "enemy" });
  state.entities.push({ ...enemy({ id: "in-flight", kind: "projectile", faction: "player" }),
    originX: 50, originY: 84, targetX: 50, targetY: 92 });

  const result = stepBattle(state, 50, demoContent);
  assert.equal(result.state.phase, "defeat");
  assert.equal(result.state.characters[0].mana, 3);
  assert.equal(result.state.entities.some(entity => entity.kind === "projectile"), false);
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

test("double creates real projectiles, hits the same surviving target, and charges mana once", () => {
  const state = battle();
  state.characters[0].manaRegen = 0;
  state.items.double = { id: "double", definitionId: "double", kind: "arcana", level: 1, grade: "common" };
  state.wands[0].placements.push({ itemId: "double", x: 1, y: 0, rotation: 0 });
  const cast = stepBattle(state, 50, demoContent);
  assert.equal(cast.state.entities.filter(entity => entity.kind === "projectile").length, 2);
  assert.equal(cast.state.entities.find(entity => entity.id === "target")?.hp, 100);
  assert.equal(cast.state.characters[0].mana, 96);
  const result = stepBattle(cast.state, 100, demoContent).state;
  assert.equal(result.entities.find(entity => entity.id === "target")?.hp, 89);
  assert.equal(result.characters[0].mana, 96);
  const later=stepBattle(result,150,demoContent).state;
  assert.equal(later.entities.find(entity=>entity.id === "target")?.hp,78);
  assert.equal(later.characters[0].mana,96);
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


test("a full projectile pool waits without paying mana or starting cooldown, then retries when free", () => {
  const state = battle();
  state.characters[0].mana = 50; state.characters[0].manaRegen = 0;
  for (let i = 0; i < PROJECTILE_LIMITS.alive; i++) {
    state.entities.push({ ...enemy({ id: `pool-${i}`, kind: "projectile", faction: "player", x: 0, y: 0,
      hp: 1, maxHp: 1, speed: 0, remainingMs: 5000 }), targetId: "target", targetX: 50, targetY: 80 });
  }
  const blocked = stepBattle(state, 50, demoContent);
  assert.equal(blocked.state.characters[0].mana, 50);
  assert.equal(blocked.state.wands[0].cooldowns["spark-1"], undefined);
  assert.equal(blocked.events.some(event => event.type === "spellCast" || event.type === "projectileSpawned"), false);
  blocked.state.entities.find(entity => entity.id === "pool-0")!.hp = 0;
  const retry = stepBattle(blocked.state, 50, demoContent);
  assert.equal(retry.state.characters[0].mana, 46);
  assert.equal(retry.state.wands[0].cooldowns["spark-1"], 700);
  assert.equal(retry.events.filter(event => event.type === "projectileSpawned").length, 1);
  assert.equal(retry.events.find(event => event.type === "spellCast")?.data.casts, 1);
});
