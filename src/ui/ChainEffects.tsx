import { useGraphicsSettings } from "./graphicsSettings";
import { useEffect, useRef, useState } from "react";
import { getCharacterAnchors } from "../content/characterAnchors";
import { useCombatLayout } from "./useCombatLayout";
import { chainHudSource } from "./chainVisuals";
import { MagicEffectArt } from "./MagicEffectArt";
import type { GameState } from "../contracts";
import "./ChainEffects.css";

interface ChainArc { seq: number; time: number; x: number; y: number; targetX: number; targetY: number; sourceCharacterId?: string }
const lifetime = 240;
const valid = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** Draw only new authoritative chain segments, aging in simulation time. */
export function ChainEffects({ state }: { state: GameState }) {
  const { settings } = useGraphicsSettings();
  const cursor = useRef({ runId: state.id, seq: state.nextEventSeq - 1 });
  const [arcs, setArcs] = useState<ChainArc[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const layout = useCombatLayout(ref, state.characters.map(character => character.id).join("\0"));
  const seen = useRef(new Set<string>());
  useEffect(() => {
    if (cursor.current.runId !== state.id) {
      cursor.current = { runId: state.id, seq: state.nextEventSeq - 1 };
      seen.current.clear();
      setArcs([]);
      return;
    }
    if (state.phase !== "battle") {
      cursor.current.seq = state.nextEventSeq - 1;
      seen.current.clear();
      setArcs(previous => previous.length ? [] : previous);
      return;
    }
    const anchors = getCharacterAnchors(state.characters);
    const fresh = state.events.flatMap(event => {
      const d = event.data;
      if (event.seq <= cursor.current.seq || event.type !== "chainArc" || !valid(event.gameTimeMs) || !valid(d.x) || !valid(d.y) || !valid(d.targetX) || !valid(d.targetY)) return [];
      return [{ seq: event.seq, time: event.gameTimeMs, x: d.x, y: d.y, targetX: d.targetX, targetY: d.targetY, sourceCharacterId: chainHudSource(d, anchors, seen.current) }];
    });
    cursor.current.seq = state.nextEventSeq - 1;
    setArcs(previous => {
      const next = [...previous, ...fresh].filter(arc => state.gameTimeMs - arc.time < lifetime && state.gameTimeMs >= arc.time).slice(-64);
      return !fresh.length && next.length === previous.length ? previous : next;
    });
  }, [state.id, state.phase, state.nextEventSeq, state.gameTimeMs, state.events]);
  return <div ref={ref} className="chain-effects" aria-hidden="true">
    {state.phase === "battle" && arcs.map(arc => {
      const source = arc.sourceCharacterId ? layout.sources[arc.sourceCharacterId] : undefined;
      const x = source?.x ?? arc.x / 100 * layout.width, y = source?.y ?? arc.y / 100 * layout.height;
      const dx = arc.targetX / 100 * layout.width - x, dy = arc.targetY / 100 * layout.height - y;
      const length = Math.hypot(dx, dy);
      if (![x, y, length].every(Number.isFinite) || length <= 0) return null;
      return <MagicEffectArt resolution={settings.effectResolution} key={`${state.id}:${arc.seq}`} kind="lightning" variant="impact" seed={arc.seq} width={length} height={14}
        className="chain-effects__arc" style={{ left: x, top: y, opacity: Math.max(0, 1 - (state.gameTimeMs - arc.time) / lifetime), transform: `translateY(-50%) rotate(${Math.atan2(dy, dx)}rad)` }} />;
    })}
  </div>;
}
