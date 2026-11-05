import assert from "node:assert/strict";
import test from "node:test";
import type { CombatEntity, ContentCatalog, GameState } from "../contracts";
import { demoContent } from "../content/demo";
import { createInitialState } from "../runtime/initial";
import { castSpell } from "./effects";
import { advanceAreaEffects, AREA_LIMITS, spawnAreaEffects, type AreaCastSpec } from "./areaEffects";

function enemy(id: string, x: number, y: number, overrides: Partial<CombatEntity> = {}): CombatEntity {
  return { id, definitionId: "enemy-basic", kind: "enemy", faction: "enemy", x, y,
    hp: 100, maxHp: 100, damage: 0, speed: 0, range: 0, cooldownMs: 1000,
    attackRemainingMs: 1000, ...overrides };
}

function battle(enemies: CombatEntity[] = [enemy("target", 50, 60)]): GameState {
  const state = createInitialState();
  state.phase = "battle";
  state.wave = 1;
  state.entities = [...enemies];
  return state;
}

function spec(area: AreaCastSpec["area"], overrides: Partial<AreaCastSpec> = {}): AreaCastSpec {
  return { itemId: "test-item", definitionId: "test-area", power: 10, range: 36, casts: 1, area, ...overrides };
}

function capture() {
  const events: { type: string; data: Record<string, unknown> }[] = [];
  return { events, emit: (type: string, data: Record<string, unknown>) => events.push({ type, data }) };
}

test("meteor showers resolve separate delayed impacts on nearby enemies and obey the area budget", () => {
  const state = battle([enemy("first", 50, 60), enemy("second", 60, 60)]);
  const { events, emit } = capture();
  const area = { mode: "strike" as const, radius: 2, delayMs: 100, durationMs: 200, maxTargets: 1,
    shower: { count: 3, intervalMs: 250, spread: 6 } };
  assert.equal(spawnAreaEffects(state, "character-1", spec(area), emit), true);
  const impacts = state.entities.filter(entity => entity.kind === "area");
  assert.equal(impacts.length, 3);
  assert.deepEqual(impacts.map(impact => impact.launchDelayMs), [100, 350, 600]);
  assert.deepEqual(impacts.map(impact => impact.x), [50, 60, 50]);
  state.paused = true;
  advanceAreaEffects(state, 1000, emit);
  assert.equal(state.entities[0].hp, 100);
  state.paused = false;
  advanceAreaEffects(state, 100, emit);
  assert.equal(state.entities[0].hp, 90);
  assert.equal(state.entities[1].hp, 100);
  advanceAreaEffects(state, 250, emit);
  assert.equal(state.entities[1].hp, 90);
  advanceAreaEffects(state, 250, emit);
  assert.equal(state.entities[0].hp, 80);
  assert.equal(events.filter(event => event.type === "areaActivated").length, 3);

  const crowded = battle();
  assert.equal(spawnAreaEffects(crowded, "character-1", spec(area, { burstCount: 6 }), emit), true);
  assert.equal(crowded.entities.filter(entity => entity.kind === "area").length, AREA_LIMITS.perCast);
});

test("worldfall strikes with a stronger giant meteor and smaller impacts clustered around it", () => {
  const state = battle([enemy("center", 50, 60, {hp: 500, maxHp: 500}), enemy("edge", 62, 60, {hp: 500, maxHp: 500})]);
  const spell = demoContent.spells.worldfall;
  state.items["spark-1"].definitionId = spell.id;
  const { events, emit } = capture();
  assert.equal(castSpell(state, "character-1", {itemId: "spark-1", definitionId: spell.id, power: spell.power,
    manaCost: spell.manaCost, cooldownMs: spell.cooldownMs, range: spell.range, casts: 1}, demoContent, emit), true);

  const impacts = state.entities.filter(entity => entity.kind === "area");
  const [giant, ...fragments] = impacts;
  assert.equal(impacts.length, 6);
  assert.equal(giant.areaImpactRole, "primary");
  assert.ok(fragments.every(fragment => fragment.areaImpactRole === "fragment"));
  assert.equal(giant.area!.radius, 16.5);
  assert.equal(giant.damage, 78);
  assert.ok(fragments.every(fragment => fragment.area!.radius === 5.5 && fragment.damage === 26));
  assert.ok(fragments.every(fragment => Math.hypot(fragment.x - giant.x, fragment.y - giant.y) <= 12));
  assert.deepEqual(impacts.map(impact => impact.launchDelayMs), [800, 960, 1120, 1280, 1440, 1600]);

  advanceAreaEffects(state, 799, emit);
  assert.equal(state.entities[0].hp, 500);
  advanceAreaEffects(state, 1, emit);
  assert.equal(state.entities[0].hp, 422);
  assert.equal(state.entities[1].hp, 422, "the giant impact reaches beyond a fragment's radius");
  advanceAreaEffects(state, 160, emit);
  assert.equal(state.entities[0].hp, 396, "the first fragment deals its own smaller hit");
  assert.equal(events.filter(event => event.type === "areaActivated").length, 2);
});

test("composite impacts retain size scaling and obey the payload and active-area budgets", () => {
  const state = battle([]);
  const { emit } = capture();
  const area = structuredClone(demoContent.spells.worldfall.area!);
  area.radius *= 1.3; // A compiled area modifier scales both the primary and fragments.
  assert.equal(spawnAreaEffects(state, "character-1", spec(area, {position: {x: 40, y: 40}, maxCasts: 2}), emit), true);
  const impacts = state.entities.filter(entity => entity.kind === "area");
  assert.equal(impacts.length, 2);
  assert.deepEqual(impacts.map(impact => impact.areaImpactRole), ["primary", "fragment"]);
  assert.ok(Math.abs(impacts[0].area!.radius - 21.45) < 1e-9);
  assert.ok(Math.abs(impacts[1].area!.radius - 7.15) < 1e-9);
  assert.deepEqual([impacts[0].x, impacts[0].y], [40, 40]);

  const crowded = battle();
  assert.equal(spawnAreaEffects(crowded, "character-1", spec(area, {burstCount: 6}), emit), true);
  assert.equal(crowded.entities.filter(entity => entity.kind === "area").length, AREA_LIMITS.perCast);
  const extreme = battle();
  assert.equal(spawnAreaEffects(extreme, "character-1", spec(area, {power: Number.MAX_VALUE}), emit), true);
  assert.ok(extreme.entities.filter(entity => entity.kind === "area").every(entity => Number.isFinite(entity.damage)));
});

test("castSpell dispatches delayed strike areas without immediate damage and respects pause", () => {
  const state = battle();
  state.items["spark-1"].definitionId = "test-area";
  const spell = { ...demoContent.spells.spark, id: "test-area", effect: "area" as const,
    area: { mode: "strike" as const, radius: 3, delayMs: 300, durationMs: 250, maxTargets: 3 } };
  const content: ContentCatalog = { ...demoContent, spells: { ...demoContent.spells, "test-area": spell } };
  const { events, emit } = capture();

  assert.equal(castSpell(state, "character-1", { itemId: "spark-1", definitionId: "test-area",
    power: 24, manaCost: 0, cooldownMs: 0, range: 36, casts: 1 }, content, emit), true);
  const area = state.entities.find(entity => entity.kind === "area")!;
  assert.equal(state.entities[0].hp, 100);
  assert.equal(area.x, 50);
  assert.equal(area.y, 60);
  assert.equal(events.filter(event => event.type === "areaSpawned").length, 1);
  assert.equal(events.filter(event => event.type === "spellCast").length, 1);

  state.paused = true;
  advanceAreaEffects(state, 300, emit);
  assert.equal(area.launchDelayMs, 300);
  state.paused = false;
  advanceAreaEffects(state, 299, emit);
  assert.equal(state.entities[0].hp, 100);
  advanceAreaEffects(state, 1, emit);
  assert.equal(state.entities[0].hp, 76);
  assert.equal(events.filter(event => event.type === "areaActivated").length, 1);
  advanceAreaEffects(state, 100, emit);
  assert.equal(state.entities[0].hp, 76);
  assert.equal(events.filter(event => event.type === "areaActivated").length, 1);
});

test("castSpell uses compiled area, impact, and beam metadata over definition defaults", () => {
  const areaState = battle([enemy("primary", 50, 60), enemy("expanded-only", 55, 60)]);
  areaState.items["spark-1"].definitionId = "compiled-area";
  const areaDefinition = { ...demoContent.spells.spark, id: "compiled-area", effect: "area" as const,
    area: { mode: "strike" as const, radius: 3, delayMs: 0, durationMs: 250, maxTargets: 3 } };
  const areaContent: ContentCatalog = { ...demoContent, spells: { ...demoContent.spells, "compiled-area": areaDefinition } };
  const { emit } = capture();
  assert.equal(castSpell(areaState, "character-1", { itemId: "spark-1", definitionId: "compiled-area",
    power: 5, manaCost: 0, cooldownMs: 0, range: 36, casts: 1,
    area: { ...areaDefinition.area, radius: 6 } }, areaContent, emit), true);
  const area = areaState.entities.find(entity => entity.kind === "area")!;
  assert.equal(area.area!.radius, 6);
  advanceAreaEffects(areaState, 1, emit);
  assert.equal(areaState.entities.find(entity => entity.id === "primary")!.hp, 95);
  assert.equal(areaState.entities.find(entity => entity.id === "expanded-only")!.hp, 95);

  const impactState = battle();
  impactState.items["spark-1"].definitionId = "compiled-impact";
  const impactDefinition = { ...demoContent.spells.spark, id: "compiled-impact",
    impact: { type: "splash" as const, radius: 2, maxTargets: 2 } };
  const impactContent: ContentCatalog = { ...demoContent, spells: { ...demoContent.spells, "compiled-impact": impactDefinition } };
  assert.equal(castSpell(impactState, "character-1", { itemId: "spark-1", definitionId: "compiled-impact",
    power: 5, manaCost: 0, cooldownMs: 0, range: 36, casts: 1, impact: { ...impactDefinition.impact, radius: 9 } },
  impactContent, emit), true);
  const projectileImpact = impactState.entities.find(entity => entity.kind === "projectile")!.impact;
  assert.equal(projectileImpact?.type, "splash");
  assert.equal(projectileImpact?.type === "splash" ? projectileImpact.radius : undefined, 9);

  const beamState = battle();
  beamState.items["spark-1"].definitionId = "compiled-beam";
  const beamDefinition = { ...demoContent.spells.spark, id: "compiled-beam", effect: "beam" as const,
    beam: { width: 1, durationMs: 300, tickMs: 100, maxTargets: 1 } };
  const beamContent: ContentCatalog = { ...demoContent, spells: { ...demoContent.spells, "compiled-beam": beamDefinition } };
  assert.equal(castSpell(beamState, "character-1", { itemId: "spark-1", definitionId: "compiled-beam",
    power: 5, manaCost: 0, cooldownMs: 0, range: 36, casts: 1, beam: { ...beamDefinition.beam, width: 8 } },
  beamContent, emit), true);
  assert.equal(beamState.entities.find(entity => entity.kind === "beam")!.beamWidth, 8);
});

test("a delayed ground area stays at its cast snapshot and misses a target that moved away", () => {
  const state = battle();
  const { events, emit } = capture();
  assert.equal(spawnAreaEffects(state, "character-1", spec({ mode: "eruption", radius: 2,
    delayMs: 100, durationMs: 300, maxTargets: 5 }), emit), true);
  const area = state.entities.find(entity => entity.kind === "area")!;
  const target = state.entities[0];
  const ground = { x: area.x, y: area.y };
  target.x = 57;
  advanceAreaEffects(state, 100, emit);
  assert.equal(target.hp, 100);
  assert.deepEqual({ x: area.x, y: area.y }, ground);
  target.x = ground.x;
  advanceAreaEffects(state, 100, emit);
  assert.equal(target.hp, 100);
  assert.deepEqual(area.hitIds, []);
  assert.equal(events.filter(event => event.type === "areaActivated").length, 1);
});

test("an expanding ring reaches enemies progressively and contacts each only once", () => {
  const state = battle([enemy("ring-target", 50, 70)]);
  const { events, emit } = capture();
  assert.equal(spawnAreaEffects(state, "character-1", spec({ mode: "ring", radius: 18,
    delayMs: 0, durationMs: 650, maxTargets: 8 }, { range: 18, power: 12 }), emit), true);
  const area = state.entities.find(entity => entity.kind === "area")!;
  const target = state.entities[0];
  assert.equal(target.hp, 100);
  assert.equal(area.area!.radius, 18);
  advanceAreaEffects(state, 100, emit);
  assert.equal(target.hp, 100);
  advanceAreaEffects(state, 400, emit);
  assert.equal(target.hp, 88);
  assert.deepEqual(area.hitIds, ["ring-target"]);
  advanceAreaEffects(state, 200, emit);
  assert.equal(target.hp, 88);
  assert.equal(area.hp, 0);
  assert.equal(events.filter(event => event.type === "damage").length, 1);
});

test("global fields pulse repeatedly but reject enemies whose centers are outside the field", () => {
  const targets = [enemy("inside", 50, 51), enemy("negative-y", 50, -0.1),
    enemy("outside-x", 100.1, 50), enemy("outside-y", 50, 100.1)];
  const state = battle(targets);
  const { events, emit } = capture();
  assert.equal(spawnAreaEffects(state, "character-1", spec({ mode: "field", radius: 75,
    delayMs: 0, durationMs: 2400, maxTargets: 64, tickMs: 400, anchor: "field" }, { range: 75 }), emit), true);
  const area = state.entities.find(entity => entity.kind === "area")!;
  assert.equal(area.x, 50);
  assert.equal(area.y, 50);
  assert.equal(area.area!.durationMs, 2400);
  assert.equal(area.area!.maxTargets, 64);
  advanceAreaEffects(state, 399, emit);
  assert.deepEqual(targets.map(target => target.hp), [100, 100, 100, 100]);
  advanceAreaEffects(state, 1, emit);
  assert.deepEqual(targets.map(target => target.hp), [90, 100, 100, 100]);
  advanceAreaEffects(state, 400, emit);
  assert.deepEqual(targets.map(target => target.hp), [80, 100, 100, 100]);
  assert.equal(events.filter(event => event.type === "damage").length, 2);
});

test("vortex uses deterministic in-bounds waypoints, pulls without crossing center, and pulses there", () => {
  const state = battle([enemy("pulled", 50, 84), enemy("centered", 50, 84)]);
  const { events, emit } = capture();
  assert.equal(spawnAreaEffects(state, "character-1", spec({ mode: "vortex", radius: 8,
    delayMs: 0, durationMs: 4000, maxTargets: 8, tickMs: 400, anchor: "caster",
    moveSpeed: 12, pullRadius: 12, pullStrength: 8 }), emit), true);
  const area = state.entities.find(entity => entity.kind === "area")!;
  const twin = structuredClone(state);
  const twinArea = twin.entities.find(entity => entity.kind === "area")!;
  const rngState = state.rngState;
  assert.equal(area.x, 50);
  assert.equal(area.y, 84);
  assert.ok(area.targetX! >= 0 && area.targetX! <= 100);
  assert.ok(area.targetY! >= 0 && area.targetY! <= 100);

  for (let step = 0; step < 8; step++) {
    advanceAreaEffects(state, 50, emit);
    advanceAreaEffects(twin, 50, () => {});
  }

  const movedTarget = state.entities.find(entity => entity.id === "pulled")!;
  const centeredTarget = state.entities.find(entity => entity.id === "centered")!;
  assert.ok(area.x < 50 && area.y < 84);
  assert.ok(Math.hypot(movedTarget.x - area.x, movedTarget.y - area.y) < 4);
  assert.ok(centeredTarget.x >= area.x - 1e-8 && centeredTarget.y >= area.y - 1e-8,
    "pulling never steps through the vortex center");
  assert.deepEqual({ x: area.x, y: area.y, targetX: area.targetX, targetY: area.targetY },
    { x: twinArea.x, y: twinArea.y, targetX: twinArea.targetX, targetY: twinArea.targetY });
  assert.deepEqual({ x: movedTarget.x, y: movedTarget.y, hp: movedTarget.hp },
    { x: twin.entities.find(entity => entity.id === "pulled")!.x,
      y: twin.entities.find(entity => entity.id === "pulled")!.y,
      hp: twin.entities.find(entity => entity.id === "pulled")!.hp });
  assert.equal(state.rngState, rngState);
  assert.equal(movedTarget.hp, 90);
  assert.equal(centeredTarget.hp, 90);
  assert.equal(events.filter(event => event.type === "damage").length, 2);
});

test("target limits count misses as contacts and use stable distance then id order", () => {
  const targets = [enemy("first", 50, 60), enemy("second", 51, 60), enemy("third", 52, 60)];
  const state = battle(targets);
  const { events, emit } = capture();
  assert.equal(spawnAreaEffects(state, "character-1", spec({ mode: "strike", radius: 3,
    delayMs: 0, durationMs: 250, maxTargets: 2 }, { attackRoll: {
      accuracy: 0, critChance: 0, critMultiplier: 2, sourceLuck: 0,
    } }), emit), true);
  const area = state.entities.find(entity => entity.kind === "area")!;
  advanceAreaEffects(state, 1, emit);
  assert.deepEqual(area.hitIds, ["first", "second"]);
  assert.deepEqual(targets.map(target => target.hp), [100, 100, 100]);
  assert.equal(events.filter(event => event.type === "attackMiss").length, 2);
  const seed = state.rngState;
  advanceAreaEffects(state, 100, emit);
  assert.equal(state.rngState, seed);
  assert.deepEqual(area.hitIds, ["first", "second"]);
});

test("area contacts use the normal critical damage and source event path", () => {
  const state = battle();
  const { events, emit } = capture();
  assert.equal(spawnAreaEffects(state, "character-1", spec({ mode: "strike", radius: 3,
    delayMs: 0, durationMs: 250, maxTargets: 1 }, { power: 10, attackRoll: {
      accuracy: 1, critChance: 1, critMultiplier: 2, sourceLuck: 7,
    } }), emit), true);
  advanceAreaEffects(state, 1, emit);
  assert.equal(state.entities[0].hp, 80);
  const damage = events.find(event => event.type === "damage")!;
  assert.equal(damage.data.areaId, state.entities.find(entity => entity.kind === "area")!.id);
  assert.equal(damage.data.critical, true);
  assert.equal(damage.data.sourceLuck, 7);
});

test("double split casts create separate branches and resolve each branch once", () => {
  const state = battle();
  const { events, emit } = capture();
  assert.equal(spawnAreaEffects(state, "character-1", spec({ mode: "eruption", radius: 3,
    delayMs: 0, durationMs: 300, maxTargets: 1 }, { power: 10, casts: 4, burstCount: 2, splitCount: 2 }), emit), true);
  const areas = state.entities.filter(entity => entity.kind === "area");
  assert.equal(areas.length, 4);
  assert.notDeepEqual({ x: areas[0].x, y: areas[0].y }, { x: areas[1].x, y: areas[1].y });
  advanceAreaEffects(state, 1, emit);
  assert.equal(state.entities[0].hp, 80);
  assert.equal(events.filter(event => event.type === "areaActivated").length, 2);
  advanceAreaEffects(state, 119, emit);
  assert.equal(state.entities[0].hp, 60);
  assert.equal(events.filter(event => event.type === "areaActivated").length, 4);
  advanceAreaEffects(state, 50, emit);
  assert.equal(state.entities[0].hp, 60);
  assert.equal(events.filter(event => event.type === "damage").length, 4);
});

test("area budgets cap casts, targets, radius, duration, alive count, and lifetime", () => {
  const state = battle();
  const { emit } = capture();
  const oversized = spec({ mode: "strike", radius: 500, delayMs: 5000, durationMs: 9000, maxTargets: 99 },
    { casts: 64, range: 100 });
  for (let cast = 0; cast < AREA_LIMITS.alive / AREA_LIMITS.perCast; cast++) {
    assert.equal(spawnAreaEffects(state, "character-1", oversized, emit), true);
  }
  const areas = state.entities.filter(entity => entity.kind === "area");
  assert.equal(areas.length, AREA_LIMITS.alive);
  for (const area of areas) {
    assert.equal(area.area!.radius, AREA_LIMITS.maxRadius);
    assert.equal(area.area!.maxTargets, AREA_LIMITS.maxTargets);
    assert.ok(area.area!.delayMs <= AREA_LIMITS.maxDelayMs + 7 * 120);
    assert.ok(area.area!.durationMs <= AREA_LIMITS.maxDurationMs);
    assert.ok(area.area!.delayMs + area.area!.durationMs <= AREA_LIMITS.maxTotalLifetimeMs);
  }
  assert.equal(spawnAreaEffects(state, "character-1", oversized, emit), false);

  const first = areas[0];
  advanceAreaEffects(state, first.launchDelayMs!, emit);
  assert.equal(first.launchDelayMs, undefined);
  advanceAreaEffects(state, first.remainingMs!, emit);
  assert.equal(first.hp, 0);
  assert.equal(first.remainingMs, 0);

  const ringState = battle();
  assert.equal(spawnAreaEffects(ringState, "character-1", spec({ mode: "ring", radius: 500,
    delayMs: 0, durationMs: 650, maxTargets: 8 }, { range: 500 }), emit), true);
  const ring = ringState.entities.find(entity => entity.kind === "area")!;
  assert.equal(ring.range, AREA_LIMITS.maxRadius);
  assert.equal(ring.area!.radius, AREA_LIMITS.maxRadius);
});

test("meteor falls on the targeted area after its delay and burns nearby enemies", () => {
  const state = battle([enemy("primary", 50, 60), enemy("nearby", 54, 60), enemy("distant", 70, 60)]);
  state.items["spark-1"].definitionId = "meteor";
  const meteor = demoContent.spells.meteor;
  const { emit } = capture();
  assert.equal(castSpell(state, "character-1", {itemId:"spark-1",definitionId:"meteor",power:meteor.power,
    manaCost:meteor.manaCost,cooldownMs:meteor.cooldownMs,range:meteor.range,casts:1},demoContent,emit),true);
  advanceAreaEffects(state,649,emit);
  assert.equal(state.entities.find(entity=>entity.id === "primary")!.hp,100);
  advanceAreaEffects(state,1,emit);
  for(const id of ["primary","nearby"]) {
    const target=state.entities.find(entity=>entity.id === id)!;
    assert.equal(target.hp,52);
    assert.equal(target.status?.burns?.length,1);
  }
  assert.equal(state.entities.find(entity=>entity.id === "distant")!.hp,100);
});
