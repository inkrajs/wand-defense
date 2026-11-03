import assert from "node:assert/strict";
import test from "node:test";
import type { CombatEntity } from "../contracts";
import { demoContent } from "../content/demo";
import { createInitialState } from "../runtime/initial";
import { advanceEnemies, beginWave } from "./waves";
import { spawnProjectiles } from "./projectiles";
import { stepBattle } from "./index";
import { applyContactDamage } from "./targets";
import { compileWand } from "../loadout";
import { createGameRuntime } from "../runtime";

function entity(id: string, overrides: Partial<CombatEntity> = {}): CombatEntity {
  return { id, definitionId: "enemy-basic", kind: "enemy", faction: "enemy", x: 30, y: 40,
    hp: 100, maxHp: 100, damage: 5, speed: 0, range: 2, cooldownMs: 1000, attackRemainingMs: 0, ...overrides };
}

test("all nine new attack combinations and three automatic summons damage through real battle steps", () => {
  for (const id of ["piercing-gale", "glacial-lance", "ember-comet", "solar-storm", "tidal-prison",
    "cinder-ring", "repulse-wave", "prism-ray", "storm-spear", "ember-familiar", "frost-wisp", "thorn-guardian"]) {
    let state = createInitialState();
    state.phase = "battle";
    state.wave = 1;
    state.items["spark-1"].definitionId = id;
    state.entities = [entity("target", { x: 50, y: 70, hp: 1000, maxHp: 1000, damage: 0 })];
    state = stepBattle(state, 50, demoContent).state;
    state.wands[0].placements = [];
    for (let index = 0; index < 60 && !state.events.some(event => event.type === "damage" && event.data.effect === id); index++) {
      state = stepBattle(state, 50, demoContent).state;
    }
    const hit = state.events.find(event => event.type === "damage" && event.data.effect === id);
    assert.ok(hit, `${id} must perform real damage`);
    assert.ok(Number(hit.data.amount) > 0, id);
    assert.equal(hit.data.sourceCharacterId, "character-1");
    assert.equal(hit.data.sourceItemId, "spark-1");
  }
});

test("all three buildings deploy far from the caster through the real command and charge once", () => {
  for (const definitionId of ["ember-turret", "frost-pylon", "restorative-totem"]) {
    const state = createInitialState();
    state.coins = 100;
    state.items["spark-1"].definitionId = definitionId;
    state.knowledge.spellIds.push(definitionId);
    const compiled = compileWand(state, "wand-1", demoContent)!.spells[0];
    const runtime = createGameRuntime(demoContent, { checkpointVersion: 1, state, pausedBeforeBackpack: false, results: [] });
    const command = { id: `deploy-${definitionId}`, type: "deployConstruct" as const,
      characterId: "character-1", itemId: "spark-1", x: 2, y: 3 };
    assert.equal(runtime.dispatch(command).status, "executed", definitionId);
    const after = runtime.getState();
    const building = after.entities.find(candidate => candidate.kind === "building")!;
    assert.deepEqual([building.x, building.y], [2, 3]);
    assert.equal(building.hp, compiled.construct!.hp);
    assert.equal(after.characters[0].mana, state.characters[0].mana - compiled.manaCost);
    assert.equal(after.coins, 100 - compiled.construct!.coinCost!);
    assert.equal(runtime.dispatch(command).status, "executed");
    assert.deepEqual(runtime.getState(), after);
    assert.equal(runtime.dispatch({ id: `start-${definitionId}`, type: "startWave" }).status, "executed");
    assert.equal(runtime.getState().entities.find(candidate => candidate.id === building.id)!.remainingMs, building.remainingMs);
    runtime.dispose();
  }
});

test("compiled construct duration, capacity, status and precision reach the deployed snapshot", () => {
  const state = createInitialState();
  state.coins = 100;
  state.characters[0].baseStats!.accuracy = 0.7;
  state.items["spark-1"].definitionId = "ember-turret";
  state.knowledge.spellIds.push("ember-turret");
  state.wands[0].width = state.wands[0].height = 5;
  state.wands[0].placements = [{ itemId: "spark-1", x: 1, y: 1, rotation: 0 }];
  for (const [id, x, y] of [["duration", 1, 3], ["capacity", 3, 1], ["slow", 0, 1], ["precision", 1, 0]] as const) {
    state.items[id] = { id, definitionId: id, kind: "arcana", level: 1, grade: "common" };
    state.wands[0].placements.push({ itemId: id, x, y, rotation: 0 });
  }
  const compiled = compileWand(state, "wand-1", demoContent)!.spells[0];
  assert.ok(compiled.construct!.durationMs > demoContent.spells["ember-turret"].construct!.durationMs);
  assert.ok(compiled.construct!.maxAlive > demoContent.spells["ember-turret"].construct!.maxAlive);
  assert.ok(compiled.onHit!.slow);
  assert.ok(compiled.attackRoll.accuracy > 0.7);
  const runtime = createGameRuntime(demoContent, { checkpointVersion: 1, state, pausedBeforeBackpack: false, results: [] });
  assert.equal(runtime.dispatch({ id: "modified-tower", type: "deployConstruct", characterId: "character-1",
    itemId: "spark-1", x: 10, y: 10 }).status, "executed");
  const deployed = runtime.getState().entities[0];
  assert.deepEqual(deployed.construct, compiled.construct);
  assert.deepEqual(deployed.onHit, compiled.onHit);
  assert.deepEqual(deployed.attackRoll, compiled.attackRoll);
  assert.equal(deployed.damage, compiled.power);
  runtime.dispose();
});

test("enemies stop to attack a contacted construct and never credit its death as an enemy kill", () => {
  const state = createInitialState();
  state.phase = "battle";
  state.wave = 1;
  state.wands[0].placements = [];
  const tower = entity("tower", { kind: "building", faction: "player", hp: 4, x: 30, y: 92, remainingMs: 5000 });
  state.entities = [entity("enemy", { y: 92, speed: 10 }), tower];
  const result = stepBattle(state, 50, demoContent);
  assert.equal(result.state.territory.shield, state.territory.shield);
  assert.equal(result.events.some(event => event.type === "constructDestroyed"), true);
  assert.equal(result.events.some(event => event.type === "enemyKilled" || event.type === "territoryAttacked"), false);
  assert.equal(result.state.characters[0].xp, 0);
});

test("construct projectiles use their own origin and keep flying after their source dies", () => {
  const state = createInitialState();
  state.phase = "battle";
  state.wave = 1;
  state.wands[0].placements = [];
  const tower = entity("tower", { kind: "building", faction: "player", x: 12, y: 20, remainingMs: 5000 });
  state.entities = [tower, entity("victim", { x: 12, y: 25, hp: 40, maxHp: 80, damage: 0 })];
  assert.equal(spawnProjectiles(state, "character-1", { itemId: "source-item", definitionId: "spark",
    power: 50, range: 20, casts: 1, speed: 1000, origin: { x: 12, y: 20 }, sourceEntityId: tower.id }, () => {}), true);
  const shot = state.entities.find(candidate => candidate.kind === "projectile")!;
  assert.deepEqual([shot.x, shot.y], [12, 20]);
  tower.hp = 0;
  const result = stepBattle(state, 50, demoContent);
  const killed = result.events.find(event => event.type === "enemyKilled")!;
  assert.ok(killed);
  assert.equal(killed.data.sourceCharacterId, "character-1");
  assert.equal(killed.data.sourceItemId, "source-item");
  assert.equal(result.state.characters[0].xp, 10);
});

test("wave starts preserve surviving construct HP and lifetime while removing old enemies and shots", () => {
  const state = createInitialState();
  const tower = entity("tower", { kind: "building", faction: "player", hp: 42, remainingMs: 1234 });
  state.entities = [tower, entity("old-enemy"), entity("old-shot", { kind: "projectile", faction: "player" }),
    entity("dead-pet", { kind: "summon", faction: "player", hp: 0 })];
  beginWave(state, () => {});
  assert.deepEqual(state.entities, [tower]);
  assert.equal(tower.hp, 42);
  assert.equal(tower.remainingMs, 1234);
});

test("monster regeneration respects max HP and armor blocks weak damage and its on-hit status", () => {
  const state = createInitialState();
  state.phase = "battle";
  state.wave = 1;
  const target = entity("armored", { hp: 95, armor: 6, regenerationPerSecond: 10 });
  state.entities = [target];
  advanceEnemies(state, 1000, () => {});
  assert.equal(target.hp, 100);
  const source = entity("shot", { kind: "projectile", faction: "player", damage: 5,
    onHit: { burn: { powerRatio: 1, durationMs: 1000, tickMs: 200 } } });
  applyContactDamage(state, source, target, () => {});
  assert.equal(target.hp, 100);
  assert.equal(target.status, undefined);
  source.damage = 10;
  applyContactDamage(state, source, target, () => {});
  assert.equal(target.hp, 96);
  assert.equal(state.entities.find(candidate => candidate.id === target.id)?.status?.burns?.length, 1);
  state.paused = true;
  advanceEnemies(state, 1000, () => {});
  assert.equal(target.hp, 96);
});
