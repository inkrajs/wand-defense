import { PencilIcon as InkraPencilIcon, type PencilIconPath, type PencilIconProps } from "@inkra/react";
import { memo } from "react";
import type { Cell } from "../contracts";
import { demoContent } from "../content/demo";
import { fireEarthArtwork } from "./magic-artwork/fire-earth";
import { otherArtwork } from "./magic-artwork/other-arcana";
import { contentExpansionArtwork } from "./magic-artwork/content-expansions";
import type { MagicArtwork } from "./magic-artwork/types";
import { waterWoodArtwork } from "./magic-artwork/water-wood";

export { InkraPencilIcon as PencilIcon };

export type MagicPresentationVariant = "outline" | "filled";
export type MagicPresentationId = string;
export type MagicPresentationRotation = 0 | 90 | 180 | 270;
type MagicPresentationViewBox = { x?: number; y?: number; width: number; height: number };

export interface MagicPresentationIconDefinition {
  id: MagicPresentationId;
  kind: "spell" | "arcana";
  label: string;
  color: string;
  shape: readonly Cell[];
  /** One complete item drawing, authored in a 24-unit-per-cell coordinate box. */
  paths: readonly PencilIconPath[];
  filledPaths: readonly PencilIconPath[];
  viewBox: MagicPresentationViewBox;
  clipGeometry: { type: "cells"; cells: readonly Cell[]; cellSize: number };
}

export interface MagicPresentationIconProps {
  definitionId: string;
  size?: number;
  seed?: string;
  variant?: MagicPresentationVariant;
  rotation?: MagicPresentationRotation;
  className?: string;
}

const stroke = (d: string): PencilIconPath => ({ d, mode: "stroke" });
const wash = (d: string): PencilIconPath => ({ d, mode: "wash" });

const spellDrawings = {
  spark: {
    label: "火花爆裂",
    color: "#ff9f43",
    paths: [
      stroke("M12 2v5m0 10v5M2 12h5m10 0h5M4.9 4.9l3.6 3.6m7 7 3.6 3.6m0-14.2-3.6 3.6m-7 7-3.6 3.6"),
      stroke("M12 7c-1 2-4 3-4 6a4 4 0 0 0 8 0c0-1-1-3-2-4 0 2-1 3-2 3 0-2-.5-3.5 0-5Z"),
    ],
    filledPaths: [wash("M12 9c-1 1.5-2 2.5-2 4a2 2 0 0 0 4 0c0-.7-.4-1.4-1-2-.1 1-.5 1.4-1 1.6 0-1.3-.3-2.4 0-3.6Z")],
  },
  fireball: {
    label: "火球焰核与连贯尾流",
    color: "#ff6b35",
    paths: [
      stroke("M3 14c5 3 10 3 15 0 5-4 9-7 15-5 4 1 7 1 12-2M4 16c5 2 9 2 14 0 5-2 8-2 13 0 4 1 8 0 12-3M5 18c5 1 9 1 13 0 6-2 9-1 13 1 4 1 8 0 12-2"),
      stroke("M10 14c-2-3-1-7 2-11 1 3 3 4 5 6 3 3 2 7-1 10-3 1-6-1-6-5Z"),
      stroke("M16 11c4-2 7-2 10 0m9 0c3 1 5 1 8 0"),
    ],
    filledPaths: [wash("M11 14c-1-2-.4-5 1-7 1 2 2 3 4 5 1.5 2 1 4-1 5-2 .6-4-.6-4-3Z"), wash("M20 13c4-2 7-2 11-.8v2c-4-1-7-1-11 .8Z")],
  },
  "water-bolt": {
    label: "水滴与涟漪",
    color: "#659dbd",
    paths: [
      stroke("M12 2C9 8 4 13 4 18a8 8 0 0 0 16 0c0-5-5-10-8-16Z"),
      stroke("M9 17c.4 2 1.4 3 3 3"),
      stroke("M3 31c3-3 6-3 9 0s6 3 9 0m-18 7c3-3 6-3 9 0s6 3 9 0m-16 4h14"),
    ],
    filledPaths: [wash("M12 5c-2.5 5-6 9-6 13a6 6 0 0 0 12 0c0-4-3.5-8-6-13Z"), wash("M5 32c2-1.5 4-1.5 7 0s5 1.5 7 0v2c-2 1.5-4 1.5-7 0s-5-1.5-7 0Z")],
  },
  "lightning-bolt": {
    label: "雷矢折闪",
    color: "#c5af4b",
    paths: [
      stroke("M16 3 7 21h12l-4 9 19-20H22l5-7H16Z"),
      stroke("M31 24 27 34h10l-6 11"),
      stroke("M4 9l-2 2m39-4 3 2m-8 13 3 1"),
    ],
    filledPaths: [wash("M17 7 11 19h11l-3 7 13-14H21l4-5H17Z"), wash("M31 28 29 34h6l-3 7 8-9h-7l3-4Z")],
  },
} as const;

const arcanaDrawings = {
  split: {
    label: "整体分岔奥术",
    color: "#e9c46a",
    paths: [
      stroke("M12 3v20m0-9L4 7m8 7 8-7M12 23 5 32m7-9 7 9M5 32v10m14-10v10"),
      stroke("M2 6 4 4l3 3m10-3 3 2-2 3m-15 21 2-3 3 2m10-2 2-3 3 3"),
    ],
    filledPaths: [wash("M10 4h4v9h-4z"), wash("M4 31h4v3H4Zm12 0h4v3h-4Z")],
  },
  double: {
    label: "双重施印",
    color: "#f4a261",
    paths: [
      stroke("M12 4C7 4 4 8 4 12c0 5 4 8 9 8 5 0 9-4 10-8 1-4 5-8 12-8 6 0 9 4 9 8 0 5-4 8-9 8-5 0-9-4-10-8-1-4-5-8-13-8Z"),
    ],
    filledPaths: [],
  },
} as const;

const spellShape = (id: keyof typeof spellDrawings) => demoContent.spells[id].shape;
const arcanaShape = (id: keyof typeof arcanaDrawings) => demoContent.arcana[id].shape;
function viewBox(shape: readonly Cell[]): MagicPresentationViewBox {
  return {
    width: Math.max(1, ...shape.map(cell => cell.x + 1)) * 24,
    height: Math.max(1, ...shape.map(cell => cell.y + 1)) * 24,
  };
}

function spellPresentation(id: keyof typeof spellDrawings): MagicPresentationIconDefinition {
  const shape = spellShape(id);
  return {
    id,
    kind: "spell",
    ...spellDrawings[id],
    shape,
    viewBox: viewBox(shape),
    clipGeometry: { type: "cells", cells: shape, cellSize: 24 },
  };
}

function arcanaPresentation(id: keyof typeof arcanaDrawings): MagicPresentationIconDefinition {
  const shape = arcanaShape(id);
  return {
    id,
    kind: "arcana",
    ...arcanaDrawings[id],
    shape,
    viewBox: viewBox(shape),
    clipGeometry: { type: "cells", cells: shape, cellSize: 24 },
  };
}

const originalDefinitions: Readonly<Record<string, MagicPresentationIconDefinition>> = Object.freeze({
  spark: spellPresentation("spark"),
  fireball: spellPresentation("fireball"),
  "water-bolt": spellPresentation("water-bolt"),
  "lightning-bolt": spellPresentation("lightning-bolt"),
  split: arcanaPresentation("split"),
  double: arcanaPresentation("double"),
});

const artworkCatalog: Readonly<Record<string, MagicArtwork>> = Object.freeze({
  ...contentExpansionArtwork,
  ...fireEarthArtwork,
  ...waterWoodArtwork,
  ...otherArtwork,
});

function catalogPresentation(id: string, artwork: MagicArtwork): MagicPresentationIconDefinition | undefined {
  const spell = demoContent.spells[id];
  const arcana = demoContent.arcana[id];
  const definition = spell ?? arcana;
  if (!definition) return undefined;
  return {
    id,
    kind: spell ? "spell" : "arcana",
    label: definition.name,
    color: definition.asset.color ?? "#e5c76b",
    shape: definition.shape,
    paths: artwork.paths,
    filledPaths: artwork.filledPaths,
    viewBox: viewBox(definition.shape),
    clipGeometry: { type: "cells", cells: definition.shape, cellSize: 24 },
  };
}

const catalogDefinitions: Readonly<Record<string, MagicPresentationIconDefinition>> = Object.freeze(
  Object.fromEntries(Object.entries(artworkCatalog).flatMap(([id, artwork]) => {
    if (Object.hasOwn(originalDefinitions, id)) return [];
    const definition = catalogPresentation(id, artwork);
    return definition ? [[id, definition]] : [];
  })),
);

const definitions: Readonly<Record<string, MagicPresentationIconDefinition>> = Object.freeze({
  ...catalogDefinitions,
  ...originalDefinitions,
});

const aliases: Readonly<Record<string, MagicPresentationId>> = { "thunder-arrow": "lightning-bolt" };
const supportsNativeShapeViewport = import.meta.env?.INKRA_LOCAL === true;

export function getMagicPresentationDefinition(definitionId: string): MagicPresentationIconDefinition | undefined {
  const id = aliases[definitionId] ?? definitionId;
  return Object.hasOwn(definitions, id) ? definitions[id] : undefined;
}

/** Native shape viewports are required for every presentation icon. Older registry builds use AssetImage. */
export function getMagicPresentationIcon(definitionId: string): MagicPresentationIconDefinition | undefined {
  const definition = getMagicPresentationDefinition(definitionId);
  if (!definition) return undefined;
  if (supportsNativeShapeViewport) return definition;
  return undefined;
}

export const MagicPresentationIcon = memo(function MagicPresentationIcon({ definitionId, size = 36, seed, variant = "outline", rotation = 0, className }: MagicPresentationIconProps) {
  const definition = getMagicPresentationIcon(definitionId);
  if (!definition) return null;
  const columns = Math.max(...definition.shape.map(cell => cell.x + 1));
  const rows = Math.max(...definition.shape.map(cell => cell.y + 1));
  const cellPixels = Math.max(1, size) / Math.max(columns, rows);
  const canvasWidth = columns * cellPixels;
  const canvasHeight = rows * cellPixels;
  const sideTurn = rotation === 90 || rotation === 270;
  const width = sideTurn ? canvasHeight : canvasWidth;
  const height = sideTurn ? canvasWidth : canvasHeight;
  const viewportProps = (supportsNativeShapeViewport
    ? { width: canvasWidth, height: canvasHeight, viewBox: definition.viewBox, clipGeometry: definition.clipGeometry }
    : {}) as unknown as Partial<PencilIconProps>;
  return <span className={className} style={{ display: "grid", placeItems: "center", width, height, flex: "none" }} aria-hidden="true">
    <InkraPencilIcon
      paths={definition.paths}
      filledPaths={definition.filledPaths}
      variant={variant}
      size={size}
      sourceSize={supportsNativeShapeViewport ? undefined : definition.viewBox.width}
      {...viewportProps}
      strokeWidth={0.8}
      seed={`${seed ?? "magic-presentation"}-${definition.id}`}
      style={{ color: definition.color, transform: rotation ? `rotate(${rotation}deg)` : undefined, transformOrigin: "center" }}
      decorative
    />
  </span>;
});
