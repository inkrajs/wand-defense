import type { CombatEntity } from "../contracts";

export interface BeamLayout { width: number; height: number; sources: Record<string, {x:number;y:number}> }
const beamColors: Record<string, {color:string;core:string}> = {
  "solar-ray": {color:"#d4ae48",core:"#fff8d2"},
  "ember-ray": {color:"#dc5b32",core:"#ffe3a6"},
  "void-ray": {color:"#8050a4",core:"#e5c5ff"},
  "helium-flash": {color:"#ed9850",core:"#fff4c6"},
  "pulsar": {color:"#80c1dc",core:"#fff8d2"},
  "gamma-burst": {color:"#edca72",core:"#fff8d2"},
};
/** The renderer follows the authoritative segment; it never schedules a pulse. */
export function beamVisual(entity: CombatEntity, layout: BeamLayout) {
  if (entity.kind !== "beam" || entity.hp <= 0 || (entity.launchDelayMs??0)>0 || (entity.remainingMs ?? 0) <= 0 || !beamColors[entity.definitionId]
    || !Number.isFinite(layout.width) || layout.width <= 0 || !Number.isFinite(layout.height) || layout.height <= 0
    || ![entity.x,entity.y,entity.targetX,entity.targetY].every(value=>typeof value==="number" && Number.isFinite(value))) return;
  const fallback={x:entity.x/100*layout.width,y:entity.y/100*layout.height};
  const source=!entity.beamTargetAnchor && entity.sourceCharacterId && layout.sources[entity.sourceCharacterId] || fallback;
  if (!Number.isFinite(source.x) || !Number.isFinite(source.y)) return;
  const end={x:entity.targetX!/100*layout.width,y:entity.targetY!/100*layout.height};
  const deltaX=end.x-source.x,deltaY=end.y-source.y;
  const width=Number.isFinite(entity.beamWidth) ? Math.max(.25,Math.min(12,entity.beamWidth!)) : 2;
  return {x:source.x-(entity.beamBidirectional?deltaX:0),y:source.y-(entity.beamBidirectional?deltaY:0),
    length:Math.hypot(deltaX,deltaY)*(entity.beamBidirectional?2:1),angle:Math.atan2(deltaY,deltaX)*180/Math.PI,
    thickness:Math.max(3,Math.min(60,width/100*Math.min(layout.width,layout.height))),...beamColors[entity.definitionId]};
}
