import { PencilIcon, type PencilIconPath } from "@inkra/react";
import type { Element } from "../contracts";

type Category = Element | "arcana" | "all";
type Drawing = { outline: readonly PencilIconPath[]; filled: readonly PencilIconPath[] };
const stroke = (d: string): PencilIconPath => ({ d, mode: "stroke" });
const wash = (d: string): PencilIconPath => ({ d, mode: "wash" });
const drawing = (outline: readonly PencilIconPath[], fill: readonly PencilIconPath[] = []): Drawing => ({ outline, filled: [...fill, ...outline] });

/** Consistent 40-unit symbols; their enclosing tabs own the accessible names. */
const drawings: Record<Category, Drawing> = {
  arcana: drawing([
    stroke("M20 4 32 20 20 36 8 20 20 4Z"),
    stroke("M20 13v14M13 20h14"),
  ]),
  all: drawing([
    stroke("M6 6h12v12H6zM22 6h12v12H22zM6 22h12v12H6zM22 22h12v12H22z"),
  ], [wash("M7 7h10v10H7zM23 7h10v10H23zM7 23h10v10H7zM23 23h10v10H23z")]),
  fire: drawing([
    stroke("M20 4c1 7 7 9 9 15 3 7-1 15-9 16-8 0-12-6-10-13 1-4 4-7 6-10 0 4 1 6 3 7 0-5 1-10 1-15Z"),
    stroke("M17 29c0-3 2-5 4-8 2 3 4 5 3 8-1 4-6 4-7 0Z"),
  ], [wash("M20 7c1 6 7 9 8 15 2 6-1 11-8 12-6 0-10-5-8-11 1-3 3-5 4-7 0 3 2 6 4 7 0-5 1-10 0-16Z")]),
  water: drawing([
    stroke("M20 4C16 11 9 17 9 24a11 11 0 0 0 22 0C31 17 24 11 20 4Z"),
    stroke("M14 25c.5 3 2 5 5 6"),
  ], [wash("M20 7c-4 6-9 12-9 17a9 9 0 0 0 18 0c0-5-5-11-9-17Z")]),
  wood: drawing([
    stroke("M7 29C8 16 17 7 33 7c0 16-9 25-22 25-2 0-4-1-4-3Z"),
    stroke("M8 32 29 12M15 25v-7m5 2h7"),
  ], [wash("M9 28C10 18 18 9 31 9c0 13-8 21-19 21-2 0-3 0-3-2Z")]),
  metal: drawing([
    stroke("M20 4 32 16 20 35 8 16 20 4Z"),
    stroke("M8 16h24M20 4v31M13 16l7 19 7-19"),
  ], [wash("M20 6 30 16 20 32 10 16Z")]),
  earth: drawing([
    stroke("M4 32 16 11l6 10 4-6 10 17H4Z"),
    stroke("m11 20 5 4 4-3m4 5 2-3 4 4"),
  ], [wash("M7 30 16 14l6 10 4-6 7 12H7Z")]),
  lightning: drawing([
    stroke("M23 4 9 22h9l-2 14 15-20H21l2-12Z"),
  ], [wash("M21 7 12 20h9l-2 11 9-13h-9Z")]),
  wind: drawing([
    stroke("M5 16h20c7 0 8-10 2-10-3 0-5 2-5 4"),
    stroke("M5 25h24c6 0 7 9 1 9-3 0-5-2-5-4"),
  ]),
  light: drawing([
    stroke("M26 20a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z"),
    stroke("M20 4v5m0 22v5M4 20h5m22 0h5M8.7 8.7l3.5 3.5m15.6 15.6 3.5 3.5m0-22.6-3.5 3.5M12.2 27.8l-3.5 3.5"),
  ], [wash("M25 20a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z")]),
  undead: drawing([
    stroke("M8 19a12 12 0 0 1 24 0c0 5-3 8-7 9v6H15v-6c-4-1-7-4-7-9Z"),
    stroke("M13 19h4m6 0h4m-8 6h2m-4 5v4m6-4v4"),
  ]),
  dark: drawing([
    stroke("M26 5a14 14 0 1 0 9 23A13 13 0 0 1 26 5Z"),
    stroke("m29 10 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z"),
  ], [wash("M24 7a12 12 0 1 0 8 23A14 14 0 0 1 24 7Z")]),
};

export function SkillTreeElementIcon({ element, size = 32 }: { element: Category; size?: number }) {
  const icon = drawings[element];
  return <PencilIcon paths={icon.outline} filledPaths={icon.filled} sourceSize={40} size={size} seed={`skill-tree-element-${element}`} strokeWidth={1.2} breaks={0} decorative />;
}
