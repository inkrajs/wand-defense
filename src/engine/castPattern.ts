export const BURST_INTERVAL_MS=120;
export interface CastPattern {casts:number;burstCount?:number;splitCount?:number}
const count=(value:number|undefined,fallback:number)=>typeof value === "number"&&Number.isFinite(value)
  ? Math.max(1,Math.min(64,Math.floor(value))) : fallback;

/** Double adds time-separated bursts; split adds simultaneous spatial branches. */
export function castPattern(spec:CastPattern,available:number) {
  const explicit=spec.burstCount !== undefined || spec.splitCount !== undefined;
  const bursts=count(spec.burstCount,1),branches=count(spec.splitCount,explicit ? 1 : count(spec.casts,1));
  const total=Math.max(0,Math.min(Math.floor(available),64,bursts*branches));
  return Array.from({length:total},(_,index)=>({delay:Math.floor(index/branches)*BURST_INTERVAL_MS,
    branch:index%branches,branches}));
}

export function branchAngle(index:number,count:number,maxAngle:number):number {
  return count<=1 ? 0 : ((index/(count-1))*2-1)*maxAngle;
}
