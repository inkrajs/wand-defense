import { PencilIcon as InkraPencilIcon, type PencilIconPath, type PencilIconProps } from "@inkra/react";
import { memo } from "react";
import { supplyDefinitions } from "../content/supplies";
import type { Cell } from "../contracts";

export { InkraPencilIcon as PencilIcon };

export type SupplyPresentationVariant = "outline" | "filled";
export type SupplyPresentationRotation = 0 | 90 | 180 | 270;
type ViewBox = { x?: number; y?: number; width: number; height: number };

export interface SupplyPresentationIconDefinition {
  id: string;
  label: string;
  color: string;
  shape: readonly Cell[];
  paths: readonly PencilIconPath[];
  filledPaths: readonly PencilIconPath[];
  viewBox: ViewBox;
  clipGeometry: { type: "cells"; cells: readonly Cell[]; cellSize: number };
}

export interface SupplyPresentationIconProps {
  definitionId: string;
  size?: number;
  seed?: string;
  variant?: SupplyPresentationVariant;
  rotation?: SupplyPresentationRotation;
}

const stroke = (d: string): PencilIconPath => ({ d, mode: "stroke" });
const wash = (d: string): PencilIconPath => ({ d, mode: "wash" });
const art = {
  "restoration-elixir": {
    paths: [stroke("M12 3h8v4l3 3v9c0 3-2 5-5 5H8c-3 0-5-2-5-5v-9l3-3V3h6m-6 8h14"), stroke("M12 15c-2-2-5 0-4 2l4 4 4-4c1-2-2-4-4-2Z"), stroke("M33 10c-3 4-5 6-5 9a5 5 0 0 0 10 0c0-3-2-5-5-9Z")],
    filledPaths: [wash("M7 5h11v3l3 3v8c0 2-1 3-3 3H8c-2 0-3-1-3-3v-8l2-3Z"), wash("M33 14c-2 3-4 5-4 7a4 4 0 0 0 8 0c0-2-2-4-4-7Z")],
  },
  "mana-surge": {
    paths: [stroke("M8 3h8v4l3 3v10c0 2-2 4-5 4H10c-3 0-5-2-5-4V10l3-3V3Z"), stroke("M6 14c3-3 5 3 8 0s5 3 8 0m-16 4c3-3 5 3 8 0s5 3 8 0m8-8c4 0 7 2 9 5m-6-8 3 3-3 3" )],
    filledPaths: [wash("M9 5h6v3l3 3v9c0 1-1 2-4 2h-4c-2 0-3-1-3-2v-9l2-3Z"), wash("M7 15c3-2 4 2 7 0s4 2 7 0v2c-3 2-4-2-7 0s-4-2-7 0Z")],
  },
  "hourglass-dust": {
    paths: [stroke("M5 3h14M5 21h14M7 4c0 5 10 6 10 8s-10 3-10 8m10-16c0 5-10 6-10 8s10 3 10 8"), stroke("M9 17h6m-5-3h4m-2-1v1"), stroke("M19 6l2-2m-2 14 2 2" )],
    filledPaths: [wash("M8 5h10c-1 3-3 5-5 6-2-1-4-3-5-6Zm0 14h10c-1-3-3-5-5-6-2 1-4 3-5 6Z")],
  },
  "vitality-essence": {
    paths: [stroke("M12 4C8 10 4 14 4 19a8 8 0 0 0 16 0c0-5-4-9-8-15Z"), stroke("M12 13v10m-4-5h8m-4-12c2-2 4-2 6 0m-6 3c-2-2-4-2-6 0"), stroke("M8 29c4-4 8-4 12 0m-10 5c3-3 5-3 8 0m-6 6 4-4 4 4" )],
    filledPaths: [wash("M12 7c-3 5-6 8-6 12a6 6 0 0 0 12 0c0-4-3-7-6-12Z"), wash("M11 14h2v9h-2Zm-3 4h8v2H8Z")],
  },
  "aegis-essence": {
    paths: [stroke("M24 4c6 4 11 5 17 5v12c0 10-7 17-17 22C14 38 7 31 7 21V9c6 0 11-1 17-5Z"), stroke("M24 11v23m-9-12 9 7 9-7"), stroke("M19 20h10m-5-5v10" )],
    filledPaths: [wash("M24 7c5 3 9 4 14 5v9c0 8-6 14-14 18-8-4-14-10-14-18v-9c5-1 9-2 14-5Z"), wash("M22 15h4v17h-4Zm-6 6h16v4H16Z")],
  },
} as const satisfies Record<string, { paths: readonly PencilIconPath[]; filledPaths: readonly PencilIconPath[] }>;

const supportsNativeShapeViewport = import.meta.env?.INKRA_LOCAL === true;

function viewBox(shape: readonly Cell[]): ViewBox {
  return {
    width: Math.max(1, ...shape.map(cell => cell.x + 1)) * 24,
    height: Math.max(1, ...shape.map(cell => cell.y + 1)) * 24,
  };
}

const definitions: Readonly<Record<string, SupplyPresentationIconDefinition>> = Object.freeze(
  Object.fromEntries(Object.entries(art).flatMap(([id, drawing]) => {
    const definition = supplyDefinitions[id];
    if (!definition) return [];
    return [[id, Object.freeze({
      id,
      label: definition.name,
      color: definition.asset.color ?? "#739ca4",
      shape: definition.shape,
      ...drawing,
      viewBox: viewBox(definition.shape),
      clipGeometry: { type: "cells" as const, cells: definition.shape, cellSize: 24 },
    })]];
  })),
);

export function getSupplyPresentationDefinition(definitionId: string): SupplyPresentationIconDefinition | undefined {
  return Object.hasOwn(definitions, definitionId) ? definitions[definitionId] : undefined;
}

/** Native shape clipping preserves each supply's authored cells; registry builds use AssetImage fallback. */
export function getSupplyPresentationIcon(definitionId: string): SupplyPresentationIconDefinition | undefined {
  const definition = getSupplyPresentationDefinition(definitionId);
  return supportsNativeShapeViewport ? definition : undefined;
}

export const SupplyPresentationIcon = memo(function SupplyPresentationIcon({ definitionId, size = 32, seed, variant = "outline", rotation = 0 }: SupplyPresentationIconProps) {
  const definition = getSupplyPresentationIcon(definitionId);
  if (!definition) return null;
  const columns = Math.max(...definition.shape.map(cell => cell.x + 1));
  const rows = Math.max(...definition.shape.map(cell => cell.y + 1));
  const cellPixels = Math.max(1, size) / Math.max(columns, rows);
  const canvasWidth = columns * cellPixels;
  const canvasHeight = rows * cellPixels;
  const sideTurn = rotation === 90 || rotation === 270;
  const viewportProps = (supportsNativeShapeViewport
    ? { width: canvasWidth, height: canvasHeight, viewBox: definition.viewBox, clipGeometry: definition.clipGeometry }
    : {}) as unknown as Partial<PencilIconProps>;
  return <span style={{ display: "grid", placeItems: "center", width: sideTurn ? canvasHeight : canvasWidth, height: sideTurn ? canvasWidth : canvasHeight, flex: "none" }} aria-hidden="true">
    <InkraPencilIcon
      paths={definition.paths}
      filledPaths={definition.filledPaths}
      variant={variant}
      size={size}
      sourceSize={supportsNativeShapeViewport ? undefined : definition.viewBox.width}
      {...viewportProps}
      strokeWidth={0.8}
      seed={`${seed ?? "supply-presentation"}-${definition.id}`}
      style={{ color: definition.color, transform: rotation ? `rotate(${rotation}deg)` : undefined, transformOrigin: "center" }}
      decorative
    />
  </span>;
});
