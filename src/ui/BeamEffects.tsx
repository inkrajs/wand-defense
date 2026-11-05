import { useGraphicsSettings } from "./graphicsSettings";
import { useRef, type CSSProperties } from "react";
import type { GameState } from "../contracts";
import { beamVisual } from "./beamVisuals";
import { useCombatLayout } from "./useCombatLayout";
import { MagicEffectArt } from "./MagicEffectArt";
import "./BeamEffects.css";

// The mask stretches with the authoritative segment, while its source stays 96×16.
const beamArtStyle: CSSProperties={width:"100%",height:"100%"};

export function BeamEffects({state}:{state:GameState}) {
  const { settings } = useGraphicsSettings();
  const ref=useRef<HTMLDivElement>(null);
  const characterIds=state.characters.map(character=>character.id).join("\0");
  const layout=useCombatLayout(ref,characterIds);
  return <div ref={ref} className="beam-effects" aria-hidden="true" data-paused={state.paused}>
    {state.phase==="battle" && state.entities.map(entity=>{
      const visual=beamVisual(entity,layout);if(!visual)return null;
      return <span key={`${state.id}:${entity.id}`} className={`beam-effects__ray beam-effects__ray--${entity.definitionId}`} style={{
        left:visual.x,top:visual.y,width:visual.length,height:visual.thickness,
        transform:`translateY(-50%) rotate(${visual.angle}deg)`,"--beam-color":visual.color,
      } as CSSProperties}><MagicEffectArt resolution={settings.effectResolution} kind="beam" variant="beam" seed="battle-beam" width={96} height={16} color="var(--beam-color)" style={beamArtStyle} />
        {entity.beamTargetAnchor && <MagicEffectArt resolution={settings.effectResolution} className="beam-effects__star" kind="light" variant="impact" seed="pulsar-core" width={28} height={28} color="var(--beam-color)" />}
      </span>;
    })}
  </div>;
}
