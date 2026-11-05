import assert from "node:assert/strict";
import test from "node:test";
import type { CombatEntity, GameState } from "../contracts";
import { demoContent } from "../content/demo";
import { createInitialState } from "../runtime/initial";
import { advanceAreaEffects, spawnAreaEffects } from "./areaEffects";
import { advanceBeams, spawnBeams } from "./beams";
import { advanceChains, spawnChains } from "./chains";
import { applyContactDamage } from "./targets";
import { castSpell } from "./effects";

function enemy(id: string, x: number, y: number, options: Partial<CombatEntity> = {}): CombatEntity {
  return { id, definitionId: "enemy-basic", kind: "enemy", faction: "enemy", x, y, hp: 100, maxHp: 100,
    damage: 0, speed: 0, range: 0, cooldownMs: 1000, attackRemainingMs: 1000, ...options };
}
function battle(...enemies: CombatEntity[]): GameState {
  const state = createInitialState();
  state.phase = "battle"; state.wave = 1; state.entities = enemies;
  return state;
}
function capture() {
  const events: {type: string; data: Record<string, unknown>}[] = [];
  return { events, emit: (type: string, data: Record<string, unknown>) => events.push({type, data}) };
}
function castArea(state: GameState, id: string, emit: ReturnType<typeof capture>["emit"]) {
  const spell = demoContent.spells[id];
  return spawnAreaEffects(state, "character-1", { itemId: "spark-1", definitionId: id,
    element: spell.element, power: spell.power, range: spell.range, casts: 1, area: spell.area!, onHit: spell.onHit }, emit);
}

test("gravity core pulls nearby enemies and deals periodic damage without consuming them", () => {
  const center = enemy("center", 50, 60, {hp: 1000, maxHp: 1000});
  const nearby = enemy("nearby", 55, 60, {hp: 1000, maxHp: 1000});
  const distant = enemy("distant", 72, 60, {hp: 1000, maxHp: 1000});
  const state = battle(center, nearby, distant);
  const {emit} = capture();
  assert.equal(castArea(state, "gravity-core", emit), true);
  advanceAreaEffects(state, 500, emit);
  assert.ok(nearby.x < 55, "the core pulls a nearby enemy toward it");
  assert.equal(distant.x, 72, "enemies outside the pull radius stay put");
  assert.ok(center.hp < 1000, "the core deals periodic damage");
  assert.ok(center.hp > 0 && nearby.hp > 0, "the core does not consume enemies");
});

test("black hole attracts and consumes a weakened enemy, then releases one stronger final stage", () => {
  const center = enemy("center", 50, 60, {hp: 1000, maxHp: 1000});
  const weak = enemy("weak", 51, 60, {hp: 17});
  const boss = enemy("boss", 50, 61, {definitionId: "boss-major", hp: 20});
  const distant = enemy("distant", 63, 61, {hp: 1000, maxHp: 1000});
  const state = battle(center, weak, boss, distant);
  const {events, emit} = capture();
  assert.equal(castArea(state, "black-hole", emit), true);
  const hole = state.entities.find(entity => entity.kind === "area")!;
  assert.deepEqual([hole.x, hole.y], [boss.x, boss.y], "the center uses the chosen target, not the caster");
  const oldX = distant.x;
  advanceAreaEffects(state, 400, emit);
  assert.ok(distant.x < oldX, "the field really pulls");
  assert.equal(weak.hp, 0, "a low-health enemy in the center is consumed");
  assert.ok(boss.hp > 0, "the same threshold does not erase a boss at 20% health");
  assert.equal(hole.areaConsumed, 1);
  assert.ok(events.some(event => event.type === "damage" && event.data.execution === true && event.data.targetId === "weak"));

  advanceAreaEffects(state, 3600, emit);
  const releases = events.filter(event => event.type === "areaFinalStage");
  assert.equal(releases.length, 1);
  assert.equal(releases[0].data.spawned, true);
  const final = state.entities.find(entity => entity.kind === "area" && entity.hp > 0)!;
  const consumed = Number(releases[0].data.consumed);
  assert.equal(final.damage, demoContent.spells["black-hole"].power * 4 * (1 + consumed * .15));
  assert.equal(events.filter(event => event.type === "spellCast").length, 1, "a final stage is not another paid cast");
  advanceAreaEffects(state, 1, emit);
  assert.equal(events.filter(event => event.type === "areaFinalStage").length, 1);
});

test("twin black holes spawn two distinct centers in one cast and finish independently", () => {
  const victim = enemy("victim", 50, 60, {hp: 1000, maxHp: 1000});
  const state = battle(victim);
  const {events, emit} = capture();
  assert.equal(castArea(state, "twin-black-holes", emit), true);
  const holes = state.entities.filter(entity => entity.kind === "area");
  assert.equal(holes.length, 2);
  assert.ok(Math.abs(Math.hypot(holes[0].x - holes[1].x, holes[0].y - holes[1].y) - 14) < 1e-6);
  assert.equal(events.filter(event => event.type === "spellCast").length, 1);
  advanceAreaEffects(state, 400, emit);
  assert.ok(victim.hp < 1000, "the actual vortex pulses cause damage");
  advanceAreaEffects(state, 3200, emit);
  assert.equal(events.filter(event => event.type === "areaFinalStage" && event.data.spawned).length, 2);
});

test("paired vortex respects battlefield edges and never spawns a half pair at the area limit", () => {
  const state = battle();
  const spell = demoContent.spells["twin-black-holes"];
  const {events, emit} = capture();
  const spec = {itemId:"spark-1",definitionId:spell.id,power:spell.power,range:spell.range,casts:1,area:spell.area!,position:{x:0,y:0}};
  assert.equal(spawnAreaEffects(state, "character-1", spec, emit), true);
  const holes = state.entities.filter(entity => entity.kind === "area");
  assert.equal(holes.length, 2);
  assert.ok(holes.every(hole => hole.x >= 0 && hole.x <= 100 && hole.y >= 0 && hole.y <= 100));
  assert.ok(Math.hypot(holes[0].x - holes[1].x, holes[0].y - holes[1].y) >= 13.99);
  state.entities = Array.from({length:31},(_,index) => ({...holes[0],id:`area-budget-${index}`}));
  const before = state.entities.length;
  assert.equal(spawnAreaEffects(state, "character-1", spec, emit), false);
  assert.equal(state.entities.length, before);
});

test("sun upkeep is paid in simulation time and insufficient mana triggers its final stage early", () => {
  const state = battle(enemy("target", 50, 60, {hp: 1000, maxHp: 1000}));
  const {events, emit} = capture();
  state.characters[0].mana = 2;
  assert.equal(castArea(state, "artificial-sun", emit), true);
  const sun = state.entities.find(entity => entity.kind === "area")!;
  state.paused = true;
  advanceAreaEffects(state, 500, emit);
  assert.equal(state.characters[0].mana, 2);
  assert.equal(sun.areaActiveMs, undefined);
  state.paused = false;
  advanceAreaEffects(state, 500, emit);
  assert.equal(state.characters[0].mana, 0);
  assert.equal(sun.hp, 0);
  const expectedSeconds = 2 / demoContent.spells["artificial-sun"].area!.manaPerSecond!;
  assert.ok(Math.abs(sun.areaActiveMs! - expectedSeconds * 1000) < 1e-8);
  const final = state.entities.find(entity => entity.kind === "area" && entity.hp > 0)!;
  const spell = demoContent.spells["artificial-sun"], finish = spell.area!.finish!;
  assert.ok(Math.abs(final.damage - spell.power * finish.powerMultiplier * (1 + expectedSeconds * finish.perSecond!)) < 1e-8);
  assert.equal(events.filter(event => event.type === "areaFinalStage").length, 1);
});

test("three-phase bomb resolves blast, larger blast and lingering radiation in order", () => {
  const victim = enemy("victim", 50, 60, {hp: 1000, maxHp: 1000});
  const state = battle(victim);
  const {events, emit} = capture();
  assert.equal(castArea(state, "three-phase-bomb", emit), true);
  advanceAreaEffects(state, 1000, emit);
  assert.equal(victim.hp, 955);
  advanceAreaEffects(state, 300, emit);
  assert.equal(victim.hp, 955, "the next phase is scheduled rather than double-advanced");
  advanceAreaEffects(state, 1, emit);
  assert.equal(victim.hp, 865);
  advanceAreaEffects(state, 349, emit);
  assert.equal(victim.hp, 865);
  advanceAreaEffects(state, 500, emit);
  assert.ok(Math.abs(victim.hp - 854.2) < 1e-8);
  assert.equal(events.filter(event => event.type === "areaFinalStage").length, 2);
  assert.equal(events.filter(event => event.type === "spellCast").length, 1);
});

test("execution and armor penetration resolve through the ordinary damage provenance", () => {
  const state = battle();
  const source = enemy("source", 50, 50, { kind: "projectile", faction: "player", damage: 6,
    sourceCharacterId: "character-1", sourceItemId: "spark-1", definitionId: "antimatter-bomb",
    onHit: structuredClone(demoContent.spells["antimatter-bomb"].onHit) });
  const {events, emit} = capture();
  const normal = enemy("normal", 50, 50, {hp: 30});
  const outside = enemy("outside", 55, 50, {hp: 30});
  const boss = enemy("boss", 50, 50, {definitionId: "boss-major", hp: 13});
  const bossWeak = enemy("boss-weak", 53.6, 50, {definitionId: "boss-major", bodySize: "huge", hp: 11});
  for (const target of [normal, outside, boss, bossWeak]) applyContactDamage(state, source, target, emit);
  assert.deepEqual([normal.hp, outside.hp, boss.hp, bossWeak.hp], [0, 24, 7, 0]);
  const execution = events.find(event => event.data.targetId === "normal" && event.data.execution === true)!;
  assert.equal(execution.data.sourceCharacterId, "character-1");
  assert.equal(execution.data.effect, "antimatter-bomb");

  const armored = enemy("armored", 50, 50, {hp: 100, armor: 20});
  source.damage = 40;
  source.onHit = {armorPierce: 0.75};
  applyContactDamage(state, source, armored, emit);
  assert.equal(armored.hp, 65, "75% armor penetration leaves 5 armor, not a damage multiplier");
});

test("earthquake expands its damaging area over successive pulses", () => {
  const center = enemy("center", 50, 60, {hp: 1000, maxHp: 1000});
  const distant = enemy("distant", 64, 60, {hp: 1000, maxHp: 1000});
  const state = battle(center, distant);
  const {emit} = capture();
  assert.equal(castArea(state, "earthquake", emit), true);
  advanceAreaEffects(state, 650, emit);
  assert.ok(center.hp < 1000);
  assert.equal(distant.hp, 1000, "the first shock has not reached the distant enemy");
  advanceAreaEffects(state, 1600, emit);
  assert.ok(distant.hp < 1000, "later shocks reach the expanding edge");
});

test("pulsar rotates two real beams around the target and can hit on both sides", () => {
  const center = enemy("center", 50, 60, {hp: 1000, maxHp: 1000});
  const state = battle(center);
  const {emit} = capture();
  const spell = demoContent.spells.pulsar;
  assert.equal(spawnBeams(state, "character-1", { itemId: "spark-1", definitionId: spell.id,
    power: spell.power, range: spell.range, casts: 1, beam: spell.beam! }, emit), true);
  const beam = state.entities.find(entity => entity.kind === "beam")!;
  assert.deepEqual([beam.x, beam.y], [50, 60]);
  const north = enemy("north", 50, 50, {hp: 1000, maxHp: 1000});
  const south = enemy("south", 50, 70, {hp: 1000, maxHp: 1000});
  state.entities.push(north, south);
  advanceBeams(state, 900, emit);
  assert.ok(Math.abs(beam.headingX!) < 1e-8);
  assert.ok(Math.abs(beam.headingY! - 1) < 1e-8);
  assert.ok(north.hp < 1000 && south.hp < 1000, "the reverse beam participates in collision");
});

test("helium flash resolves its final stage as eight damaging radial beams", () => {
  const center = enemy("center", 50, 60, {hp: 10000, maxHp: 10000});
  const state = battle(center), {events, emit} = capture();
  assert.equal(castArea(state, "helium-flash", emit), true);
  const targets = [[60,60],[40,60],[50,70],[50,50],[60,70]].map(([x,y],i) => enemy(`ray-${i}`,x,y,{hp:10000,maxHp:10000}));
  state.entities.push(...targets);
  advanceAreaEffects(state, 1200, emit);
  assert.equal(state.entities.filter(entity => entity.kind === "beam" && entity.hp > 0).length, 4);
  advanceBeams(state, 300, emit);
  for (const target of targets) assert.ok(target.hp < 10000, target.id);
  assert.equal(events.filter(event => event.type === "spellCast").length, 1);
  assert.equal(events.filter(event => event.type === "areaFinalStage").length, 1);
});

test("fission chain actually applies bounded blast damage around successive targets", () => {
  const one = enemy("one", 50, 75, {hp: 1000, maxHp: 1000});
  const two = enemy("two", 53, 75, {hp: 1000, maxHp: 1000});
  const three = enemy("three", 57, 75, {hp: 1000, maxHp: 1000});
  const state = battle(one, two, three);
  const {events, emit} = capture();
  const spell = demoContent.spells["fission-bomb"];
  assert.equal(spell.impact?.type, "chain");
  if (spell.impact?.type !== "chain") return;
  assert.equal(spawnChains(state, "character-1", { itemId: "spark-1", definitionId: spell.id,
    power: spell.power, range: spell.range, casts: 1, impact: spell.impact }, emit), true);
  assert.ok(two.hp < 1000, "the first blast reaches a neighbor before the next hop");
  advanceChains(state, 160, emit);
  assert.ok(events.filter(event => event.type === "chainBlast").length >= 2);
  assert.ok(three.hp < 1000);
});

test("a newly added summon can cast through its real wand and creates an ally", () => {
  const state = battle(enemy("target", 50, 70));
  const {emit} = capture();
  const spell = demoContent.spells["flame-elemental"];
  state.items["spark-1"].definitionId = spell.id;
  assert.equal(castSpell(state, "character-1", {itemId: "spark-1", definitionId: spell.id,
    power: spell.power, manaCost: spell.manaCost, cooldownMs: spell.cooldownMs, range: spell.range, casts: 1}, demoContent, emit), true);
  assert.ok(state.entities.some(entity => entity.kind === "summon" && entity.definitionId === spell.id && entity.hp > 0));
});
