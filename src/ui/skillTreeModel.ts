import type { ContentCatalog, Element, GameState, RecipeDefinition } from '../contracts';

export type SkillTreeFilter = Element | 'arcana' | 'all';

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

/** Details use global discoveries, even when an ingredient is a boundary of this element view. */
export function getKnownRecipesForDefinition(content: ContentCatalog, knowledge: GameState['knowledge'], definitionId: string): RecipeDefinition[] {
  const knownSpells = new Set(knowledge.spellIds);
  const knownArcana = new Set(knowledge.arcanaIds);
  const knownRecipes = new Set(knowledge.recipeIds);
  return content.recipes.filter(recipe => recipe.output === definitionId && knownRecipes.has(recipe.id)
    && recipe.inputs.every(id => Object.hasOwn(content.spells,id) ? knownSpells.has(id)
      : Object.hasOwn(content.arcana,id) && knownArcana.has(id)));
}

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
  const matchesElement = (id: string) => element !== 'all' && element !== 'arcana' && Object.hasOwn(content.spells, id)
    && (content.spells[id].element === element || content.spells[id].fusionElements?.includes(element));
  // Propagate participation forward through discovered ancestry, including cycles.
  // Unseen recipes may determine atomicity, but must never change this view's expansion.
  const participating = new Set(element === 'arcana' ? Object.keys(content.arcana) : Object.keys(content.spells).filter(matchesElement));
  const consumers = new Map<string, string[]>();
  for (const recipe of discovered) {
    for (const input of recipe.inputs) {
      const list = consumers.get(input) ?? [];
      list.push(recipe.output); consumers.set(input, list);
    }
  }
  // Arcana is its own branch: consuming an arcana does not make every spell part of it.
  const participationQueue = element === 'arcana' ? [] : [...participating];
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
  if (element === 'all' || element === 'arcana') {
    for (const id of knowledge.arcanaIds) if (Object.hasOwn(content.arcana, id)) seeds.add(id);
  }
  for (const recipe of discovered) {
    if (element === 'arcana' && !Object.hasOwn(content.arcana, recipe.output)) continue;
    if (element !== 'all' && element !== 'arcana' && !matchesElement(recipe.output) && !recipe.inputs.some(input => participating.has(input))) continue;
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
      atomic: !generated.has(id),
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
  let orderedNodes = [...nodes.values()];
  if (element === 'arcana') {
    // The graph centers each rank independently. Place connected roots near the
    // middle of the first rank so progressions stay beside their ingredients.
    const connected = new Set([...edges.values()].flatMap(edge => [edge.source, edge.target]));
    const targets = new Set([...edges.values()].map(edge => edge.target));
    const roots = orderedNodes.filter(node => !targets.has(node.id));
    const isolated = roots.filter(node => !connected.has(node.id));
    const connectedRoots = roots.filter(node => connected.has(node.id));
    const middle = Math.floor(isolated.length / 2);
    orderedNodes = [...isolated.slice(0, middle), ...connectedRoots, ...isolated.slice(middle),
      ...orderedNodes.filter(node => targets.has(node.id))];
  }
  return {nodes: [...orderedNodes.filter(node => !node.boundary), ...orderedNodes.filter(node => node.boundary)], edges: [...edges.values()]};
}
