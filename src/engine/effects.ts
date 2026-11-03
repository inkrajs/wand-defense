import type { CombatEntity, ContentCatalog, GameState } from "../contracts";

export interface CastSpec {
  itemId: string;
  definitionId: string;
  power: number;
  hp?: number;
  manaCost: number;
  cooldownMs: number;
  range: number;
  casts: number;
}

type Emit = (type: string, data: Record<string, unknown>) => void;

const distance = (a: Pick<CombatEntity, "x" | "y">, b: Pick<CombatEntity, "x" | "y">) =>
  Math.hypot(a.x - b.x, a.y - b.y);

function nextEntityId(state: GameState, offset: number): string {
  return `entity-${state.wave}-${state.nextEventSeq + offset}`;
}

function findSourceCharacter(state: GameState, itemId: string, characterId: string) {
  const character = state.characters.find((entry) => entry.id === characterId);
  if (!character || !character.wandIds.some((id) => {
    const wand = state.wands.find((candidate) => candidate.id === id);
    return wand?.placements.some((placement) => placement.itemId === itemId) ?? false;
  })) return undefined;
  return character;
}

function nearestTargets(state: GameState, x: number, y: number, range: number, skip: Set<string> = new Set()) {
  return state.entities
    .filter((entity) => entity.kind === "enemy" && entity.faction === "enemy" && entity.hp > 0 && !skip.has(entity.id))
    .map((entity) => ({ entity, distance: Math.hypot(entity.x - x, entity.y - y) }))
    .filter((entry) => entry.distance <= range)
    .sort((a, b) => a.distance - b.distance || a.entity.id.localeCompare(b.entity.id))
    .map((entry) => entry.entity);
}

/** Applies one compiled cast. Mana and wand cooldowns belong to the caller. */
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
  if (spell.effect === "projectile") {
    let hit = false;
    for (let index = 0; index < casts; index++) {
      const target = nearestTargets(state, 50, 84, Math.max(0, spec.range))[0];
      if (!target) break;
      target.hp = Math.max(0, target.hp - Math.max(0, spec.power));
      emit("damage", { targetId: target.id, sourceCharacterId: characterId, sourceItemId: spec.itemId, amount: Math.max(0, spec.power), effect: spell.id });
      hit = true;
    }
    return hit;
  }

  if (spell.effect === "heal") {
    const amount = Math.max(0, spec.power);
    let applied = false;
    for (let index = 0; index < casts; index++) {
      const target = state.entities
        .filter((entity) => entity.faction === "player" && (entity.kind === "summon" || entity.kind === "building") && entity.hp < entity.maxHp)
        .map((entity) => ({ entity, distance: Math.hypot(entity.x - 50, entity.y - 84) }))
        .filter((entry) => entry.distance <= Math.max(0, spec.range))
        .sort((a, b) => a.distance - b.distance || a.entity.id.localeCompare(b.entity.id))[0]?.entity;
      if (target) {
        const healed = Math.min(amount, target.maxHp - target.hp);
        if (healed > 0) {
          target.hp += healed;
          emit("heal", { targetId: target.id, sourceCharacterId: characterId, sourceItemId: spec.itemId, amount: healed, effect: spell.id });
          applied = true;
          continue;
        }
      }
      const territoryDistance = distance({ x: 50, y: 84 }, { x: 50, y: 92 });
      const healed = Math.min(amount, state.territory.maxHp - state.territory.hp);
      if (territoryDistance <= Math.max(0, spec.range) && healed > 0) {
        state.territory.hp += healed;
        emit("heal", { targetId: "territory", sourceCharacterId: characterId, sourceItemId: spec.itemId, amount: healed, effect: spell.id });
        applied = true;
      } else break;
    }
    return applied;
  }

  if (spell.effect === "summon" || spell.effect === "building") {
    const kind = spell.effect === "summon" ? "summon" : "building";
    const existing = state.entities.filter((entity) => entity.sourceItemId === spec.itemId && entity.faction === "player" && (entity.kind === "summon" || entity.kind === "building")).length;
    const count = Math.min(casts, Math.max(0, 2 - existing));
    if (!count) return false;
    const created: CombatEntity[] = [];
    for (let index = 0; index < count; index++) {
      const hp = Math.max(1, spec.hp ?? spell.hp ?? Math.round(spec.power * 3));
      let id = nextEntityId(state, index);
      let suffix = index + 1;
      while (state.entities.some((existingEntity) => existingEntity.id === id) || created.some((createdEntity) => createdEntity.id === id)) {
        id = nextEntityId(state, suffix++);
      }
      const entity: CombatEntity = {
        id, definitionId: spell.id, kind, faction: "player",
        x: 50, y: kind === "summon" ? 78 : 86, hp, maxHp: hp,
        damage: Math.max(0, spec.power),
        speed: kind === "summon" ? Math.max(0, spell.speed ?? 0) : 0,
        range: Math.max(0, spec.range), cooldownMs: 1000,
        attackRemainingMs: 0, remainingMs: Math.max(1, spell.durationMs ?? 12000),
        element: spell.element, sourceCharacterId: characterId, sourceItemId: spec.itemId,
      };
      created.push(entity);
    }
    state.entities.push(...created);
    for (const entity of created) emit("spawn", { entity: { ...entity } });
    return true;
  }

  return false;
}

/** Advances player summons and buildings in deterministic slices of at most 50ms. */
export function advanceAllies(state: GameState, dtMs: number, content: ContentCatalog, emit: Emit): void {
  if (state.phase !== "battle" || state.paused || state.backpackOpen || !Number.isFinite(dtMs) || dtMs <= 0) return;
  let remaining = Math.max(0, dtMs);
  while (remaining > 0) {
    const step = Math.min(50, remaining);
    remaining -= step;
    const allies = state.entities.filter((entity) => entity.faction === "player" && (entity.kind === "summon" || entity.kind === "building"));
    for (const ally of allies) {
      if (ally.hp <= 0) continue;
      if (ally.remainingMs !== undefined) ally.remainingMs = Math.max(0, ally.remainingMs - step);
      if (ally.remainingMs === 0) {
        ally.hp = 0;
        emit("despawn", { entityId: ally.id, reason: "expired" });
        continue;
      }

      if (content.spells[ally.definitionId]?.summonBehavior === "heal") {
        const hurtAlly = allies
          .filter((candidate) => candidate.id !== ally.id && candidate.hp > 0 && candidate.hp < candidate.maxHp && distance(ally, candidate) <= ally.range)
          .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp) || a.id.localeCompare(b.id))[0];
        if (hurtAlly) {
          const heal = Math.min(Math.max(0, ally.damage) * step / 1000, hurtAlly.maxHp - hurtAlly.hp);
          if (heal > 0) {
            hurtAlly.hp += heal;
            emit("heal", { targetId: hurtAlly.id, sourceCharacterId: ally.sourceCharacterId, sourceItemId: ally.sourceItemId, amount: heal, effect: ally.definitionId });
          }
        }
        continue;
      }

      if (ally.kind === "summon" && ally.speed > 0) {
        const targets = nearestTargets(state, ally.x, ally.y, ally.range);
        if (!targets.length) ally.y = Math.max(0, ally.y - ally.speed * step / 1000);
      }

      ally.attackRemainingMs = Math.max(0, ally.attackRemainingMs - step);
      if (ally.attackRemainingMs > 0) continue;
      const target = nearestTargets(state, ally.x, ally.y, ally.range)[0];
      if (!target) continue;
      const amount = Math.max(0, ally.damage);
      if (amount > 0) {
        target.hp = Math.max(0, target.hp - amount);
        emit("damage", { targetId: target.id, sourceEntityId: ally.id, sourceCharacterId: ally.sourceCharacterId, sourceItemId: ally.sourceItemId, amount });
      }
      ally.attackRemainingMs = ally.cooldownMs;
    }
  }
}
