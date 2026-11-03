import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { GameState } from "../contracts";
import { AssetImage, resolveEntityAsset } from "./assets";
import { collectDeathVisuals } from "./deathVisuals";
import { getMonsterSize } from "../content/monsters";
import { getMonsterPresentationIcon, MonsterPresentationIcon } from "./monsterPresentationIcons";
import "./DeathEffects.css";
import { useGraphicsSettings } from "./graphicsSettings";

type DeathVisual=ReturnType<typeof collectDeathVisuals>[number]&{expires:number;entityId:string};
export function DeathEffects({state}:{state:GameState}) {
  const { settings } = useGraphicsSettings();
  const cursor=useRef({id:state.id,seq:state.nextEventSeq-1});
  const [visuals,setVisuals]=useState<DeathVisual[]>([]);
  useEffect(()=>{
    if(cursor.current.id !== state.id) {
      cursor.current={id:state.id,seq:state.nextEventSeq-1};setVisuals([]);return;
    }
    const fresh=collectDeathVisuals(state,cursor.current.seq);
    cursor.current.seq=state.nextEventSeq-1;
    if (!settings.deathEffects) { setVisuals(previous => previous.length ? [] : previous); return; }
    if(!fresh.length)return;
    const now=performance.now();
    setVisuals(previous=>[...previous.filter(visual=>visual.expires>now),
      ...fresh.map(visual=>({...visual,entityId:visual.entityId??`${state.id}:${visual.seq}`,expires:now+180}))].slice(-24));
  },[state,settings.deathEffects]);
  useEffect(()=>{
    if(!visuals.length)return;
    const timer=window.setTimeout(()=>setVisuals(previous=>previous.filter(visual=>visual.expires>performance.now())),
      Math.max(1,Math.min(...visuals.map(visual=>visual.expires))-performance.now()));
    return ()=>window.clearTimeout(timer);
  },[visuals]);
  return <div className="death-effects" aria-hidden="true">{(settings.deathEffects && cursor.current.id === state.id ? visuals : []).map(visual=>
    <div key={`${state.id}:${visual.seq}`} className="death-effects__body battlefield__unit battlefield__unit--enemy"
      style={{left:`${visual.x}%`,top:`${visual.y}%`,"--unit-monster-size":`${getMonsterSize({definitionId:visual.definitionId}).pixels}px`} as CSSProperties}>
      <span className="battlefield__unit-mark">{getMonsterPresentationIcon(visual.definitionId,visual.entityId)
        ? <MonsterPresentationIcon definitionId={visual.definitionId} entityId={visual.entityId} size={getMonsterSize({definitionId:visual.definitionId}).pixels}/>
        : <AssetImage asset={resolveEntityAsset({kind:"enemy",definitionId:visual.definitionId})}/>}</span>
    </div>)}
  </div>;
}
