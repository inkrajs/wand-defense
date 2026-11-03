import assert from "node:assert/strict";
import test from "node:test";
import type { CombatEntity, GameState } from "../contracts";
import { getMonsterSize } from "../content/monsters";
import { createInitialState } from "../runtime/initial";
import { advanceProjectiles, spawnProjectiles } from "./projectiles";
import { buildProjectileCollisionCandidates, firstProjectileCollision } from "./projectileCollision";

interface ReferenceHit {
  target: CombatEntity;
  x: number;
  y: number;
  distance: number;
}

/** Preserved pre-cache collision scan. Keep this independent of production helpers. */
function referenceFirstProjectileCollision(
  state: GameState,
  from: { x: number; y: number },
  to: { x: number; y: number },
  excluded: ReadonlySet<string>,
): ReferenceHit | undefined {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const ux = length > 0 ? dx / length : 0;
  const uy = length > 0 ? dy / length : 0;
  let first: ReferenceHit | undefined;
  for (const target of state.entities) {
    if (target.kind !== "enemy" || target.faction !== "enemy" || target.hp <= 0 || excluded.has(target.id)
      || !Number.isFinite(target.x) || !Number.isFinite(target.y)) continue;
    const radius = getMonsterSize(target).hitRadius;
    const ox = target.x - from.x;
    const oy = target.y - from.y;
    const projection = ox * ux + oy * uy;
    const perpendicular = ox * ox + oy * oy - projection * projection;
    if (perpendicular > radius * radius + 1e-8) continue;
    const root = Math.sqrt(Math.max(0, radius * radius - perpendicular));
    let distance = projection - root;
    if (distance < 0) {
      if (ox * ox + oy * oy <= radius * radius) distance = 0;
      else continue;
    }
    if (distance > length + 1e-8) continue;
    if (!first || distance < first.distance - 1e-8
      || (Math.abs(distance - first.distance) < 1e-8 && target.id < first.target.id)) {
      first = { target, x: from.x + ux * distance, y: from.y + uy * distance, distance };
    }
  }
  return first;
}

function enemy(id: string, x: number, y: number, options: Partial<CombatEntity> = {}): CombatEntity {
  return {
    id, definitionId: "enemy-basic", kind: "enemy", faction: "enemy", x, y,
    hp: 100, maxHp: 100, damage: 0, speed: 0, range: 0, cooldownMs: 1000, attackRemainingMs: 1000,
    ...options,
  };
}

function collisionState(targets: CombatEntity[]): GameState {
  const state = createInitialState();
  state.entities = targets;
  return state;
}

function assertCachedEqualsReference(
  state: GameState,
  from: { x: number; y: number },
  to: { x: number; y: number },
  excluded: ReadonlySet<string> = new Set(),
  candidates = buildProjectileCollisionCandidates(state),
): void {
  const expected = referenceFirstProjectileCollision(state, from, to, excluded);
  const actual = firstProjectileCollision(state, from, to, excluded, candidates, 0);
  assert.equal(actual?.target.id, expected?.target.id);
  if (!expected || !actual) return;
  assert.equal(actual.x, expected.x);
  assert.equal(actual.y, expected.y);
  assert.equal(actual.distance, expected.distance);
}

test("cached collision scan matches the preserved formula across deterministic size/grid samples", () => {
  const sizes = ["small", "normal", "large", "huge", "colossal"] as const;
  const targets = Array.from({ length: 240 }, (_, index) => {
    const x = 20 + ((index * 37) % 61);
    const y = -8 + ((index * 29) % 102);
    const bodySize = sizes[index % sizes.length];
    const kind = index % 41 === 0 ? "building" : "enemy";
    const faction = index % 37 === 0 ? "player" : "enemy";
    const hp = index % 43 === 0 ? 0 : 100;
    const finiteX = index % 47 === 0 ? Number.NaN : x;
    return enemy(`grid-${String(index).padStart(3, "0")}`, finiteX, y, { bodySize, kind, faction, hp });
  });
  const state = collisionState(targets);
  const candidates = buildProjectileCollisionCandidates(state);
  const segments = Array.from({ length: 64 }, (_, index) => {
    const from = { x: 5 + (index * 17) % 91, y: 5 + (index * 31) % 91 };
    const to = { x: 5 + (index * 43 + 11) % 91, y: 5 + (index * 13 + 29) % 91 };
    return { from, to, excluded: index % 4 === 0 ? new Set([`grid-${String((index * 7) % 240).padStart(3, "0")}`]) : new Set<string>() };
  });
  for (const { from, to, excluded } of segments) {
    assertCachedEqualsReference(state, from, to, excluded, candidates);
  }
  const negativeYState = collisionState([enemy("offscreen-top", 50, -2, { bodySize: "huge" })]);
  const negativeYCandidates = buildProjectileCollisionCandidates(negativeYState);
  assert.equal(negativeYCandidates.length, 1);
  assertCachedEqualsReference(negativeYState, { x: 50, y: -10 }, { x: 50, y: 10 }, new Set(), negativeYCandidates);
});

test("cached scan preserves grazing, exact ties, exclusions and first-hit ordering", () => {
  const largeOnly = collisionState([enemy("large-edge", 51.5, 60, { definitionId: "boss-minor" })]);
  const largeOnlyCandidates = buildProjectileCollisionCandidates(largeOnly);
  assertCachedEqualsReference(largeOnly, { x: 50, y: 70 }, { x: 50, y: 50 }, new Set(), largeOnlyCandidates);
  assert.equal(firstProjectileCollision(largeOnly, { x: 50, y: 70 }, { x: 50, y: 50 }, new Set(), largeOnlyCandidates, 0)?.target.id, "large-edge");
  largeOnly.entities[0].bodySize = "small";
  const nextAdvanceCandidates = buildProjectileCollisionCandidates(largeOnly);
  assertCachedEqualsReference(largeOnly, { x: 50, y: 70 }, { x: 50, y: 50 }, new Set(), nextAdvanceCandidates);
  assert.equal(firstProjectileCollision(largeOnly, { x: 50, y: 70 }, { x: 50, y: 50 }, new Set(), nextAdvanceCandidates, 0), undefined,
    "the next simulation advance uses the updated small-monster radius");

  const grazing = collisionState([
    enemy("grazing-large", 51.5, 60, { definitionId: "boss-minor" }),
    enemy("grazing-small", 51.5001, 60, { bodySize: "small" }),
    enemy("nearer", 50.5, 65),
  ]);
  const grazingCandidates = buildProjectileCollisionCandidates(grazing);
  assertCachedEqualsReference(grazing, { x: 50, y: 70 }, { x: 50, y: 50 }, new Set(), grazingCandidates);

  const tied = collisionState([enemy("zeta", 50, 60), enemy("alpha", 50, 60)]);
  const tieCandidates = buildProjectileCollisionCandidates(tied);
  const hit = firstProjectileCollision(tied, { x: 50, y: 70 }, { x: 50, y: 50 }, new Set(), tieCandidates, 0);
  assertCachedEqualsReference(tied, { x: 50, y: 70 }, { x: 50, y: 50 }, new Set(), tieCandidates);
  assert.equal(hit?.target.id, "alpha");
  assertCachedEqualsReference(tied, { x: 50, y: 70 }, { x: 50, y: 50 }, new Set(["alpha"]), tieCandidates);
  assert.equal(firstProjectileCollision(tied, { x: 50, y: 70 }, { x: 50, y: 50 }, new Set(["alpha"]), tieCandidates, 0)?.target.id, "zeta");

  const chainedTies = collisionState([
    enemy("c", 3, 0),
    enemy("b", 3 + 0.9e-8, 0),
    enemy("a", 3 + 1.8e-8, 0),
  ]);
  const chainedCandidates = buildProjectileCollisionCandidates(chainedTies);
  assertCachedEqualsReference(chainedTies, { x: 0, y: 0 }, { x: 10, y: 0 }, new Set(), chainedCandidates);
  assert.equal(firstProjectileCollision(chainedTies, { x: 0, y: 0 }, { x: 10, y: 0 }, new Set(), chainedCandidates, 0)?.target.id, "a");
  assert.equal(referenceFirstProjectileCollision(chainedTies, { x: 0, y: 0 }, { x: 10, y: 0 }, new Set())?.target.id, "a",
    "the preserved pairwise epsilon comparison can advance through adjacent 0.9e-8 distance ties");
});

test("cached candidates recheck live health and filters; empty candidate sets return no contact", () => {
  const dead = enemy("dead", 50, 60);
  const changedFaction = enemy("changed-faction", 50, 55);
  const changedKind = enemy("changed-kind", 50, 50);
  const changedPosition = enemy("changed-position", 50, 45);
  const state = collisionState([dead, changedFaction, changedKind, changedPosition]);
  const candidates = buildProjectileCollisionCandidates(state);
  dead.hp = 0;
  changedFaction.faction = "player";
  changedKind.kind = "building";
  changedPosition.x = Number.NaN;
  assert.equal(referenceFirstProjectileCollision(state, { x: 50, y: 70 }, { x: 50, y: 50 }, new Set()), undefined);
  assertCachedEqualsReference(state, { x: 50, y: 70 }, { x: 50, y: 50 }, new Set(), candidates);

  const filtered = collisionState([
    enemy("dead-at-entry", 50, 60, { hp: 0 }),
    enemy("friendly-at-entry", 50, 60, { faction: "player" }),
    enemy("wrong-kind", 50, 60, { kind: "building" }),
    enemy("nonfinite-x", Number.POSITIVE_INFINITY, 60),
    enemy("nonfinite-y", 50, Number.NaN),
  ]);
  const filteredCandidates = buildProjectileCollisionCandidates(filtered);
  assert.equal(filteredCandidates.length, 0);
  assert.equal(referenceFirstProjectileCollision(filtered, { x: 50, y: 70 }, { x: 50, y: 50 }, new Set()), undefined);
  assert.equal(firstProjectileCollision(filtered, { x: 50, y: 70 }, { x: 50, y: 50 }, new Set(), filteredCandidates, 0), undefined);
  assert.equal(buildProjectileCollisionCandidates(collisionState([])).length, 0);
});

test("projectile radius expands contact while nonfinite or negative values retain zero-radius behavior", () => {
  const normalRadius = getMonsterSize(enemy("radius-probe", 0, 0)).hitRadius;
  const grazingOffset = normalRadius + 0.2;
  const state = collisionState([
    enemy("zeta", 50 + grazingOffset, 60),
    enemy("alpha", 50 + grazingOffset, 60),
    enemy("later", 50 + grazingOffset + 0.1, 60),
  ]);
  const candidates = buildProjectileCollisionCandidates(state);
  const from = { x: 50, y: 70 };
  const to = { x: 50, y: 50 };

  const legacy = referenceFirstProjectileCollision(state, from, to, new Set());
  const zeroRadius = firstProjectileCollision(state, from, to, new Set(), candidates, 0);
  assert.equal(zeroRadius?.target.id, legacy?.target.id);
  assert.equal(firstProjectileCollision(state, from, to, new Set(), candidates, 0), undefined,
    "the legacy zero-radius projectile narrowly misses these normal monsters");

  const expanded = firstProjectileCollision(state, from, to, new Set(), candidates, 0.4);
  assert.equal(expanded?.target.id, "alpha", "expanded contact uses earliest distance then lexical tie-break");
  assert.ok(expanded && expanded.distance < 10);

  for (const invalidRadius of [Number.NaN, Number.POSITIVE_INFINITY, -0.4]) {
    const invalid = firstProjectileCollision(state, from, to, new Set(), candidates, invalidRadius);
    assert.equal(invalid?.target.id, legacy?.target.id,
      "nonfinite and negative projectile radii match the preserved zero-radius formula");
  }
});

test("real advances share live candidates so a piercing shot skips a kill and continues through later targets", () => {
  const state = createInitialState();
  state.phase = "battle";
  state.wave = 1;
  state.waveSpawnRemaining = 1;
  state.entities = [enemy("A", 50, 70, { hp: 10, maxHp: 10 }), enemy("B", 50, 64), enemy("C", 50, 58)];
  const events: { type: string; data: Record<string, unknown> }[] = [];
  const emit = (type: string, data: Record<string, unknown>) => events.push({ type, data });
  const rngBefore = state.rngState;

  assert.equal(spawnProjectiles(state, "character-1", {
    itemId: "first-shot", definitionId: "first-shot", power: 10, range: 100, casts: 1, speed: 200,
  }, emit), true);
  assert.equal(spawnProjectiles(state, "character-1", {
    itemId: "piercing-shot", definitionId: "piercing-shot", power: 10, range: 100, casts: 1, speed: 200,
    impact: { type: "pierce", maxTargets: 3 },
  }, emit), true);

  advanceProjectiles(state, 100, emit);
  assert.deepEqual(events.filter(event => event.type === "damage").map(event => event.data.targetId), ["A", "B"]);
  assert.equal(state.entities.find(entity => entity.id === "A")?.hp, 0);
  assert.equal(state.entities.find(entity => entity.id === "B")?.hp, 90);
  assert.equal(state.entities.find(entity => entity.id === "C")?.hp, 100);
  const piercing = state.entities.find(entity => entity.sourceItemId === "piercing-shot" && entity.kind === "projectile");
  assert.deepEqual(piercing?.hitIds, ["B"]);
  assert.equal(piercing?.targetId, undefined, "piercing continues along its heading rather than retargeting");
  assert.ok((piercing?.headingY ?? 0) < 0);

  advanceProjectiles(state, 50, emit);
  assert.deepEqual(events.filter(event => event.type === "damage").map(event => event.data.targetId), ["A", "B", "C"]);
  assert.deepEqual(piercing?.hitIds, ["B", "C"]);
  assert.equal(state.rngState, rngBefore);
});
