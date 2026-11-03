import { useGraphicsSettings } from "./graphicsSettings";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MagicEffectArt } from "./MagicEffectArt";
import type { GameState } from "../contracts";
import "./ChainEffects.css";

interface ChainArc { seq: number; time: number; x: number; y: number; targetX: number; targetY: number }
const lifetime = 240;
const valid = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** Draw only new authoritative chain segments, aging in simulation time. */
export function ChainEffects({ state }: { state: GameState }) {
  const { settings } = useGraphicsSettings();
  const cursor = useRef({ runId: state.id, seq: state.nextEventSeq - 1 });
  const [arcs, setArcs] = useState<ChainArc[]>([]);
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
  useEffect(() => {
    if (cursor.current.runId !== state.id) {
      cursor.current = { runId: state.id, seq: state.nextEventSeq - 1 };
      setArcs([]);
      return;
    }
    if (state.phase !== "battle") {
      cursor.current.seq = state.nextEventSeq - 1;
      setArcs(previous => previous.length ? [] : previous);
      return;
    }
    const fresh = state.events.flatMap(event => {
      const d = event.data;
      if (event.seq <= cursor.current.seq || event.type !== "chainArc" || !valid(event.gameTimeMs) || !valid(d.x) || !valid(d.y) || !valid(d.targetX) || !valid(d.targetY)) return [];
      return [{ seq: event.seq, time: event.gameTimeMs, x: d.x, y: d.y, targetX: d.targetX, targetY: d.targetY }];
    });
    cursor.current.seq = state.nextEventSeq - 1;
    setArcs(previous => {
      const next = [...previous, ...fresh].filter(arc => state.gameTimeMs - arc.time < lifetime && state.gameTimeMs >= arc.time).slice(-64);
      return !fresh.length && next.length === previous.length ? previous : next;
    });
  }, [state.id, state.phase, state.nextEventSeq, state.gameTimeMs, state.events]);
  return <div ref={ref} className="chain-effects" aria-hidden="true">
    {state.phase === "battle" && arcs.map(arc => {
      const x = arc.x / 100 * size.width, y = arc.y / 100 * size.height;
      const dx = (arc.targetX - arc.x) / 100 * size.width, dy = (arc.targetY - arc.y) / 100 * size.height;
      const length = Math.hypot(dx, dy);
      if (![x, y, length].every(Number.isFinite) || length <= 0) return null;
      return <MagicEffectArt resolution={settings.effectResolution} key={`${state.id}:${arc.seq}`} kind="lightning" variant="impact" seed={arc.seq} width={length} height={14}
        className="chain-effects__arc" style={{ left: x, top: y, opacity: Math.max(0, 1 - (state.gameTimeMs - arc.time) / lifetime), transform: `translateY(-50%) rotate(${Math.atan2(dy, dx)}rad)` }} />;
    })}
  </div>;
}
