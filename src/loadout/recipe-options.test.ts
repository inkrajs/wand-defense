import assert from 'node:assert/strict';
import test from 'node:test';
import type { ContentCatalog, GameState } from '../contracts';
import { demoContent } from '../content/demo';
import { createFixtureState } from '../runtime/mock';
import { applyLoadoutCommand } from './transactions';
import { getWandRecipeGroups, getWandRecipeOptions } from './recipe-options';
import { compileWand } from './compile';
import { canMergeItems } from './merge-items';

const content: ContentCatalog = {...demoContent, recipes: [
  {id: 'four', name: '四发', inputs: ['double', 'double'], output: 'quadruple', requireAdjacency: true},
  {id: 'six', name: '六发', inputs: ['quadruple', 'double'], output: 'sextuple', requireAdjacency: true},
  ...demoContent.recipes,
]};
function fixture() {
  const state = createFixtureState();
  state.phase = 'ready'; state.paused = true;
  state.wands = [{...state.wands[0], width: 10, height: 6, placements: [], cooldowns: {}}];
  state.items = {}; state.backpack = []; state.knowledge.recipeIds = ['four', 'six'];
  return state;
}
function place(state: GameState, id: string, definitionId: string, x: number, y: number, rotation: 0 | 1 | 2 | 3 = 0): GameState {
  const definition = content.spells[definitionId] ?? content.arcana[definitionId];
  const added = {...state, items: {...state.items, [id]: {id, definitionId, kind: content.spells[definitionId] ? 'spell' as const : 'arcana' as const, level: definition.level, grade: definition.grade}}, backpack: [...state.backpack, id]};
  const result = applyLoadoutCommand(added, {id: `place-${id}`, type: 'placeItem', wandId: state.wands[0].id, itemId: id, x, y, rotation}, content);
  assert.equal(result.result.status, 'executed');
  return result.state;
}

test('player recipe options choose distinct adjacent duplicate materials and execute the two-step arcana chain', () => {
  let state = place(fixture(), 'far-double', 'double', 8, 4);
  state = place(state, 'double-a', 'double', 0, 0);
  state = place(state, 'double-b', 'double', 2, 0);
  const before = structuredClone(state);
  const [option] = getWandRecipeOptions(state, state.wands[0].id, content);
  assert.deepEqual(option, {recipeId: 'four', output: 'quadruple', itemIds: ['double-a', 'double-b']});
  assert.deepEqual(state, before);
  assert.equal(canMergeItems(state, 'double-a', 'double-b', content), true);
  const merged = applyLoadoutCommand(state, {id: 'four-result', type: 'mergeRecipe', wandId: state.wands[0].id, recipeId: option.recipeId, itemIds: [...option.itemIds]}, content);
  assert.equal(merged.result.status, 'executed');
  assert.equal(merged.state.items['four-result:output'].definitionId, 'quadruple');
  assert.equal(merged.state.items['double-a'], undefined); assert.equal(merged.state.items['double-b'], undefined);
  assert.ok(merged.state.items['far-double']);
  assert.deepEqual(merged.state.backpack, ['four-result:output']);
  assert.ok(merged.state.knowledge.arcanaIds.includes('quadruple'));
  const equipped = applyLoadoutCommand(merged.state, {id: 'equip-four', type: 'placeItem', wandId: state.wands[0].id, itemId: 'four-result:output', x: 6, y: 4, rotation: 0}, content);
  assert.equal(equipped.result.status, 'executed');
  const [six] = getWandRecipeOptions(equipped.state, state.wands[0].id, content);
  assert.deepEqual(six, {recipeId: 'six', output: 'sextuple', itemIds: ['four-result:output', 'far-double']});
  const final = applyLoadoutCommand(equipped.state, {id: 'six-result', type: 'mergeRecipe', wandId: state.wands[0].id, recipeId: six.recipeId, itemIds: [...six.itemIds]}, content);
  assert.equal(final.result.status, 'executed');
  assert.equal(final.events.length, 1); assert.equal(final.events[0].type, 'recipeMerged');
  assert.equal(final.state.items['six-result:output'].definitionId, 'sextuple');
  assert.ok(final.state.knowledge.arcanaIds.includes('sextuple'));
  assert.deepEqual(final.state.wands[0].placements, []);
});

test('three-material option uses rotated shapes and connected chains then commits a real recipe', () => {
  const recipe = content.recipes.find(entry => entry.output === 'thunderstorm')!;
  let state = fixture(); state.knowledge.recipeIds = [recipe.id];
  state = place(state, 'thunder', 'thunder-field-bolt', 0, 0);
  state = place(state, 'area', 'area', 2, 0);
  state = place(state, 'double', 'double', 0, 2, 1);
  const before = structuredClone(state);
  const option = getWandRecipeOptions(state, state.wands[0].id, content)[0];
  assert.ok(option); assert.equal(new Set(option.itemIds).size, 3);
  const merged = applyLoadoutCommand(state, {id: 'three-result', type: 'mergeRecipe', wandId: state.wands[0].id, recipeId: option.recipeId, itemIds: [...option.itemIds]}, content);
  assert.equal(merged.result.status, 'executed');
  assert.equal(merged.state.items['three-result:output'].definitionId, 'thunderstorm');
  assert.deepEqual(merged.events[0].data.consumedItemIds, option.itemIds);
  assert.deepEqual(state, before);
});

test('recipe options hide unknown, missing, disconnected and invalid-location materials and reject stale choices atomically', () => {
  let state = place(fixture(), 'a', 'double', 0, 0);
  assert.deepEqual(getWandRecipeOptions(state, state.wands[0].id, content), []);
  state = place(state, 'b', 'double', 2, 0);
  const [choice] = getWandRecipeOptions(state, state.wands[0].id, content);
  assert.ok(choice);
  const hidden = structuredClone(state); hidden.knowledge.recipeIds = [];
  assert.deepEqual(getWandRecipeOptions(hidden, hidden.wands[0].id, content), []);
  const separated = structuredClone(state); separated.wands[0].placements[1].x = 8;
  assert.deepEqual(getWandRecipeOptions(separated, separated.wands[0].id, content), []);
  const rejected = applyLoadoutCommand(separated, {id: 'stale', type: 'mergeRecipe', wandId: separated.wands[0].id, recipeId: choice.recipeId, itemIds: choice.itemIds}, content);
  assert.equal(rejected.result.code, 'INPUTS_NOT_ADJACENT'); assert.equal(rejected.state, separated); assert.deepEqual(rejected.events, []);
  const duplicate = structuredClone(state); duplicate.backpack.push('a');
  assert.deepEqual(getWandRecipeOptions(duplicate, duplicate.wands[0].id, content), []);
  state.phase = 'battle'; state.paused = false;
  assert.deepEqual(getWandRecipeOptions(state, state.wands[0].id, content), []);
  state.paused = true;
  assert.equal(getWandRecipeOptions(state, state.wands[0].id, content).length, 1);
  state.phase = 'defeat';
  assert.deepEqual(getWandRecipeOptions(state, state.wands[0].id, content), []);
});

test('identical glimmers synthesize different magic only in their actual horizontal or vertical arrangement', () => {
  for (const [dx, dy, expected, forbidden] of [[1, 0, 'glimmer-shield-recipe', 'glimmer-ray-recipe'], [0, 1, 'glimmer-ray-recipe', 'glimmer-shield-recipe']] as const) {
    let state = fixture(); state.knowledge.recipeIds = [expected, forbidden];
    state = place(state, 'a', 'glimmer', 3, 2);
    state = place(state, 'b', 'glimmer', 3 + dx, 2 + dy);
    const options = getWandRecipeOptions(state, state.wands[0].id, content);
    assert.deepEqual(options.map(option => option.recipeId), [expected]);
    const denied = applyLoadoutCommand(state, {id:'wrong-layout', type:'mergeRecipe', wandId:state.wands[0].id, recipeId:forbidden, itemIds:['b','a']}, content);
    assert.equal(denied.result.code, 'RECIPE_LAYOUT_MISMATCH');
    assert.equal(denied.state, state);
    const merged = applyLoadoutCommand(state, {id:'right-layout', type:'mergeRecipe', wandId:state.wands[0].id, recipeId:expected, itemIds:['b','a']}, content);
    assert.equal(merged.result.status, 'executed');
    assert.equal(merged.state.items['right-layout:output'].definitionId, expected === 'glimmer-ray-recipe' ? 'solar-ray' : 'ward');
  }
});

test('two amplification tiers really synthesize and strengthen adjacent magic', () => {
  const recipeIds = ['greater-amplify-recipe','supreme-amplify-recipe'];
  let state = fixture(); state.knowledge.recipeIds = recipeIds;
  state = place(state,'amp-a','amplify',0,0); state = place(state,'amp-b','amplify',1,0);
  const first = getWandRecipeOptions(state,state.wands[0].id,content).find(option => option.recipeId === recipeIds[0])!;
  const result = applyLoadoutCommand(state, {id:'upgrade',type:'mergeRecipe',wandId:state.wands[0].id,recipeId:first.recipeId,itemIds:first.itemIds},content);
  assert.equal(result.result.status,'executed');
  assert.equal(result.state.items['upgrade:output'].definitionId,'greater-amplify');
  state = place(result.state, 'test-spell', 'spark', 0, 1);
  const baseline = compileWand(state, state.wands[0].id, content)!.spells[0].power;
  const placed = applyLoadoutCommand(state, {id:'equip-upgrade',type:'placeItem',wandId:state.wands[0].id,itemId:'upgrade:output',x:0,y:0,rotation:0},content);
  assert.equal(placed.result.status,'executed');
  assert.equal(compileWand(placed.state,state.wands[0].id,content)!.spells[0].power, baseline * 2);
  assert.equal(content.arcana['supreme-amplify'].value, 3);
});

test('an inspected material finds its own legal group even when another pair is listed first', () => {
  const horizontal = 'glimmer-shield-recipe', vertical = 'glimmer-ray-recipe';
  let state = fixture(); state.knowledge.recipeIds = [horizontal, vertical];
  state = place(state, 'corner', 'glimmer', 0, 0);
  state = place(state, 'right', 'glimmer', 1, 0);
  state = place(state, 'below', 'glimmer', 0, 1);
  state = place(state, 'second-left', 'glimmer', 4, 0);
  state = place(state, 'second-right', 'glimmer', 5, 0);
  state = place(state, 'isolated', 'glimmer', 9, 5);
  const wandId = state.wands[0].id;
  const groups = getWandRecipeGroups(state, wandId, content);
  assert.deepEqual(groups, [
    {recipeId: horizontal, output: 'ward', itemIds: ['corner', 'right']},
    {recipeId: horizontal, output: 'ward', itemIds: ['second-left', 'second-right']},
    {recipeId: vertical, output: 'solar-ray', itemIds: ['corner', 'below']},
  ]);
  assert.deepEqual(getWandRecipeGroups(state, wandId, content), groups);
  assert.deepEqual(getWandRecipeGroups(state, 'another-wand', content), []);
  for (const [index, group] of groups.entries()) {
    const merge = applyLoadoutCommand(state, {id: `group-${index}`, type: 'mergeRecipe', wandId, recipeId: group.recipeId, itemIds: group.itemIds}, content);
    assert.equal(merge.result.status, 'executed');
  }
  const restricted = {...state, knowledge: {...state.knowledge, recipeIds: [horizontal]}};
  const broken = {...content, recipes: [{...content.recipes.find(recipe => recipe.id === horizontal)!, output: 'missing-output'}, ...content.recipes]};
  assert.deepEqual(getWandRecipeGroups(restricted, wandId, content), groups.slice(0, 2));
  assert.deepEqual(getWandRecipeGroups(restricted, wandId, broken), []);
  const inspect = (id: string) => getWandRecipeOptions(state, wandId, content, id);
  assert.deepEqual(inspect('corner').map(option => option.recipeId), [horizontal, vertical]);
  assert.deepEqual(inspect('below').map(option => option.recipeId), [vertical]);
  assert.deepEqual(inspect('isolated'), []);
  assert.deepEqual(inspect('missing'), []);
  const [choice] = inspect('second-right');
  assert.equal(choice.recipeId, horizontal);
  assert.deepEqual(choice.itemIds, ['second-left', 'second-right']);
  const merged = applyLoadoutCommand(state, {id: 'picked-pair', type: 'mergeRecipe', wandId, recipeId: choice.recipeId, itemIds: choice.itemIds}, content);
  assert.equal(merged.result.status, 'executed');
  assert.deepEqual(merged.state.wands[0].placements.map(p => p.itemId), ['corner', 'right', 'below', 'isolated']);
});
