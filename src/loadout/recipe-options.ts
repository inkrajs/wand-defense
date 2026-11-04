import type { ContentCatalog, GameState } from '../contracts';
import { areAdjacent, placementCells } from './geometry';

export interface WandRecipeOption { recipeId: string; output: string; itemIds: string[] }

/** Find one deterministic executable material group per discovered recipe, without mutating state. */
export function getWandRecipeOptions(state: GameState, wandId: string, content: ContentCatalog): WandRecipeOption[] {
  if (state.phase === 'defeat' || (state.phase === 'battle' && !state.paused)) return [];
  const wand = state.wands.find(entry => entry.id === wandId);
  if (!wand) return [];
  const known = new Set(state.knowledge.recipeIds);
  const materials = wand.placements.flatMap(placement => {
    const item = state.items[placement.itemId];
    const definition = item && (item.kind === 'spell' ? content.spells[item.definitionId] : content.arcana[item.definitionId]);
    if (!definition?.shape.length || state.backpack.includes(placement.itemId)
      || state.wands.reduce((count, entry) => count + entry.placements.filter(other => other.itemId === placement.itemId).length, 0) !== 1) return [];
    return [{itemId: item.id, definitionId: item.definitionId, cells: placementCells(definition.shape, placement)}];
  });
  function connected(indices: number[]) {
    const reached = new Set([indices[0]]), queue = [indices[0]];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      for (const index of indices) {
        if (!reached.has(index) && areAdjacent(materials[queue[cursor]].cells, materials[index].cells)) {
          reached.add(index); queue.push(index);
        }
      }
    }
    return reached.size === indices.length;
  }
  const options: WandRecipeOption[] = [];
  const seen = new Set<string>();
  for (const recipe of content.recipes) {
    if (!known.has(recipe.id) || seen.has(recipe.id) || !recipe.inputs.length
      || !(content.spells[recipe.output] || content.arcana[recipe.output])) continue;
    seen.add(recipe.id);
    const selected: number[] = [];
    function find(inputIndex: number): boolean {
      if (inputIndex === recipe.inputs.length) return !recipe.requireAdjacency || connected(selected);
      const definitionId = recipe.inputs[inputIndex];
      // Identical materials are combinations, rather than permutations of the same instances.
      const previous = recipe.inputs.lastIndexOf(definitionId, inputIndex - 1);
      const after = inputIndex > 0 && previous >= 0 ? selected[previous] : -1;
      for (let index = after + 1; index < materials.length; index++) {
        if (materials[index].definitionId !== definitionId || selected.includes(index)) continue;
        selected.push(index);
        if (find(inputIndex + 1)) return true;
        selected.pop();
      }
      return false;
    }
    if (find(0)) options.push({recipeId: recipe.id, output: recipe.output, itemIds: selected.map(index => materials[index].itemId)});
  }
  return options;
}
