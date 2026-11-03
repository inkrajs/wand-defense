import { startTransition, useEffect, useRef, useState } from "react";
import type { GameState } from "../contracts";

/** Presentation only: give the lethal hit a frame, without delaying game rewards. */
export function useBattleSettlement(state:GameState):boolean {
  const key=`${state.id}:${state.wave}`;
  const lastBattle=useRef(state.phase === "battle" ? key : undefined);
  const [readyKey,setReadyKey]=useState(state.phase === "reward" ? key : undefined);
  useEffect(()=>{
    if(state.phase === "battle") lastBattle.current=key;
    if(state.phase !== "reward") return;
    const delay=lastBattle.current === key ? 180 : 0;
    let timer:number|undefined;
    const frame=requestAnimationFrame(()=>{
      timer=window.setTimeout(()=>startTransition(()=>setReadyKey(key)),delay);
    });
    return ()=>{cancelAnimationFrame(frame);window.clearTimeout(timer);};
  },[key,state.phase]);
  return state.phase === "reward" && readyKey === key;
}
