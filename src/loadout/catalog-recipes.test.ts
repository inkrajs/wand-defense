import assert from 'node:assert/strict';
import test from 'node:test';
import { demoContent } from '../content/demo';
import { createFixtureState } from '../runtime/mock';
import { applyLoadoutCommand } from './index';
import { findRecipeExample } from './recipe-layout';
import { getWandRecipeOptions } from './recipe-options';

test('catalog recipe previews are executable on the same 5×5 wand board', () => {
  for (const recipe of demoContent.recipes) {
    const example = findRecipeExample(recipe, demoContent);
    assert.ok(example, `${recipe.id}: missing 5×5 preview`);
    const state = createFixtureState();
    state.phase = 'ready';
    state.wands[0] = {
      ...state.wands[0], width: 5, height: 5, cooldowns: {},
      placements: example.map(entry => entry.placement),
    };
    state.backpack = [];
    state.items = {};
    state.knowledge.recipeIds = [recipe.id];
    for (const { definitionId, placement } of example) {
      const { grade, level } = demoContent.spells[definitionId] ?? demoContent.arcana[definitionId];
      state.items[placement.itemId] = {
        id: placement.itemId, definitionId, grade, level,
        kind: demoContent.spells[definitionId] ? 'spell' : 'arcana',
      };
    }
    const [option] = getWandRecipeOptions(state, state.wands[0].id, demoContent);
    assert.equal(option?.recipeId, recipe.id, `${recipe.id}: preview is not offered on the wand`);
    const merged = applyLoadoutCommand(state, {
      id: 'preview-merge', type: 'mergeRecipe', wandId: state.wands[0].id,
      recipeId: recipe.id, itemIds: option.itemIds,
    }, demoContent);
    assert.equal(merged.result.status, 'executed', `${recipe.id}: preview cannot merge`);
    assert.equal(merged.state.items['preview-merge:output']?.definitionId, recipe.output, recipe.id);
  }
});
