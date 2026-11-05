import assert from "node:assert/strict";
import test from "node:test";
import type { CombatEntity, ContentCatalog, GameState } from "../contracts";
import { sampleWaveRewards } from "../content/randomRewards";
import { demoContent } from "../content/demo";
import { approvedArcana, approvedRecipes } from "../content/approved-4";
import { compileWand } from "../loadout/compile";
import { findRecipeExample } from "../loadout/recipe-layout";
import { getWandRecipeOptions } from "../loadout/recipe-options";
import { createInitialState } from "../runtime/initial";
import { advanceProjectiles, spawnProjectiles } from "./projectiles";
import { releaseConstructDeathBurst } from "./constructs";
import { stepBattle } from "./index";

const content: ContentCatalog = {
  ...demoContent, arcana: { ...demoContent.arcana, ...approvedArcana },
  recipes: [...new Set([...demoContent.recipes, ...approvedRecipes])],
};

function setup(): GameState {
  const state = createInitialState();
  state.phase = "battle";
  state.wave = 10;
  state.waveSpawnRemaining = 1;
  state.spawnRemainingMs = 100000;
  state.characters[0].mana = 60;
  state.characters[0].manaRegen = 0;
  Object.assign(state.wands[0], { width: 5, height: 5, placements: [], cooldowns: {} });
  return state;
}

function equip(state: GameState, definitionId: string, x: number, y: number, rotation: 0 | 1 | 2 | 3 = 0) {
  const spell = content.spells[definitionId];
  const def = spell ?? content.arcana[definitionId];
  assert.ok(def, definitionId);
  const id = `${definitionId}-${state.wands[0].placements.length}`;
  state.items[id] = { id, definitionId, kind: spell ? "spell" : "arcana", grade: def.grade, level: 1 };
  state.wands[0].placements.push({ itemId: id, x, y, rotation });
  return id;
}

function enemy(id: string, x: number, y: number): CombatEntity {
  return { id, definitionId: "enemy-basic", kind: "enemy", faction: "enemy", x, y, hp: 500, maxHp: 500,
    damage: 0, speed: 0, range: 1, cooldownMs: 1000, attackRemainingMs: 1000 };
}

test("all sixteen arcana recipes fit a 5×5 wand and the runtime recognizes their exact placements", () => {
  for (const recipe of approvedRecipes) {
    const example = findRecipeExample(recipe, content);
    assert.ok(example, recipe.id);
    const state = setup();
    state.phase = "ready";
    state.knowledge.recipeIds = [recipe.id];
    for (const { definitionId, placement: { x, y, rotation } } of example) equip(state, definitionId, x, y, rotation);
    assert.ok(getWandRecipeOptions(state, state.wands[0].id, content).some(option => option.recipeId === recipe.id), recipe.id);
  }
});

test("tracking turns toward a moving target while pursuit can reacquire after death", () => {
  for (const reacquire of [false, true]) {
    const state = setup();
    const target = enemy("target", 50, 70);
    const alternate = enemy("alternate", 60, 80);
    state.entities = [target, alternate];
    assert.ok(spawnProjectiles(state, state.characters[0].id, {
      itemId: "test", definitionId: "spark", power: 1, range: 40, speed: 20, casts: 1,
      steering: { turnRate: 5, reacquire },
    }, () => {}));
    const projectile = state.entities.find(entity => entity.kind === "projectile")!;
    // Aim at the first target regardless of caster anchor distance, then move it.
    projectile.targetId = target.id;
    projectile.headingX = 0;
    projectile.headingY = -1;
    target.x += 10;
    advanceProjectiles(state, 50, () => {});
    assert.ok(projectile.headingX > 0 && projectile.headingX < .3);
    target.hp = 0;
    alternate.x = projectile.x + 8;
    alternate.y = projectile.y;
    advanceProjectiles(state, 50, () => {});
    assert.equal(projectile.targetId, reacquire ? alternate.id : target.id);
  }
});

test("ricochet steers the actual projectile to fresh enemies and first-shot recovery refunds only once", () => {
  const state = setup();
  const char = state.characters[0];
  const startMana = char.mana;
  state.entities = [enemy("first", 50, 80), enemy("second", 53, 77), enemy("third", 56, 74)];
  assert.ok(spawnProjectiles(state, char.id, {
    itemId: "test", definitionId: "spark", origin: { x: 50, y: 84 }, fixedOrigin: true,
    power: 100, range: 25, speed: 45, casts: 2,
    impact: { type: "chain", radius: 7, maxTargets: 3, falloff: .68 },
    manaRefund: { amount: 5, maxMana: 100 },
  }, () => {}));
  const projectile = state.entities.find(entity => entity.kind === "projectile")!;
  for (let i = 0; i < 12; i++) advanceProjectiles(state, 50, () => {});
  assert.deepEqual(projectile.hitIds, ["first", "second", "third"]);
  assert.equal(char.mana, startMana + 5);
});

test("resonance needs a second matching spell, and only the higher variant matches a fusion element", () => {
  for (const modifier of ["resonance", "elemental-resonance"]) {
    const state = setup();
    equip(state, "spark", 0, 0);
    equip(state, modifier, 0, 1);
    const before = compileWand(state, "wand-1", content)!.spells[0].power;
    equip(state, "steam-cloud", 0, 2);
    const after = compileWand(state, "wand-1", content)!.spells[0].power;
    assert.equal(after, modifier === "resonance" ? before : before * 1.28);
  }
});

test("local domains grow, full domains reach the battlefield, and aftershocks use real timed area phases", () => {
  for (const modifier of ["domain-expansion", "total-domain", "chain-aftershock"]) {
    const state = setup();
    equip(state, "steam-cloud", 0, 0);
    equip(state, modifier, 0, 2);
    const spell = compileWand(state, "wand-1", content)!.spells[0];
    const base = content.spells["steam-cloud"];
    assert.ok(spell.manaCost > base.manaCost);
    if (modifier === "domain-expansion") assert.ok(spell.area!.radius > base.area!.radius);
    if (modifier === "total-domain") assert.equal(spell.area!.anchor, "field");
    if (modifier === "chain-aftershock") {
      assert.ok(spell.area!.finish!.next!.radius > spell.area!.finish!.radius);
      state.entities = [enemy("target", 50, 70)];
      const transition = stepBattle(state, 4000, content);
      assert.ok(transition.events.filter(event => event.type === "areaSpawned").length >= 3);
    }
  }
});

test("a killed summon releases a bounded two-stage burst once, while living summons do not burst", () => {
  const state = setup();
  const source = { ...enemy("ally", 50, 70), kind: "summon" as const, faction: "player" as const,
    hp: 1, deathBurst: 1.1, sourceCharacterId: state.characters[0].id, sourceItemId: "summon-spell" };
  releaseConstructDeathBurst(state, source, () => {});
  assert.equal(state.entities.length, 0);
  source.hp = 0;
  releaseConstructDeathBurst(state, source, () => {});
  releaseConstructDeathBurst(state, source, () => {});
  assert.equal(state.entities.length, 1);
  assert.equal(state.entities[0].area?.finish?.radius, 8);
});

test("multi-linked casts reserve and charge every item, then release two independent payloads once", () => {
  const state = setup();
  const carrier = equip(state, "spark", 0, 0);
  equip(state, "multi-linked-cast", 0, 1);
  const first = equip(state, "water-bolt", 3, 1);
  const second = equip(state, "pebble", 0, 2);
  const wand = state.wands[0];
  const spells = compileWand(state, wand.id, content)!.spells;
  assert.equal(spells[0].trigger?.payload.itemId, first);
  assert.equal(spells[0].trigger?.additionalPayload?.itemId, second);
  assert.equal(spells[0].manaCost, spells.reduce((sum, spell) => sum + (spell.id === "spark" ? content.spells.spark.manaCost : spell.manaCost), 0));
  state.entities = [enemy("target", 50, 72)];
  const launch = stepBattle(state, 50, content);
  assert.equal(launch.state.characters[0].mana, state.characters[0].mana - spells[0].manaCost);
  assert.equal(launch.state.wands[0].cooldowns[first], launch.state.wands[0].cooldowns[carrier]);
  assert.equal(launch.state.wands[0].cooldowns[second], launch.state.wands[0].cooldowns[carrier]);
  const flight = stepBattle(launch.state, 350, content);
  assert.deepEqual(flight.events.filter(event => event.type === "spellTriggered").map(event => event.data.payloadItemId), [first, second]);
});

test("each approved arcana becomes eligible for a direct reward only at its gate", () => {
  for (const definition of Object.values(approvedArcana)) {
    const wave = definition.rewardMinWave!;
    const catalog = { ...content, spells: {}, arcana: { [definition.id]: definition } };
    const options = { content: catalog, characterCount: 3, wandCount: 6, canHeal: false, random: () => .5 };
    assert.equal(sampleWaveRewards({ ...options, wave: wave - 1 }).some(offer => offer.definitionId === definition.id), false);
    assert.equal(sampleWaveRewards({ ...options, wave }).some(offer => offer.definitionId === definition.id), true);
  }
});

test("linked casts can release a paid area at range after the original target disappears", () => {
  const state = setup();
  equip(state, "spark", 0, 0);
  equip(state, "linked-cast", 0, 1);
  const payload = equip(state, "steam-cloud", 0, 2);
  state.entities = [enemy("target", 50, 72)];
  const launch = stepBattle(state, 50, content);
  launch.state.entities.find(entity => entity.id === "target")!.hp = 0;
  const result = stepBattle(launch.state, 500, content);
  const released = result.events.find(event => event.type === "spellTriggered");
  assert.equal(released?.data.payloadItemId, payload);
  assert.equal(released?.data.spawned, true);
});
