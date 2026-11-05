import assert from "node:assert/strict";
import test from "node:test";
import type { CombatEntity } from "../contracts";
import { approvedRecipes, approvedSpells } from "../content/approved-1";
import { demoContent } from "../content/demo";
import { findRecipeExample, matchesRecipeLayout } from "../loadout/recipe-layout";
import { createInitialState } from "../runtime/initial";
import { advanceAreaEffects, spawnAreaEffects } from "./areaEffects";

test("fire, water and lightning branch recipes fit the default wand", () => {
  const content = { ...demoContent, spells: { ...demoContent.spells, ...approvedSpells } };
  for (const recipe of approvedRecipes) assert.ok(findRecipeExample(recipe, content), recipe.id);
  const waterBlade = approvedRecipes.find(recipe => recipe.output === "water-blade")!;
  assert.ok(matchesRecipeLayout(waterBlade, [
    { definitionId: "water-bolt", cells: [{ x: 3, y: 3 }] },
    { definitionId: "water-bolt", cells: [{ x: 4, y: 3 }] },
  ], content));
  assert.equal(matchesRecipeLayout(waterBlade, [
    { definitionId: "water-bolt", cells: [{ x: 3, y: 3 }] },
    { definitionId: "water-bolt", cells: [{ x: 3, y: 4 }] },
  ], content), false);
});

function exerciseArea(id: string) {
  const spell = approvedSpells[id];
  const state = createInitialState();
  state.phase = "battle";
  const enemy: CombatEntity = { id: "target", definitionId: "enemy-basic", kind: "enemy", faction: "enemy",
    x: 50, y: 60, hp: 1000, maxHp: 1000, speed: 0, damage: 0, range: 0, cooldownMs: 1000, attackRemainingMs: 1000 };
  state.entities = [enemy];
  const events: { type: string; data: Record<string, unknown> }[] = [];
  const emit = (type: string, data: Record<string, unknown>) => { events.push({ type, data }); };
  const created = spawnAreaEffects(state, "character-1", { itemId: "spark-1", definitionId: id, element: spell.element,
    power: spell.power, range: spell.range, casts: 1, area: spell.area!, onHit: spell.onHit }, emit);
  assert.equal(created, true);
  return { state, enemy, events, advance: (ms: number) => advanceAreaEffects(state, ms, emit) };
}

test("great flood wets a target and releases a retreating wave from the same cast", () => {
  const battle = exerciseArea("great-flood");
  battle.advance(1100);
  assert.ok(battle.enemy.status?.wetRemainingMs);
  battle.advance(2600);
  assert.ok(battle.events.some(event => event.type === "areaFinalStage" && event.data.spawned));
  assert.equal(battle.events.filter(event => event.type === "spellCast").length, 1);
});

test("paired lightning orbs release two independent crosses of beams", () => {
  const battle = exerciseArea("ball-lightning-storm");
  assert.equal(battle.state.entities.filter(entity => entity.kind === "area").length, 2);
  battle.advance(2900);
  assert.equal(battle.events.filter(event => event.type === "areaFinalStage" && event.data.spawned).length, 2);
  assert.equal(battle.state.entities.filter(entity => entity.kind === "beam").length, 4);
});
