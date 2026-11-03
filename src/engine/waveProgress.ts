import type { GameState } from "../contracts";
import { getWaveSpec, type BossTier } from "./waves";

export interface WaveProgress {
  wave: number; preview: boolean;
  total: number; defeated: number; progress: number;
  markers: {id:string;position:number;tier:Exclude<BossTier,"none">;cleared:boolean}[];
}

/** Authoritative spawn schedule and actual boss IDs, independent of kill ordering. */
export function getWaveProgress(state:GameState):WaveProgress {
  const preview=state.phase === "ready";
  const wave=Math.max(0,Number.isFinite(state.wave) ? Math.floor(state.wave) : 0)+(preview ? 1 : 0);
  if(wave<=0) return {wave,preview,total:0,defeated:0,progress:0,markers:[]};
  const spec=getWaveSpec(wave), total=spec.count;
  if(preview) return {wave,preview,total,defeated:0,progress:0,markers:spec.bossNodes.map(node=>({
    id:node.id,position:node.spawnIndex/total,tier:node.tier,cleared:false,
  }))};
  const remaining=Number.isFinite(state.waveSpawnRemaining) ? Math.max(0,Math.min(total,state.waveSpawnRemaining)) : total;
  const spawned=total-remaining;
  const alive=state.entities.filter(entity=>entity.kind==="enemy"&&entity.hp>0).length;
  const defeated=state.phase==="reward"?total:Math.max(0,Math.min(total,spawned-alive));
  return {wave,preview,total,defeated,progress:total>0?defeated/total:0,markers:spec.bossNodes.map(node=>({
    id:node.id,position:node.spawnIndex/total,tier:node.tier,
    cleared:state.phase==="reward"||(spawned>node.spawnIndex&&!state.entities.some(entity=>
      entity.id===`enemy-${state.wave}-${total-node.spawnIndex}`&&entity.kind==="enemy"&&entity.hp>0)),
  }))};
}
