import type { SpellDefinition } from "../contracts";

const cell = (x: number, y: number) => ({ x, y });
const asset = (id: string, label: string, color: string) => ({ key: `spell.${id}`, label, color });
const square = (size: number) => Array.from({ length: size * size }, (_, index) => cell(index % size, Math.floor(index / size)));

/** Persistent projectile fields and caster-centered weather effects. */
export const fieldSpellDefinitions: Record<string, SpellDefinition> = {
  "fire-field-bolt": {
    id: "fire-field-bolt", name: "焰域弹", element: "fire", shape: square(2),
    asset: asset("fire-field-bolt", "焰域弹", "#ed6842"), effect: "projectile",
    power: 6, manaCost: 12, cooldownMs: 2400, range: 30, speed: 60,
    impact: { type: "field", radius: 6, durationMs: 2400, tickMs: 400, maxTargets: 5, trigger: "contact" },
    level: 1, grade: "common",
  },
  "thunder-field-bolt": {
    id: "thunder-field-bolt", name: "雷域弹", element: "lightning", shape: square(2),
    asset: asset("thunder-field-bolt", "雷域弹", "#a993dd"), effect: "projectile",
    power: 7, manaCost: 14, cooldownMs: 2600, range: 34, speed: 85,
    impact: { type: "field", radius: 5, durationMs: 2000, tickMs: 400, maxTargets: 6, trigger: "either" },
    level: 1, grade: "common",
  },
  thunderstorm: {
    id: "thunderstorm", name: "雷暴", element: "lightning", shape: square(3),
    asset: asset("thunderstorm", "雷暴", "#8271d0"), effect: "area",
    power: 8, manaCost: 45, cooldownMs: 8000, range: 100,
    area: { mode: "field", radius: 75, delayMs: 0, durationMs: 2000, tickMs: 400, maxTargets: 64, anchor: "field" },
    level: 1, grade: "common",
  },
  "moving-storm": {
    id: "moving-storm", name: "风暴", element: "wind",
    shape: [cell(1, 0), cell(0, 1), cell(1, 1), cell(2, 1), cell(1, 2)],
    asset: asset("moving-storm", "风暴", "#67bba9"), effect: "area",
    power: 6, manaCost: 24, cooldownMs: 5000, range: 12,
    area: {
      mode: "vortex", radius: 8, delayMs: 0, durationMs: 4000, tickMs: 400, maxTargets: 8,
      anchor: "caster", moveSpeed: 12, pullRadius: 12, pullStrength: 8,
    },
    level: 1, grade: "common",
  },
};
