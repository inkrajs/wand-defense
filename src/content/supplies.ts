import type { Grade, SupplyDefinition, SupplyInstance } from "../contracts";
import { gradeOrder } from "./grades";

const cell = (x: number, y: number) => ({ x, y });
const asset = (id: string, label: string, color: string) => ({ key: `item.${id}`, label, color });

function freezeSupply(definition: SupplyDefinition): SupplyDefinition {
  for (const coordinate of definition.shape) Object.freeze(coordinate);
  Object.freeze(definition.shape);
  Object.freeze(definition.asset);
  Object.freeze(definition.effect);
  return Object.freeze(definition);
}

export const supplyDefinitions: Readonly<Record<string, SupplyDefinition>> = Object.freeze({
  "health-potion": freezeSupply({
    id: "health-potion", name: "生命药水", shape: [cell(0, 0)],
    asset: asset("health-potion", "恢复领地生命", "#c76e69"),
    effect: { type: "territoryHeal", value: 40 }, level: 1, grade: "common",
  }),
  "shield-potion": freezeSupply({
    id: "shield-potion", name: "护盾药水", shape: [cell(0, 0), cell(1, 0)],
    asset: asset("shield-potion", "恢复领地护盾", "#6f98bf"),
    effect: { type: "territoryShield", value: 30 }, level: 1, grade: "common",
  }),
  "mana-potion": freezeSupply({
    id: "mana-potion", name: "法力药水", shape: [cell(0, 0), cell(0, 1)],
    asset: asset("mana-potion", "恢复全队法力", "#7793d0"),
    effect: { type: "partyMana", value: 50 }, level: 1, grade: "common",
  }),
});

function validGrade(value: unknown): value is Grade {
  return typeof value === "string" && gradeOrder.includes(value as Grade);
}

function resolveGrade(requested: unknown, definitionGrade: unknown): Grade {
  if (validGrade(requested)) return requested;
  if (validGrade(definitionGrade)) return definitionGrade;
  return "common";
}

export function createSupplyFromDefinition(
  definition: SupplyDefinition,
  id: string,
  grade: Grade = definition.grade,
): SupplyInstance {
  return {
    id,
    definitionId: definition.id,
    level: definition.level,
    grade: resolveGrade(grade, definition.grade),
  };
}
