import * as Inkra from "@inkra/react";
import type { ComponentType, CSSProperties } from "react";

export type GamePencilPoint = { x: number; y: number };
export type GamePencilShapeGeometry =
  | { type: "cells"; cells: readonly GamePencilPoint[]; cellSize?: number }
  | { type: "path"; d: string; viewBox: { x?: number; y?: number; width: number; height: number }; fillRule?: "nonzero" | "evenodd" }
  | { type: "rect"; width: number; height: number; radius?: number }
  | { type: "polygon"; points: readonly GamePencilPoint[]; viewBox?: { x?: number; y?: number; width: number; height: number } };

export type GamePencilShapeProps = {
  geometry: GamePencilShapeGeometry;
  color?: string;
  inkDensity?: number;
  opacity?: number;
  outlineColor?: string;
  outlineWidth?: number;
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  fit?: "meet" | "stretch";
  seed?: string | number;
  decorative?: boolean;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
  "aria-hidden"?: boolean;
};

type PencilShapeCandidateProps = GamePencilShapeProps & { geometry: GamePencilShapeGeometry };
type PencilSurfaceCompatProps = {
  as: "span";
  variant: "selection";
  seed: string | number;
  className: string;
  style: CSSProperties;
  clipContent?: boolean;
  radius?: number;
  "aria-hidden": true;
};

const Shape = (Inkra as unknown as { PencilShape?: ComponentType<PencilShapeCandidateProps> }).PencilShape;
const Surface = Inkra.PencilSurface as ComponentType<PencilSurfaceCompatProps>;
const MIN_LEGACY_SURFACE_EDGE = 12;

function sourceBox(geometry: GamePencilShapeGeometry) {
  if (geometry.type === "cells") {
    if (!geometry.cells.length) return { x: 0, y: 0, width: 1, height: 1, cellSize: geometry.cellSize ?? 32 };
    const cellSize = Math.max(0.01, geometry.cellSize ?? 32);
    const xs = geometry.cells.map(cell => cell.x);
    const ys = geometry.cells.map(cell => cell.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, width: (Math.max(...xs) - x + 1) * cellSize, height: (Math.max(...ys) - y + 1) * cellSize, columns: Math.max(...xs) - x + 1, rows: Math.max(...ys) - y + 1, cellSize };
  }
  if (geometry.type === "rect") return { x: 0, y: 0, width: geometry.width, height: geometry.height };
  if (geometry.type === "path") return { x: geometry.viewBox.x ?? 0, y: geometry.viewBox.y ?? 0, width: geometry.viewBox.width, height: geometry.viewBox.height };
  if (geometry.viewBox) return { x: geometry.viewBox.x ?? 0, y: geometry.viewBox.y ?? 0, width: geometry.viewBox.width, height: geometry.viewBox.height };
  if (!geometry.points.length) return { x: 0, y: 0, width: 1, height: 1 };
  const xs = geometry.points.map(point => point.x), ys = geometry.points.map(point => point.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, width: Math.max(1, Math.max(...xs) - x), height: Math.max(1, Math.max(...ys) - y) };
}

function numericCssLength(value: CSSProperties["width"] | CSSProperties["height"] | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\s*\d+(?:\.\d+)?px\s*$/.test(value)) return Number.parseFloat(value);
  return undefined;
}

function legacyClipPath(geometry: GamePencilShapeGeometry, box: ReturnType<typeof sourceBox>): string | undefined {
  if (geometry.type === "path") return `path('${geometry.d.replaceAll("'", "\\'")}')`;
  if (geometry.type === "rect") return geometry.radius ? `inset(0 round ${geometry.radius}px)` : undefined;
  if (geometry.type === "polygon") {
    return `polygon(${geometry.points.map(point => `${((point.x - box.x) / box.width) * 100}% ${((point.y - box.y) / box.height) * 100}%`).join(",")})`;
  }
  return undefined;
}

function legacyCellMask(cells: readonly GamePencilPoint[], columns: number, rows: number): CSSProperties {
  const images = cells.map(() => "linear-gradient(#fff 0 0)");
  // CSS mask-position percentages apply to the leftover space after sizing.
  const positions = cells.map(cell => `${(columns <= 1 ? 0 : cell.x / (columns - 1)) * 100}% ${(rows <= 1 ? 0 : cell.y / (rows - 1)) * 100}%`);
  const sizes = cells.map(() => `${100 / columns}% ${100 / rows}%`);
  const repeats = cells.map(() => "no-repeat");
  return {
    maskImage: images.join(","), maskPosition: positions.join(","), maskSize: sizes.join(","), maskRepeat: repeats.join(","), maskComposite: "add",
    WebkitMaskImage: images.join(","), WebkitMaskPosition: positions.join(","), WebkitMaskSize: sizes.join(","), WebkitMaskRepeat: repeats.join(","), WebkitMaskComposite: "source-over",
  };
}

/** Public-shape adapter for the candidate PencilShape export and the released PencilSurface-only registry. */
export function GamePencilShape({ geometry, color = "currentColor", inkDensity = 1, opacity = 1, outlineColor, outlineWidth, width, height, fit = "meet", seed = "game-pencil-shape", decorative = true, className, style, "aria-label": ariaLabel, "aria-hidden": ariaHidden }: GamePencilShapeProps) {
  if (Shape) return <Shape
    geometry={geometry}
    color={color}
    inkDensity={inkDensity}
    opacity={opacity}
    outlineColor={outlineColor}
    outlineWidth={outlineWidth}
    width={width}
    height={height}
    fit={fit}
    seed={seed}
    decorative={decorative}
    className={className}
    style={style}
    aria-label={ariaLabel}
    aria-hidden={ariaHidden}
  />;

  const box = sourceBox(geometry);
  const requestedWidth = numericCssLength(width);
  const requestedHeight = numericCssLength(height);
  const naturalWidth = box.width;
  const naturalHeight = box.height;
  const sx = requestedWidth ? requestedWidth / naturalWidth : (requestedHeight ? requestedHeight / naturalHeight : 1);
  const sy = requestedHeight ? requestedHeight / naturalHeight : sx;
  const scale = fit === "meet" ? Math.min(sx, sy) : undefined;
  const scaleX = scale ?? sx;
  const scaleY = scale ?? sy;
  const contentWidth = naturalWidth * scaleX;
  const contentHeight = naturalHeight * scaleY;
  const displayWidth = requestedWidth ?? contentWidth;
  const displayHeight = requestedHeight ?? contentHeight;
  const offsetX = Math.max(0, (displayWidth - contentWidth) / 2);
  const offsetY = Math.max(0, (displayHeight - contentHeight) / 2);
  const isPath = geometry.type === "path";
  // Inkra 0.15 skips its pencil layer when the drawing surface is under 6px.
  // Enlarge the masked plane, then compensate in its transform so the visible
  // geometry retains the requested dimensions.
  const paintScale = isPath ? 1 : Math.max(1, MIN_LEGACY_SURFACE_EDGE / naturalWidth, MIN_LEGACY_SURFACE_EDGE / naturalHeight);
  const clipPath = legacyClipPath(geometry, box);
  const cellSize = geometry.type === "cells" ? box.cellSize : undefined;
  const columns = geometry.type === "cells" ? box.columns : undefined;
  const rows = geometry.type === "cells" ? box.rows : undefined;
  const mask = geometry.type === "cells"
    ? legacyCellMask(geometry.cells.map(cell => ({ x: cell.x - box.x, y: cell.y - box.y })), columns!, rows!)
    : undefined;
  const radius = geometry.type === "rect" ? geometry.radius : undefined;
  const legacyStyle: CSSProperties = {
    position: "relative", display: "block", width: width ?? displayWidth, height: height ?? displayHeight,
    color, opacity, overflow: "visible", pointerEvents: "none", ...style,
  };
  const pathMinX = isPath ? Math.min(0, box.x) : 0;
  const pathMinY = isPath ? Math.min(0, box.y) : 0;
  const pathMaxX = isPath ? Math.max(0, box.x + box.width) : 0;
  const pathMaxY = isPath ? Math.max(0, box.y + box.height) : 0;
  const pathPlaneWidth = isPath ? Math.max(MIN_LEGACY_SURFACE_EDGE, pathMaxX - pathMinX) : naturalWidth * paintScale;
  const pathPlaneHeight = isPath ? Math.max(MIN_LEGACY_SURFACE_EDGE, pathMaxY - pathMinY) : naturalHeight * paintScale;
  const planeLeft = offsetX - (isPath ? box.x * scaleX : 0);
  const planeTop = offsetY - (isPath ? box.y * scaleY : 0);
  const contentStyle: CSSProperties = {
    position: "absolute", display: "block", left: `${planeLeft}px`, top: `${planeTop}px`,
    width: `${pathPlaneWidth}px`, height: `${pathPlaneHeight}px`, overflow: "visible",
    transform: `scale(${isPath ? scaleX : scaleX / paintScale}, ${isPath ? scaleY : scaleY / paintScale})`, transformOrigin: "top left",
    ...(clipPath ? { clipPath } : {}), ...mask,
    ...(outlineColor ? { filter: `drop-shadow(0 0 ${Math.max(0, outlineWidth ?? 0.8)}px ${outlineColor})` } : {}),
    ...(radius ? { borderRadius: `${radius}px` } : {}),
  };
  return <span className={className} style={legacyStyle} role={decorative ? undefined : "img"} aria-label={decorative ? undefined : ariaLabel} aria-hidden={decorative ? true : ariaHidden}>
    <span style={contentStyle}>
      <Surface
        as="span"
        variant="selection"
        seed={seed}
        className="game-pencil-shape__legacy-surface"
        aria-hidden={true}
        clipContent={Boolean(radius)}
        radius={radius}
        style={{
          display: "block", position: isPath ? "absolute" : undefined,
          left: isPath ? `${pathMinX}px` : undefined, top: isPath ? `${pathMinY}px` : undefined,
          width: isPath ? `${Math.max(MIN_LEGACY_SURFACE_EDGE, pathMaxX - pathMinX)}px` : "100%",
          height: isPath ? `${Math.max(MIN_LEGACY_SURFACE_EDGE, pathMaxY - pathMinY)}px` : "100%",
          color, "--inkra-selection-pigment": color,
        } as CSSProperties}
      />
    </span>
  </span>;
}
