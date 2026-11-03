import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { GameState } from "../contracts";
import { advanceBloodMemory, BLOOD_STORAGE_KEY, bloodAppearance, bloodOpacity, bloodGeometry, restoreBloodMemory, type BloodDecal } from "./floorBlood";
import { GamePencilShape } from "./GamePencilShape";
import "./BloodDecals.css";
import { useGraphicsSettings } from "./graphicsSettings";

const BloodMark = memo(function BloodMark({ mark, opacity }: { mark: BloodDecal; opacity: number }) {
  const appearance = useMemo(() => bloodAppearance(mark), [mark]);
  const geometry = useMemo(() => bloodGeometry(mark), [mark.id,mark.maxHp,mark.level,mark.grade,mark.effect]);
  return <span className="blood-decals__mark" style={{
    left: `${mark.x}%`, top: `${mark.y}%`, width: `${appearance.diameter}px`,
    height: `${appearance.diameter * appearance.flatness}px`, opacity, color: appearance.color,
  } as CSSProperties}><GamePencilShape geometry={geometry} color={appearance.color}
    width={appearance.diameter} height={appearance.diameter*appearance.flatness} fit="stretch"
    inkDensity={.85+appearance.strength*.08} seed={`blood-${mark.id}`} decorative /></span>;
});

/** Floor decoration reads authoritative events; it cannot deal damage or spend game RNG. */
export function BloodDecals({ state }: { state: GameState }) {
  const { settings } = useGraphicsSettings();
  const [memory, setMemory] = useState(() => {
    let saved: string | null = null;
    try { saved = window.sessionStorage.getItem(BLOOD_STORAGE_KEY); } catch { /* Optional art cache. */ }
    return advanceBloodMemory(restoreBloodMemory(saved, state), state);
  });
  const latest = useRef(memory);
  const [visible, setVisible] = useState<string[]>([]);
  const revealed = useRef<{ runId: string; ids: string[] }>({ runId: state.id, ids: [] });
  const clock = Math.floor(state.gameTimeMs / 500) * 500;
  useEffect(() => {
    const previous = latest.current;
    const next = advanceBloodMemory(previous, state);
    latest.current = next;
    if (previous.runId !== next.runId || previous.marks !== next.marks) setMemory(next);
  }, [state.id, state.nextEventSeq, clock, state.wave]);
  useEffect(() => {
    if (state.phase === "battle") return;
    try { window.sessionStorage.setItem(BLOOD_STORAGE_KEY, JSON.stringify({ version: 1, ...latest.current })); } catch { /* Gameplay does not depend on the art cache. */ }
  }, [state.phase, memory.runId, memory.marks]);
  const displayMarks = useMemo(() => settings.blood && settings.bloodBudget > 0 ? memory.marks.slice(-settings.bloodBudget) : [], [memory.marks, settings.blood, settings.bloodBudget]);
  // Limit first-time pencil rendering during large kill bursts; memory itself stays complete.
  useEffect(() => {
    const marks = memory.runId === state.id ? displayMarks : [];
    const valid = new Set(marks.map(mark => mark.id));
    const changedRun = revealed.current.runId !== state.id;
    const previous = changedRun ? [] : revealed.current.ids;
    const kept = previous.filter(id => valid.has(id));
    revealed.current = { runId: state.id, ids: kept };
    if (changedRun || kept.length !== previous.length) setVisible(kept);
    let frame = 0;
    if ((state.phase !== "battle" || !state.paused) && marks.length) {
      const reveal = () => {
        const existing = new Set(revealed.current.ids);
        const next = marks.filter(mark => !existing.has(mark.id)).slice(0, 4).map(mark => mark.id);
        if (!next.length) return;
        const ids = [...revealed.current.ids, ...next];
        revealed.current = { runId: state.id, ids };
        setVisible(ids);
        if (marks.length > ids.length) frame = requestAnimationFrame(reveal);
      };
      frame = requestAnimationFrame(reveal);
    }
    return () => cancelAnimationFrame(frame);
  }, [memory.runId, displayMarks, state.id, state.phase, state.paused]);
  const visibleIds = useMemo(() => new Set(visible), [visible]);
  return <div className="blood-decals" aria-hidden="true">
    {memory.runId === state.id && displayMarks.filter(mark => visibleIds.has(mark.id)).map(mark => <BloodMark key={mark.id} mark={mark} opacity={bloodOpacity(mark, clock, state.wave)} />)}
  </div>;
}
