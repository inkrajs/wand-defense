import type { Cell, ContentCatalog, GameState, Placement } from "../contracts";
import { placementCells } from "../loadout/geometry";

// The previous footprints are needed only when a rotated L-shaped spell's
// bounding-box origin was empty and another spell occupied that cell.
const legacyShapes: Readonly<Record<string, readonly Cell[]>> = {
  regrowth: [{x:0,y:0},{x:1,y:0},{x:0,y:1}],
  "metal-needle": [{x:0,y:0},{x:1,y:0},{x:2,y:0}],
  "water-bolt": [{x:0,y:0},{x:0,y:1}],
  "lightning-bolt": [{x:0,y:0},{x:1,y:0},{x:1,y:1}],
  "wind-blade": [{x:0,y:0},{x:1,y:0}],
  "rock-shot": [{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1}],
  "light-arrow": [{x:0,y:0},{x:1,y:0}],
  "dark-orb": [{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1}],
};
const key = ({x,y}: Cell) => `${x},${y}`;

/** Preserve old wand layouts while repairing overlaps caused by shrinking atomic spells. */
export function migrateAtomicSpellPlacements(state: GameState, content: ContentCatalog): void {
  for (const wand of state.wands) {
    const entries = wand.placements.flatMap(placement => {
      const item = state.items[placement.itemId];
      const definition = item && (content.spells[item.definitionId] ?? content.arcana[item.definitionId]);
      if (!definition?.shape.length) return [];
      const legacy = legacyShapes[item.definitionId];
      const changed = item.kind === "spell" && !!legacy && definition.shape.length === 1;
      return [{ placement, cells: placementCells(definition.shape, placement), legacy: changed ? legacy : undefined }];
    });
    const occupied = new Map<string, {changed: boolean}>();
    let requiresMigration = false;
    for (const entry of entries) for (const cell of entry.cells) {
      const previous = occupied.get(key(cell));
      if (previous && (previous.changed || entry.legacy)) requiresMigration = true;
      occupied.set(key(cell), {changed: !!entry.legacy || !!previous?.changed});
    }
    if (!requiresMigration) continue;

    const reserved = new Set(entries.filter(entry => !entry.legacy).flatMap(entry => entry.cells.map(key)));
    const moves: {placement: Placement; cell: Cell}[] = [];
    let canMigrate = true;
    for (const entry of entries) {
      if (!entry.legacy) continue;
      const oldCells = placementCells(entry.legacy, entry.placement);
      const origin = {x: entry.placement.x, y: entry.placement.y};
      const preferred = oldCells.some(cell => key(cell) === key(origin)) ? [origin, ...oldCells] : oldCells;
      const cell = preferred.find(candidate => candidate.x >= 0 && candidate.y >= 0
        && candidate.x < wand.width && candidate.y < wand.height && !reserved.has(key(candidate)));
      // An already-invalid legacy layout must never cause lost spells or partial migration.
      if (!cell) { canMigrate = false; break; }
      reserved.add(key(cell));
      moves.push({placement: entry.placement, cell});
    }
    if (canMigrate) for (const {placement, cell} of moves) Object.assign(placement, cell);
  }
}
