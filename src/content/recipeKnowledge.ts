import type { ContentCatalog, GameState } from "../contracts";

/** Knowing every ingredient reveals a recipe, without revealing its unknown result. */
export function discoverAvailableRecipes(knowledge: GameState["knowledge"], content: ContentCatalog): string[] {
  const known = new Set([...knowledge.spellIds, ...knowledge.arcanaIds]);
  const recipes = new Set(knowledge.recipeIds);
  for (const recipe of content.recipes) {
    if (recipe.inputs.length > 0 && recipe.inputs.every(id => known.has(id) && (Object.hasOwn(content.spells, id) || Object.hasOwn(content.arcana, id)))
      && (Object.hasOwn(content.spells, recipe.output) || Object.hasOwn(content.arcana, recipe.output))) recipes.add(recipe.id);
  }
  return [...recipes];
}
