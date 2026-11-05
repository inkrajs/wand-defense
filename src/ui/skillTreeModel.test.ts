import assert from 'node:assert/strict';
import test from 'node:test';
import type { ContentCatalog, Element, GameState, RecipeDefinition, SpellDefinition } from '../contracts';
import { demoContent } from '../content/demo';
import { buildSkillTree, getKnownRecipesForDefinition } from './skillTreeModel';

const knowledge = (spellIds: string[] = [], arcanaIds: string[] = [], recipeIds: string[] = []): GameState['knowledge'] => ({spellIds, arcanaIds, recipeIds, sequenceIds: []});
const spell = (id: string, element: Element): SpellDefinition => ({...demoContent.spells.spark, id, name: id, element});
const recipe = (id: string, inputs: string[], output: string): RecipeDefinition => ({id, name: `秘密名称:${output}`, inputs, output, requireAdjacency: true});

test('arcana tree shows arcana progression and only spell ingredients as boundaries', () => {
  const content: ContentCatalog = {
    spells: {root: spell('root', 'fire'), catalyst: spell('catalyst', 'fire'), unrelated: spell('unrelated', 'water')},
    arcana: {
      double: structuredClone(demoContent.arcana.double),
      quadruple: structuredClone(demoContent.arcana.quadruple),
      focus: structuredClone(demoContent.arcana.focus),
      secret: {...demoContent.arcana.focus, id: 'secret', name: '秘密奥术'},
    }, sequences: {}, recipes: [
      recipe('quad', ['double', 'double'], 'quadruple'),
      recipe('secret', ['quadruple', 'catalyst'], 'secret'),
      recipe('catalyst', ['root'], 'catalyst'),
      recipe('unrelated', ['double'], 'unrelated'),
    ],
  };
  const known = knowledge(['root', 'catalyst', 'unrelated'], ['double', 'quadruple', 'focus'], content.recipes.map(value => value.id));
  const tree = buildSkillTree(content, known, 'arcana');
  assert.equal(tree.nodes.length, 5);
  assert.equal(tree.edges.length, 3);
  assert.equal(tree.nodes.find(node => node.definitionId === 'double')!.atomic, true);
  assert.equal(tree.nodes.find(node => node.definitionId === 'quadruple')!.atomic, false);
  assert.deepEqual(tree.nodes.find(node => node.definitionId === 'quadruple')!.recipes, [{inputs: ['arcana:double', 'arcana:double']}]);
  const material = tree.nodes.find(node => node.definitionId === 'catalyst')!;
  assert.equal(material.boundary, true);
  assert.equal(material.recipes, undefined);
  assert.equal(tree.nodes.some(node => node.definitionId === 'root' || node.definitionId === 'unrelated'), false);
  const unknown = tree.nodes.find(node => !node.known)!;
  assert.equal(unknown.name, '未知');
  assert.equal(unknown.definitionId, undefined);
  assert.deepEqual(unknown.recipes, [{inputs: ['arcana:quadruple', 'spell:catalyst']}]);
  assert.equal(JSON.stringify(tree).includes('秘密奥术'), false);
  assert.equal(JSON.stringify(tree).includes('secret'), false);
});

test('real arcana tree includes its isolated arcana and the double to six-shot line', () => {
  const known = knowledge(Object.keys(demoContent.spells), Object.keys(demoContent.arcana), demoContent.recipes.map(value => value.id));
  const tree = buildSkillTree(demoContent, known, 'arcana');
  for (const id of known.arcanaIds) assert.ok(tree.nodes.some(node => node.definitionId === id), id);
  assert.ok(tree.nodes.every(node => node.kind === 'arcana' || node.boundary));
  assert.ok(tree.edges.some(edge => edge.source === 'spell:iron-spark' && edge.target === 'arcana:oxidation'));
  assert.ok(tree.edges.some(edge => edge.source === 'arcana:double' && edge.target === 'arcana:quadruple'));
  assert.ok(tree.edges.some(edge => edge.source === 'arcana:quadruple' && edge.target === 'arcana:sextuple'));
  assert.ok(tree.nodes.filter(node => node.kind === 'arcana').every(node => !node.boundary));
  assert.deepEqual(buildSkillTree(demoContent, knowledge(), 'arcana'), {nodes: [], edges: []});
});

test('endgame spells retain their actual progression in the relevant elemental trees', () => {
  const known = knowledge(Object.keys(demoContent.spells), Object.keys(demoContent.arcana), demoContent.recipes.map(value => value.id));
  const light = buildSkillTree(demoContent, known, 'light');
  const dark = buildSkillTree(demoContent, known, 'dark');
  const earth = buildSkillTree(demoContent, known, 'earth');
  const hasEdge = (tree: typeof light, from: string, to: string) =>
    tree.edges.some(edge => edge.source === `spell:${from}` && edge.target === `spell:${to}`);
  for (const [from, to] of [['glimmer', 'solar-ray'], ['solar-ray', 'prism-ray'], ['prism-ray', 'god-rod'], ['prism-ray', 'vacuum-decay']]) {
    assert.ok(hasEdge(light, from, to), `light: ${from} -> ${to}`);
  }
  for (const [from, to] of [['gravity-well', 'black-hole'], ['black-hole', 'twin-black-holes'], ['twin-black-holes', 'supermassive-black-hole'], ['supermassive-black-hole', 'vacuum-decay']]) {
    assert.ok(hasEdge(dark, from, to), `dark: ${from} -> ${to}`);
  }
  for (const [from, to] of [['rock-shot', 'dense-rock'], ['dense-rock', 'gravity-core'], ['gravity-core', 'gravity-well']]) {
    assert.ok(hasEdge(earth, from, to), `earth: ${from} -> ${to}`);
  }
  assert.ok(hasEdge(dark, 'dark-orb', 'void-ray'));
  assert.ok(hasEdge(dark, 'void-ray', 'gravity-well'));
  assert.equal(hasEdge(earth, 'rock-shot', 'gravity-well'), false);
});

test('a boundary spell still exposes its discovered recipe in details without revealing unknown ingredients', () => {
  const allKnown = knowledge(['depleted-round','iron-spark','railgun','static-spark'], ['pierce'], ['depleted-round-recipe','railgun-recipe']);
  const tree = buildSkillTree(demoContent, allKnown, 'lightning');
  const boundary = tree.nodes.find(node => node.definitionId === 'depleted-round')!;
  assert.equal(boundary.boundary, true);
  assert.equal(boundary.recipes, undefined);
  assert.deepEqual(getKnownRecipesForDefinition(demoContent, allKnown, 'depleted-round').map(value => value.id), ['depleted-round-recipe']);
  assert.deepEqual(getKnownRecipesForDefinition(demoContent, {...allKnown, arcanaIds:[]}, 'depleted-round'), []);
  assert.deepEqual(getKnownRecipesForDefinition(demoContent, {...allKnown, recipeIds:[]}, 'depleted-round'), []);
});

test('real discovered recipe seeds its unknown output anonymously without leaking names or unrelated elements', () => {
  const content = structuredClone(demoContent);
  content.spells.spark.level = 50; content.spells.spark.grade = 'mythic';
  const known = knowledge(['spark', 'water-bolt'], ['amplify'], ['fireball-recipe']);
  const before = structuredClone({content, known});
  const tree = buildSkillTree(content, known, 'fire');
  assert.equal(tree.nodes.length, 3);
  const unknown = tree.nodes.find(node => !node.known)!;
  assert.equal(unknown.name, '未知'); assert.equal(unknown.kind, 'spell');
  assert.equal(unknown.definitionId, undefined); assert.match(unknown.id, /^unknown:\d+$/);
  assert.deepEqual(unknown.recipes, [{inputs: ['spell:spark', 'arcana:amplify']}]);
  assert.deepEqual(tree.edges.map(({source, target}) => [source, target]), [['spell:spark', unknown.id], ['arcana:amplify', unknown.id]]);
  assert.equal(JSON.stringify(tree).includes('fireball-recipe'), false);
  assert.equal(JSON.stringify(tree).includes(content.spells.fireball.name), false);
  assert.equal(tree.nodes.some(node => node.definitionId === 'water-bolt'), false);
  assert.equal(tree.nodes.some(node => node.definitionId === 'flame-lance-recipe'), false);
  assert.equal(tree.nodes.find(node => node.definitionId === 'spark')!.atomic, true);
  assert.equal(tree.nodes.find(node => node.definitionId === 'amplify')!.atomic, true);
  assert.deepEqual({content, known}, before);
});

test('cross-element ancestry connects ingredients directly and preserves quantities within alternative recipes', () => {
  const content: ContentCatalog = {spells: {ember: spell('ember', 'fire'), water: spell('water', 'water'), wood: spell('wood', 'wood'), final: spell('final', 'fire')},
    arcana: {amplify: structuredClone(demoContent.arcana.amplify)}, sequences: {}, recipes: [
      recipe('final-a', ['water', 'amplify', 'water'], 'final'),
      recipe('cross-system', ['wood', 'ember'], 'water'),
      recipe('final-b', ['ember', 'amplify'], 'final'),
    ]};
  const tree = buildSkillTree(content, knowledge(Object.keys(content.spells), ['amplify'], content.recipes.map(value => value.id)), 'fire');
  assert.equal(tree.nodes.length, 5); assert.equal(tree.edges.length, 5);
  const byDefinition = (id: string) => tree.nodes.find(node => node.definitionId === id)!;
  assert.deepEqual(byDefinition('final').recipes, [
    {inputs: [byDefinition('water').id, byDefinition('amplify').id, byDefinition('water').id]},
    {inputs: [byDefinition('ember').id, byDefinition('amplify').id]},
  ]);
  assert.deepEqual(byDefinition('water').recipes, [{inputs: [byDefinition('wood').id, byDefinition('ember').id]}]);
  assert.deepEqual(new Set(tree.edges.map(edge => `${edge.source}->${edge.target}`)), new Set([
    'spell:water->spell:final', 'arcana:amplify->spell:final', 'spell:ember->spell:final',
    'spell:wood->spell:water', 'spell:ember->spell:water',
  ]));
  assert.equal(byDefinition('water').atomic, false); assert.equal(byDefinition('wood').atomic, true);
  for (const value of content.recipes) assert.equal(JSON.stringify(tree).includes(value.id), false);
});

test('atomic uses the full real generation catalog; empty and dangling recipes do not manufacture synthesis', () => {
  const content: ContentCatalog = {spells: {base: spell('base', 'fire'), derived: spell('derived', 'fire'), phantom: spell('phantom', 'fire')},
    arcana: {}, sequences: {}, recipes: [recipe('hidden-producer', ['base'], 'derived'), recipe('empty', [], 'base'), recipe('dangling', ['missing'], 'phantom')]};
  const tree = buildSkillTree(content, knowledge(['base', 'derived'], [], ['empty', 'dangling']), 'fire');
  assert.equal(tree.nodes.length, 2); assert.equal(tree.edges.length, 0);
  assert.equal(tree.nodes.find(node => node.definitionId === 'base')!.atomic, true);
  assert.equal(tree.nodes.find(node => node.definitionId === 'derived')!.atomic, false);
  assert.ok(tree.nodes.every(node => node.recipes === undefined));
});

test('cyclic known recipes terminate, deduplicate nodes and edges, and remain deterministic', () => {
  const content: ContentCatalog = {spells: {a: spell('a', 'fire'), b: spell('b', 'water'), c: spell('c', 'wood')}, arcana: {}, sequences: {},
    recipes: [recipe('cycle-a', ['b'], 'a'), recipe('cycle-b', ['a'], 'b'), recipe('alternative-a', ['c'], 'a')]};
  const known = knowledge(['a', 'a'], [], ['cycle-a', 'cycle-b', 'alternative-a', 'cycle-a', 'stale-recipe']);
  const before = structuredClone({content, known});
  const tree = buildSkillTree(content, known, 'fire');
  assert.equal(tree.nodes.length, 3); assert.equal(tree.edges.length, 3);
  const a = tree.nodes.find(node => node.definitionId === 'a')!;
  assert.equal(a.recipes?.length, 2);
  const b = tree.nodes.find(node => node.id === a.recipes![0].inputs[0])!;
  assert.deepEqual(b.recipes, [{inputs: [a.id]}]);
  assert.ok(tree.nodes.filter(node => !node.known).every(node => node.definitionId === undefined && node.name === '未知'));
  const ids = new Set(tree.nodes.map(node => node.id));
  assert.equal(ids.size, tree.nodes.length);
  assert.equal(new Set(tree.edges.map(edge => edge.id)).size, tree.edges.length);
  assert.ok(tree.edges.every(edge => ids.has(edge.source) && ids.has(edge.target)));
  assert.deepEqual(buildSkillTree(content, known, 'fire'), tree);
  assert.deepEqual({content, known}, before);
});

test('all includes every known magic and discovered valid recipe, including an unknown arcana output', () => {
  const content: ContentCatalog = {spells: {
    fire: spell('fire', 'fire'), earth: spell('earth', 'earth'), dark: spell('dark', 'dark'),
    'secret-water': {...spell('secret-water', 'water'), name: '水秘术'},
    'secret-fire': {...spell('secret-fire', 'fire'), name: '火秘术'},
    'unreachable-secret': {...spell('unreachable-secret', 'lightning'), name: '不可见秘术'},
  }, arcana: {
    amplify: structuredClone(demoContent.arcana.amplify), efficiency: structuredClone(demoContent.arcana.efficiency),
    'secret-arcana': {...demoContent.arcana.amplify, id: 'secret-arcana', name: '秘密奥术'},
  }, sequences: {}, recipes: [
    recipe('mixed', ['fire', 'earth'], 'secret-fire'),
    recipe('cross', ['secret-water', 'amplify'], 'earth'),
    recipe('arcana-output', ['dark', 'efficiency'], 'secret-arcana'),
    recipe('undiscovered', ['fire'], 'unreachable-secret'),
    recipe('empty', [], 'unreachable-secret'),
    recipe('dangling', ['missing'], 'unreachable-secret'),
  ]};
  const known = knowledge(['fire', 'earth', 'dark', 'stale'], ['amplify', 'efficiency', 'stale'], ['mixed', 'cross', 'arcana-output', 'empty', 'dangling']);
  const before = structuredClone({content, known});
  const tree = buildSkillTree(content, known, 'all');
  assert.equal(tree.nodes.length, 8); assert.equal(tree.edges.length, 6);
  assert.ok(tree.nodes.every(node => node.kind === 'spell' || node.kind === 'arcana'));
  for (const id of ['fire', 'earth', 'dark', 'amplify', 'efficiency']) assert.ok(tree.nodes.some(node => node.known && node.definitionId === id), id);
  const anonymous = tree.nodes.filter(node => !node.known);
  assert.equal(anonymous.length, 3);
  assert.ok(anonymous.every(node => node.name === '未知' && node.definitionId === undefined && node.id.startsWith('unknown:')));
  const arcanaOutput = anonymous.find(node => node.kind === 'arcana')!;
  assert.deepEqual(arcanaOutput.recipes, [{inputs: ['spell:dark', 'arcana:efficiency']}]);
  for (const secret of ['水秘术', '火秘术', '秘密奥术', '不可见秘术', 'secret-water', 'secret-fire', 'secret-arcana', 'unreachable-secret', 'mixed', 'cross', 'arcana-output']) assert.equal(JSON.stringify(tree).includes(secret), false);
  const fire = buildSkillTree(content, known, 'fire');
  assert.ok(fire.nodes.some(node => node.definitionId === 'earth'));
  const externalEarth = fire.nodes.find(node => node.definitionId === 'earth')!;
  assert.equal(externalEarth.recipes, undefined); assert.equal(externalEarth.boundary, true);
  assert.equal(externalEarth.atomic, false);
  assert.equal(fire.nodes.some(node => node.definitionId === 'amplify'), false);
  assert.equal(fire.nodes.some(node => !node.known && node.recipes === undefined), false);
  assert.equal(fire.nodes.some(node => node.definitionId === 'dark' || node.definitionId === 'efficiency'), false);
  assert.deepEqual({content, known}, before);
});

test('all retains isolated known spells and arcana across the real catalog without revealing undiscovered recipes', () => {
  const known = knowledge(Object.keys(demoContent.spells), Object.keys(demoContent.arcana));
  const tree = buildSkillTree(demoContent, known, 'all');
  assert.equal(tree.nodes.length, known.spellIds.length + known.arcanaIds.length);
  assert.equal(tree.edges.length, 0);
  assert.ok(tree.nodes.every(node => node.known && node.recipes === undefined));
  assert.equal(new Set(tree.nodes.map(node => node.id)).size, tree.nodes.length);
  assert.deepEqual(buildSkillTree(demoContent, knowledge(), 'all'), {nodes: [], edges: []});
});


test('fire and earth filters both show the meteor fusion and its cross-element ingredients', () => {
  const ids = ['spark', 'fireball', 'rock-shot', 'meteor'];
  const known = knowledge(ids, ['amplify'], ['fireball-recipe', 'meteor-recipe']);
  for (const filter of ['all', 'fire', 'earth'] as const) {
    const tree = buildSkillTree(demoContent, known, filter);
    const byId = (id: string) => tree.nodes.find(node => node.definitionId === id)!;
    for (const id of ['fireball', 'rock-shot', 'meteor']) assert.ok(byId(id), `${filter}: ${id}`);
    assert.ok(tree.edges.some(edge => edge.source === byId('fireball').id && edge.target === byId('meteor').id));
    assert.ok(tree.edges.some(edge => edge.source === byId('rock-shot').id && edge.target === byId('meteor').id));
    assert.deepEqual(byId('meteor').recipes, [{inputs: [byId('fireball').id, byId('rock-shot').id]}]);
    assert.equal(tree.nodes.length, filter === 'earth' ? 3 : 5);
    assert.equal(tree.edges.length, filter === 'earth' ? 2 : 4);
    assert.equal(byId('fireball').boundary, filter === 'earth');
    assert.equal(byId('rock-shot').boundary, filter === 'fire');
    if (filter === 'earth') {
      assert.equal(byId('fireball').recipes, undefined);
      assert.equal(byId('fireball').atomic, false);
      assert.equal(byId('spark'), undefined); assert.equal(byId('amplify'), undefined);
    }
    assert.ok(tree.nodes.every(node => node.kind === 'spell' || node.kind === 'arcana'));
    assert.equal(JSON.stringify(tree).includes('meteor-recipe'), false);
  }
});


test('element view expands only participating alternatives and keeps unrelated spell and arcana ingredients as boundaries', () => {
  const content: ContentCatalog = {spells: {
    fire: spell('fire', 'fire'), water: spell('water', 'water'), wood: spell('wood', 'wood'),
    dark: spell('dark', 'dark'), earth: spell('earth', 'earth'), wind: spell('wind', 'wind'),
  }, arcana: {amplify: structuredClone(demoContent.arcana.amplify), efficiency: structuredClone(demoContent.arcana.efficiency)}, sequences: {}, recipes: [
    recipe('water-fire-path', ['fire', 'wood', 'wood'], 'water'),
    recipe('water-unrelated-path', ['dark'], 'water'),
    recipe('wood-unrelated-path', ['earth'], 'wood'),
    recipe('arcana-unrelated-path', ['wind'], 'amplify'),
    recipe('fire-main-path', ['water', 'amplify'], 'fire'),
    recipe('arcana-fire-path', ['water', 'efficiency'], 'efficiency'),
    recipe('earth-hidden-path', ['fire'], 'earth'),
  ]};
  const known = knowledge(Object.keys(content.spells), ['amplify', 'efficiency'], content.recipes.slice(0, -1).map(value => value.id));
  const before = structuredClone({content, known});
  const tree = buildSkillTree(content, known, 'fire');
  const byId = (id: string) => tree.nodes.find(node => node.definitionId === id);
  assert.deepEqual(byId('water')!.recipes, [{inputs: ['spell:fire', 'spell:wood', 'spell:wood']}]);
  assert.deepEqual(byId('efficiency')!.recipes, [{inputs: ['spell:water', 'arcana:efficiency']}]);
  assert.equal(byId('efficiency')!.boundary, false);
  for (const id of ['wood', 'amplify']) {
    assert.equal(byId(id)!.boundary, true); assert.equal(byId(id)!.recipes, undefined);
    assert.equal(byId(id)!.atomic, false);
  }
  for (const id of ['dark', 'earth', 'wind']) assert.equal(byId(id), undefined);
  assert.deepEqual(tree.nodes.filter(node => node.boundary).map(node => node.definitionId), ['amplify', 'wood']);
  const firstBoundary = tree.nodes.findIndex(node => node.boundary);
  assert.ok(tree.nodes.slice(firstBoundary).every(node => node.boundary));
  assert.equal(tree.edges.filter(edge => edge.source === 'spell:wood' && edge.target === 'spell:water').length, 1);
  assert.equal(tree.edges.length, 6);
  assert.deepEqual(buildSkillTree(content, known, 'fire'), tree);
  const all = buildSkillTree(content, known, 'all');
  assert.equal(all.nodes.length, 8); assert.equal(all.edges.length, 9);
  assert.ok(all.nodes.every(node => !node.boundary));
  assert.equal(all.nodes.find(node => node.definitionId === 'water')!.recipes!.length, 2);
  assert.deepEqual({content, known}, before);
});

test('anonymous external boundaries do not expand unrelated cycles or disclose hidden ancestors', () => {
  const content: ContentCatalog = {spells: {
    fire: spell('fire', 'fire'),
    'secret-water': {...spell('secret-water', 'water'), name: '水秘密'},
    'secret-dark': {...spell('secret-dark', 'dark'), name: '暗秘密'},
  }, arcana: {}, sequences: {}, recipes: [
    recipe('main-secret', ['secret-water'], 'fire'),
    recipe('water-secret', ['secret-dark'], 'secret-water'),
    recipe('dark-secret', ['secret-water'], 'secret-dark'),
  ]};
  const known = knowledge(['fire'], [], content.recipes.map(value => value.id));
  const tree = buildSkillTree(content, known, 'fire');
  assert.equal(tree.nodes.length, 2); assert.equal(tree.edges.length, 1);
  const boundary = tree.nodes.find(node => node.boundary)!;
  assert.equal(boundary.name, '未知'); assert.equal(boundary.definitionId, undefined);
  assert.equal(boundary.atomic, false); assert.equal(boundary.recipes, undefined);
  assert.deepEqual(tree.edges.map(({source, target}) => [source, target]), [[boundary.id, 'spell:fire']]);
  for (const secret of ['secret-water', 'secret-dark', '水秘密', '暗秘密', ...content.recipes.map(value => value.id)]) assert.equal(JSON.stringify(tree).includes(secret), false);
  assert.deepEqual(buildSkillTree(content, known, 'fire'), tree);
  const all = buildSkillTree(content, known, 'all');
  assert.equal(all.nodes.length, 3); assert.equal(all.edges.length, 3);
  assert.ok(all.nodes.every(node => !node.boundary));
});
