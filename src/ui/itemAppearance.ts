import type { Element, Grade } from "../contracts";
import { elementAppearances, neutralMagicPigment } from "../content/elements";
import { gradeDefinitions } from "../content/grades";

/** Structural mirror of Inkra's public appearance result, kept compatible with registry 0.15. */
export type ItemAppearance = { fillColor?: string; outlineColor?: string };
export type ItemAppearanceSource = { element?: Element; grade?: Grade };

/** Supplies colors for the full occupied shape; Inkra applies them after rotating its cells. */
export function getGameItemAppearance(item: ItemAppearanceSource): ItemAppearance {
  const pigment = item.element ? elementAppearances[item.element].pigment : neutralMagicPigment;
  const fillColor = pigment;
  const outlineColor = item.grade ? gradeDefinitions[item.grade].color : undefined;
  return { fillColor, outlineColor };
}
