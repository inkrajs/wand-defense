import type { Element, Grade } from "../contracts";
import { elementAppearances, neutralMagicPigment } from "../content/elements";
import { gradeDefinitions } from "../content/grades";
import { gearDefinitions } from "../content/gear";
import { supplyDefinitions } from "../content/supplies";
import { demoContent } from "../content/demo";

/** Structural mirror of Inkra's public appearance result, kept compatible with registry 0.15. */
export type ItemAppearance = { fillColor?: string; outlineColor?: string };
export type ItemAppearanceSource = { element?: Element; grade?: Grade; kind?: string; definitionId?: string };

/** Supplies colors for the full occupied shape; Inkra applies them after rotating its cells. */
export function getGameItemAppearance(item: ItemAppearanceSource): ItemAppearance {
  const definedColor = item.kind === "gear" && item.definitionId
    ? gearDefinitions[item.definitionId]?.asset.color
    : item.kind === "supply" && item.definitionId
      ? supplyDefinitions[item.definitionId]?.asset.color
      : item.kind === "arcana" && item.definitionId
        ? demoContent.arcana[item.definitionId]?.asset.color
        : undefined;
  const pigment = item.element ? elementAppearances[item.element].pigment : definedColor ?? neutralMagicPigment;
  const fillColor = pigment;
  const outlineColor = item.grade ? gradeDefinitions[item.grade].color : undefined;
  return { fillColor, outlineColor };
}
