import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { GameState } from "../contracts";
import "./CombatEffects.css";

import { collectCastVisuals, projectileVisual, type CastVisual } from "./combatVisuals";

type ActiveVisual = CastVisual & { expires: number; duration: number };
/** Cosmetic event playback only: no timers, hits or mana are written into the runtime. */
export function CombatEffects({ state }: { state: GameState }) {
  const cursor = useRef({runId:state.id,seq:state.nextEventSeq - 1});
  const [visuals,setVisuals] = useState<ActiveVisual[]>([]);
  useEffect(() => {
    if (cursor.current.runId !== state.id) {
      cursor.current = {runId:state.id,seq:state.nextEventSeq - 1};
      setVisuals([]);
      return;
    }
    const fresh = collectCastVisuals(state,cursor.current.seq);
    cursor.current.seq = state.nextEventSeq - 1;
    if (state.paused) { setVisuals(previous => previous.length ? [] : previous); return; }
    if (!fresh.length) return;
    const now = performance.now();
    // Keep fast-forward readable while preventing unbounded effects at high cast rates.
    setVisuals(previous => [...previous.filter(effect => effect.expires > now),
      ...fresh.map(effect => {
        const duration = Math.max(140,Math.min(600,(effect.kind === "heal" ? 560 : 300) / state.speed));
        return {...effect,duration,expires:now + duration};
      })].slice(-32));
  },[state]);
  useEffect(() => {
    if (!visuals.length) return;
    const timer = window.setTimeout(() => {
      const now = performance.now();
      setVisuals(previous => previous.filter(effect => effect.expires > now));
    },Math.max(1,Math.min(...visuals.map(effect => effect.expires)) - performance.now()));
    return () => window.clearTimeout(timer);
  },[visuals]);

  return <div className="combat-effects" data-paused={state.paused} aria-hidden="true">
    {state.phase === "battle" && state.entities.map(entity => {
      const visual = projectileVisual(entity);
      if (!visual) return null;
      const characterIndex = Math.max(0,state.characters.findIndex(character => character.id === entity.sourceCharacterId));
      return <div key={`${state.id}-${entity.id}`} className={`combat-projectile combat-cast--${visual.kind}`} style={{
        "--projectile-x":`${visual.x}cqw`,"--projectile-y":`${visual.y}cqh`,
        "--origin-y":`${visual.originY}cqh`,"--origin-weight":visual.originWeight,
        "--cast-x":`${visual.targetX}cqw`,"--cast-y":`${visual.targetY}cqh`,
        "--cast-index":characterIndex,"--cast-count":state.characters.length,
      } as CSSProperties}><span className="combat-cast__bolt"><i /><b /></span></div>;
    })}
    {visuals.map(effect => <div key={`${state.id}-${effect.seq}`} className={`combat-cast combat-cast--${effect.kind}${effect.fizzled ? " is-fizzled" : ""}`} style={{
      "--cast-x":`${effect.x}cqw`,"--cast-y":`${effect.y}cqh`,
      "--cast-index":effect.characterIndex,"--cast-count":state.characters.length,
      "--cast-duration":`${effect.duration}ms`,
    } as CSSProperties}>
      <div className="combat-cast__impact">{Array.from({length:6},(_,index) => <i key={index} style={{"--spark-angle":`${index * 60}deg`} as CSSProperties} />)}</div>
    </div>)}
  </div>;
}
