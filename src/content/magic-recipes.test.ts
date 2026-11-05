import assert from "node:assert/strict";
import test from "node:test";
import { demoContent } from "./demo";
import { expandedSpellDefinitions } from "./expandedSpells";
import { fieldSpellDefinitions } from "./fieldSpells";
import { baseMagicDefinitionIds, magicRecipeDefinitions } from "./magicRecipes";

const spells = { ...demoContent.spells, ...fieldSpellDefinitions, ...expandedSpellDefinitions };

test("spell and arcana recipes have unique IDs and valid outputs, with fireball preserved first", () => {
  assert.equal(new Set(magicRecipeDefinitions.map(recipe => recipe.id)).size, magicRecipeDefinitions.length);
  assert.deepEqual(magicRecipeDefinitions[0], {
    id: "fireball-recipe", name: "火球", inputs: ["spark", "amplify"], output: "fireball", requireAdjacency: true,
  });
  assert.deepEqual(demoContent.recipes, magicRecipeDefinitions);

  for (const recipe of magicRecipeDefinitions) {
    assert.equal(recipe.requireAdjacency, true, `${recipe.id} requires adjacency`);
    assert.ok(recipe.inputs.length === 2 || recipe.inputs.length === 3,
      `${recipe.id} has its planned materials`);
    assert.equal(recipe.name, (spells[recipe.output] ?? demoContent.arcana[recipe.output])?.name);
  }
});

test("atomic spells and spell recipes cover the catalog; arcana recipes also have valid definitions", () => {
  assert.equal(baseMagicDefinitionIds.length, 18);
  assert.equal(new Set(baseMagicDefinitionIds).size, 18);
  const spellIds = Object.keys(spells);
  const arcanaIds = Object.keys(demoContent.arcana);
  const definedMagicIds = new Set([...spellIds, ...arcanaIds]);
  const outputIds = magicRecipeDefinitions.map(recipe => recipe.output).filter(id => Object.hasOwn(spells, id));
  const allAcquisitionIds = [...baseMagicDefinitionIds, ...new Set(outputIds)];

  assert.equal(new Set(allAcquisitionIds).size, spellIds.length);
  assert.deepEqual(new Set(allAcquisitionIds), new Set(spellIds));
  for (const id of baseMagicDefinitionIds) {
    assert.ok(Object.hasOwn(spells, id), `base spell ${id} exists`);
    assert.deepEqual(spells[id].shape, [{x: 0, y: 0}], `base spell ${id} occupies one cell`);
  }
  for (const recipe of magicRecipeDefinitions) {
    assert.ok(definedMagicIds.has(recipe.output), `output ${recipe.output} exists`);
    for (const input of recipe.inputs) {
      assert.ok(definedMagicIds.has(input), `ingredient ${input} exists for ${recipe.id}`);
      assert.notEqual(input, recipe.output, `${recipe.id} cannot consume its own output`);
    }
  }
});

test("recipe ingredient dependencies form a directed acyclic graph", () => {
  const recipeByOutput = new Map<string, typeof magicRecipeDefinitions>();
  for (const recipe of magicRecipeDefinitions) recipeByOutput.set(recipe.output, [...(recipeByOutput.get(recipe.output) ?? []), recipe]);
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(output: string): void {
    if (visited.has(output)) return;
    assert.ok(!visiting.has(output), `recipe dependency cycle reaches ${output}`);
    visiting.add(output);
    const recipes = recipeByOutput.get(output);
    assert.ok(recipes, `recipe exists for ${output}`);
    for (const recipe of recipes) for (const input of recipe.inputs) {
      if (recipeByOutput.has(input)) visit(input);
    }
    visiting.delete(output);
    visited.add(output);
  }

  for (const output of recipeByOutput.keys()) visit(output);
  assert.equal(visited.size, recipeByOutput.size);
});
