import type { Cell, ContentCatalog, Placement, RecipeDefinition } from '../contracts';
import { areAdjacent, placementCells, validatePlacement } from './geometry';

export interface RecipeMaterial { definitionId: string; cells: Cell[] }
export interface RecipeExample { definitionId: string; placement: Placement; cells: Cell[] }

/** Compare exact occupied cells, including relative orientation, while allowing translation and identical inputs. */
export function matchesRecipeLayout(recipe: RecipeDefinition, materials: RecipeMaterial[], content: ContentCatalog): boolean {
  if (!recipe.layout) return true;
  if (recipe.layout.length !== recipe.inputs.length || materials.length !== recipe.inputs.length) return false;
  const expected = recipe.inputs.map((id, index) => {
    const shape = (content.spells[id] ?? content.arcana[id])?.shape;
    return shape ? {definitionId: id, cells: placementCells(shape, {itemId: String(index), ...recipe.layout![index]})} : undefined;
  });
  if (expected.some(item => !item)) return false;
  const normalize = (items: RecipeMaterial[]) => {
    const cells = items.flatMap(item => item.cells);
    if (!cells.length) return [];
    const minX = Math.min(...cells.map(cell => cell.x)), minY = Math.min(...cells.map(cell => cell.y));
    return items.map(item => `${item.definitionId}:${item.cells.map(({x,y}) => `${x-minX},${y-minY}`).sort().join(';')}`).sort();
  };
  return JSON.stringify(normalize(materials)) === JSON.stringify(normalize(expected as RecipeMaterial[]));
}

/** Produce an actually executable layout, using the same shape and adjacency rules as the wand. */
export function findRecipeExample(recipe: RecipeDefinition, content: ContentCatalog, width = 5, height = 5): RecipeExample[] | undefined {
  if (recipe.layout) {
    const examples = recipe.inputs.map((id,index) => {
      const shape = (content.spells[id] ?? content.arcana[id])?.shape;
      const placement = {itemId: String(index), ...recipe.layout![index]};
      return shape ? {definitionId:id, placement, cells:placementCells(shape,placement)} : undefined;
    });
    if (examples.some(item => !item)) return undefined;
    const result = examples as RecipeExample[];
    const occupied: Cell[] = [];
    for (const item of result) { if (!validatePlacement(width,height,item.cells,occupied).valid) return undefined; occupied.push(...item.cells); }
    return result;
  }
  const inputs = recipe.inputs.map((id,index) => ({id,index,shape:(content.spells[id] ?? content.arcana[id])?.shape}));
  if (inputs.some(input => !input.shape?.length)) return undefined;
  // Large pieces first makes constrained 5×5 layouts quick to find.
  inputs.sort((a,b) => b.shape!.length - a.shape!.length || a.index - b.index);
  const chosen: (RecipeExample & {index:number})[] = [];
  function search(index:number): boolean {
    if (index === inputs.length) return true;
    const input = inputs[index], occupied = chosen.flatMap(item => item.cells), distinct = new Set<string>();
    for (const rotation of [0,1,2,3] as const) {
      const origin = placementCells(input.shape!, {itemId:'',x:0,y:0,rotation});
      const key = origin.map(cell => `${cell.x},${cell.y}`).sort().join(';');
      if (distinct.has(key)) continue; distinct.add(key);
      for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
        const placement = {itemId:String(input.index),x,y,rotation};
        const cells = placementCells(input.shape!,placement);
        if (!validatePlacement(width,height,cells,occupied).valid) continue;
        if (recipe.requireAdjacency && chosen.length && !chosen.some(item => areAdjacent(item.cells,cells))) continue;
        chosen.push({index:input.index,definitionId:input.id,placement,cells});
        if (search(index+1)) return true;
        chosen.pop();
      }
    }
    return false;
  }
  return search(0) ? chosen.sort((a,b)=>a.index-b.index) : undefined;
}
