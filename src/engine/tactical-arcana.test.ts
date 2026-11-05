import assert from "node:assert/strict";
import test from "node:test";
import type { CombatEntity, GameState } from "../contracts";
import { approvedArcana, approvedRecipes } from "../content/approved-6";
import { demoContent } from "../content/demo";
import { compileWand } from "../loadout/compile";
import { findRecipeExample } from "../loadout/recipe-layout";
import { createInitialState } from "../runtime/initial";
import { spawnConstructs } from "./constructs";
import { advanceProjectiles, spawnProjectiles } from "./projectiles";
import { applyContactDamage } from "./targets";
import { stepBattle } from "./index";

const catalog = { ...demoContent, arcana: { ...demoContent.arcana, ...approvedArcana } };
const noop = () => {};
const enemy = (id: string, x: number, y: number): CombatEntity => ({
  id, definitionId: "enemy-basic", kind: "enemy", faction: "enemy", x, y, hp: 1000, maxHp: 1000,
  damage: 0, speed: 0, range: 1, cooldownMs: 0, attackRemainingMs: 0,
});
const battle = (...entities: CombatEntity[]): GameState => ({
  ...createInitialState(), phase: "battle", paused: false, entities,
});

test("the 28 approved arcana all have a fitting recipe; advanced versions consume their immediate predecessor", () => {
  assert.equal(Object.keys(approvedArcana).length, 28);
  for (const recipe of approvedRecipes) assert.ok(findRecipeExample(recipe, catalog), recipe.id);
  for (const arcana of Object.values(approvedArcana).filter(entry => entry.value === 2)) {
    const lower = Object.values(approvedArcana).find(entry => entry.modifier === arcana.modifier && entry.value === 1)!;
    assert.ok(approvedRecipes.find(recipe => recipe.output === arcana.id)?.inputs.includes(lower.id));
    assert.ok(arcana.rewardMinWave! > lower.rewardMinWave!);
  }
});

test("wand compilation applies overload and marks a compatible projectile only when adjacent", () => {
  const state = createInitialState();
  const wand = state.wands[0];
  const baseline = compileWand(state, wand.id, catalog)!.spells[0];
  for (const [id, x, y] of [["overload", 1, 0], ["brand", 0, 1]] as const) {
    const definition = approvedArcana[id];
    state.items[id] = { id, definitionId: id, grade: definition.grade, level: definition.level, kind: "arcana" };
    wand.placements.push({ itemId: id, x, y, rotation: 0 });
  }
  const spell = compileWand(state, wand.id, catalog)!.spells[0];
  assert.equal(spell.power, baseline.power * 1.8);
  assert.equal(spell.cooldownMs, baseline.cooldownMs * 1.8);
  assert.equal(spell.onHit?.tactical?.branding, 1);
  wand.placements.at(-1)!.x = 2;
  assert.equal(compileWand(state, wand.id, catalog)!.spells[0].onHit?.tactical?.branding, undefined);
});

test("mark, freezing, conductivity and armor exposure resolve from successful real contacts", () => {
  const target = enemy("first", 50, 60);
  const peer = enemy("second", 51, 60);
  const state = battle(target, peer);
  const source: CombatEntity = { ...target, id: "projectile", faction: "player", kind: "projectile",
    sourceCharacterId: "character-1", damage: 20, element: "water", onHit: { tactical: { branding: 2, freezing: 2 } } };
  target.status = { slow: { multiplier: .5, remainingMs: 500 } };
  applyContactDamage(state, source, target, noop);
  assert.equal(target.hp, 980);
  assert.equal(target.status.slow?.multiplier, .1);
  applyContactDamage(state, source, target, noop);
  assert.equal(target.hp, 938);
  assert.equal(peer.hp, 988);
  assert.equal(target.tacticalStatus?.brand, undefined);
  assert.equal(target.tacticalStatus?.frozenUntilMs, undefined);
  source.element = "lightning";
  source.onHit = { tactical: { conductivity: 2 } };
  delete target.status;
  applyContactDamage(state, source, target, noop);
  assert.ok(target.tacticalStatus?.conductiveUntilMs);
  applyContactDamage(state, source, target, noop);
  assert.equal(peer.hp, 977);
  assert.ok(peer.tacticalStatus?.exposedUntilMs);
  peer.armor = 20;
  source.onHit = undefined;
  applyContactDamage(state, source, peer, noop);
  assert.equal(peer.hp, 968);
});

test("returning and secondary split projectiles respect finite flight and retain original provenance", () => {
  const first = enemy("first", 50, 70);
  const second = enemy("second", 50, 64);
  const state = battle(first, second);
  const events: string[] = [];
  const emit = (type: string) => events.push(type);
  const spec = { itemId: "spark-1", definitionId: "spark", power: 20, range: 28, casts: 1, speed: 80 };
  assert.ok(spawnProjectiles(state, "character-1", { ...spec, tacticalFlight: { returnFlight: 1, resplit: 2 } }, emit));
  for (let index = 0; index < 40; index++) advanceProjectiles(state, 50, emit);
  assert.equal(events.filter(type => type === "projectileTurned").length, 1);
  assert.ok(events.filter(type => type === "projectileSpawned").length <= 5);
  assert.ok(first.hp < 980 && second.hp < 1000);
  assert.ok(state.entities.filter(entity => entity.kind === "projectile").every(entity => entity.hp === 0
    && entity.sourceItemId === spec.itemId && entity.sourceCharacterId === "character-1"));
});

test("summons reinforce existing allies and can sacrifice only after a real blast can be spawned", () => {
  const state = battle(enemy("first", 50, 75));
  const definitionId = "skeleton-guard";
  const spell = demoContent.spells[definitionId];
  state.items.summon = { id: "summon", kind: "spell", definitionId, level: 1, grade: "common" };
  state.wands[0].placements.push({ itemId: "summon", x: 1, y: 0, rotation: 0 });
  const spec = { kind: "summon" as const, itemId: "summon", definitionId, power: spell.power, range: spell.range,
    construct: spell.construct!, casts: 1, tacticalConstruct: { reinforcement: 2 as const } };
  assert.ok(spawnConstructs(state, "character-1", spec, noop));
  const summoned = state.entities.find(entity => entity.kind === "summon")!;
  summoned.hp /= 2;
  summoned.remainingMs = 2000;
  assert.ok(spawnConstructs(state, "character-1", spec, noop));
  assert.ok(summoned.hp > summoned.maxHp / 2 && summoned.remainingMs > 2000);
  assert.equal(state.entities.filter(entity => entity.kind === "summon").length, 1);
  assert.ok(spawnConstructs(state, "character-1", { ...spec, tacticalConstruct: { sacrifice: 2 } }, noop));
  assert.equal(summoned.hp, 0);
  assert.equal(state.entities.filter(entity => entity.kind === "area" && entity.area?.finish).length, 1);
  const settled = stepBattle(state, 50, catalog).state;
  assert.equal(settled.entities.some(entity => entity.id === summoned.id), false);
  assert.ok(!settled.remains?.some(entry => entry.entity.id === summoned.id));
});

test("a mounted spell emits from its summon and lifesteal reaches one wounded ally", () => {
  const target = enemy("target", 50, 78);
  const state = battle(target);
  const definitionId = "skeleton-guard";
  const spell = demoContent.spells[definitionId];
  state.items.summon = { id: "summon", kind: "spell", definitionId, level: 1, grade: "common" };
  state.wands[0].placements.push({ itemId: "summon", x: 1, y: 0, rotation: 0 });
  const spec = { kind: "summon" as const, itemId: "summon", definitionId, power: spell.power,
    range: spell.range, construct: spell.construct!, casts: 1, position: { x: 50, y: 82 },
    tacticalConstruct: { constructPayload: 1 as const, symbiosis: 2 as const,
      mounted: { itemId: "spark-1", definitionId: "spark", element: "fire" as const, power: 16,
        range: 20, speed: 100, attackRoll: { accuracy: 1, critChance: 0, critMultiplier: 1, sourceLuck: 0 } } },
  };
  assert.ok(spawnConstructs(state, "character-1", spec, noop));
  assert.ok(spawnConstructs(state, "character-1", { ...spec, tacticalConstruct: undefined }, noop));
  const [caster, ally] = state.entities.filter(entity => entity.kind === "summon");
  ally.hp /= 2;
  const result = stepBattle(state, 150, catalog);
  const projectile = result.events.find(event => event.type === "projectileSpawned" && event.data.sourceEntityId === caster.id);
  assert.ok(projectile);
  assert.equal(projectile.data.sourceItemId, "spark-1");
  assert.ok(result.events.some(event => event.type === "heal" && event.data.targetId === ally.id
    && event.data.sourceEntityId === caster.id));
});
