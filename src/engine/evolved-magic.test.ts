import assert from "node:assert/strict";
import test from "node:test";
import type { CombatEntity, GameState } from "../contracts";
import { demoContent } from "../content/demo";
import { evolvedRecipes } from "../content/evolvedMagic";
import { compileWand } from "../loadout/compile";
import { findRecipeExample } from "../loadout/recipe-layout";
import { getWandRecipeOptions } from "../loadout/recipe-options";
import { applyLoadoutCommand } from "../loadout/transactions";
import { createInitialState } from "../runtime/initial";
import { stepBattle } from "./index";

function equip(state: GameState, definitionId: string, x: number, y: number) {
  const kind = Object.hasOwn(demoContent.spells, definitionId) ? "spell" : "arcana";
  state.items[definitionId] = { id: definitionId, definitionId, kind, level: 1, grade: "common" };
  state.wands[0].placements.push({ itemId: definitionId, x, y, rotation: 0 });
}

function fixture() {
  const state = createInitialState();
  state.phase = "battle";
  state.wave = 10;
  state.waveSpawnRemaining = 1;
  state.spawnRemainingMs = 100000;
  state.wands[0].width = 5;
  state.wands[0].height = 5;
  state.wands[0].placements = [];
  state.characters[0].mana = 90;
  return state;
}

function enemy(hp: number, y = 70): CombatEntity {
  return {
    id: "target", definitionId: "enemy-basic", faction: "enemy", kind: "enemy",
    hp, maxHp: 100, x: 50, y, damage: 0, speed: 0, range: 1, cooldownMs: 1000, attackRemainingMs: 1000,
  };
}

test("evolved recipes have executable examples and the same fire/wood ingredients produce distinct orientations", () => {
  for (const recipe of evolvedRecipes) assert.ok(findRecipeExample(recipe, demoContent), recipe.id);
  for (const [x, y, expected] of [[1, 0, "kindling"], [0, 1, "thermal-draft"]] as const) {
    const state = fixture();
    state.phase = "ready";
    equip(state, "ember-seed", 0, 0);
    equip(state, "thorn-seed", x, y);
    state.knowledge.recipeIds = ["kindling-recipe", "thermal-draft-recipe"];
    const options = getWandRecipeOptions(state, "wand-1", demoContent);
    assert.deepEqual(options.map(option => option.output), [expected]);
    const result = applyLoadoutCommand(state, {
      id: "recipe", type: "mergeRecipe", wandId: "wand-1", recipeId: options[0].recipeId, itemIds: [...options[0].itemIds],
    }, demoContent);
    assert.equal(result.result.status, "executed");
    assert.equal(result.state.items["recipe:output"].definitionId, expected);
  }
});

test("affinity handles diagonal reach, weakening, and a shared elemental modifier only once", () => {
  const state = fixture();
  equip(state, "oxidation", 0, 0);
  equip(state, "metal-needle", 2, 1);
  equip(state, "kindling", 0, 2);
  equip(state, "regrowth", 0, 3);
  equip(state, "ember-seed", 1, 3);
  const withArcana = compileWand(state, "wand-1", demoContent)!.spells;
  const clean = structuredClone(state);
  clean.wands[0].placements = clean.wands[0].placements.filter(p => clean.items[p.itemId].kind === "spell");
  const baseline = compileWand(clean, "wand-1", demoContent)!.spells;
  for (const [id, multiplier] of [["metal-needle", 1.22], ["regrowth", .8], ["ember-seed", 1.3]] as const) {
    const power = (spells: typeof baseline) => spells.find(spell => spell.id === id)!.power;
    assert.ok(Math.abs(power(withArcana) - power(baseline) * multiplier) < 1e-9, id);
  }
});

test("enemy remains can be spent once, either by reanimation or corpse burst", () => {
  for (const definition of ["reanimate", "corpse-burst"]) {
    const state = fixture();
    equip(state, definition, 0, 0);
    const empty = stepBattle(state, 50, demoContent);
    assert.equal(empty.events.some(event => event.type === "spellCast"), false);
    state.entities = [enemy(0), { ...enemy(100, 73), id: "survivor" }];
    const result = stepBattle(state, 50, demoContent);
    assert.equal(result.state.remains, undefined);
    assert.equal(result.events.filter(event => event.type === "enemyKilled").length, 1);
    if (definition === "reanimate") {
      const summon = result.state.entities.find(entity => entity.kind === "summon");
      assert.deepEqual([summon?.definitionId, summon?.x, summon?.y, summon?.range], ["reanimate", 50, 70, 3]);
    } else {
      const damage = stepBattle(result.state, 300, demoContent).events.find(event => event.type === "damage");
      assert.equal(damage?.data.targetId, "survivor");
    }
  }
});

test("rebirth retains the original summon and one death cannot be re-used", () => {
  const state = fixture();
  equip(state, "rebirth", 0, 0);
  const construct = demoContent.spells["skeleton-archer"].construct!;
  state.entities = [{
    ...enemy(0), id: "archer", definitionId: "skeleton-archer", kind: "summon", faction: "player",
    element: "undead", remainingMs: 14000, construct, maxHp: 30, damage: 10, range: 21, sourceCharacterId: "character-1",
  }];
  const first = stepBattle(state, 50, demoContent);
  const revived = first.state.entities.find(entity => entity.kind === "summon")!;
  assert.deepEqual([revived.definitionId, revived.hp, revived.remainingMs, revived.construct?.attackMode],
    ["skeleton-archer", 15, 10000, "projectile"]);
  revived.hp = 0;
  first.state.wands[0].cooldowns.rebirth = 0;
  const second = stepBattle(first.state, 50, demoContent);
  assert.equal(second.state.entities.some(entity => entity.kind === "summon"), false);
  assert.equal(second.events.some(event => event.type === "spellCast"), false);
});

test("terminal trigger releases at the traveled range limit, but not when blocked early", () => {
  for (const blocked of [false, true]) {
    const state = fixture();
    equip(state, "spark", 0, 0);
    equip(state, "range-trigger", 1, 0);
    equip(state, "frost-ring", 2, 0);
    state.entities = [enemy(100, 75)];
    const carrier = compileWand(state, "wand-1", demoContent)!.spells[0];
    assert.equal(carrier.trigger?.mode, "range");
    const cast = stepBattle(state, 50, demoContent);
    assert.equal(cast.events.filter(event => event.type === "spellCast").length, 1);
    if (!blocked) cast.state.entities.find(entity => entity.id === "target")!.x = 95;
    cast.state.wands[0].cooldowns.spark = 100000;
    const flight = stepBattle(cast.state, 1800, demoContent);
    const releases = flight.events.filter(event => event.type === "spellTriggered");
    assert.equal(releases.length, blocked ? 0 : 1);
    if (!blocked) {
      assert.equal(releases[0].data.mode, "range");
      assert.ok(Math.abs(Number(releases[0].data.y) - (84 - carrier.range)) < 1e-6);
      assert.equal(releases[0].data.spawned, true);
    }
  }
});

test("condensation fires one strengthened shot and reserves the second spell's cooldown", () => {
  const state = fixture();
  equip(state, "spark", 0, 0);
  equip(state, "condense", 1, 0);
  state.items["spark-1"] = { ...state.items.spark, id: "spark-1" };
  state.wands[0].placements.push({ itemId: "spark-1", x: 2, y: 0, rotation: 0 });
  state.entities = [enemy(100, 75)];
  const [carrier, payload] = compileWand(state, "wand-1", demoContent)!.spells;
  assert.equal(carrier.power, payload.power * 1.6);
  assert.equal(carrier.manaCost, payload.manaCost * 2);
  state.wands[0].cooldowns["spark-1"] = 500;
  const pending = stepBattle(state, 50, demoContent);
  assert.equal(pending.events.some(event => event.type === "spellCast"), false);
  pending.state.wands[0].cooldowns["spark-1"] = 0;
  const cast = stepBattle(pending.state, 50, demoContent);
  assert.equal(cast.events.filter(event => event.type === "spellCast").length, 1);
  assert.equal(cast.state.entities.filter(entity => entity.kind === "projectile").length, 1);
  assert.equal(cast.state.wands[0].cooldowns["spark-1"], carrier.cooldownMs);
  assert.equal(cast.state.wands[0].cooldowns.spark, carrier.cooldownMs);
});
