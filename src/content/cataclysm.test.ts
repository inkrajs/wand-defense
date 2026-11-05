import assert from "node:assert/strict";
import test from "node:test";
import { demoContent } from "./demo";
import { cataclysmSpells } from "./cataclysmSpells";
import { discoverAvailableRecipes } from "./recipeKnowledge";
import { findRecipeExample } from "../loadout/recipe-layout";
import { applyLoadoutCommand } from "../loadout/transactions";
import { createFixtureState } from "../runtime/mock";
import { getMagicPresentationDefinition } from "../ui/magicPresentationIcons";
import { sampleWaveRewards } from "./randomRewards";

test("every new spell has artwork, a discoverable recipe and materials that can be combined on a 5×5 wand", () => {
  const knowledge = {spellIds: Object.keys(demoContent.spells), arcanaIds: Object.keys(demoContent.arcana),
    recipeIds: [] as string[], sequenceIds: [] as string[]};
  const knownRecipes = new Set(discoverAvailableRecipes(knowledge, demoContent));
  for (const [id, spell] of Object.entries(cataclysmSpells)) {
    const icon = getMagicPresentationDefinition(id);
    assert.ok(icon && icon.paths.length && icon.filledPaths.length, `${id} needs actual artwork`);
    assert.deepEqual(icon.shape, spell.shape);
    assert.ok(spell.description && spell.manaCost > 0 && spell.cooldownMs > 0);
    const recipe = demoContent.recipes.find(entry => entry.output === id);
    assert.ok(recipe, `${id} needs a recipe`);
    assert.ok(knownRecipes.has(recipe.id), `${id} recipe is discoverable`);
    const example = findRecipeExample(recipe, demoContent);
    assert.ok(example, `${recipe.id} must physically fit on a 5×5 wand`);
    const state = createFixtureState();
    state.phase = "ready"; state.paused = true; state.backpack = [];
    state.wands[0] = {...state.wands[0], width: 5, height: 5, placements: example.map(option => option.placement), cooldowns: {}};
    state.items = Object.fromEntries(recipe.inputs.map((definitionId, index) => {
      const definition = demoContent.spells[definitionId] ?? demoContent.arcana[definitionId];
      return [String(index), {id: String(index), definitionId, kind: demoContent.spells[definitionId] ? "spell" : "arcana",
        level: definition.level, grade: definition.grade}];
    }));
    state.knowledge.recipeIds = [recipe.id];
    const result = applyLoadoutCommand(state, {id: `make-${id}`, type: "mergeRecipe", wandId: state.wands[0].id,
      recipeId: recipe.id, itemIds: recipe.inputs.map((_,index)=>String(index))}, demoContent);
    assert.equal(result.result.status, "executed", recipe.id);
    assert.equal(result.state.items[`make-${id}:output`].definitionId, id);
  }
});

test("advanced spells enter the direct reward pool only at their configured wave", () => {
  for (const [id, firstWave] of [["dense-rock", 4], ["gravity-core", 8], ["gravity-well", 12], ["black-hole", 15]] as const) {
    const content = {...demoContent, spells: { [id]: cataclysmSpells[id] }, arcana: {}};
    const sampling = {characterCount: 3, wandCount: 6, content, canHeal: false, random: () => 0.5};
    assert.ok(sampleWaveRewards({...sampling, wave: firstWave - 1}).every(reward => reward.definitionId !== id));
    assert.ok(sampleWaveRewards({...sampling, wave: firstWave}).some(reward => reward.definitionId === id));
  }
});

test('endgame fusion recipes retain real intermediary steps and requested elemental materials', () => {
  const recipe = (output:string) => demoContent.recipes.find(entry => entry.output === output)!;
  assert.deepEqual(recipe('helium-flash').inputs, ['magma-lance','thunderstorm','greater-amplify']);
  assert.ok(demoContent.spells['magma-lance'].fusionElements?.includes('earth') || demoContent.spells['magma-lance'].element === 'earth');
  assert.equal(demoContent.spells.thunderstorm.element,'lightning');
  assert.ok(recipe('artificial-sun').inputs.includes('water-bolt'));
  assert.equal(demoContent.spells['fission-bomb'].name, '核弹');
  assert.equal(demoContent.spells['fission-bomb'].element, 'metal');
  assert.ok(recipe('antimatter-bomb').inputs.includes('annihilation-orb'));
  assert.ok(recipe('annihilation-orb').inputs.includes('twilight-orb'));
  assert.deepEqual(recipe('dense-rock').inputs, ['rock-shot','rock-shot','focus']);
  assert.deepEqual(recipe('gravity-core').inputs, ['dense-rock','dense-rock','greater-amplify']);
  assert.deepEqual(recipe('gravity-well').inputs, ['gravity-core','void-ray','focus']);
  assert.deepEqual(recipe('void-ray').inputs, ['dark-orb','focus']);
  assert.ok(demoContent.spells['gravity-well'].fusionElements?.includes('earth'));
  assert.equal(demoContent.spells['gravity-well'].rewardMinWave, 12);
  assert.ok(demoContent.spells['gravity-core'].area!.pullStrength! < demoContent.spells['gravity-well'].area!.pullStrength!);
  assert.equal(demoContent.spells['black-hole'].name, '小黑洞');
  assert.deepEqual(recipe('twin-black-holes').inputs, ['black-hole','double']);
  assert.ok(recipe('supermassive-black-hole').inputs.includes('twin-black-holes'));
  assert.ok(recipe('vacuum-decay').inputs.includes('supermassive-black-hole'));
  assert.ok(recipe('vacuum-decay').inputs.includes('prism-ray'));
  assert.ok(recipe('god-rod').inputs.includes('railgun'));
  assert.ok(recipe('god-rod').inputs.includes('prism-ray'));
  assert.ok(demoContent.spells['supermassive-black-hole'].manaCost > demoContent.spells['black-hole'].manaCost);
});
