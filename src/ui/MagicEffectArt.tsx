import { PencilIcon, PencilLine, type PencilIconPath } from "@inkra/react";
import { memo, useCallback, useEffect, useId, useRef, useSyncExternalStore, type CSSProperties } from "react";
import type { GamePencilShapeGeometry } from "./GamePencilShape";
import type { VisualKind } from "./combatVisuals";
import "./MagicEffectArt.css";

export type MagicEffectArtKind = VisualKind | "flame" | "field" | "ring" | "impact" | "beam";
export type MagicEffectArtVariant = "projectile" | "impact" | "beam";

export interface MagicEffectArtProps {
  kind: MagicEffectArtKind;
  variant?: MagicEffectArtVariant;
  /** Any stable label is folded into four shared texture slots, never an unbounded entity cache. */
  seed?: string | number;
  /** Display dimensions only; the underlying pencil drawing stays at a fixed resolution. */
  width?: number;
  height?: number;
  color?: string;
  fit?: "meet" | "stretch";
  resolution?: number;
  className?: string;
  /** Position, opacity and simulation-driven transforms belong on this outer wrapper. */
  style?: CSSProperties;
}

const TILE_SIZE = 96;
const VIEW_SIZE = 64;
const flame: GamePencilShapeGeometry = {
  type: "path", viewBox: { width: VIEW_SIZE, height: VIEW_SIZE },
  d: "M32 3C35 15 49 19 48 32C54 29 55 23 54 19C65 37 56 59 35 61C14 63 4 49 9 35C12 27 17 23 18 14C25 22 23 29 25 34C32 27 27 15 32 3Z M7 51C4 47 3 43 5 39C10 43 11 47 7 51Z M58 56C55 53 56 49 60 46C63 51 62 54 58 56Z",
};
const field: GamePencilShapeGeometry = {
  type: "path", viewBox: { width: VIEW_SIZE, height: VIEW_SIZE },
  // One compound wash, including scattered interior pools, rather than particle canvases.
  d: "M4 29C3 17 15 6 29 5C43 3 57 11 60 26C64 41 52 57 36 60C20 63 5 51 4 39L9 41C14 52 26 56 37 54C50 51 58 40 55 27C52 15 42 9 29 11C16 12 9 21 10 30Z M17 26C20 19 29 16 36 20C40 22 41 27 38 30C31 26 24 27 19 33Z M25 42C31 35 43 34 48 40C45 48 32 51 25 46Z M12 37L17 35L20 40L15 43Z",
};
const ring: GamePencilShapeGeometry = {
  type: "path", viewBox: { width: VIEW_SIZE, height: VIEW_SIZE }, fillRule: "evenodd",
  d: "M32 3C48 2 61 16 61 32C62 49 48 61 32 61C15 62 3 48 3 32C2 16 16 3 32 3Z M32 8C18 8 8 18 8 32C8 46 18 56 32 56C46 56 56 46 56 32C56 18 46 8 32 8Z",
};
const impact: GamePencilShapeGeometry = {
  type: "path", viewBox: { width: VIEW_SIZE, height: VIEW_SIZE },
  d: "M30 5L36 24L50 11L42 28L61 30L43 36L54 51L37 43L32 61L26 42L10 53L22 36L3 31L23 26L12 10L29 23Z",
};
const lightning: readonly PencilIconPath[] = [{
  mode: "stroke", d: "M0 32L15 24L22 36L34 25L41 38L51 29L64 32 M22 36L19 47L27 43 M41 38L46 49",
}];
const wind: readonly PencilIconPath[] = [{
  mode: "stroke", d: "M6 30C8 13 26 6 42 10C56 14 61 28 55 40C49 54 31 59 17 49 M12 33C12 20 26 14 39 18C49 21 52 32 46 40C40 49 27 48 21 42 M22 32C22 25 30 23 36 26C44 31 37 40 30 37",
}];
const water: GamePencilShapeGeometry = { type: "path", viewBox: { width: VIEW_SIZE, height: VIEW_SIZE }, d: "M32 3C25 17 10 31 10 42C10 55 20 61 32 61C44 61 54 55 54 42C54 31 39 17 32 3Z" };
const rock: GamePencilShapeGeometry = { type: "path", viewBox: { width: VIEW_SIZE, height: VIEW_SIZE }, d: "M16 9L43 5L59 24L53 49L34 60L10 50L4 29Z" };
const shadow: GamePencilShapeGeometry = { type: "path", viewBox: { width: VIEW_SIZE, height: VIEW_SIZE }, d: "M33 5C51 1 63 20 57 35C63 48 46 64 32 58C16 64 1 48 7 34C1 19 17 1 33 5Z" };
const needle: readonly PencilIconPath[] = [{ mode: "stroke", d: "M32 3L29 53L32 60L35 53L32 3 M25 49L32 45L39 49" }];
const thorn: readonly PencilIconPath[] = [{ mode: "stroke", d: "M32 3L32 60 M32 23C16 23 13 14 14 9C24 9 31 13 32 23 M32 40C49 38 52 29 51 24C40 24 34 31 32 40" }];
const heal: readonly PencilIconPath[] = [{ mode: "stroke", d: "M27 9L37 9L37 26L54 26L54 37L37 37L37 55L27 55L27 37L10 37L10 26L27 26Z" }];
const shield: readonly PencilIconPath[] = [{ mode: "stroke", d: "M32 4C39 10 48 12 55 12L53 34C51 46 43 55 32 60C21 55 13 46 11 34L9 12C16 12 25 10 32 4Z M20 23L30 35L45 19" }];
const geometry: Partial<Record<MagicEffectArtKind, GamePencilShapeGeometry>> = { flame, ember: flame, fireball: flame, field, ring, impact, water, rock, shadow, disc: ring, light: impact };
const paths: Partial<Record<MagicEffectArtKind, readonly PencilIconPath[]>> = { lightning, wind, needle, thorn, heal, shield };

function textureSlot(seed: string | number | undefined) {
  if (seed === undefined) return 0;
  const label = String(seed);
  let hash = 0;
  for (let index = 0; index < Math.min(label.length, 128); index++) hash = (hash * 31 + label.charCodeAt(index)) | 0;
  return (hash >>> 0) % 4;
}

type ResourceKind = MagicEffectArtKind | "lightning-up";
const lightningUp: readonly PencilIconPath[] = [{ mode: "stroke", d: "M32 64L24 49L36 42L25 30L38 23L29 13L32 0 M36 42L47 45L43 37 M38 23L49 18" }];
const washPaths = Object.fromEntries(Object.entries(geometry).map(([kind, shape]) => [kind,
  shape.type === "path" ? [{ d: shape.d, mode: "wash", fillRule: shape.fillRule }] : [],
])) as Partial<Record<MagicEffectArtKind, readonly PencilIconPath[]>>;
function drawingFor(kind: ResourceKind) {
  return kind === "lightning-up" ? lightningUp : paths[kind] ?? washPaths[kind] ?? washPaths.impact!;
}
// Both released and local PencilIcon renderers use a 40-unit icon plane by default.
// Normalize once, rather than depending on the local-only rectangular viewBox API.
const iconDrawings = new Map<ResourceKind, readonly PencilIconPath[]>();
for (const kind of [...Object.keys(geometry), ...Object.keys(paths), "lightning-up"] as ResourceKind[]) {
  iconDrawings.set(kind, drawingFor(kind).map(path => ({ ...path,
    d: path.d.replace(/-?\d*\.?\d+/g, value => String(Number(value) * 40 / VIEW_SIZE)),
  })));
}
function isWash(kind: ResourceKind) { return kind !== "lightning-up" && Boolean(washPaths[kind]); }
const fallbackMasks = new Map<ResourceKind, string>();
function fallbackMask(kind: ResourceKind) {
  let mask = fallbackMasks.get(kind);
  if (!mask) {
    // Plain authored geometry is the temporary/canvas-unavailable fallback, not another brush.
    const body = kind === "beam" ? '<path d="M0 32H64" fill="none" stroke="black" stroke-width="12"/>'
      : drawingFor(kind).map(path => `<path d="${path.d}" fill="${isWash(kind) ? "black" : "none"}" fill-rule="${path.fillRule ?? "nonzero"}" stroke="${isWash(kind) ? "none" : "black"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
    mask = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`)}")`;
    fallbackMasks.set(kind, mask);
  }
  return mask;
}

interface TextureSnapshot { owner?: string; url?: string }
interface TextureEntry {
  snapshot: TextureSnapshot;
  members: Set<string>;
  listeners: Set<() => void>;
}
const EMPTY_TEXTURE: TextureSnapshot = {};
// Only the finite art kinds and four slots enter this map; color, size and entity IDs do not.
const textures = new Map<string, TextureEntry>();
function textureEntry(key: string): TextureEntry {
  let entry = textures.get(key);
  if (!entry) {
    entry = { snapshot: EMPTY_TEXTURE, members: new Set(), listeners: new Set() };
    textures.set(key, entry);
  }
  return entry;
}
function publish(entry: TextureEntry, snapshot: TextureSnapshot) {
  entry.snapshot = snapshot;
  for (const listener of entry.listeners) listener();
}

/** One temporary public renderer per shared texture; no game-owned brush or paint loop. */
const TextureSource = memo(function TextureSource({ kind, slot, resolution, onReady }: { kind: ResourceKind; slot: number; resolution: number; onReady: (url: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    let finished = false;
    const capture = () => {
      if (finished || !node.width || !node.height) return;
      try {
        const context = node.getContext("2d");
        if (!context) return;
        const pixels = context.getImageData(0, 0, node.width, node.height).data;
        let hasInk = false;
        for (let index = 3; index < pixels.length; index += 4) if (pixels[index]) { hasInk = true; break; }
        if (!hasInk) return;
        const url = node.toDataURL("image/png");
        finished = true;
        observer.disconnect();
        onReady(url);
      } catch { /* Decorative rendering cannot interrupt the game. */ }
    };
    // Canvas dimensions are public DOM attributes. Capture after the library finishes painting.
    const observer = new MutationObserver(capture);
    observer.observe(node, { attributes: true, attributeFilter: ["width", "height"] });
    capture();
    return () => { finished = true; observer.disconnect(); };
  }, [kind, slot, resolution, onReady]);
  const seed = `magic-effect-art:${kind}:${slot}:v1`;
  const drawing = iconDrawings.get(kind) ?? iconDrawings.get("impact")!;
  const filled = isWash(kind);
  return <span className="magic-effect-art__source" aria-hidden="true">
    {kind === "beam"
      ? <PencilLine ref={canvas} seed={seed} orientation="horizontal" weight={3} aria-hidden="true" style={{ display: "block", width: TILE_SIZE * resolution, height: 16 * resolution, color: "#000" }} />
      : <PencilIcon ref={canvas} paths={drawing} variant={filled ? "filled" : "outline"} size={TILE_SIZE * resolution} sourceSize={40} seed={seed} decorative style={{ display: "block", color: "#000" }} />}
  </span>;
});

function useTexture(kind: ResourceKind, slot: number, resolution: number, enabled: boolean) {
  const id = useId();
  const key = `${kind}:${slot}:${resolution}`;
  const subscribe = useCallback((listener: () => void) => {
    const entry = textureEntry(key);
    entry.listeners.add(listener);
    return () => { entry.listeners.delete(listener); };
  }, [key]);
  const snapshot = useSyncExternalStore(subscribe, useCallback(() => textures.get(key)?.snapshot ?? EMPTY_TEXTURE, [key]), () => EMPTY_TEXTURE);
  useEffect(() => {
    if (!enabled) return;
    const entry = textureEntry(key);
    entry.members.add(id);
    if (!entry.snapshot.url && !entry.snapshot.owner) publish(entry, { owner: id });
    return () => {
      entry.members.delete(id);
      if (entry.snapshot.owner === id) publish(entry, { owner: entry.members.values().next().value });
    };
  }, [key, id, enabled]);
  const ready = useCallback((url: string) => {
    const entry = textureEntry(key);
    if (entry.snapshot.owner === id && !entry.snapshot.url) publish(entry, { url });
  }, [key, id]);
  return { url: snapshot.url, produce: snapshot.owner === id && !snapshot.url, ready };
}

/** Decorative only: no clock, entity identity, game RNG, target selection or damage. */
export const MagicEffectArt = memo(function MagicEffectArt({ kind, variant = kind === "beam" ? "beam" : "projectile", seed, width = variant === "beam" ? 96 : variant === "impact" ? 48 : 32, height = variant === "beam" ? 8 : width, color = "currentColor", fit = "stretch", resolution = 1, className, style }: MagicEffectArtProps) {
  let stampKind: ResourceKind = variant === "beam" ? "beam" : kind === "lightning" && variant === "projectile" ? "lightning-up" : kind;
  if (stampKind === "ember" || stampKind === "fireball") stampKind = "flame";
  if (stampKind === "disc") stampKind = "ring";
  if (stampKind === "light") stampKind = "impact";
  if (stampKind !== "beam" && stampKind !== "lightning-up" && !paths[stampKind] && !geometry[stampKind]) stampKind = "impact";
  const slot = textureSlot(seed);
  const validSize = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
  const textureResolution = resolution <= .5 ? .5 : resolution <= .75 ? .75 : 1;
  const texture = useTexture(stampKind, slot, textureResolution, validSize);
  if (!validSize) return null;
  const mask = texture.url ? `url("${texture.url}")` : fallbackMask(stampKind);
  return <span className={["magic-effect-art", className].filter(Boolean).join(" ")} data-magic-effect-art={kind} data-magic-effect-variant={variant} data-magic-effect-ready={Boolean(texture.url)} aria-hidden="true" style={{ width, height, ...style }}>
    {texture.produce && <TextureSource kind={stampKind} slot={slot} resolution={textureResolution} onReady={texture.ready} />}
    <span className="magic-effect-art__ink" style={{ backgroundColor: color, maskImage: mask, WebkitMaskImage: mask, maskSize: fit === "meet" ? "contain" : "100% 100%", WebkitMaskSize: fit === "meet" ? "contain" : "100% 100%" }} />
  </span>;
});
