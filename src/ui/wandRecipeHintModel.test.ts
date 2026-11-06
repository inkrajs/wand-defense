import assert from 'node:assert/strict';
import test from 'node:test';
import { demoContent } from '../content/demo';
import { createFixtureState } from '../runtime/mock';
import { getHintMaterialIds, getWandRecipeHints, layerWandRecipeHints, type WandRecipeHint } from './wandRecipeHintModel';

test('competing combinations take separate rounds while independent combinations flash together', () => {
  const group = (key: string, itemIds: string[]): WandRecipeHint => ({ key, itemIds, cells: [] });
  const layers = layerWandRecipeHints([group('ab', ['a', 'b']), group('bc', ['b', 'c']), group('de', ['d', 'e'])]);
  assert.deepEqual(layers.map(layer => layer.map(item => item.key)), [['ab', 'de'], ['bc']]);
});

test('washes cover exactly the occupied cells of known executable arrangements', () => {
  const state = createFixtureState();
  state.phase = 'ready'; state.paused = true; state.backpack = [];
  state.knowledge.recipeIds = ['glimmer-shield-recipe', 'glimmer-ray-recipe'];
  const definition = demoContent.spells.glimmer;
  state.items = Object.fromEntries(['a', 'b', 'c', 'isolated'].map(id => [id, {
    id, definitionId: 'glimmer', kind: 'spell' as const, level: definition.level, grade: definition.grade,
  }]));
  state.wands = [{ ...state.wands[0], width: 5, height: 5, placements: [
    { itemId: 'a', x: 0, y: 0, rotation: 0 }, { itemId: 'b', x: 1, y: 0, rotation: 0 },
    { itemId: 'c', x: 0, y: 1, rotation: 0 }, { itemId: 'isolated', x: 4, y: 4, rotation: 0 },
  ] }];
  const before = structuredClone(state);
  const hints = getWandRecipeHints(state, state.wands, demoContent);
  const layers = hints.get(state.wands[0].id)!;
  assert.deepEqual(layers.map(layer => layer.map(hint => hint.itemIds)), [[['a', 'b']], [['a', 'c']]]);
  assert.deepEqual(layers[0][0].cells, [{ x: 0, y: 0 }, { x: 1, y: 0 }]);
  assert.deepEqual(layers[1][0].cells, [{ x: 0, y: 0 }, { x: 0, y: 1 }]);
  assert.deepEqual([...getHintMaterialIds(hints)].sort(), ['a', 'b', 'c']);
  assert.deepEqual(state, before);
  state.knowledge.recipeIds = [];
  assert.equal(getWandRecipeHints(state, state.wands, demoContent).size, 0);
});

test('the combined wash follows irregular and rotated ingredient shapes', () => {
  const state = createFixtureState();
  state.phase = 'ready'; state.paused = true; state.backpack = [];
  state.knowledge.recipeIds = ['thunderstorm-recipe'];
  const entries = [['thunder', 'thunder-field-bolt'], ['area', 'area'], ['double', 'double']] as const;
  state.items = Object.fromEntries(entries.map(([id, definitionId]) => {
    const definition = demoContent.spells[definitionId] ?? demoContent.arcana[definitionId];
    return [id, { id, definitionId, kind: definitionId === 'thunder-field-bolt' ? 'spell' as const : 'arcana' as const,
      level: definition.level, grade: definition.grade }];
  }));
  state.wands = [{ ...state.wands[0], width: 5, height: 5, placements: [
    { itemId: 'thunder', x: 0, y: 0, rotation: 0 }, { itemId: 'area', x: 2, y: 0, rotation: 0 },
    { itemId: 'double', x: 0, y: 2, rotation: 1 },
  ] }];
  const hints = getWandRecipeHints(state, state.wands, demoContent).get(state.wands[0].id)!;
  const cells = hints[0][0].cells.map(({ x, y }) => `${x},${y}`).sort();
  assert.deepEqual(cells, ['0,0', '0,1', '0,2', '0,3', '1,0', '1,1', '2,0', '2,1', '3,0']);
});
