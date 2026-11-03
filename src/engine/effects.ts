import type { ContentCatalog, GameState } from "../contracts";

export interface CastSpec {
  itemId: string;
  definitionId: string;
  power: number;
  manaCost: number;
  cooldownMs: number;
  range: number;
  casts: number;
}

type Emit = (type: string, data: Record<string, unknown>) => void;

function findSourceCharacter(state: GameState, itemId: string, characterId: string) {
  const character = state.characters.find((entry) => entry.id === characterId);
  if (!character || !character.wandIds.some((id) => {
    const wand = state.wands.find((candidate) => candidate.id === id);
    return wand?.characterId === characterId && wand.placements.some((placement) => placement.itemId === itemId);
  })) return undefined;
  return character;
}

function nearestTarget(state: GameState, range: number) {
  return state.entities
    .filter((entity) => entity.kind === "enemy" && entity.faction === "enemy" && entity.hp > 0)
    .map((entity) => ({ entity, distance: Math.hypot(entity.x - 50, entity.y - 84) }))
    .filter((entry) => entry.distance <= range)
    .sort((a, b) => a.distance - b.distance || a.entity.id.localeCompare(b.entity.id))[0]?.entity;
}

/** Applies direct damage or territory healing. Mana and wand cooldowns belong to the caller. */
export function castSpell(
  state: GameState,
  characterId: string,
  spec: CastSpec,
  content: ContentCatalog,
  emit: Emit,
): boolean {
  const spell = content.spells[spec.definitionId];
  const item = state.items[spec.itemId];
  const character = findSourceCharacter(state, spec.itemId, characterId);
  if (!spell || spell.id !== spec.definitionId || item?.kind !== "spell" || item.definitionId !== spec.definitionId || !character) return false;

  const casts = Math.max(1, Math.floor(spec.casts));
  const amount = Math.max(0, spec.power);
  if (spell.effect === "projectile") {
    let hit = false;
    for (let index = 0; index < casts; index++) {
      const target = nearestTarget(state, Math.max(0, spec.range));
      if (!target) break;
      target.hp = Math.max(0, target.hp - amount);
      emit("damage", { targetId: target.id, sourceCharacterId: characterId, sourceItemId: spec.itemId, amount, effect: spell.id });
      hit = true;
    }
    return hit;
  }

  if (spell.effect === "heal") {
    if (spec.range < 8 || state.territory.hp <= 0) return false;
    let applied = false;
    for (let index = 0; index < casts; index++) {
      const healed = Math.min(amount, state.territory.maxHp - state.territory.hp);
      if (healed <= 0) break;
      state.territory.hp += healed;
      emit("heal", { targetId: "territory", sourceCharacterId: characterId, sourceItemId: spec.itemId, amount: healed, effect: spell.id });
      applied = true;
    }
    return applied;
  }

  return false;
}
