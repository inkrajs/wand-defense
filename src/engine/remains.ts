import type { CombatEntity, GameState } from "../contracts";
import { getCharacterAnchor } from "../content/characterAnchors";
import { spawnAreaEffects } from "./areaEffects";
import { CONSTRUCT_LIMITS, spawnConstructs } from "./constructs";
import type { CastSpec } from "./effects";
import type { CombatEmit } from "./targets";

const MAX_REMAINS = 32;
const REMAINS_MS = 6000;

export function rememberFallenUnit(state: GameState, entity: CombatEntity): void {
  if (entity.hp > 0 || !isOnBattlefield(entity)) return;
  const eligible = entity.kind === "enemy" || (entity.kind === "summon" && entity.faction === "player"
    && entity.construct && !entity.reborn && entity.definitionId !== "reanimate" && (entity.remainingMs ?? 0) > 0);
  if (!eligible) return;

  const remains = state.remains ??= [];
  remains.push({ entity, expiresAt: state.gameTimeMs + REMAINS_MS });
  if (remains.length > MAX_REMAINS) remains.shift();
}

export function discardExpiredRemains(state: GameState): void {
  const remains = state.remains;
  if (!remains) return;
  while (remains.length && remains[0].expiresAt <= state.gameTimeMs) remains.shift();
  if (remains.length === 0) delete state.remains;
}

export function castRemainsSpell(
  state: GameState, characterId: string, action: "reanimate" | "rebirth" | "detonate", spec: CastSpec, emit: CombatEmit,
): boolean {
  if (state.phase !== "battle" || state.paused || state.backpackOpen || !state.remains?.length) return false;
  const anchor = getCharacterAnchor(state.characters, characterId);
  if (!anchor) return false;

  let bestIndex = -1;
  let bestDistance = spec.range ** 2;
  for (const [index, { entity, expiresAt }] of state.remains.entries()) {
    if (expiresAt <= state.gameTimeMs) continue;
    if (action === "rebirth" ? entity.sourceCharacterId !== characterId || !canRebirth(state, entity) : entity.kind !== "enemy") continue;
    const distance = (entity.x - anchor.x) ** 2 + (entity.y - anchor.y) ** 2;
    if (distance <= bestDistance && (bestIndex < 0 || distance < bestDistance)) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  if (bestIndex < 0) return false;

  const { entity } = state.remains[bestIndex];
  if (action === "detonate") {
    if (!spec.area || !spawnAreaEffects(state, characterId, { ...spec, area: spec.area,
      position: { x: entity.x, y: entity.y }, maxCasts: 1 }, emit)) return false;
  } else if (action === "reanimate") {
    if (!spec.construct || !spawnConstructs(state, characterId, {
      ...spec, kind: "summon", construct: spec.construct, position: { x: entity.x, y: entity.y },
      range: 3, casts: 1, burstCount: 1, splitCount: 1,
    }, emit)) return false;
  } else {
    const revived: CombatEntity = {
      ...entity,
      id: `reborn-${state.nextEventSeq}-${entity.id}`,
      hp: entity.maxHp * .5,
      remainingMs: Math.min(entity.remainingMs ?? 0, 10000),
      attackRemainingMs: entity.cooldownMs,
      launchDelayMs: 0,
      reborn: true,
    };
    state.entities.push(revived);
    emit("constructSpawned", {
      entityId: revived.id, definitionId: revived.definitionId, kind: revived.kind,
      sourceCharacterId: characterId, sourceItemId: revived.sourceItemId,
      x: revived.x, y: revived.y, hp: revived.hp, maxHp: revived.maxHp, durationMs: revived.remainingMs,
      behavior: revived.construct?.behavior, attackMode: revived.construct?.attackMode,
    });
    emit("spellCast", { sourceCharacterId: characterId, sourceItemId: spec.itemId, definitionId: spec.definitionId, casts: 1 });
  }
  state.remains.splice(bestIndex, 1);
  if (!state.remains.length) delete state.remains;
  return true;
}

function canRebirth(state: GameState, entity: CombatEntity): boolean {
  if (entity.kind !== "summon" || entity.faction !== "player" || !entity.construct || entity.reborn
    || entity.definitionId === "reanimate" || (entity.remainingMs ?? 0) <= 0) return false;
  const live = state.entities.filter(candidate => candidate.faction === "player"
    && (candidate.kind === "summon" || candidate.kind === "building") && candidate.hp > 0);
  return live.length < CONSTRUCT_LIMITS.alive && live.filter(candidate => candidate.kind === "summon"
    && candidate.sourceCharacterId === entity.sourceCharacterId && candidate.sourceItemId === entity.sourceItemId
    && candidate.definitionId === entity.definitionId).length < entity.construct.maxAlive;
}

function isOnBattlefield({ x, y }: CombatEntity) {
  return x >= 0 && x <= 100 && y >= 0 && y <= 100;
}
