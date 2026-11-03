import test from 'node:test';
import assert from 'node:assert/strict';
import type { ContentCatalog } from '../contracts';
import { createFixtureState } from '../runtime/mock';
import { compileWand } from './compile';

const content: ContentCatalog = {
  spells: { spark: {
    id: 'spark', name: 'Spark', level: 1, grade: 'common', element: 'fire',
    shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }], asset: { key: 'spark', label: 'Spark' },
    effect: 'projectile', power: 10, manaCost: 4, cooldownMs: 1000, range: 10,
  } },
  arcana: { amplify: {
    id: 'amplify', name: 'Amplify', level: 1, grade: 'common',
    shape: [{ x: 0, y: 0 }], asset: { key: 'amplify', label: 'Amplify' },
    modifier: 'amplify', value: 2,
  } }, recipes: [], sequences: { 'fire-9': {
    id: 'fire-9', pathwayId: 'fire', number: 9, name: 'Fire',
    bonuses: { fire: 0.1 }, requirements: [],
  } },
};

test('multi-cell contact applies each modifier once then current sequence; input stays immutable', () => {
  const state = createFixtureState();
  state.wands[0].placements.push({ itemId: 'amplify-1', x: 1, y: 1, rotation: 0 });
  const before = structuredClone({ state, content });
  const compiled = compileWand(state, 'wand-1', content)!;
  assert.equal(compiled.spells[0].power, 22);
  assert.deepEqual(compiled.spells[0].modifierItemIds, ['amplify-1']);
  compiled.spells[0].shape[0].x = 99;
  compiled.spells[0].asset.label = 'Changed';
  assert.deepEqual({ state, content }, before);
});

test('diagonal arcana does not modify; double creates copies without charging twice', () => {
  const state = createFixtureState();
  state.wands[0].placements.push({ itemId: 'amplify-1', x: 2, y: 1, rotation: 0 });
  assert.equal(compileWand(state, 'wand-1', content)!.spells[0].power, 11);
  const doubled = structuredClone(content);
  doubled.arcana.amplify.modifier = 'double';
  state.wands[0].placements[1].x = 1;
  const spell = compileWand(state, 'wand-1', doubled)!.spells[0];
  assert.equal(spell.copies, 2);
  assert.equal(spell.manaCost, 4);
});

test('owner mismatch cannot cast and generated entity HP inherits sequence once', () => {
  const state = createFixtureState();
  const summoned = structuredClone(content);
  summoned.spells.spark.effect = 'summon';
  summoned.spells.spark.hp = 50;
  assert.ok(Math.abs(compileWand(state, 'wand-1', summoned)!.spells[0].hp! - 55) < 1e-9);
  state.characters[0].wandIds = [];
  assert.equal(compileWand(state, 'wand-1', summoned), undefined);
});

test('compiled output follows a real place → merge → rotate/place transaction chain', async () => {
  const { applyLoadoutCommand } = await import('./transactions');
  const catalog = structuredClone(content);
  catalog.spells.fireball = { ...structuredClone(catalog.spells.spark), id: 'fireball', power: 30 };
  catalog.recipes = [{ id: 'fireball-recipe', name: 'Fireball', inputs: ['spark', 'amplify'], output: 'fireball', requireAdjacency: true }];
  let state = createFixtureState();
  state.backpackOpen = true;
  state.paused = true;
  const original = structuredClone(state);
  const placed = applyLoadoutCommand(state, { id: 'place', type: 'placeItem', wandId: 'wand-1', itemId: 'amplify-1', x: 1, y: 1, rotation: 0 }, catalog);
  assert.equal(placed.result.status, 'executed');
  state = placed.state;
  const merged = applyLoadoutCommand(state, { id: 'merge', type: 'mergeRecipe', wandId: 'wand-1', recipeId: 'fireball-recipe', itemIds: ['spark-1', 'amplify-1'] }, catalog);
  assert.equal(merged.result.status, 'executed');
  assert.equal(compileWand(merged.state, 'wand-1', catalog)!.spells.length, 0);
  const equipped = applyLoadoutCommand(merged.state, { id: 'place-result', type: 'placeItem', wandId: 'wand-1', itemId: 'merge:output', x: 2, y: 0, rotation: 1 }, catalog);
  assert.equal(equipped.result.status, 'executed');
  const spells = compileWand(equipped.state, 'wand-1', catalog)!.spells;
  assert.equal(spells.length, 1);
  assert.equal(spells[0].itemId, 'merge:output');
  assert.equal(spells[0].power, 33);
  assert.equal(equipped.state.revision, original.revision + 3);
  assert.equal(original.items['spark-1'].definitionId, 'spark');
});
