import type { GameState } from "../contracts";

export function collectDeathVisuals(state:GameState,afterSeq:number) {
  return state.events.flatMap(event=>{
    if(event.seq<=afterSeq || event.type !== "enemyKilled") return [];
    const {x,y,definitionId,entityId}=event.data;
    if(typeof x !== "number" || !Number.isFinite(x) || typeof y !== "number" || !Number.isFinite(y)) return [];
    return [{seq:event.seq,x,y,
      entityId:typeof entityId === "string" ? entityId : undefined,
      definitionId:typeof definitionId === "string" ? definitionId : "enemy"}];
  });
}
