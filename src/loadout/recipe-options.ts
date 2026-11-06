import type { ContentCatalog, GameState } from '../contracts';
import { areAdjacent, placementCells } from './geometry';
import { matchesRecipeLayout } from './recipe-layout';

export interface WandRecipeOption { recipeId: string; output: string; itemIds: string[] }

/** Find one deterministic executable material group per discovered recipe, optionally requiring a particular material instance. */
export function getWandRecipeOptions(state: GameState, wandId: string, content: ContentCatalog, requiredItemId?: string): WandRecipeOption[] {
  return collectWandRecipeOptions(state, wandId, content, false, requiredItemId);
}

/** Enumerate executable groups on one wand. Shared materials do not join separate groups. */
export function getWandRecipeGroups(state: GameState, wandId: string, content: ContentCatalog): WandRecipeOption[] {
  return collectWandRecipeOptions(state, wandId, content, true);
}

function collectWandRecipeOptions(state: GameState, wandId: string, content: ContentCatalog, allGroups: boolean, requiredItemId?: string): WandRecipeOption[] {
  if (state.phase === 'defeat' || (state.phase === 'battle' && !state.paused)) return [];
  const wand = state.wands.find(entry => entry.id === wandId);
  if (!wand) return [];
  const known = new Set(state.knowledge.recipeIds);
  const backpack = new Set(state.backpack);
  const placementCounts = new Map<string, number>();
  for (const entry of state.wands) for (const {itemId} of entry.placements) {
    placementCounts.set(itemId, (placementCounts.get(itemId) ?? 0) + 1);
  }
  const materials = wand.placements.flatMap(placement => {
    const item = state.items[placement.itemId];
    if (!item || item.id !== placement.itemId || backpack.has(placement.itemId) || placementCounts.get(placement.itemId) !== 1) return [];
    const definitions = item.kind === 'spell' ? content.spells : content.arcana;
    const definition = Object.hasOwn(definitions, item.definitionId) ? definitions[item.definitionId] : undefined;
    if (!definition?.shape.length) return [];
    return [{itemId: item.id, definitionId: item.definitionId, cells: placementCells(definition.shape, placement)}];
  });
  const requiredMaterial = requiredItemId === undefined ? undefined : materials.find(material => material.itemId === requiredItemId);
  if (requiredItemId !== undefined && !requiredMaterial) return [];
  const byDefinition = new Map<string, number[]>();
  materials.forEach(({definitionId}, index) => {
    const indices = byDefinition.get(definitionId) ?? [];
    indices.push(index);
    byDefinition.set(definitionId, indices);
  });
  const adjacency = new Map<number, boolean>();
  function adjacent(a: number, b: number) {
    const key = Math.min(a, b) * materials.length + Math.max(a, b);
    const cached = adjacency.get(key);
    if (cached !== undefined) return cached;
    const result = areAdjacent(materials[a].cells, materials[b].cells);
    adjacency.set(key, result);
    return result;
  }
  function connected(indices: number[]) {
    const reached = new Set([indices[0]]), queue = [indices[0]];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      for (const index of indices) {
        if (!reached.has(index) && adjacent(queue[cursor], index)) {
          reached.add(index); queue.push(index);
        }
      }
    }
    return reached.size === indices.length;
  }
  const options: WandRecipeOption[] = [];
  const seen = new Set<string>();
  for (const recipe of content.recipes) {
    if (seen.has(recipe.id)) continue;
    // The transaction also resolves duplicate catalog IDs to their first entry.
    seen.add(recipe.id);
    if (!known.has(recipe.id) || !recipe.inputs.length
      || (requiredMaterial && !recipe.inputs.includes(requiredMaterial.definitionId))
      || !(Object.hasOwn(content.spells, recipe.output) || Object.hasOwn(content.arcana, recipe.output))) continue;
    const selected: number[] = [];
    function find(inputIndex: number): boolean {
      if (inputIndex === recipe.inputs.length) {
        if (requiredMaterial && !selected.some(index => materials[index] === requiredMaterial)) return false;
        if (recipe.requireAdjacency && !connected(selected)) return false;
        if (!matchesRecipeLayout(recipe, selected.map(index => materials[index]), content)) return false;
        options.push({recipeId: recipe.id, output: recipe.output, itemIds: selected.map(index => materials[index].itemId)});
        return !allGroups;
      }
      const definitionId = recipe.inputs[inputIndex];
      // Identical materials are combinations, rather than permutations of the same instances.
      const previous = recipe.inputs.lastIndexOf(definitionId, inputIndex - 1);
      const after = inputIndex > 0 && previous >= 0 ? selected[previous] : -1;
      for (const index of byDefinition.get(definitionId) ?? []) {
        if (index <= after || selected.includes(index)) continue;
        selected.push(index);
        if (find(inputIndex + 1)) return true;
        selected.pop();
      }
      return false;
    }
    find(0);
  }
  return options;
}
