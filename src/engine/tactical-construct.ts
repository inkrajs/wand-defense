import type { CombatEntity, GameState } from "../contracts";
import type { AreaCastSpec } from "./areaEffects";
import type { ConstructCastSpec } from "./constructs";
import type { ProjectileSpec } from "./projectiles";
import type { CombatEmit } from "./targets";

const live = (entity: CombatEntity) => entity.kind === "summon" && entity.faction === "player"
  && entity.hp > 0 && (entity.remainingMs ?? 0) > 0 && (entity.launchDelayMs ?? 0) <= 0;

function restore(entity: CombatEntity, hp: number): number {
  const recovered = Math.min(Math.max(0, entity.maxHp - entity.hp), hp);
  entity.hp += recovered;
  return recovered;
}

function emitHealing(emit: CombatEmit, source: CombatEntity, target: CombatEntity, amount: number): void {
  if (amount <= 0) return;
  emit("heal", { targetId: target.id, sourceEntityId: source.id, sourceCharacterId: source.sourceCharacterId,
    sourceItemId: source.sourceItemId, amount, effect: source.definitionId, x: target.x, y: target.y });
}

export function useExistingConstruct(
  state: GameState, owner: string, spec: ConstructCastSpec, emit: CombatEmit,
  spawn: (state: GameState, owner: string, spec: AreaCastSpec, emit: CombatEmit) => boolean,
): boolean {
  const tactic = spec.tacticalConstruct;
  if (!tactic?.sacrifice && !tactic?.reinforcement) return false;
  const matching = state.entities.filter(entity => live(entity) && entity.sourceItemId === spec.itemId
    && entity.sourceCharacterId === owner && entity.definitionId === spec.definitionId);
  if (!matching.length) return false;
  const weakest = matching.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.id.localeCompare(b.id))[0];
  if (tactic.sacrifice) {
    const advanced = tactic.sacrifice === 2;
    if (!spawn(state, owner, {
      itemId: spec.itemId, definitionId: spec.definitionId, element: spec.element,
      power: spec.power * 2.5 + weakest.maxHp * .22, range: 10, casts: 1, maxCasts: 1,
      position: { x: weakest.x, y: weakest.y }, attackRoll: spec.attackRoll, internal: true,
      area: { mode: "ring", radius: 8, delayMs: 0, durationMs: 350, maxTargets: 6,
        ...(advanced ? { finish: { mode: "ring", radius: 12, durationMs: 400, maxTargets: 8, powerMultiplier: .72 } } : {}) },
    }, emit)) return false;
    weakest.hp = 0;
    weakest.remainingMs = 0;
    delete weakest.deathBurst;
    if (advanced) {
      const allies = nearbyAllies(state, weakest, 12).slice(0, 4);
      for (const ally of allies) emitHealing(emit, weakest, ally, restore(ally, ally.maxHp * .22));
    }
    emit("constructSacrificed", { entityId: weakest.id, sourceCharacterId: owner, sourceItemId: spec.itemId,
      x: weakest.x, y: weakest.y });
    return true;
  }

  const advanced = tactic.reinforcement === 2;
  const eligible = matching.filter(entity => entity.hp < entity.maxHp
    || (entity.remainingMs ?? 0) <= spec.construct.durationMs * .65).slice(0, advanced ? 4 : 1);
  for (const entity of eligible) {
    emitHealing(emit, entity, entity, restore(entity, entity.maxHp * (advanced ? .34 : .26)));
    const remaining = entity.remainingMs ?? 0;
    entity.remainingMs = Math.max(remaining, Math.min(30_000, remaining + spec.construct.durationMs * .4));
  }
  return eligible.length > 0;
}

function nearbyAllies(state: GameState, source: CombatEntity, range: number): CombatEntity[] {
  return state.entities.filter(entity => entity !== source && live(entity) && entity.hp < entity.maxHp
    && entity.sourceCharacterId === source.sourceCharacterId && Math.hypot(entity.x - source.x, entity.y - source.y) <= range)
    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.id.localeCompare(b.id));
}

export function healSymbioticConstruct(state: GameState, source: CombatEntity, amount: number, emit: CombatEmit): void {
  if (amount <= 0 || (source.kind !== "summon" && !source.sourceEntityId)) return;
  const summon = source.kind === "summon" ? source : state.entities.find(entity => entity.id === source.sourceEntityId);
  const tier = summon?.tacticalConstruct?.symbiosis;
  if (!summon || !tier || !live(summon)) return;
  const ally = tier === 2 ? nearbyAllies(state, summon, 10)[0] ?? summon : summon;
  emitHealing(emit, summon, ally, restore(ally, Math.min(ally.maxHp * .12, amount * (tier === 2 ? .36 : .26))));
}

export function castMountedSpell(
  state: GameState, summon: CombatEntity, emit: CombatEmit,
  spawn: (state: GameState, owner: string, spec: ProjectileSpec, emit: CombatEmit) => boolean,
): boolean {
  const tactic = summon.tacticalConstruct;
  const mounted = tactic?.mounted;
  if (!tactic || !mounted || !summon.sourceCharacterId) return false;
  if (tactic.constructPayload === 2) {
    tactic.alternate = !tactic.alternate;
    if (!tactic.alternate) return false;
  }
  return spawn(state, summon.sourceCharacterId, {
    ...mounted, casts: 1, maxCasts: 1, origin: { x: summon.x, y: summon.y }, sourceEntityId: summon.id,
  }, emit);
}
