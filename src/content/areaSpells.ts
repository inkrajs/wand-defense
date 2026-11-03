import type { SpellDefinition } from "../contracts";

const cell = (x: number, y: number) => ({ x, y });
const asset = (id: string, name: string, color: string) => ({ key: `spell.${id}`, label: name, color });

/** Three prototype area spells whose timing and targeting are implemented by the area effect system. */
export const areaSpellDefinitions: Record<string, SpellDefinition> = {
  "thunder-strike": {
    id: "thunder-strike", name: "落雷", element: "lightning",
    shape: [cell(0, 0), cell(1, 0), cell(1, 1)],
    asset: asset("thunder-strike", "落雷", "#b8a8ef"), effect: "area",
    power: 24, manaCost: 12, cooldownMs: 1800, range: 36,
    area: { mode: "strike", radius: 3, delayMs: 300, durationMs: 250, maxTargets: 3 },
    level: 1, grade: "common",
  },
  "frost-ring": {
    id: "frost-ring", name: "冰环", element: "water",
    shape: [cell(0, 0), cell(1, 0), cell(0, 1), cell(1, 1)],
    asset: asset("frost-ring", "冰环", "#79c6de"), effect: "area",
    power: 12, manaCost: 14, cooldownMs: 2200, range: 18,
    area: { mode: "ring", radius: 18, delayMs: 0, durationMs: 650, maxTargets: 8 },
    onHit: { slow: { multiplier: 0.5, durationMs: 1800 } },
    level: 1, grade: "common",
  },
  "earth-spikes": {
    id: "earth-spikes", name: "地刺", element: "earth",
    shape: [cell(0, 0), cell(1, 0), cell(2, 0)],
    asset: asset("earth-spikes", "地刺", "#a8835f"), effect: "area",
    power: 30, manaCost: 15, cooldownMs: 2600, range: 32,
    area: { mode: "eruption", radius: 5, delayMs: 600, durationMs: 300, maxTargets: 5 },
    level: 1, grade: "common",
  },
};
