import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { GameState } from "../contracts";
import "./CombatEffects.css";
import { useGraphicsSettings } from "./graphicsSettings";

import { collectCastVisuals, projectileVisual, type CastVisual, type VisualKind } from "./combatVisuals";
import { useCombatLayout } from "./useCombatLayout";
import { getCharacterAnchors } from "../content/characterAnchors";
import { MagicEffectArt, type MagicEffectArtKind } from "./MagicEffectArt";

const projectileSizes: Partial<Record<VisualKind, number>> = { fireball: 36, lightning: 32, wind: 34, rock: 30, shadow: 30 };
const impactSizes: Partial<Record<VisualKind, number>> = { fireball: 56, heal: 56, shield: 64 };
const impactKinds: Partial<Record<VisualKind, MagicEffectArtKind>> = { ember: "impact", fireball: "impact", water: "ring", disc: "ring" };

function sourceOffset(source: number | undefined, origin: number, extent: number) {
  const value = source === undefined ? 0 : source - origin / 100 * extent;
  return Number.isFinite(value) ? value : 0;
}

type ActiveVisual = CastVisual & { expires: number; duration: number };
/** Cosmetic event playback only: no timers, hits or mana are written into the runtime. */
export function CombatEffects({ state }: { state: GameState }) {
  const { settings } = useGraphicsSettings();
  const ref=useRef<HTMLDivElement>(null);
  const layout=useCombatLayout(ref,state.characters.map(character=>character.id).join("\0"));
  const anchors=getCharacterAnchors(state.characters);
  const cursor = useRef({runId:state.id,seq:state.nextEventSeq - 1});
  const [visuals,setVisuals] = useState<ActiveVisual[]>([]);
  useEffect(() => {
    if (cursor.current.runId !== state.id) {
      cursor.current = {runId:state.id,seq:state.nextEventSeq - 1};
      setVisuals([]);
      return;
    }
    const fresh = collectCastVisuals(state,cursor.current.seq).filter(effect => settings.impactSparks || effect.kind === "heal" || effect.kind === "shield");
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
  },[state,settings.impactSparks]);
  useEffect(() => {
    if (!visuals.length) return;
    const timer = window.setTimeout(() => {
      const now = performance.now();
      setVisuals(previous => previous.filter(effect => effect.expires > now));
    },Math.max(1,Math.min(...visuals.map(effect => effect.expires)) - performance.now()));
    return () => window.clearTimeout(timer);
  },[visuals]);

  return <div ref={ref} className="combat-effects" data-paused={state.paused} aria-hidden="true">
    {state.phase === "battle" && state.entities.map(entity => {
      const visual = projectileVisual(entity);
      if (!visual) return null;
      const source=layout.sources[entity.sourceCharacterId??""];
      const size=projectileSizes[visual.kind]??28;
      const x=visual.x/100*layout.width+visual.originWeight*sourceOffset(source?.x,visual.originX,layout.width);
      const y=visual.y/100*layout.height+visual.originWeight*sourceOffset(source?.y,visual.originY,layout.height);
      // World axes can have different screen scales. Keep the drawn tip on the real flight direction.
      const heading=visual.heading!==undefined && layout.width>0 && layout.height>0
        ? Math.atan2(entity.headingY!*layout.height,entity.headingX!*layout.width)*180/Math.PI+90
        : Math.atan2((visual.targetY-visual.y)*layout.height,(visual.targetX-visual.x)*layout.width)*180/Math.PI+90;
      return <div key={`${state.id}-${entity.id}`} className={`combat-projectile combat-cast--${visual.kind}`} style={{
        transform:`translate(${x}px, ${y}px)`,
        visibility:layout.width>0 && layout.height>0 ? undefined : "hidden",
      }}><span className="combat-cast__bolt" style={{width:size,height:size,left:-size/2,top:-size/2,transform:`rotate(${heading}deg)`}}>
        {settings.projectileTrails && (visual.kind==="ember" || visual.kind==="fireball") && <MagicEffectArt resolution={settings.effectResolution} kind={visual.kind} variant="projectile" seed={`projectile:${visual.kind}`} width={12} height={22} color="var(--cast-color)" className="combat-cast__tail" />}
        <MagicEffectArt resolution={settings.effectResolution} kind={visual.kind} variant="projectile" seed={`projectile:${visual.kind}`} width={size} height={size} color="var(--cast-color)" />
      </span></div>;
    })}
    {visuals.filter(effect => settings.impactSparks || effect.kind === "heal" || effect.kind === "shield").map(effect => <div key={`${state.id}-${effect.seq}`} className={`combat-cast combat-cast--${effect.kind}${effect.groundStrike ? " is-ground-strike" : ""}${effect.fizzled ? " is-fizzled" : ""}`} style={{
      "--cast-x":`${effect.x}cqw`,"--cast-y":`${effect.y}cqh`,
      "--cast-index":effect.characterIndex,"--cast-count":state.characters.length,
      "--cast-source-x":layout.sources[state.characters[effect.characterIndex]?.id??""]
        ? `${layout.sources[state.characters[effect.characterIndex].id].x}px` : `${anchors[effect.characterIndex]?.x??50}cqw`,
      "--cast-source-y":layout.sources[state.characters[effect.characterIndex]?.id??""]
        ? `${layout.sources[state.characters[effect.characterIndex].id].y}px` : "84cqh",
      "--cast-duration":`${effect.duration}ms`,
      "--cast-impact-size":`${effect.fizzled?16:impactSizes[effect.kind]??40}px`,
    } as CSSProperties}>
      {effect.groundStrike && <span className="combat-cast__strike"><MagicEffectArt resolution={settings.effectResolution} kind="lightning" variant="impact" seed="storm-strike" width={96} height={40} fit="stretch" color="var(--cast-color)" className="combat-cast__strike-art" /></span>}
      <div className="combat-cast__impact"><MagicEffectArt resolution={settings.effectResolution} kind={effect.groundStrike ? "impact" : impactKinds[effect.kind]??effect.kind} variant="impact" seed={`impact:${effect.kind}`} width={effect.fizzled?16:impactSizes[effect.kind]??40} color="var(--cast-color)" /></div>
    </div>)}
  </div>;
}
