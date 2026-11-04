import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { CombatEntity, GameEvent, GameState } from "../contracts";
import { demoContent } from "../content/demo";
import { MagicEffectArt } from "./MagicEffectArt";
import "./AreaEffects.css";
import { useGraphicsSettings } from "./graphicsSettings";

const MAX_AREA_EFFECTS = 32;
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

  const radius = bounded(area.radius, 0, 100);
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
  const meteor = entity.definitionId === "meteor";
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
    "--area-marker-y": `${-radiusY * (1 - windup)}px`,
    "--area-spike-scale": phase === "active" ? bounded(progress * 4, 0, 1) : 0,
    "--area-spike-opacity": phase === "active" ? (1 - progress) * bounded(progress * 4, 0, 1) : 0,
    "--area-inner-spike-opacity": phase === "active" ? (1 - progress) * bounded(progress * 4, 0, 1) * 0.8 : 0,
    "--area-impact-scale": 0.55 + progress * 0.65,
    "--area-spike-height": `${spikeHeight}px`,
    "--area-spike-inner-height": `${innerSpikeHeight}px`,
  } as CSSProperties;
  return <span className={`area-effect area-effect--${mode} area-effect--${element}`} data-area-id={entity.id} data-area-mode={mode} data-area-phase={phase} data-area-coverage={globalField ? "field" : "local"} style={style}>
    {/* Full-field damage uses sparse marks, never a viewport-sized opaque wash. */}
    {!globalField && <MagicEffectArt resolution={resolution} className="area-effect__ground" kind="field" width={radiusX * 2} height={radiusY * 2} />}
    {mode === "ring" && <MagicEffectArt resolution={resolution} className="area-effect__ring" kind="ring" width={radiusX * 2} height={radiusY * 2} />}
    {mode === "strike" && <>
      <MagicEffectArt resolution={resolution} className={`area-effect__marker${meteor ? " area-effect__meteor" : ""}`} kind={meteor ? "rock" : "lightning"} width={meteor ? 26 : 8} height={meteor ? 30 : Math.max(34, radiusY)} />
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
        return <MagicEffectArt resolution={resolution} key={index} kind={element === "fire" ? "flame" : "lightning"} width={globalField ? 16 : 13} height={globalField ? 32 : 22} className={`area-effect__mote ${element === "fire" ? "area-effect__mote--flame" : "area-effect__mote--arc"}`} style={{
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
  </span>;
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
    {visuals.map(visual => <AreaShape key={`${state.id}:${visual.entity.id}`} visual={visual} details={settings.areaDetails} resolution={settings.effectResolution} washScale={1 / Math.max(1, visuals.length)} />)}
  </div>;
}
