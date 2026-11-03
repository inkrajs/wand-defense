import type { CombatEntity, GameState } from "../contracts";

export type VisualKind = "ember" | "fireball" | "needle" | "water" | "lightning" | "wind" | "rock" | "heal";
// Presentation registry: replace a visual here without changing a spell's rules.
const spellVisuals: Record<string, VisualKind> = {
  spark: "ember", fireball: "fireball", "metal-needle": "needle", regrowth: "heal",
  "water-bolt": "water", "lightning-bolt": "lightning", "wind-blade": "wind", "rock-shot": "rock",
};
export interface CastVisual {
  seq: number; kind: VisualKind; x: number; y: number; characterIndex: number; fizzled?: boolean;
}
export function projectileVisual(entity: CombatEntity) {
  const kind = spellVisuals[entity.definitionId];
  if (entity.kind !== "projectile" || !kind || kind === "heal" || !Number.isFinite(entity.x) || !Number.isFinite(entity.y)) return;
  const coordinate = (value: number | undefined, fallback: number) => Math.max(0,Math.min(100,
    typeof value === "number" && Number.isFinite(value) ? value : fallback));
  const originX = coordinate(entity.originX,50), originY = coordinate(entity.originY,84);
  const x = coordinate(entity.x,50), y = coordinate(entity.y,84);
  const targetX = coordinate(entity.targetX,x), targetY = coordinate(entity.targetY,y);
  const distance = Math.hypot(targetX - originX,targetY - originY);
  const travelled = Math.hypot(x - originX,y - originY);
  return {kind,originY,originWeight:distance > 0 ? Math.max(0,Math.min(1,1 - travelled / distance)) : 0,
    x:Math.max(2,Math.min(98,x)),y:Math.max(3,Math.min(88,y)),
    targetX:Math.max(2,Math.min(98,targetX)),targetY:Math.max(3,Math.min(88,targetY))};
}
/** Use recorded hit coordinates even when the target died in this same tick. */
export function collectCastVisuals(state: GameState, afterSeq: number): CastVisual[] {
  return state.events.flatMap(event => {
    if (event.seq <= afterSeq || !["damage","heal","projectileExpired"].includes(event.type)) return [];
    const data = event.data, fizzled = event.type === "projectileExpired";
    const definitionId = data.effect ?? state.items[String(data.sourceItemId)]?.definitionId;
    const kind = spellVisuals[String(definitionId)];
    const characterIndex = state.characters.findIndex(character => character.id === data.sourceCharacterId);
    if (!kind || characterIndex < 0 || (!fizzled && (typeof data.amount !== "number" || data.amount <= 0))) return [];
    const target = state.entities.find(entity => entity.id === data.targetId);
    const x = typeof data.x === "number" ? data.x : target?.x;
    const y = typeof data.y === "number" ? data.y : target?.y;
    if (x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y)) return [];
    return [{seq:event.seq,kind,x:Math.max(2,Math.min(98,x)),y:Math.max(3,Math.min(88,y)),characterIndex,fizzled}];
  });
}
