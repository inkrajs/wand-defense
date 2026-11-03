import type { RecipeDefinition } from "../contracts";

/** Spell definitions acquired directly, before following recipe branches. */
export const baseMagicDefinitionIds: readonly string[] = Object.freeze([
  "spark",
  "regrowth",
  "metal-needle",
  "water-bolt",
  "lightning-bolt",
  "wind-blade",
  "rock-shot",
  "light-arrow",
  "dark-orb",
]);

/** Adjacency-based recipes that connect the nine base spells to every other spell. */
export const magicRecipeDefinitions: RecipeDefinition[] = [
  { id: "fireball-recipe", name: "火球", inputs: ["spark", "amplify"], output: "fireball", requireAdjacency: true },
  { id: "flame-lance-recipe", name: "炎矛", inputs: ["fireball", "reach"], output: "flame-lance", requireAdjacency: true },
  { id: "cinder-burst-recipe", name: "熔爆", inputs: ["fireball", "area"], output: "cinder-burst", requireAdjacency: true },
  { id: "thorn-shot-recipe", name: "荆刺", inputs: ["regrowth", "metal-needle"], output: "thorn-shot", requireAdjacency: true },
  { id: "renewal-recipe", name: "生息", inputs: ["regrowth", "amplify"], output: "renewal", requireAdjacency: true },
  { id: "tidal-orb-recipe", name: "潮涌", inputs: ["water-bolt", "area"], output: "tidal-orb", requireAdjacency: true },
  { id: "stone-spike-recipe", name: "岩刺", inputs: ["rock-shot", "reach"], output: "stone-spike", requireAdjacency: true },
  { id: "iron-disc-recipe", name: "飞刃", inputs: ["metal-needle", "wind-blade"], output: "iron-disc", requireAdjacency: true },
  { id: "gale-burst-recipe", name: "风爆", inputs: ["wind-blade", "area"], output: "gale-burst", requireAdjacency: true },
  { id: "arc-chain-recipe", name: "电弧", inputs: ["lightning-bolt", "double"], output: "arc-chain", requireAdjacency: true },
  { id: "ward-recipe", name: "光盾", inputs: ["light-arrow", "regrowth"], output: "ward", requireAdjacency: true },
  { id: "solar-ray-recipe", name: "光束", inputs: ["light-arrow", "focus"], output: "solar-ray", requireAdjacency: true },
  { id: "ember-ray-recipe", name: "炎流", inputs: ["flame-lance", "focus"], output: "ember-ray", requireAdjacency: true },
  { id: "void-ray-recipe", name: "幽光", inputs: ["dark-orb", "focus"], output: "void-ray", requireAdjacency: true },
  { id: "spark-hop-recipe", name: "跳电", inputs: ["lightning-bolt", "efficiency"], output: "spark-hop", requireAdjacency: true },
  { id: "thunder-chain-recipe", name: "雷链", inputs: ["arc-chain", "amplify"], output: "thunder-chain", requireAdjacency: true },
  { id: "storm-net-recipe", name: "雷网", inputs: ["arc-chain", "area"], output: "storm-net", requireAdjacency: true },
  { id: "thunder-strike-recipe", name: "落雷", inputs: ["lightning-bolt", "focus"], output: "thunder-strike", requireAdjacency: true },
  { id: "frost-ring-recipe", name: "冰环", inputs: ["water-bolt", "wind-blade"], output: "frost-ring", requireAdjacency: true },
  { id: "earth-spikes-recipe", name: "地刺", inputs: ["stone-spike", "area"], output: "earth-spikes", requireAdjacency: true },
  { id: "fire-field-bolt-recipe", name: "火场弹", inputs: ["cinder-burst", "efficiency"], output: "fire-field-bolt", requireAdjacency: true },
  { id: "thunder-field-bolt-recipe", name: "雷场弹", inputs: ["storm-net", "focus"], output: "thunder-field-bolt", requireAdjacency: true },
  { id: "thunderstorm-recipe", name: "雷暴", inputs: ["thunder-field-bolt", "area", "double"], output: "thunderstorm", requireAdjacency: true },
  { id: "moving-storm-recipe", name: "风暴", inputs: ["gale-burst", "area"], output: "moving-storm", requireAdjacency: true },
];
