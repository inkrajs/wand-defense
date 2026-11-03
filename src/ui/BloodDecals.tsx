import { memo, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { GameState } from "../contracts";
import { advanceBloodMemory, BLOOD_STORAGE_KEY, bloodAppearance, bloodOpacity, bloodSpots, restoreBloodMemory, type BloodDecal } from "./floorBlood";
import "./BloodDecals.css";

const BloodMark = memo(function BloodMark({ mark, opacity }: { mark: BloodDecal; opacity: number }) {
  const appearance = useMemo(() => bloodAppearance(mark), [mark]);
  const shapes = useMemo(() => bloodSpots(mark).map((spot, index) => <ellipse key={index}
    cx={spot.x} cy={spot.y} rx={spot.rx} ry={spot.ry} opacity={spot.opacity}
    transform={`rotate(${spot.angle} ${spot.x} ${spot.y})`} />), [mark.id]);
  return <svg className="blood-decals__mark" viewBox="0 0 120 120" preserveAspectRatio="none" style={{
    left: `${mark.x}%`, top: `${mark.y}%`, width: `${appearance.diameter}px`,
    height: `${appearance.diameter * appearance.flatness}px`, opacity, color: appearance.color,
  } as CSSProperties}>{shapes}</svg>;
});

/** Floor decoration reads authoritative events; it cannot deal damage or spend game RNG. */
export function BloodDecals({ state }: { state: GameState }) {
  const [memory, setMemory] = useState(() => {
    let saved: string | null = null;
    try { saved = window.sessionStorage.getItem(BLOOD_STORAGE_KEY); } catch { /* Optional art cache. */ }
    return advanceBloodMemory(restoreBloodMemory(saved, state), state);
  });
  const clock = Math.floor(state.gameTimeMs / 500) * 500;
  useEffect(() => { setMemory(previous => advanceBloodMemory(previous, state)); }, [state.id, state.nextEventSeq, clock, state.wave]);
  useEffect(() => {
    try { window.sessionStorage.setItem(BLOOD_STORAGE_KEY, JSON.stringify({ version: 1, ...memory })); } catch { /* Gameplay does not depend on the art cache. */ }
  }, [memory.runId, memory.marks]);
  return <div className="blood-decals" aria-hidden="true">
    {memory.runId === state.id && memory.marks.map(mark => <BloodMark key={mark.id} mark={mark} opacity={bloodOpacity(mark, clock, state.wave)} />)}
  </div>;
}
