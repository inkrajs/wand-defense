import assert from 'node:assert/strict';
import test from 'node:test';
import type { ContentCatalog, Element, GameState, RecipeDefinition, SpellDefinition } from '../contracts';
import { demoContent } from '../content/demo';
import { buildSkillTree } from './skillTreeModel';

const knowledge = (spellIds: string[] = [], arcanaIds: string[] = [], recipeIds: string[] = []): GameState['knowledge'] => ({spellIds, arcanaIds, recipeIds, sequenceIds: []});
const spell = (id: string, element: Element): SpellDefinition => ({...demoContent.spells.spark, id, name: id, element});
const recipe = (id: string, inputs: string[], output: string): RecipeDefinition => ({id, name: `秘密名称:${output}`, inputs, output, requireAdjacency: true});

test('real discovered recipe seeds its unknown output anonymously without leaking names or unrelated elements', () => {
  const content = structuredClone(demoContent);
  content.spells.spark.level = 50; content.spells.spark.grade = 'mythic';
  const known = knowledge(['spark', 'water-bolt'], ['amplify'], ['fireball-recipe']);
  const before = structuredClone({content, known});
  const tree = buildSkillTree(content, known, 'fire');
  assert.equal(tree.nodes.length, 4);
  const unknown = tree.nodes.find(node => !node.known)!;
  assert.equal(unknown.name, '未知'); assert.equal(unknown.kind, 'spell');
  assert.equal(unknown.definitionId, undefined); assert.match(unknown.id, /^unknown:\d+$/);
  const merge = tree.nodes.find(node => node.kind === 'recipe')!;
  assert.equal(merge.name, '合成'); assert.equal(merge.output, unknown.id);
  assert.equal(JSON.stringify(tree).includes(content.spells.fireball.name), false);
  assert.equal(tree.nodes.some(node => node.definitionId === 'water-bolt'), false);
  assert.equal(tree.nodes.some(node => node.definitionId === 'flame-lance-recipe'), false);
  assert.equal(tree.nodes.find(node => node.definitionId === 'spark')!.atomic, true);
  assert.equal(tree.nodes.find(node => node.definitionId === 'amplify')!.atomic, false);
  assert.deepEqual({content, known}, before);
});

test('cross-element ancestry uses independent AND nodes, preserves ingredient quantities and multiple recipes', () => {
  const content: ContentCatalog = {spells: {ember: spell('ember', 'fire'), water: spell('water', 'water'), wood: spell('wood', 'wood'), final: spell('final', 'fire')},
    arcana: {amplify: structuredClone(demoContent.arcana.amplify)}, sequences: {}, recipes: [
      recipe('final-a', ['water', 'amplify', 'water'], 'final'),
      recipe('cross-system', ['wood', 'ember'], 'water'),
      recipe('final-b', ['ember', 'amplify'], 'final'),
    ]};
  const tree = buildSkillTree(content, knowledge(Object.keys(content.spells), ['amplify'], content.recipes.map(value => value.id)), 'fire');
  assert.equal(tree.nodes.length, 8); assert.equal(tree.edges.length, 9);
  const byDefinition = (id: string) => tree.nodes.find(node => node.definitionId === id)!;
  const merge = byDefinition('final-a');
  assert.deepEqual(merge.inputs, [byDefinition('water').id, byDefinition('amplify').id, byDefinition('water').id]);
  assert.equal(merge.output, byDefinition('final').id);
  assert.ok(tree.edges.some(edge => edge.source === byDefinition('wood').id && edge.target === byDefinition('cross-system').id));
  assert.ok(tree.edges.some(edge => edge.source === merge.id && edge.target === byDefinition('final').id));
  assert.equal(tree.edges.some(edge => edge.source === byDefinition('water').id && edge.target === byDefinition('final').id), false);
  assert.equal(byDefinition('water').atomic, false); assert.equal(byDefinition('wood').atomic, true);
  assert.equal(byDefinition('final-b').name, '合成');
});

test('atomic uses the full real generation catalog; empty and dangling recipes do not manufacture synthesis', () => {
  const content: ContentCatalog = {spells: {base: spell('base', 'fire'), derived: spell('derived', 'fire'), phantom: spell('phantom', 'fire')},
    arcana: {}, sequences: {}, recipes: [recipe('hidden-producer', ['base'], 'derived'), recipe('empty', [], 'base'), recipe('dangling', ['missing'], 'phantom')]};
  const tree = buildSkillTree(content, knowledge(['base', 'derived'], [], ['empty', 'dangling']), 'fire');
  assert.equal(tree.nodes.length, 2); assert.equal(tree.edges.length, 0);
  assert.equal(tree.nodes.find(node => node.definitionId === 'base')!.atomic, true);
  assert.equal(tree.nodes.find(node => node.definitionId === 'derived')!.atomic, false);
  assert.equal(tree.nodes.some(node => node.kind === 'recipe'), false);
});

test('cyclic known recipes terminate, deduplicate nodes and edges, and remain deterministic', () => {
  const content: ContentCatalog = {spells: {a: spell('a', 'fire'), b: spell('b', 'water'), c: spell('c', 'wood')}, arcana: {}, sequences: {},
    recipes: [recipe('cycle-a', ['b'], 'a'), recipe('cycle-b', ['a'], 'b'), recipe('alternative-a', ['c'], 'a')]};
  const known = knowledge(['a', 'a'], [], ['cycle-a', 'cycle-b', 'alternative-a', 'cycle-a', 'stale-recipe']);
  const before = structuredClone({content, known});
  const tree = buildSkillTree(content, known, 'fire');
  assert.equal(tree.nodes.length, 6); assert.equal(tree.edges.length, 6);
  const ids = new Set(tree.nodes.map(node => node.id));
  assert.equal(ids.size, tree.nodes.length);
  assert.equal(new Set(tree.edges.map(edge => edge.id)).size, tree.edges.length);
  assert.ok(tree.edges.every(edge => ids.has(edge.source) && ids.has(edge.target)));
  assert.deepEqual(buildSkillTree(content, known, 'fire'), tree);
  assert.deepEqual({content, known}, before);
});
