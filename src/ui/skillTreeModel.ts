import type { ContentCatalog, Element, GameState, RecipeDefinition } from '../contracts';

export type SkillTreeFilter = Element | 'all';

export interface SkillTreeNode {
  id: string;
  definitionId?: string;
  name: string;
  kind: 'spell' | 'arcana';
  known: boolean;
  atomic: boolean;
  /** External ingredient endpoint in this element view; independent of global atomicity. */
  boundary: boolean;
  /** Alternative recipes, each retaining repeated ingredient graph IDs for quantities. */
  recipes?: {inputs: string[]}[];
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
  const discovered = recipes.filter(recipe => recipeKnowledge.has(recipe.id));
  const matchesElement = (id: string) => element !== 'all' && Object.hasOwn(content.spells, id)
    && (content.spells[id].element === element || content.spells[id].fusionElements?.includes(element));
  // Propagate participation forward through discovered ancestry, including cycles.
  // Unseen recipes may determine atomicity, but must never change this view's expansion.
  const participating = new Set(Object.keys(content.spells).filter(matchesElement));
  const consumers = new Map<string, string[]>();
  for (const recipe of discovered) {
    for (const input of recipe.inputs) {
      const list = consumers.get(input) ?? [];
      list.push(recipe.output); consumers.set(input, list);
    }
  }
  const participationQueue = [...participating];
  for (let index = 0; index < participationQueue.length; index++) {
    for (const output of consumers.get(participationQueue[index]) ?? []) {
      if (participating.has(output)) continue;
      participating.add(output); participationQueue.push(output);
    }
  }
  const producers = new Map<string, RecipeDefinition[]>();
  const seeds = new Set<string>();
  for (const id of knowledge.spellIds) {
    if (Object.hasOwn(content.spells, id) && (element === 'all' || matchesElement(id))) seeds.add(id);
  }
  if (element === 'all') {
    for (const id of knowledge.arcanaIds) if (Object.hasOwn(content.arcana, id)) seeds.add(id);
  }
  for (const recipe of discovered) {
    if (element !== 'all' && !matchesElement(recipe.output) && !recipe.inputs.some(input => participating.has(input))) continue;
    const list = producers.get(recipe.output) ?? [];
    list.push(recipe); producers.set(recipe.output, list);
    seeds.add(recipe.output);
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
      boundary: element !== 'all' && !participating.has(id),
    };
    magicNodes.set(id, node); nodes.set(node.id, node);
    return node;
  }
  function connect(source: string, target: string) {
    const id = `edge:${JSON.stringify([source, target])}`;
    edges.set(id, {id, source, target});
  }
  const queue = [...seeds], expanded = new Set<string>(), expandedRecipes = new Set<string>();
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index];
    if (expanded.has(id)) continue;
    expanded.add(id);
    const output = magicNode(id);
    for (const recipe of producers.get(id) ?? []) {
      if (expandedRecipes.has(recipe.id)) continue;
      expandedRecipes.add(recipe.id);
      const inputs = recipe.inputs.map(input => magicNode(input).id);
      (output.recipes ??= []).push({inputs});
      for (const input of inputs) connect(input, output.id);
      queue.push(...recipe.inputs);
    }
  }
  // Stable boundary ordering is a layout hint; edge direction remains ingredient → output.
  const orderedNodes = [...nodes.values()];
  return {nodes: [...orderedNodes.filter(node => !node.boundary), ...orderedNodes.filter(node => node.boundary)], edges: [...edges.values()]};
}
