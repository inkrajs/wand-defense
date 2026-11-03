import assert from "node:assert/strict";
import test from "node:test";
import type { CombatEntity, GameState } from "../contracts";
import { createFixtureState } from "../runtime/mock";
import { advanceProjectiles, PROJECTILE_LIMITS, spawnProjectiles } from "./projectiles";

type Emit = (type: string, data: Record<string, unknown>) => void;
function projectileState(): GameState {
  const state = createFixtureState();
  state.phase = "battle";
  state.waveSpawnRemaining = 1;
  state.entities = [enemy("target", 50, 70)];
  return state;
}
function enemy(id: string, x: number, y: number, overrides: Partial<CombatEntity> = {}): CombatEntity {
  return { id, definitionId: "enemy-basic", kind: "enemy", faction: "enemy", x, y,
    hp: 100, maxHp: 100, damage: 0, speed: 0, range: 1, cooldownMs: 1000,
    attackRemainingMs: 1000, ...overrides };
}
function recorder() {
  const events: { type: string; data: Record<string, unknown> }[] = [];
  const emit: Emit = (type, data) => events.push({ type, data });
  return { events, emit };
}
function spawn(state: GameState, emit: Emit, casts = 1, speed = 72): boolean {
  return spawnProjectiles(state, "character-1", {
    itemId: "spark-1", definitionId: "spark", power: 11, range: 24, casts, speed,
  }, emit);
}

test("spawn makes real projectile entities without applying damage or consuming caller resources", () => {
  const state = projectileState();
  const { events, emit } = recorder();

  assert.equal(spawn(state, emit), true);
  assert.equal(state.entities.find(entity => entity.id === "target")?.hp, 100);
  const bullets = state.entities.filter(entity => entity.kind === "projectile");
  assert.equal(bullets.length, 1);
  assert.equal(bullets[0].sourceItemId, "spark-1");
  assert.equal(bullets[0].sourceCharacterId, "character-1");
  assert.equal(bullets[0].targetId, "target");
  assert.deepEqual([bullets[0].x, bullets[0].y], [50, 84]);
  assert.deepEqual([bullets[0].originX, bullets[0].originY], [50, 84]);
  assert.deepEqual([bullets[0].targetX, bullets[0].targetY], [50, 70]);
  assert.equal(bullets[0].remainingMs, 5000);
  assert.equal(events.filter(event => event.type === "projectileSpawned").length, 1);
  assert.equal(events.filter(event => event.type === "spellCast").length, 1);
  assert.equal(events.some(event => event.type === "damage"), false);
  assert.equal(state.characters[0].mana, 100);
});

test("projectile retains its launch aim and only damages a moving target on actual contact", () => {
  const state = projectileState();
  const { events, emit } = recorder();
  spawn(state, emit);
  state.entities.find(entity => entity.id === "target")!.y = 68;

  advanceProjectiles(state, 100, emit);
  assert.equal(state.entities.find(entity => entity.id === "target")?.hp, 100);
  const bullet = state.entities.find(entity => entity.kind === "projectile")!;
  assert.deepEqual([bullet.targetX, bullet.targetY], [50, 70]);
  assert.equal(events.some(event => event.type === "damage"), false);

  advanceProjectiles(state, 1000, emit);
  assert.equal(state.entities.find(entity => entity.id === "target")?.hp, 89);
  assert.equal(state.entities.some(entity => entity.kind === "projectile" && entity.hp > 0), false);
  assert.equal(events.filter(event => event.type === "damage").length, 1);
});

test("a dead target leaves its projectile flying until it contacts another enemy", () => {
  const state = projectileState();
  const { events, emit } = recorder();
  spawn(state, emit);
  state.entities.push(enemy("bystander", 50, 76));
  state.entities.find(entity => entity.id === "target")!.hp = 0;

  advanceProjectiles(state, 100, emit);
  assert.equal(state.entities.find(entity => entity.id === "bystander")?.hp, 89);
  const bullet = state.entities.find(entity => entity.kind === "projectile")!;
  assert.equal(bullet.targetId, "target");
  assert.deepEqual([bullet.targetX, bullet.targetY], [50, 70]);
  assert.equal(bullet.hp,0);

  advanceProjectiles(state, 5000, emit);
  assert.equal(state.entities.find(entity => entity.id === "bystander")?.hp, 89);
  assert.equal(state.entities.some(entity => entity.kind === "projectile" && entity.hp > 0), false);
  assert.equal(events.filter(event => event.type === "damage").length,1);
});

test("each double cast creates its own projectile and contact emits one damage per hit", () => {
  const state = projectileState();
  const { events, emit } = recorder();

  assert.equal(spawn(state, emit, 2), true);
  assert.equal(state.entities.filter(entity => entity.kind === "projectile").length, 2);
  advanceProjectiles(state, 5000, emit);

  assert.equal(state.entities.find(entity => entity.id === "target")?.hp, 78);
  assert.equal(events.filter(event => event.type === "damage").length, 2);
  assert.equal(state.entities.filter(entity => entity.kind === "projectile" && entity.hp > 0).length, 0);
});

test("projectiles freeze while paused or backpack is open", () => {
  for (const flag of ["paused", "backpackOpen"] as const) {
    const state = projectileState();
    const { emit } = recorder();
    spawn(state, emit);
    state[flag] = true;
    const before = structuredClone(state.entities);

    advanceProjectiles(state, 5000, emit);
    assert.deepEqual(state.entities, before, `${flag} should freeze projectile state`);
  }
});

test("five second lifetime removes a projectile that cannot reach its destination", () => {
  const state = projectileState();
  const { events, emit } = recorder();
  spawn(state, emit, 1, 1);

  advanceProjectiles(state, 4999, emit);
  assert.equal(state.entities.some(entity => entity.kind === "projectile"), true);
  advanceProjectiles(state, 1, emit);
  const projectile = state.entities.find(entity => entity.kind === "projectile")!;
  assert.equal(projectile.hp, 0);
  assert.equal(projectile.remainingMs, 0);
  assert.equal(events.some(event => event.type === "damage"), false);
});

test("no eligible target does not spawn a projectile", () => {
  const { emit } = recorder();
  const state = projectileState();
  const spec = { itemId: "spark-1", definitionId: "spark", power: 11, range: 24, casts: 1, speed: 72 };

  state.entities = [];
  assert.equal(spawnProjectiles(state, "character-1", spec, emit), false);
  assert.equal(state.entities.length, 0);
});

test("spawnProjectiles uses configured speed for each supported spell", () => {
  const speeds = [72, 50, 100] as const;
  const definitions = ["spark", "fireball", "metal-needle"] as const;
  for (let index = 0; index < definitions.length; index++) {
    const state = projectileState();
    const definitionId = definitions[index];
    state.items["spark-1"].definitionId = definitionId;
    const { emit } = recorder();
    assert.equal(spawnProjectiles(state, "character-1", {
      itemId: "spark-1", definitionId, power: 11, range: 30, casts: 1, speed: speeds[index],
    }, emit), true);
    assert.equal(state.entities.find(entity => entity.kind === "projectile")?.speed, speeds[index]);
  }
});

test("fireball projectiles begin at eighteen percent speed and use a 600ms ramp", () => {
  const state = projectileState();
  const { emit } = recorder();
  spawnProjectiles(state, "character-1", {
    itemId: "spark-1", definitionId: "fireball", power: 25, range: 30, casts: 1, speed: 50,
  }, emit);
  const bullet = state.entities.find(entity => entity.kind === "projectile")!;

  assert.equal(bullet.moveSpeed, 9);
  assert.equal(bullet.moveRampMs, 600);
});


test("large copy counts respect per-cast and shared alive budgets and report actual shots", () => {
  const state = projectileState();
  const { events, emit } = recorder();
  assert.equal(spawn(state, emit, 2401), true);
  assert.equal(state.entities.filter(entity => entity.kind === "projectile").length, PROJECTILE_LIMITS.perCast);
  assert.equal(events.find(event => event.type === "spellCast")?.data.casts, PROJECTILE_LIMITS.perCast);
  while (state.entities.filter(entity => entity.kind === "projectile").length < PROJECTILE_LIMITS.alive) {
    assert.equal(spawn(state, emit, 2401), true);
  }
  const full = structuredClone(state); const eventCount = events.length;
  assert.equal(spawn(state, emit, 2401), false);
  assert.deepEqual(state, full); assert.equal(events.length, eventCount);
  const shots = state.entities.filter(entity => entity.kind === "projectile");
  shots[0].hp = 0;
  shots[1].remainingMs = 0;
  assert.equal(spawn(state, emit, 2401), true);
  assert.equal(events.at(-1)?.type, "spellCast");
  assert.equal(events.at(-1)?.data.casts, 2);
  assert.equal(state.entities.filter(entity => entity.kind === "projectile" && entity.hp > 0 && (entity.remainingMs ?? 1) > 0).length, PROJECTILE_LIMITS.alive);
  assert.equal(new Set(state.entities.map(entity => entity.id)).size, state.entities.length);
});
