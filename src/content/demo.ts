import type { ContentCatalog } from "../contracts";
import { approvedArcana as approvedArcana6 } from "./approved-6";
import { approvedSpells as approvedSpells5 } from "./approved-5";
import { approvedArcana as approvedArcana4 } from "./approved-4";
import { approvedSpells as approvedSpells1 } from "./approved-1";
import { approvedSpells as approvedSpells2 } from "./approved-2";
import { approvedSpells as approvedSpells3 } from "./approved-3";
import { evolvedArcana, evolvedSpells } from "./evolvedMagic";
import { gearDefinitions } from "./gear";
import { supplyDefinitions } from "./supplies";
import { areaSpellDefinitions } from "./areaSpells";
import { fieldSpellDefinitions } from "./fieldSpells";
import { expandedArcana } from "./expandedArcana";
import { magicRecipeDefinitions } from "./magicRecipes";
import { expandedSpellDefinitions } from "./expandedSpells";
import { cataclysmSpells } from "./cataclysmSpells";

const asset = (key: string, label: string, color: string) => ({ key, label, color });
const cell = (x: number, y: number) => ({ x, y });

/** Playable catalog shared by the runtime, compiler, UI and knowledge-filtered protocol. */
export const demoContent: ContentCatalog = {
  gear: gearDefinitions,
  items: supplyDefinitions,
  spells: {
    ...expandedSpellDefinitions,
    ...evolvedSpells,
    ...approvedSpells1,
    ...approvedSpells2,
    ...approvedSpells3,
    ...approvedSpells5,
    ...cataclysmSpells,
    spark: {
      id: "spark", name: "火花", element: "fire", shape: [cell(0, 0)],
      asset: asset("spell.spark", "火花", "#ff9f43"), effect: "projectile",
      power: 10, manaCost: 4, cooldownMs: 700, range: 24, speed: 72, level: 1, grade: "common",
    },
    fireball: {
      id: "fireball", name: "火球", element: "fire", shape: [cell(0, 0), cell(1, 0)],
      asset: asset("spell.fireball", "火球", "#ff6b35"), effect: "projectile",
      power: 25, manaCost: 10, cooldownMs: 1100, range: 30, speed: 50, level: 1, grade: "common",
      onHit: { burn: { powerRatio: 0.2, durationMs: 2400, tickMs: 600 } },
    },
    regrowth: {
      id: "regrowth", name: "回春", element: "wood", shape: [cell(0, 0)],
      asset: asset("spell.regrowth", "回春", "#7ed957"), effect: "heal",
      power: 18, manaCost: 12, cooldownMs: 3200, range: 20, level: 1, grade: "common",
    },
    "metal-needle": {
      id: "metal-needle", name: "金针", element: "metal", shape: [cell(0, 0)],
      asset: asset("spell.metal-needle", "金针", "#c0c7d1"), effect: "projectile",
      power: 16, manaCost: 7, cooldownMs: 850, range: 28, speed: 100, level: 1, grade: "common",
    },
    "water-bolt": {
      id: "water-bolt", name: "水弹", element: "water", shape: [cell(0, 0)],
      asset: asset("spell.water-bolt", "水弹", "#659dbd"), effect: "projectile",
      power: 8, manaCost: 3, cooldownMs: 600, range: 26, speed: 60, level: 1, grade: "common",
      onHit: { slow: { multiplier: 0.75, durationMs: 1200 } },
    },
    "lightning-bolt": {
      id: "lightning-bolt", name: "雷矢", element: "lightning", shape: [cell(0, 0)],
      asset: asset("spell.lightning-bolt", "雷矢", "#c5af4b"), effect: "projectile",
      power: 22, manaCost: 9, cooldownMs: 1300, range: 36, speed: 140, level: 1, grade: "common",
    },
    "wind-blade": {
      id: "wind-blade", name: "风刃", element: "wind", shape: [cell(0, 0)],
      asset: asset("spell.wind-blade", "风刃", "#70b4a7"), effect: "projectile",
      power: 6, manaCost: 2, cooldownMs: 350, range: 22, speed: 110, level: 1, grade: "common",
      onHit: { knockback: 2 },
    },
    "rock-shot": {
      id: "rock-shot", name: "岩弹", element: "earth", shape: [cell(0, 0)],
      asset: asset("spell.rock-shot", "岩弹", "#b18d65"), effect: "projectile",
      power: 36, manaCost: 12, cooldownMs: 1800, range: 30, speed: 34, level: 1, grade: "common",
    },
    "flame-lance": {
      id: "flame-lance", name: "炎矛", element: "fire", shape: [cell(0, 0), cell(1, 0), cell(2, 0)],
      asset: asset("spell.flame-lance", "炎矛", "#ff7043"), effect: "projectile",
      power: 20, manaCost: 9, cooldownMs: 1300, range: 35, speed: 105, level: 1, grade: "common",
      impact: { type: "pierce", maxTargets: 3 },
    },
    "cinder-burst": {
      id: "cinder-burst", name: "熔爆", element: "fire", shape: [cell(0, 0), cell(1, 0), cell(0, 1), cell(1, 1)],
      asset: asset("spell.cinder-burst", "熔爆", "#e85d3f"), effect: "projectile",
      power: 30, manaCost: 14, cooldownMs: 1800, range: 30, speed: 45, level: 1, grade: "common",
      impact: { type: "splash", radius: 6, maxTargets: 6 },
    },
    "thorn-shot": {
      id: "thorn-shot", name: "荆刺", element: "wood", shape: [cell(0, 0), cell(1, 0)],
      asset: asset("spell.thorn-shot", "荆刺", "#69a85e"), effect: "projectile",
      power: 7, manaCost: 2, cooldownMs: 300, range: 25, speed: 95, level: 1, grade: "common",
    },
    renewal: {
      id: "renewal", name: "生息", element: "wood", shape: [cell(0, 0), cell(1, 0), cell(0, 1)],
      asset: asset("spell.renewal", "生息", "#78bd69"), effect: "heal",
      power: 30, manaCost: 15, cooldownMs: 4200, range: 20, level: 1, grade: "common",
    },
    "tidal-orb": {
      id: "tidal-orb", name: "潮涌", element: "water", shape: [cell(0, 0), cell(1, 0), cell(0, 1), cell(1, 1)],
      asset: asset("spell.tidal-orb", "潮涌", "#4f9bc3"), effect: "projectile",
      power: 24, manaCost: 12, cooldownMs: 1700, range: 32, speed: 42, level: 1, grade: "common",
      impact: { type: "splash", radius: 7, maxTargets: 7 },
    },
    "stone-spike": {
      id: "stone-spike", name: "岩刺", element: "earth", shape: [cell(0, 0), cell(1, 0), cell(2, 0)],
      asset: asset("spell.stone-spike", "岩刺", "#9a7958"), effect: "projectile",
      power: 28, manaCost: 11, cooldownMs: 1500, range: 34, speed: 80, level: 1, grade: "common",
      impact: { type: "pierce", maxTargets: 2 },
    },
    "iron-disc": {
      id: "iron-disc", name: "飞刃", element: "metal", shape: [cell(0, 0), cell(1, 0), cell(1, 1)],
      asset: asset("spell.iron-disc", "飞刃", "#aeb8c4"), effect: "projectile",
      power: 18, manaCost: 8, cooldownMs: 1100, range: 32, speed: 110, level: 1, grade: "common",
      impact: { type: "pierce", maxTargets: 3 },
    },
    "gale-burst": {
      id: "gale-burst", name: "风爆", element: "wind", shape: [cell(0, 0), cell(1, 0), cell(0, 1), cell(1, 1)],
      asset: asset("spell.gale-burst", "风爆", "#64aa9d"), effect: "projectile",
      power: 15, manaCost: 10, cooldownMs: 1200, range: 28, speed: 90, level: 1, grade: "common",
      impact: { type: "splash", radius: 7, maxTargets: 7 },
    },
    "arc-chain": {
      id: "arc-chain", name: "电弧", element: "lightning", shape: [cell(0, 0), cell(1, 0), cell(1, 1)],
      asset: asset("spell.arc-chain", "电弧", "#c5b447"), effect: "chain",
      power: 18, manaCost: 12, cooldownMs: 1600, range: 32, level: 1, grade: "common",
      impact: { type: "chain", radius: 16, maxTargets: 3, falloff: 0.7 },
    },
    "light-arrow": {
      id: "light-arrow", name: "光矢", element: "light", shape: [cell(0, 0)],
      asset: asset("spell.light-arrow", "光矢", "#f4d76d"), effect: "projectile",
      power: 9, manaCost: 3, cooldownMs: 400, range: 38, speed: 150, level: 1, grade: "common",
    },
    "dark-orb": {
      id: "dark-orb", name: "暗蚀", element: "dark", shape: [cell(0, 0)],
      asset: asset("spell.dark-orb", "暗蚀", "#72558f"), effect: "projectile",
      power: 32, manaCost: 16, cooldownMs: 2000, range: 30, speed: 38, level: 1, grade: "common",
      impact: { type: "splash", radius: 5, maxTargets: 5 },
    },
    ward: {
      id: "ward", name: "光盾", element: "light", shape: [cell(0, 0), cell(1, 0)],
      asset: asset("spell.ward", "光盾", "#f3df91"), effect: "shield",
      power: 25, manaCost: 12, cooldownMs: 3500, range: 20, level: 1, grade: "common",
    },
    "solar-ray": {
      id: "solar-ray", name: "光束", element: "light", shape: [cell(0, 0), cell(1, 0), cell(2, 0)],
      asset: asset("spell.solar-ray", "光束", "#f7d85f"), effect: "beam",
      power: 5, manaCost: 12, cooldownMs: 2200, range: 38, level: 1, grade: "common",
      beam: { width: 1.8, durationMs: 900, tickMs: 100, maxTargets: 3 },
    },
    "ember-ray": {
      id: "ember-ray", name: "炎流", element: "fire", shape: [cell(0, 0), cell(1, 0), cell(2, 0), cell(1, 1)],
      asset: asset("spell.ember-ray", "炎流", "#ed7043"), effect: "beam",
      power: 8, manaCost: 18, cooldownMs: 3200, range: 30, level: 1, grade: "common",
      beam: { width: 5, durationMs: 1200, tickMs: 200, maxTargets: 5 },
      onHit: { burn: { powerRatio: 0.15, durationMs: 1800, tickMs: 600 } },
    },
    "void-ray": {
      id: "void-ray", name: "幽光", element: "dark", shape: [cell(0, 0), cell(1, 0), cell(0, 1), cell(1, 1)],
      asset: asset("spell.void-ray", "幽光", "#62517c"), effect: "beam",
      power: 18, manaCost: 20, cooldownMs: 4000, range: 34, level: 1, grade: "common",
      beam: { width: 3, durationMs: 1000, tickMs: 400, maxTargets: 2 },
    },
    "spark-hop": {
      id: "spark-hop", name: "跳电", element: "lightning", shape: [cell(0, 0), cell(1, 0)],
      asset: asset("spell.spark-hop", "跳电", "#c5b447"), effect: "chain",
      power: 8, manaCost: 4, cooldownMs: 650, range: 26, level: 1, grade: "common",
      impact: { type: "chain", radius: 9, maxTargets: 3, falloff: 0.6 },
    },
    "thunder-chain": {
      id: "thunder-chain", name: "雷链", element: "lightning", shape: [cell(0, 0), cell(1, 0), cell(2, 0), cell(1, 1)],
      asset: asset("spell.thunder-chain", "雷链", "#a997e8"), effect: "chain",
      power: 20, manaCost: 14, cooldownMs: 1800, range: 36, level: 1, grade: "common",
      impact: { type: "chain", radius: 22, maxTargets: 4, falloff: 0.85 },
    },
    "storm-net": {
      id: "storm-net", name: "雷网", element: "lightning", shape: [cell(0, 0), cell(1, 0), cell(0, 1), cell(1, 1)],
      asset: asset("spell.storm-net", "雷网", "#8f83cf"), effect: "chain",
      power: 12, manaCost: 16, cooldownMs: 2100, range: 30, level: 1, grade: "common",
      impact: { type: "chain", radius: 11, maxTargets: 6, falloff: 0.8 },
    },
    ...areaSpellDefinitions,
    ...fieldSpellDefinitions,
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
    ...expandedArcana,
    ...evolvedArcana,
    ...approvedArcana4,
    ...approvedArcana6,
  },
  recipes: magicRecipeDefinitions,
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
