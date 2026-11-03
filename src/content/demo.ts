import type { ContentCatalog } from "../contracts";

const asset = (key: string, label: string, color: string) => ({ key, label, color });
const cell = (x: number, y: number) => ({ x, y });

/** Small but playable content set used by the prototype and UI fixture. */
export const demoContent: ContentCatalog = {
  spells: {
    spark: {
      id: "spark", name: "火花", element: "fire", shape: [cell(0, 0)],
      asset: asset("spell.spark", "火花", "#ff9f43"), effect: "projectile",
      power: 10, manaCost: 4, cooldownMs: 700, range: 24, speed: 0, level: 1, grade: "common",
    },
    fireball: {
      id: "fireball", name: "火球", element: "fire", shape: [cell(0, 0), cell(1, 0)],
      asset: asset("spell.fireball", "火球", "#ff6b35"), effect: "projectile",
      power: 25, manaCost: 10, cooldownMs: 1100, range: 30, speed: 0, level: 1, grade: "common",
    },
    regrowth: {
      id: "regrowth", name: "回春", element: "wood", shape: [cell(0, 0), cell(1, 0), cell(0, 1)],
      asset: asset("spell.regrowth", "回春", "#7ed957"), effect: "heal",
      power: 18, manaCost: 12, cooldownMs: 3200, range: 20, level: 1, grade: "common",
    },
    "metal-needle": {
      id: "metal-needle", name: "金针", element: "metal", shape: [cell(0, 0), cell(1, 0), cell(2, 0)],
      asset: asset("spell.metal-needle", "金针", "#c0c7d1"), effect: "projectile",
      power: 16, manaCost: 7, cooldownMs: 850, range: 28, speed: 0, level: 1, grade: "common",
    },
  },
  arcana: {
    amplify: {
      id: "amplify", name: "增幅", shape: [cell(0, 0)], asset: asset("arcana.amplify", "增幅", "#ffd166"),
      modifier: "amplify", value: 1.5, level: 1, grade: "common",
    },
    double: {
      id: "double", name: "双重", shape: [cell(0, 0), cell(1, 0)], asset: asset("arcana.double", "双重", "#f4a261"),
      modifier: "double", value: 2, level: 1, grade: "common",
    },
    split: {
      id: "split", name: "分裂", shape: [cell(0, 0), cell(0, 1)], asset: asset("arcana.split", "分裂", "#e9c46a"),
      modifier: "split", value: 2, level: 1, grade: "common",
    },
    focus: {
      id: "focus", name: "聚焦", shape: [cell(0, 0), cell(1, 0), cell(2, 0)], asset: asset("arcana.focus", "聚焦", "#e76f51"),
      modifier: "focus", value: 1.25, level: 1, grade: "common",
    },
  },
  recipes: [{ id: "fireball-recipe", name: "火球", inputs: ["spark", "amplify"], output: "fireball", requireAdjacency: true }],
  sequences: {
    "fire-9": {
      id: "fire-9", pathwayId: "fire", number: 9, name: "执烛人", bonuses: { fire: 0.1 },
      requirements: [
        { id: "fire-9-level", kind: "characterLevel", value: 9, mode: "live" },
        { id: "fire-9-spark", kind: "equippedSpellLevel", value: 3, definitionId: "spark", mode: "live" },
      ],
    },
    "fire-8": {
      id: "fire-8", pathwayId: "fire", number: 8, name: "燃灯者", previousId: "fire-9", bonuses: { fire: 0.2 },
      requirements: [
        { id: "fire-8-level", kind: "characterLevel", value: 10, mode: "live" },
        { id: "fire-8-wand", kind: "equippedWandLevel", value: 3, mode: "live" },
        { id: "fire-8-coins", kind: "coins", value: 25, mode: "consume" },
      ],
    },
    "wood-9": {
      id: "wood-9", pathwayId: "wood", number: 9, name: "拾种人", bonuses: { wood: 0.1 },
      requirements: [
        { id: "wood-9-level", kind: "characterLevel", value: 9, mode: "live" },
        { id: "wood-9-node", kind: "node", value: 1, definitionId: "wood-3", mode: "completed" },
      ],
    },
    "metal-9": {
      id: "metal-9", pathwayId: "metal", number: 9, name: "修补匠", bonuses: { metal: 0.1 },
      requirements: [
        { id: "metal-9-level", kind: "characterLevel", value: 9, mode: "live" },
        { id: "metal-9-wand", kind: "equippedWandLevel", value: 5, mode: "live" },
        { id: "metal-9-coins", kind: "coins", value: 100, mode: "consume" },
      ],
    },
  },
};
