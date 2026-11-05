import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { CombatEntity, GameEvent, GameState } from "../contracts";
import { demoContent } from "../content/demo";
import { MagicEffectArt, type MagicEffectArtKind } from "./MagicEffectArt";
import "./AreaEffects.css";
import { useGraphicsSettings } from "./graphicsSettings";

const MAX_AREA_EFFECTS = 32;
const METEOR_SPELLS = new Set(["meteor", "meteor-shower-small", "meteor-shower-large", "worldfall"]);
const FIELD_MOTES: Record<string, MagicEffectArtKind> = {
  fire: "flame", water: "water", wood: "thorn", earth: "rock", metal: "needle",
  wind: "wind", light: "light", dark: "shadow", lightning: "lightning",
};
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const bounded = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

type AreaPhase = "windup" | "active";
type AreaVisual = {
  entity: CombatEntity;
  phase: AreaPhase;
  windup: number;
  progress: number;
  elapsedMs: number;
  radiusX: number;
  radiusY: number;
  x: number;
  y: number;
};

function matchingEvent(events: readonly GameEvent[], type: string, entityId: string) {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index];
    if (event.type === type && event.data.entityId === entityId && finite(event.gameTimeMs)) return event;
  }
  return undefined;
}

function areaVisual(entity: CombatEntity, state: GameState, width: number, height: number): AreaVisual | undefined {
  const area = entity.area;
  const remainingMs = entity.remainingMs;
  if (!area || ![entity.x, entity.y, area.radius, area.delayMs, area.durationMs, state.gameTimeMs].every(finite)
    || !finite(remainingMs) || area.radius <= 0 || area.delayMs < 0 || area.durationMs <= 0 || remainingMs <= 0) return undefined;

  const delayMs = bounded(area.delayMs, 0, 60_000);
  const durationMs = bounded(area.durationMs, 1, 60_000);
  const launchRemaining = finite(entity.launchDelayMs) ? bounded(entity.launchDelayMs, 0, 60_000) : 0;
  const spawned = matchingEvent(state.events, "areaSpawned", entity.id);
  const activated = matchingEvent(state.events, "areaActivated", entity.id);
  const spawnTime = spawned?.gameTimeMs;
  const spawnedDelay = spawned && finite(spawned.data.delayMs)
    ? bounded(spawned.data.delayMs, 0, 60_000)
    : delayMs;
  const elapsedActive = bounded(durationMs - bounded(remainingMs, 0, durationMs), 0, durationMs);

  const phase: AreaPhase = activated || launchRemaining <= 0 ? "active" : "windup";
  const windup = phase === "active"
    ? 1
    : spawnTime !== undefined && spawnedDelay > 0
      ? bounded((state.gameTimeMs - spawnTime) / spawnedDelay, 0, 1)
      : delayMs > 0 ? bounded(1 - launchRemaining / delayMs, 0, 1) : 0;
  const progress = elapsedActive / durationMs;

  const expansion = finite(area.expandDuringMs) && area.expandDuringMs > 0 ? bounded(elapsedActive / area.expandDuringMs, .08, 1) : 1;
  const radius = bounded(area.radius, 0, 100) * expansion;
  const x = entity.x / 100 * width;
  const y = entity.y / 100 * height;
  if (![x, y].every(finite)) return undefined;
  return {
    entity,
    phase,
    windup,
    progress,
    elapsedMs: elapsedActive,
    x,
    y,
    radiusX: radius / 100 * width,
    radiusY: radius / 100 * height,
  };
}

function AreaShape({ visual, details, resolution, washScale }: { visual: AreaVisual; details: boolean; resolution: number; washScale: number }) {
  const { entity, phase, progress, elapsedMs, windup, radiusX, radiusY, x, y } = visual;
  const mode = entity.area?.mode;
  if (mode !== "strike" && mode !== "ring" && mode !== "eruption" && mode !== "field" && mode !== "vortex") return null;
  const meteor = METEOR_SPELLS.has(entity.definitionId);
  const rod = entity.definitionId === "god-rod";
  const bomb = entity.definitionId === "hydrogen-bomb" || entity.definitionId === "three-phase-bomb";
  const primaryMeteor = meteor && entity.areaImpactRole === "primary";
  const meteorWidth = primaryMeteor ? bounded(radiusX * 0.55, 58, 96) : entity.areaImpactRole === "fragment" ? 20 : 26;
  const meteorHeight = primaryMeteor ? meteorWidth * 1.15 : entity.areaImpactRole === "fragment" ? 24 : 30;
  const meteorFall = primaryMeteor ? bounded(radiusY * 2.5, 140, 360) : radiusY;
  const persistent = mode === "field" || mode === "vortex";
  const element = entity.element ?? (persistent ? demoContent.spells[entity.definitionId]?.element : undefined) ?? "neutral";
  const globalField = mode === "field" && entity.area?.anchor === "field";
  const tickMs = entity.area?.tickMs;
  // Decorative cadence only: contacts and movement remain entirely in the engine.
  const tickProgress = finite(tickMs) && tickMs > 0 ? elapsedMs % tickMs / tickMs : 0;
  const sustain = phase === "active" ? bounded((1 - progress) / 0.15, 0, 1) : windup * 0.4;
  const spikeHeight = bounded(radiusY * 0.28, 14, 34);
  const innerSpikeHeight = bounded(radiusY * 0.2, 11, 24);
  const style = {
    left: x,
    top: y,
    "--area-radius-x": `${radiusX}px`,
    "--area-radius-y": `${radiusY}px`,
    "--area-diameter-x": `${radiusX * 2}px`,
    "--area-diameter-y": `${radiusY * 2}px`,
    "--area-progress": progress,
    "--area-windup": windup,
    "--area-fade": phase === "active" ? 1 - progress : 1,
    "--area-ground-opacity": (persistent ? 0.12 * sustain : phase === "active" ? (1 - progress) * 0.18 : 0.08 + windup * 0.1) * washScale,
    "--area-sustain": sustain,
    "--area-cadence": 0.5 + 0.25 * Math.cos(tickProgress * Math.PI * 2),
    "--area-swirl-angle": `${elapsedMs * 0.09}deg`,
    "--area-marker-opacity": 0.35 + windup * 0.65,
    "--area-ring-scale": 0.08 + progress * 0.92,
    "--area-marker-y": `${-meteorFall * (1 - windup) - (primaryMeteor ? meteorHeight / 2 : 0)}px`,
    "--area-spike-scale": phase === "active" ? bounded(progress * 4, 0, 1) : 0,
    "--area-spike-opacity": phase === "active" ? (1 - progress) * bounded(progress * 4, 0, 1) : 0,
    "--area-inner-spike-opacity": phase === "active" ? (1 - progress) * bounded(progress * 4, 0, 1) * 0.8 : 0,
    "--area-impact-scale": 0.55 + progress * 0.65,
    "--area-spike-height": `${spikeHeight}px`,
    "--area-spike-inner-height": `${innerSpikeHeight}px`,
  } as CSSProperties;
  return <span className={`area-effect area-effect--${mode} area-effect--${element}`} data-area-id={entity.id} data-area-mode={mode} data-area-phase={phase} data-area-coverage={globalField ? "field" : "local"} data-area-impact-role={entity.areaImpactRole} style={style}>
    {/* Full-field damage uses sparse marks, never a viewport-sized opaque wash. */}
    {!globalField && <MagicEffectArt resolution={resolution} className="area-effect__ground" kind="field" width={radiusX * 2} height={radiusY * 2} />}
    {mode === "ring" && <MagicEffectArt resolution={resolution} className="area-effect__ring" kind="ring" width={radiusX * 2} height={radiusY * 2} />}
    {mode === "strike" && <>
      {primaryMeteor && <MagicEffectArt resolution={resolution} className="area-effect__meteor-trail" kind="flame" width={meteorWidth * 1.35} height={meteorHeight * 1.55} color="#e87543" />}
      <MagicEffectArt resolution={resolution} className={`area-effect__marker${meteor ? " area-effect__meteor" : rod || bomb ? " area-effect__marker--centered" : ""}`} kind={meteor ? "rock" : rod ? "needle" : bomb ? "fireball" : "lightning"} width={meteor ? meteorWidth : rod ? 22 : bomb ? 30 : 8} height={meteor ? meteorHeight : rod ? 58 : bomb ? 30 : Math.max(34, radiusY)} />
      <MagicEffectArt resolution={resolution} className="area-effect__impact" kind="impact" variant="impact" width={radiusX * 2} height={radiusY * 2} />
    </>}
    {mode === "eruption" && details && <>
      {Array.from({ length: 8 }, (_, index) => <MagicEffectArt resolution={resolution} key={`outer-${index}`} kind="rock" className="area-effect__spike" width={10} height={spikeHeight} style={{ "--area-spike-angle": `${index * 45}deg`, "--area-spike-offset": `${-radiusY * 0.56}px` } as CSSProperties} />)}
      {Array.from({ length: 6 }, (_, index) => <MagicEffectArt resolution={resolution} key={`inner-${index}`} kind="rock" className="area-effect__spike area-effect__spike--inner" width={7} height={innerSpikeHeight} style={{ "--area-spike-angle": `${index * 60 + 15}deg`, "--area-spike-offset": `${-radiusY * 0.32}px` } as CSSProperties} />)}
    </>}
    {mode === "field" && details && !(globalField && element === "lightning") && <span className="area-effect__field-texture">
      {Array.from({ length: globalField ? 13 : 7 }, (_, index) => {
        // Stable points inside the real area ellipse; never choose targets or infer hits.
        const angle = index * 2.399963229728653;
        const distance = index === 0 ? 0 : Math.sqrt(index / (globalField ? 13 : 7)) * 0.78;
        return <MagicEffectArt resolution={resolution} key={index} kind={FIELD_MOTES[element] ?? "wind"} width={globalField ? 16 : 13} height={globalField ? 32 : 22} className={`area-effect__mote ${element === "fire" ? "area-effect__mote--flame" : "area-effect__mote--arc"}`} style={{
          left: Math.cos(angle) * distance * radiusX,
          top: Math.sin(angle) * distance * radiusY,
          "--area-mote-angle": `${index * 31 % 60 - 30}deg`,
        } as CSSProperties} />;
      })}
    </span>}
    {mode === "vortex" && <span className="area-effect__vortex">
      <span className="area-effect__swirl-plane" style={{ transform: `scale(${radiusX / 48}, ${radiusY / 48})` }}>
        <MagicEffectArt resolution={resolution} className="area-effect__swirl" kind="wind" width={96} height={96} />
      </span>
      <MagicEffectArt resolution={resolution} className="area-effect__eye" kind="ring" width={7} height={7} />
    </span>}
    {mode === "vortex" && ["black-hole", "twin-black-holes", "supermassive-black-hole"].includes(entity.definitionId) && <MagicEffectArt resolution={resolution} className="area-effect__core" kind="shadow" width={entity.definitionId === "supermassive-black-hole" ? 36 : 24} height={entity.definitionId === "supermassive-black-hole" ? 36 : 24} />}
    {mode === "field" && (entity.definitionId === "artificial-sun" || entity.definitionId === "helium-flash") && <MagicEffectArt resolution={resolution} className="area-effect__core" kind="fireball" width={28} height={28} />}
  </span>;
}


const FIELD_EDGE_PATHS: Record<string, { edge: string; accent: string }> = {
  lightning: { edge: "M0 6 Q6 2 12 6 Q15 1 21 5 Q27 1 33 6 Q39 2 45 6 Q50 1 56 5 Q63 1 69 6 Q75 2 81 6 Q87 1 93 5 Q97 3 100 6", accent: "M18 7l-2 4h3l-2 4M52 7l-2 4h3l-2 4M83 7l-2 4h3l-2 4" },
  fire: { edge: "M0 7 Q5 3 10 7 T20 7 T30 7 T40 7 T50 7 T60 7 T70 7 T80 7 T90 7 T100 7", accent: "M15 9q-2-3 0-6 1 3 3 4 2-2 2-4 3 4 0 7M48 9q-2-3 0-6 1 3 3 4 2-2 2-4 3 4 0 7M81 9q-2-3 0-6 1 3 3 4 2-2 2-4 3 4 0 7" },
  water: { edge: "M0 6 Q5 2 10 6 T20 6 T30 6 T40 6 T50 6 T60 6 T70 6 T80 6 T90 6 T100 6", accent: "M13 10q4-3 8 0m25 0q4-3 8 0m25 0q4-3 8 0" },
  wood: { edge: "M0 6 Q12 3 25 6 T50 6 T75 6 T100 6", accent: "M15 6q-3-5 2-5 1 4-2 5Zm34 0q-3-5 2-5 1 4-2 5Zm34 0q-3-5 2-5 1 4-2 5Z" },
  earth: { edge: "M0 7l8-4 7 4 8-5 7 5 8-4 7 4 8-5 7 5 8-4 7 4 8-5 7 5 8-4 7 4", accent: "M15 9l3-2 3 2m28 0 3-2 3 2m28 0 3-2 3 2" },
  metal: { edge: "M0 6h100", accent: "M15 3l3 3-3 3-3-3Zm34 0 3 3-3 3-3-3Zm34 0 3 3-3 3-3-3Z" },
  wind: { edge: "M0 6q8-5 16 0t16 0 16 0 16 0 16 0 20 0", accent: "M13 10q5-3 10 0m24 0q5-3 10 0m24 0q5-3 10 0" },
  light: { edge: "M0 6 Q12 3 25 6 T50 6 T75 6 T100 6", accent: "M16 2v8m-4-4h8m28-4v8m-4-4h8m28-4v8m-4-4h8" },
  dark: { edge: "M0 6 Q6 10 12 6 T24 6 T36 6 T48 6 T60 6 T72 6 T84 6 T100 6", accent: "M15 3a3 3 0 1 0 3 5 3 3 0 0 1-3-5Zm34 0a3 3 0 1 0 3 5 3 3 0 0 1-3-5Zm34 0a3 3 0 1 0 3 5 3 3 0 0 1-3-5Z" },
};

/** Sparse viewport-edge marks, driven by the same simulation envelope as the field. */
function GlobalFieldFrame({ visual, details }: { visual: AreaVisual; details: boolean }) {
  const { entity, phase, windup, elapsedMs } = visual;
  const element = entity.element ?? demoContent.spells[entity.definitionId]?.element ?? "neutral";
  const paths = FIELD_EDGE_PATHS[element] ?? FIELD_EDGE_PATHS.wind;
  const remaining = finite(entity.remainingMs) ? entity.remainingMs : 0;
  const envelope = phase === "windup" ? windup * 0.65 : Math.min(1, elapsedMs / 300, remaining / 400);
  return <svg className={`area-field-frame area-field-frame--${element}`} data-area-phase={phase} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ opacity: bounded(envelope, 0, 1) }}>
    {[0, 90, 180, 270].map(angle => <g key={angle} transform={`rotate(${angle} 50 50)`}>
      <path className="area-field-frame__edge" d={paths.edge} vectorEffect="non-scaling-stroke" />
      {(details || angle === 0) && <path className="area-field-frame__accent" d={paths.accent} vectorEffect="non-scaling-stroke" />}
    </g>)}
  </svg>;
}

/** Decorative area telegraphs driven only by authoritative simulation timestamps/state. */
export function AreaEffects({ state }: { state: GameState }) {
  const { settings } = useGraphicsSettings();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      setSize(previous => previous.width === rect.width && previous.height === rect.height ? previous : { width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const visuals = useMemo(() => {
    if (state.phase !== "battle" || size.width <= 0 || size.height <= 0) return [];
    const globals = new Set<string>();
    return state.entities.filter(entity => entity.kind === "area" && entity.hp > 0).slice(-MAX_AREA_EFFECTS).reverse().flatMap(entity => {
      const visual = areaVisual(entity, state, size.width, size.height);
      if (!visual) return [];
      if (entity.area?.mode === "field" && entity.area.anchor === "field") {
        const element = entity.element ?? demoContent.spells[entity.definitionId]?.element ?? "neutral";
        if (globals.has(element)) return [];
        globals.add(element);
      }
      return [visual];
    });
  }, [size.height, size.width, state]);

  return <div ref={ref} className="area-effects" aria-hidden="true" data-paused={state.paused}>
    {visuals.filter(visual => visual.entity.area?.mode === "field" && visual.entity.area.anchor === "field").map(visual => <GlobalFieldFrame key={`edge:${state.id}:${visual.entity.id}`} visual={visual} details={settings.areaDetails} />)}
    {visuals.map(visual => <AreaShape key={`${state.id}:${visual.entity.id}`} visual={visual} details={settings.areaDetails} resolution={settings.effectResolution} washScale={1 / Math.max(1, visuals.length)} />)}
  </div>;
}
