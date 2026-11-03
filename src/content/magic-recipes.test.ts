import assert from "node:assert/strict";
import test from "node:test";
import { demoContent } from "./demo";
import { expandedSpellDefinitions } from "./expandedSpells";
import { fieldSpellDefinitions } from "./fieldSpells";
import { baseMagicDefinitionIds, magicRecipeDefinitions } from "./magicRecipes";

const spells = { ...demoContent.spells, ...fieldSpellDefinitions, ...expandedSpellDefinitions };

test("the 39 recipes have unique IDs and outputs, with fireball preserved first", () => {
  assert.equal(magicRecipeDefinitions.length, 39);
  assert.equal(new Set(magicRecipeDefinitions.map(recipe => recipe.id)).size, 39);
  assert.equal(new Set(magicRecipeDefinitions.map(recipe => recipe.output)).size, 39);
  assert.deepEqual(magicRecipeDefinitions[0], {
    id: "fireball-recipe", name: "火球", inputs: ["spark", "amplify"], output: "fireball", requireAdjacency: true,
  });
  assert.deepEqual(demoContent.recipes, magicRecipeDefinitions);

  for (const recipe of magicRecipeDefinitions) {
    assert.equal(recipe.requireAdjacency, true, `${recipe.id} requires adjacency`);
    assert.ok(recipe.inputs.length === 2 || recipe.output === "thunderstorm" && recipe.inputs.length === 3,
      `${recipe.id} has its planned materials`);
    assert.equal(recipe.id, recipe.output === "fireball" ? "fireball-recipe" : `${recipe.output}-recipe`);
    assert.equal(recipe.name, spells[recipe.output]?.name);
  }
});

test("nine base spells and recipe outputs cover the 48 spell catalog with defined materials", () => {
  assert.equal(baseMagicDefinitionIds.length, 9);
  assert.equal(new Set(baseMagicDefinitionIds).size, 9);
  const spellIds = Object.keys(spells);
  const arcanaIds = Object.keys(demoContent.arcana);
  const definedMagicIds = new Set([...spellIds, ...arcanaIds]);
  const outputIds = magicRecipeDefinitions.map(recipe => recipe.output);
  const allAcquisitionIds = [...baseMagicDefinitionIds, ...outputIds];

  assert.equal(spellIds.length, 48);
  assert.equal(new Set(allAcquisitionIds).size, 48);
  assert.deepEqual(new Set(allAcquisitionIds), new Set(spellIds));
  for (const id of baseMagicDefinitionIds) assert.ok(Object.hasOwn(spells, id), `base spell ${id} exists`);
  for (const recipe of magicRecipeDefinitions) {
    assert.ok(Object.hasOwn(spells, recipe.output), `output ${recipe.output} exists`);
    for (const input of recipe.inputs) {
      assert.ok(definedMagicIds.has(input), `ingredient ${input} exists for ${recipe.id}`);
      assert.notEqual(input, recipe.output, `${recipe.id} cannot consume its own output`);
    }
  }
});

test("recipe ingredient dependencies form a directed acyclic graph", () => {
  const recipeByOutput = new Map(magicRecipeDefinitions.map(recipe => [recipe.output, recipe]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(output: string): void {
    if (visited.has(output)) return;
    assert.ok(!visiting.has(output), `recipe dependency cycle reaches ${output}`);
    visiting.add(output);
    const recipe = recipeByOutput.get(output);
    assert.ok(recipe, `recipe exists for ${output}`);
    for (const input of recipe.inputs) {
      if (recipeByOutput.has(input)) visit(input);
    }
    visiting.delete(output);
    visited.add(output);
  }

  for (const output of recipeByOutput.keys()) visit(output);
  assert.equal(visited.size, 39);
});
