import type { Cell, ContentCatalog, GameState, WandInstance } from '../contracts';
import { placementCells } from '../loadout/geometry';
import { getWandRecipeGroups } from '../loadout/recipe-options';

export type WandRecipeHint = { key: string; itemIds: string[]; cells: Cell[] };
export type WandRecipeHints = Map<string, WandRecipeHint[][]>;

/** Keep competing recipes in separate rounds; independent groups can flash together. */
export function layerWandRecipeHints(hints: readonly WandRecipeHint[]): WandRecipeHint[][] {
  const layers: WandRecipeHint[][] = [];
  const occupied: Set<string>[] = [];
  for (const hint of hints) {
    let layer = occupied.findIndex(items => hint.itemIds.every(id => !items.has(id)));
    if (layer < 0) { layer = layers.length; layers.push([]); occupied.push(new Set()); }
    layers[layer].push(hint);
    hint.itemIds.forEach(id => occupied[layer].add(id));
  }
  return layers;
}

/** The overlay uses the same item instances, rotations and legal recipes as synthesis. */
export function getWandRecipeHints(state: GameState, wands: readonly WandInstance[], content: ContentCatalog): WandRecipeHints {
  const result: WandRecipeHints = new Map();
  if (state.phase === 'defeat' || (state.phase === 'battle' && !state.paused)) return result;
  for (const wand of wands) {
    const cellsByItem = new Map<string, Cell[]>();
    for (const placement of wand.placements) {
      const item = state.items[placement.itemId];
      const definition = item && (item.kind === 'spell' ? content.spells[item.definitionId] : content.arcana[item.definitionId]);
      if (definition?.shape.length) cellsByItem.set(item.id, placementCells(definition.shape, placement));
    }
    const seen = new Set<string>();
    const hints: WandRecipeHint[] = [];
    for (const group of getWandRecipeGroups(state, wand.id, content)) {
      // Several outputs can use exactly the same instances: one wash is enough.
      const key = JSON.stringify([...group.itemIds].sort());
      if (seen.has(key) || group.itemIds.some(id => !cellsByItem.has(id))) continue;
      seen.add(key);
      const cells = group.itemIds.flatMap(id => cellsByItem.get(id)!);
      hints.push({ key, itemIds: group.itemIds, cells });
    }
    if (hints.length) result.set(wand.id, layerWandRecipeHints(hints));
  }
  return result;
}

export function getHintMaterialIds(hints: WandRecipeHints): Set<string> {
  return new Set([...hints.values()].flatMap(layers => layers.flatMap(layer => layer.flatMap(hint => hint.itemIds))));
}
