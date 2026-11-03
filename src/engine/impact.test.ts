import assert from "node:assert/strict";
import test from "node:test";
import type { BeamSpec, CombatEntity, GameState, ProjectileImpact } from "../contracts";
import { startBattle, stepBattle } from "./index";
import { advanceBeams, BEAM_LIMITS, spawnBeams } from "./beams";
import { applyLoadoutCommand } from "../loadout";
import { createFixtureState } from "../runtime/mock";
import { createInitialState } from "../runtime/initial";
import { advanceProjectiles, spawnProjectiles } from "./projectiles";
import { advanceAreaEffects } from "./areaEffects";
import { demoContent } from "../content/demo";

type Event = { type: string; data: Record<string, unknown> };
function stateWith(enemies: CombatEntity[]): GameState {
  const state = createFixtureState();
  state.phase = "battle";
  state.waveSpawnRemaining = 1;
  state.entities = enemies;
  return state;
}

function enemy(id: string, x: number, y: number): CombatEntity {
  return { id, definitionId: "enemy-basic", kind: "enemy", faction: "enemy", x, y,
    hp: 100, maxHp: 100, damage: 0, speed: 0, range: 1, cooldownMs: 1000, attackRemainingMs: 1000 };
}

function recorder() {
  const events: Event[] = [];
  return { events, emit: (type: string, data: Record<string, unknown>) => events.push({ type, data }) };
}

function fire(state: GameState, emit: (type: string, data: Record<string, unknown>) => void,
  impact: ProjectileImpact, options: { power?: number; speed?: number; range?: number } = {}) {
  assert.equal(spawnProjectiles(state, "character-1", {
    itemId: "impact-spell", definitionId: "test-impact", power: options.power ?? 10,
    range: options.range ?? 40, casts: 1, speed: options.speed ?? 100, impact,
  }, emit), true);
  return state.entities.find(entity => entity.kind === "projectile")!;
}

function stepUntil(events: Event[], predicate: () => boolean, state: GameState,
  emit: (type: string, data: Record<string, unknown>) => void, maxSteps = 100): void {
  for (let i = 0; i < maxSteps && !predicate(); i++) advanceProjectiles(state, 50, emit);
}

test("piercing continues along the original ray and hits the next target on a later step", () => {
  const state = stateWith([enemy("first", 50, 70), enemy("second", 50, 62)]);
  const { events, emit } = recorder();
  const bullet = fire(state, emit, { type: "pierce", maxTargets: 3 });
  stepUntil(events, () => events.some(event => event.type === "damage" && event.data.targetId === "first"), state, emit);

  assert.equal(state.entities.find(entity => entity.id === "first")?.hp, 90);
  assert.equal(state.entities.find(entity => entity.id === "second")?.hp, 100,
    "one substep must not apply damage twice");
  assert.deepEqual(bullet.hitIds, ["first"]);
  assert.equal(bullet.targetId, undefined);
  assert.equal(bullet.headingX,0);assert.equal(bullet.headingY,-1);

  advanceProjectiles(state, 50, emit);
  assert.equal(state.entities.find(entity => entity.id === "second")?.hp, 100);
  stepUntil(events, () => events.some(event => event.type === "damage" && event.data.targetId === "second"), state, emit);
  assert.equal(state.entities.find(entity => entity.id === "second")?.hp, 90);
  assert.deepEqual(bullet.hitIds, ["first", "second"]);
});

test("splash selects stable nearest targets up to its cap and leaves targets outside its radius", () => {
  const state = stateWith([
    enemy("contact", 50, 70), enemy("beta", 51, 69), enemy("alpha", 49, 69), enemy("outside", 53, 70),
  ]);
  const { events, emit } = recorder();
  fire(state, emit, { type: "splash", radius: 2, maxTargets: 3 });
  stepUntil(events, () => events.filter(event => event.type === "damage").length >= 3, state, emit);

  const hits = events.filter(event => event.type === "damage").map(event => event.data.targetId);
  assert.deepEqual(hits, ["contact", "alpha", "beta"]);
  assert.equal(state.entities.find(entity => entity.id === "outside")?.hp, 100);
  assert.ok(hits.every(id => new Set(hits).size === hits.length));
});

test("chain damage applies falloff and waits for real flight between targets", () => {
  const state = stateWith([enemy("first", 50, 70), enemy("second", 50, 62)]);
  const { events, emit } = recorder();
  const bullet = fire(state, emit, { type: "chain", radius: 10, maxTargets: 2, falloff: 0.5 });
  stepUntil(events, () => events.some(event => event.type === "damage" && event.data.targetId === "first"), state, emit);

  assert.equal(state.entities.find(entity => entity.id === "second")?.hp, 100);
  assert.equal(bullet.damage, 5);
  stepUntil(events, () => events.some(event => event.type === "damage" && event.data.targetId === "second"), state, emit);
  const hits = events.filter(event => event.type === "damage");
  assert.deepEqual(hits.map(event => event.data.targetId), ["first", "second"]);
  assert.deepEqual(hits.map(event => event.data.amount), [10, 5]);
});

test("field projectile triggers leave persistent areas without direct contact damage", () => {
  for (const trigger of ["contact", "range", "either"] as const) {
    const state = stateWith([enemy("target", 50, 78)]);
    const { events, emit } = recorder();
    const bullet = fire(state, emit, { type: "field", radius: 4, maxTargets: 64,
      durationMs: 2400, tickMs: 400, trigger }, { speed: 100, range: 10, power: 10 });
    bullet.attackRoll = { accuracy: 1, critChance: 0, critMultiplier: 2, sourceLuck: 7 };

    advanceProjectiles(state, 50, emit);
    if (trigger === "range") {
      assert.ok(bullet.hp > 0);
      assert.equal(bullet.travelledDistance, 5);
      assert.equal(state.entities.some(entity => entity.kind === "area"), false);
      advanceProjectiles(state, 50, emit);
    }

    const field = state.entities.find(entity => entity.kind === "area")!;
    assert.equal(bullet.hp, 0);
    assert.equal(state.entities.find(entity => entity.id === "target")?.hp, 100,
      "field triggers do not apply direct projectile damage");
    assert.equal(field.area?.mode, "field");
    assert.equal(field.area?.maxTargets, 8);
    assert.equal(field.sourceCharacterId, "character-1");
    assert.equal(field.sourceItemId, "impact-spell");
    assert.deepEqual(field.attackRoll, bullet.attackRoll);
    assert.ok(Math.abs(bullet.travelledDistance! - (trigger === "range" ? 10 : 3.8)) < 1e-6);
    assert.ok(Math.abs(field.y - (trigger === "range" ? 74 : 80.2)) < 1e-6);

    advanceAreaEffects(state, 399, emit);
    assert.equal(state.entities.find(entity => entity.id === "target")?.hp, 100);
    advanceAreaEffects(state, 1, emit);
    assert.equal(state.entities.find(entity => entity.id === "target")?.hp, 90);
    const damage = events.find(event => event.type === "damage")!;
    assert.equal(damage.data.areaId, field.id);
    assert.equal(damage.data.sourceCharacterId, "character-1");
    assert.equal(damage.data.sourceItemId, "impact-spell");
  }
});

test("contact-only field projectiles expire at range without leaving an area when they miss", () => {
  const target = enemy("moved-away", 50, 78);
  const state = stateWith([target]);
  const { emit } = recorder();
  const bullet = fire(state, emit, { type: "field", radius: 4, maxTargets: 4,
    durationMs: 2400, tickMs: 400, trigger: "contact" }, { speed: 100, range: 10 });
  target.x = 70;
  advanceProjectiles(state, 100, emit);

  assert.equal(bullet.hp, 0);
  assert.equal(bullet.travelledDistance, 10);
  assert.equal(state.entities.some(entity => entity.kind === "area"), false);
  assert.equal(target.hp, 100);
});

test("either field trigger prefers contact when contact and range end at the same point", () => {
  const state = stateWith([enemy("target", 50, 78)]);
  const { emit } = recorder();
  const bullet = fire(state, emit, { type: "field", radius: 4, maxTargets: 4,
    durationMs: 2400, tickMs: 400, trigger: "either" }, { speed: 100, range: 10 });
  // The enemy is 3.8 units from first contact (enemy radius + projectile radius).
  bullet.range = 3.8;
  advanceProjectiles(state, 50, emit);

  const area = state.entities.find(entity => entity.kind === "area")!;
  assert.equal(bullet.hp, 0);
  assert.equal(bullet.travelledDistance, 3.8);
  assert.ok(Math.abs(area.y - 80.2) < 1e-6);
  assert.equal(state.entities.find(entity => entity.id === "target")?.hp, 100);
});

test("a dead intended target does not cancel flight; a later real collision triggers splash", () => {
  const target = enemy("lost", 50, 70);
  const bystander = enemy("bystander", 50, 69);
  const state = stateWith([target, bystander]);
  const { events, emit } = recorder();
  fire(state, emit, { type: "splash", radius: 5, maxTargets: 4 });
  target.hp = 0;

  stepUntil(events, () => !state.entities.some(entity => entity.kind === "projectile" && entity.hp > 0), state, emit);
  assert.equal(bystander.hp, 90);
  assert.deepEqual(events.filter(event=>event.type === "damage").map(event=>event.data.targetId),["bystander"]);
  assert.equal(events.some(event=>event.type === "projectileExpired"&&event.data.reason === "targetLost"),false);
});

test("a continuing projectile keeps its original five second lifetime budget", () => {
  const state = stateWith([enemy("first", 50, 83.5), enemy("farther", 50, 20)]);
  const { events, emit } = recorder();
  const bullet = fire(state, emit, { type: "pierce", maxTargets: 2 }, { speed: 10, range: 100 });
  advanceProjectiles(state, 50, emit);
  assert.equal(events.filter(event => event.type === "damage").length, 1);
  assert.equal(bullet.remainingMs, 4950);

  advanceProjectiles(state, 4900, emit);
  assert.ok(bullet.hp > 0);
  assert.equal(bullet.remainingMs, 50);
  advanceProjectiles(state, 50, emit);
  assert.equal(bullet.hp, 0);
  assert.equal(bullet.remainingMs, 0);
  assert.equal(events.filter(event => event.type === "damage").length, 1);
  assert.equal(events.at(-1)?.data.reason, "timeout");
});

test("pierce, splash and chain all cap total targets at eight", () => {
  const modes: ProjectileImpact[] = [
    { type: "pierce", maxTargets: 50 },
    { type: "splash", radius: 100, maxTargets: 50 },
    { type: "chain", radius: 100, maxTargets: 50, falloff: 1 },
  ];
  for (const impact of modes) {
    const enemies = Array.from({ length: 12 }, (_, index) => enemy(`enemy-${String(index).padStart(2, "0")}`, 50, 83 - index * 0.5));
    const state = stateWith(enemies);
    const { events, emit } = recorder();
    const bullet = fire(state, emit, impact, { speed: 1000, range: 100 });
    assert.equal(bullet.remainingImpacts, 8);
    for (let i = 0; i < 12 && bullet.hp > 0; i++) advanceProjectiles(state, 50, emit);
    const hits = events.filter(event => event.type === "damage");
    assert.equal(hits.length, 8, `${impact.type} hit count`);
    assert.equal(new Set(bullet.hitIds).size, 8, `${impact.type} hit IDs`);
    assert.ok(bullet.hitIds!.length <= 8);
  }
});

test("one real splash cast can kill several enemies once and credits its firing character", () => {
  let state = createInitialState();
  state.paused = true;
  state.backpackOpen = true;
  state.items["splash-spell"] = { id: "splash-spell", definitionId: "cinder-burst", kind: "spell", level: 1, grade: "common" };
  state.backpack.push("splash-spell");
  const removed = applyLoadoutCommand(state, { id: "remove-starter", type: "removeItem", wandId: "wand-1", itemId: "spark-1" }, demoContent);
  assert.equal(removed.result.status, "executed");
  const placed = applyLoadoutCommand(removed.state, { id: "equip-splash", type: "placeItem", wandId: "wand-1", itemId: "splash-spell", x: 0, y: 0, rotation: 0 }, demoContent);
  assert.equal(placed.result.status, "executed");
  state = placed.state;
  state.paused = false;
  state.backpackOpen = false;
  state.characters[0].manaRegen = 0;
  state = startBattle(state, demoContent).state;
  state.waveSpawnRemaining = 0;
  state.entities = [enemy("first", 50, 70), enemy("alpha", 49, 69), enemy("beta", 51, 69), enemy("gamma", 50, 68)]
    .map(target => ({ ...target, hp: 1, maxHp: 8 }));

  const allEvents: Event[] = [];
  for (let i = 0; i < 100 && state.phase === "battle"; i++) {
    const result = stepBattle(state, 50, demoContent);
    state = result.state;
    allEvents.push(...result.events);
  }
  const kills = allEvents.filter(event => event.type === "enemyKilled");
  assert.equal(kills.length, 4);
  assert.equal(new Set(kills.map(event => event.data.entityId)).size, 4);
  assert.ok(kills.every(event => event.data.sourceItemId === "splash-spell"));
  assert.ok(kills.every(event => event.data.sourceCharacterId === "character-1"));
  assert.ok(kills.every(event => event.data.xpCharacterId === "character-1"));
  assert.equal(state.characters[0].xp, 4);
});

function spawnBeam(state: GameState, emit: (type: string, data: Record<string, unknown>) => void, beam: BeamSpec) {
  assert.equal(spawnBeams(state, "character-1", {
    itemId: "beam-spell", definitionId: "test-beam", power: 7, range: 30, casts: 1, beam,
  }, emit), true);
  return state.entities.find(entity => entity.kind === "beam")!;
}

test("beams begin pulsing after their minimum interval and hold their original line", () => {
  const state = stateWith([enemy("aimed-at", 50, 70)]);
  const { events, emit } = recorder();
  const beam = spawnBeam(state, emit, { width: 2, durationMs: 500, tickMs: 50, maxTargets: 3 });
  assert.equal(beam.cooldownMs, BEAM_LIMITS.minTickMs);
  assert.equal(beam.remainingMs, 500);
  state.entities.find(entity => entity.id === "aimed-at")!.x = 55;
  state.entities.push(enemy("old-line", 50, 65));

  advanceBeams(state, 50, emit);
  assert.equal(events.filter(event => event.type === "damage").length, 0);
  advanceBeams(state, 50, emit);
  const hits = events.filter(event => event.type === "damage");
  assert.deepEqual(hits.map(event => event.data.targetId), ["old-line"]);
  assert.equal(hits[0].data.sourceCharacterId, "character-1");
  assert.equal(hits[0].data.sourceItemId, "beam-spell");
});

test("beam width and target cap bound each fixed-line pulse", () => {
  const state = stateWith([
    enemy("near", 50, 70), enemy("inside", 50.8, 68), enemy("outside-width", 51.1, 66),
  ]);
  const { events, emit } = recorder();
  spawnBeam(state, emit, { width: 2, durationMs: 500, tickMs: 100, maxTargets: 50 });
  advanceBeams(state, 100, emit);

  const hits = events.filter(event => event.type === "damage");
  assert.deepEqual(hits.map(event => event.data.targetId), ["near", "inside"]);
  assert.equal(state.entities.find(entity => entity.id === "outside-width")?.hp, 100);
  assert.equal(hits.length, Math.min(2, BEAM_LIMITS.maxTargets));
});

test("beams freeze while paused and are cleaned up when battle reaches defeat", () => {
  const state = stateWith([enemy("target", 50, 70)]);
  const { emit } = recorder();
  spawnBeam(state, emit, { width: 2, durationMs: 1000, tickMs: 100, maxTargets: 1 });
  state.paused = true;
  const frozen = structuredClone(state.entities);
  advanceBeams(state, 1000, emit);
  assert.deepEqual(state.entities, frozen);

  state.paused = false;
  state.territory.hp = 0;
  const afterDefeat = stepBattle(state, 50, demoContent).state;
  assert.equal(afterDefeat.phase, "defeat");
  assert.equal(afterDefeat.entities.some(entity => entity.kind === "beam"), false);
});

test("beam time is frozen by pause, backpack, nonbattle phases and invalid time steps", () => {
  for (const configure of [
    (state: GameState) => { state.paused = true; },
    (state: GameState) => { state.backpackOpen = true; },
    (state: GameState) => { state.phase = "ready"; },
  ]) {
    const state = stateWith([enemy("target", 50, 70)]);
    const { emit } = recorder();
    spawnBeam(state, emit, { width: 2, durationMs: 1000, tickMs: 100, maxTargets: 1 });
    configure(state);
    for (const dt of [100, 0, -10, Number.NaN, Number.POSITIVE_INFINITY]) advanceBeams(state, dt, emit);
    assert.equal(state.entities.find(entity => entity.kind === "beam")?.remainingMs, 1000);
    assert.equal(state.entities.find(entity => entity.kind === "beam")?.attackRemainingMs, 100);
  }
});

test("wave clear removes a live beam entity", () => {
  const state = stateWith([enemy("target", 50, 70)]);
  const { emit } = recorder();
  spawnBeam(state, emit, { width: 2, durationMs: 1000, tickMs: 100, maxTargets: 1 });
  state.entities = state.entities.filter(entity => entity.kind === "beam");
  state.waveSpawnRemaining = 0;
  const cleared = stepBattle(state, 50, demoContent).state;
  assert.equal(cleared.phase, "reward");
  assert.equal(cleared.entities.some(entity => entity.kind === "beam"), false);
});

test("a full shared beam pool leaves the real spell cast unpaid and ready to retry", () => {
  let state = createInitialState();
  state.paused = true;
  state.backpackOpen = true;
  state.items["beam-spell"] = { id: "beam-spell", definitionId: "solar-ray", kind: "spell", level: 1, grade: "common" };
  state.backpack.push("beam-spell");
  const removed = applyLoadoutCommand(state, { id: "remove-starter", type: "removeItem", wandId: "wand-1", itemId: "spark-1" }, demoContent);
  assert.equal(removed.result.status, "executed");
  const placed = applyLoadoutCommand(removed.state, { id: "equip-beam", type: "placeItem", wandId: "wand-1", itemId: "beam-spell", x: 0, y: 0, rotation: 0 }, demoContent);
  assert.equal(placed.result.status, "executed");
  state = placed.state;
  state.paused = false;
  state.backpackOpen = false;
  state.characters[0].manaRegen = 0;
  state = startBattle(state, demoContent).state;
  state.waveSpawnRemaining = 0;
  const target = enemy("target", 50, 70);
  const fullBeams: CombatEntity[] = Array.from({ length: BEAM_LIMITS.alive }, (_, index) => ({
    id: `occupied-${index}`, definitionId: "test-beam", kind: "beam", faction: "player",
    x: 50, y: 84, targetX: 50, targetY: 60, beamWidth: 1, maxTargets: 1,
    hp: 1, maxHp: 1, damage: 1, speed: 0, range: 30, cooldownMs: 100,
    attackRemainingMs: 100, remainingMs: 1000, sourceCharacterId: "character-1", sourceItemId: "other-beam",
  }));
  state.entities = [target, ...fullBeams];
  const mana = state.characters[0].mana;
  state = stepBattle(state, 50, demoContent).state;

  assert.equal(state.entities.filter(entity => entity.kind === "beam").length, BEAM_LIMITS.alive);
  assert.equal(state.events.some(event => event.type === "beamSpawned" && event.data.sourceItemId === "beam-spell"), false);
  assert.equal(state.characters[0].mana, mana);
  assert.equal(state.wands[0].cooldowns["beam-spell"] ?? 0, 0);
});
