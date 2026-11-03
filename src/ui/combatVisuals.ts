import type { CombatEntity, GameState } from "../contracts";

export type VisualKind = "ember" | "fireball" | "needle" | "water" | "lightning" | "wind" | "rock" | "thorn" | "disc" | "light" | "shadow" | "heal" | "shield";
// Presentation registry: replace a visual here without changing a spell's rules.
const spellVisuals: Record<string, VisualKind> = {
  spark: "ember", fireball: "fireball", "metal-needle": "needle", regrowth: "heal",
  "water-bolt": "water", "lightning-bolt": "lightning", "wind-blade": "wind", "rock-shot": "rock",
  "flame-lance": "ember", "cinder-burst": "fireball", "thorn-shot": "thorn", renewal: "heal",
  "tidal-orb": "water", "stone-spike": "rock", "iron-disc": "disc", "gale-burst": "wind",
  "arc-chain": "lightning", "light-arrow": "light", "dark-orb": "shadow", ward: "shield",
  "spark-hop": "lightning", "thunder-chain": "lightning", "storm-net": "lightning",
  "solar-ray": "light", "ember-ray": "fireball", "void-ray": "shadow",
};
export interface CastVisual {
  seq: number; kind: VisualKind; x: number; y: number; characterIndex: number; fizzled?: boolean;
}
export function projectileVisual(entity: CombatEntity) {
  const kind = spellVisuals[entity.definitionId];
  if (entity.kind !== "projectile" || (entity.launchDelayMs??0)>0 || !kind || kind === "heal" || kind === "shield" || !Number.isFinite(entity.x) || !Number.isFinite(entity.y)) return;
  const coordinate = (value: number | undefined, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const originX = coordinate(entity.originX,50), originY = coordinate(entity.originY,84);
  const x = coordinate(entity.x,50), y = coordinate(entity.y,84);
  const targetX = coordinate(entity.targetX,x), targetY = coordinate(entity.targetY,y);
  const distance = Math.hypot(targetX - originX,targetY - originY);
  const travelled = Math.hypot(x - originX,y - originY);
  const heading=Number.isFinite(entity.headingX)&&Number.isFinite(entity.headingY)
    ? Math.atan2(entity.headingY!,entity.headingX!)*180/Math.PI+90 : undefined;
  return {kind,originX,originY,originWeight:Number.isFinite(distance) && Number.isFinite(travelled) && distance > 0 && !(entity.hitIds?.length) ? Math.max(0,Math.min(1,1 - travelled / distance)) : 0,
    heading,
    x,y,targetX,targetY};
}
/** Use recorded hit coordinates even when the target died in this same tick. */
export function collectCastVisuals(state: GameState, afterSeq: number): CastVisual[] {
  return state.events.flatMap(event => {
    if (event.seq <= afterSeq || !["damage","heal","shieldRestored","projectileExpired"].includes(event.type)) return [];
    const data = event.data, fizzled = event.type === "projectileExpired";
    const definitionId = data.effect ?? state.items[String(data.sourceItemId)]?.definitionId;
    const kind = spellVisuals[String(definitionId)];
    const characterIndex = state.characters.findIndex(character => character.id === data.sourceCharacterId);
    if (!kind || characterIndex < 0 || (!fizzled && (typeof data.amount !== "number" || data.amount <= 0))) return [];
    const target = state.entities.find(entity => entity.id === data.targetId);
    const x = typeof data.x === "number" ? data.x : target?.x;
    const y = typeof data.y === "number" ? data.y : target?.y;
    if (x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y)) return [];
    return [{seq:event.seq,kind,x,y,characterIndex,fizzled}];
  });
}
