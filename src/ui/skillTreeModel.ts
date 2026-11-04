import type { ContentCatalog, Element, GameState, RecipeDefinition } from '../contracts';

export type SkillTreeFilter = Element | 'all';

export interface SkillTreeNode {
  id: string;
  definitionId?: string;
  name: string;
  kind: 'spell' | 'arcana' | 'recipe';
  known: boolean;
  atomic: boolean;
  /** Graph node IDs, retaining repeated ingredient occurrences for recipe quantities. */
  inputs?: string[];
  output?: string;
}
export interface SkillTreeEdge { id: string; source: string; target: string }

/** Only discovered recipes expose ancestry. Unknown magic receives an opaque graph identity. */
export function buildSkillTree(content: ContentCatalog, knowledge: GameState['knowledge'], element: SkillTreeFilter): {nodes: SkillTreeNode[]; edges: SkillTreeEdge[]} {
  const spellKnowledge = new Set(knowledge.spellIds), arcanaKnowledge = new Set(knowledge.arcanaIds);
  const recipeKnowledge = new Set(knowledge.recipeIds);
  const definition = (id: string) => Object.hasOwn(content.spells, id)
    ? {kind: 'spell' as const, value: content.spells[id]}
    : Object.hasOwn(content.arcana, id) ? {kind: 'arcana' as const, value: content.arcana[id]} : undefined;
  const recipes = content.recipes.filter(recipe => recipe.inputs.length > 0
    && definition(recipe.output) && recipe.inputs.every(id => definition(id)));
  const generated = new Set(recipes.map(recipe => recipe.output));
  const producers = new Map<string, RecipeDefinition[]>();
  const seeds = new Set<string>();
  for (const id of knowledge.spellIds) {
    if (Object.hasOwn(content.spells, id) && (element === 'all' || (content.spells[id].element === element || content.spells[id].fusionElements?.includes(element)))) seeds.add(id);
  }
  if (element === 'all') {
    for (const id of knowledge.arcanaIds) if (Object.hasOwn(content.arcana, id)) seeds.add(id);
  }
  for (const recipe of recipes) {
    if (!recipeKnowledge.has(recipe.id)) continue;
    const list = producers.get(recipe.output) ?? [];
    list.push(recipe); producers.set(recipe.output, list);
    if (element === 'all' || (Object.hasOwn(content.spells, recipe.output) && (content.spells[recipe.output].element === element || content.spells[recipe.output].fusionElements?.includes(element)))) seeds.add(recipe.output);
  }

  const nodes = new Map<string, SkillTreeNode>();
  const magicNodes = new Map<string, SkillTreeNode>();
  const edges = new Map<string, SkillTreeEdge>();
  let unknownIndex = 0;
  function magicNode(id: string): SkillTreeNode {
    const existing = magicNodes.get(id);
    if (existing) return existing;
    const entry = definition(id)!; // Seeds and recipe references were checked against the catalog.
    const known = (entry.kind === 'spell' ? spellKnowledge : arcanaKnowledge).has(id);
    const node: SkillTreeNode = {
      id: known ? `${entry.kind}:${id}` : `unknown:${unknownIndex++}`,
      ...(known ? {definitionId: id} : {}),
      name: known ? entry.value.name : '未知', kind: entry.kind, known,
      atomic: entry.kind === 'spell' && !generated.has(id),
    };
    magicNodes.set(id, node); nodes.set(node.id, node);
    return node;
  }
  function connect(source: string, target: string) {
    const id = `edge:${JSON.stringify([source, target])}`;
    edges.set(id, {id, source, target});
  }
  const queue = [...seeds], expanded = new Set<string>();
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index];
    if (expanded.has(id)) continue;
    expanded.add(id);
    const output = magicNode(id);
    for (const recipe of producers.get(id) ?? []) {
      const recipeId = `recipe:${recipe.id}`;
      if (nodes.has(recipeId)) continue;
      const inputs = recipe.inputs.map(input => magicNode(input).id);
      nodes.set(recipeId, {id: recipeId, definitionId: recipe.id, name: '合成', kind: 'recipe',
        known: true, atomic: false, inputs, output: output.id});
      for (const input of inputs) connect(input, recipeId);
      connect(recipeId, output.id);
      queue.push(...recipe.inputs);
    }
  }
  return {nodes: [...nodes.values()], edges: [...edges.values()]};
}
