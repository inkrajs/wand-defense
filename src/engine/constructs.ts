import type { AttackRollStats, CombatEntity, ConstructSpec, Element, GameState, OnHitSpec, ProjectileImpact } from "../contracts";
import { getCharacterAnchor } from "../content/characterAnchors";
import { applyContactDamage, nearbyEnemies, type CombatEmit } from "./targets";
import { spawnProjectiles } from "./projectiles";
import { castPattern } from "./castPattern";

export const CONSTRUCT_LIMITS = Object.freeze({
  alive: 32,
  perCast: 8,
  durationMs: 30_000,
  perSource: 8,
});

export interface ConstructCastSpec {
  kind: "summon" | "building";
  itemId: string;
  definitionId: string;
  element?: Element;
  power: number;
  range: number;
  casts: number;
  burstCount?: number;
  splitCount?: number;
  speed?: number;
  impact?: ProjectileImpact;
  attackRoll?: AttackRollStats;
  onHit?: OnHitSpec;
  construct: ConstructSpec;
  position?: { x: number; y: number };
}

/** Returns a detached construct description safe to store on every created entity. */
export function normalizeConstruct(spec?: ConstructSpec): ConstructSpec | undefined {
  if (!spec || typeof spec !== "object") return undefined;
  if (!Number.isFinite(spec.hp) || spec.hp <= 0
    || !Number.isFinite(spec.durationMs) || spec.durationMs <= 0
    || !Number.isFinite(spec.attackIntervalMs) || spec.attackIntervalMs <= 0
    || !Number.isFinite(spec.maxAlive) || !Number.isInteger(spec.maxAlive) || spec.maxAlive < 1
    || (spec.attackMode !== "contact" && spec.attackMode !== "projectile")
    || !["attack", "heal", "shield"].includes(spec.behavior)) return undefined;
  if (spec.baseCount !== undefined && (!Number.isInteger(spec.baseCount) || spec.baseCount < 1 || spec.baseCount > CONSTRUCT_LIMITS.perCast)) return undefined;
  if (spec.moveSpeed !== undefined && (!Number.isFinite(spec.moveSpeed) || spec.moveSpeed < 0)) return undefined;
  if (spec.projectileSpeed !== undefined && (!Number.isFinite(spec.projectileSpeed) || spec.projectileSpeed < 0)) return undefined;
  if (spec.coinCost !== undefined && (!Number.isFinite(spec.coinCost) || spec.coinCost < 0)) return undefined;
  if (spec.bodySize !== undefined && !["small", "normal", "large", "huge", "colossal"].includes(spec.bodySize)) return undefined;
  if (spec.placement !== undefined && spec.placement !== "caster" && spec.placement !== "target") return undefined;

  return {
    ...spec,
    hp: Math.min(1e12, spec.hp),
    durationMs: Math.min(CONSTRUCT_LIMITS.durationMs, spec.durationMs),
    attackIntervalMs: Math.max(50, spec.attackIntervalMs),
    maxAlive: Math.min(CONSTRUCT_LIMITS.perSource, spec.maxAlive),
    ...(spec.moveSpeed !== undefined ? { moveSpeed: Math.min(1_000, spec.moveSpeed) } : {}),
    ...(spec.projectileSpeed !== undefined ? { projectileSpeed: Math.min(1_000, spec.projectileSpeed) } : {}),
    ...(spec.coinCost !== undefined ? { coinCost: Math.floor(spec.coinCost) } : {}),
  };
}

/** Creates the whole cast atomically. The caller charges mana, coins, and cooldown once on true. */
export function spawnConstructs(state: GameState, characterId: string, spec: ConstructCastSpec, emit: CombatEmit): boolean {
  const construct = normalizeConstruct(spec.construct);
  if (!construct || !ownsSpell(state, characterId, spec.itemId, spec.definitionId)) return false;
  if (!Number.isFinite(spec.power) || spec.power < 0 || !Number.isFinite(spec.range) || spec.range < 0) return false;
  if (state.phase === "defeat") return false;
  if (!Number.isFinite(spec.casts) || !Number.isInteger(spec.casts) || spec.casts < 1) return false;

  const manual = spec.position !== undefined;
  if (manual) {
    if (!validPosition(spec.position)) return false;
  } else if (spec.kind !== "summon" || state.phase !== "battle" || state.paused || state.backpackOpen) {
    return false;
  }
  if (!manual && state.phase !== "battle") return false;
  if (construct.coinCost !== undefined && (!Number.isFinite(state.coins) || state.coins < construct.coinCost)) return false;

  const live = state.entities.filter(isLiveConstruct);
  const fromSource = live.filter(entity => sameConstructSource(entity, characterId, spec.itemId, spec.definitionId)).length;
  const availableGlobal = Math.max(0, CONSTRUCT_LIMITS.alive - live.length);
  const availableSource = Math.max(0, construct.maxAlive - fromSource);
  const cast = construct.baseCount === undefined ? spec : {
    ...spec, burstCount: (spec.burstCount ?? 1) * construct.baseCount,
  };
  const pattern = castPattern(cast, Math.min(CONSTRUCT_LIMITS.perCast, availableGlobal, availableSource));
  const count = pattern.length;
  if (count < 1) return false;

  const character = state.characters.find(candidate => candidate.id === characterId);
  if (!character) return false;
  const position = manual ? spec.position! : initialPosition(state, characterId, spec, construct);
  if (!validPosition(position)) return false;

  const created: CombatEntity[] = [];
  for (let index = 0; index < pattern.length; index++) {
    const id = nextConstructId(state, index, created);
    const entity: CombatEntity = {
      id,
      definitionId: spec.definitionId,
      ...(spec.element ? { element: spec.element } : {}),
      kind: spec.kind,
      faction: "player",
      x: position.x,
      y: position.y,
      hp: construct.hp,
      maxHp: construct.hp,
      damage: finiteNonnegative(spec.power),
      speed: spec.kind === "summon" ? construct.moveSpeed ?? 0 : 0,
      range: finiteNonnegative(spec.range),
      cooldownMs: construct.attackIntervalMs,
      attackRemainingMs: 0,
      remainingMs: construct.durationMs,
      sourceCharacterId: characterId,
      sourceItemId: spec.itemId,
      construct: structuredClone(construct),
      ...(spec.attackRoll ? { attackRoll: { ...spec.attackRoll } } : {}),
      ...(spec.onHit ? { onHit: structuredClone(spec.onHit) } : {}),
      ...(construct.bodySize ? { bodySize: construct.bodySize } : {}),
      ...(pattern[index].delay > 0 ? { launchDelayMs: pattern[index].delay } : {}),
      ...(spec.impact ? { impact: structuredClone(spec.impact) } : {}),
      ...(spec.speed !== undefined ? { moveSpeed: Math.min(1_000, finiteNonnegative(spec.speed)) } : {}),
    };
    created.push(entity);
  }

  state.entities.push(...created);
  for (const entity of created) emit("constructSpawned", {
    entityId: entity.id, definitionId: entity.definitionId, kind: entity.kind,
    sourceCharacterId: entity.sourceCharacterId, sourceItemId: entity.sourceItemId,
    x: entity.x, y: entity.y, hp: entity.hp, maxHp: entity.maxHp,
    durationMs: entity.remainingMs, behavior: construct.behavior, attackMode: construct.attackMode,
  });
  emit("spellCast", { sourceCharacterId: characterId, sourceItemId: spec.itemId,
    definitionId: spec.definitionId, casts: created.length });
  return true;
}

/** Advances only constructs already present at entry, in deterministic slices of at most 50 ms. */
export function advanceConstructs(state: GameState, dtMs: number, emit: CombatEmit): void {
  if (state.phase !== "battle" || state.paused || state.backpackOpen || !Number.isFinite(dtMs) || dtMs <= 0) return;
  let remaining = dtMs;
  const removed = new Set<string>();
  while (remaining > 0) {
    const step = Math.min(50, remaining);
    remaining -= step;
    const constructs = state.entities.filter(isConstruct);
    for (const entity of constructs) {
      // Enemy contact resolution owns destroyed events and cleanup for zero-HP constructs.
      if (entity.hp <= 0 || removed.has(entity.id)) continue;
      const launchDelay = Math.max(0, finite(entity.launchDelayMs, 0));
      const delayed = Math.min(step, launchDelay);
      if (launchDelay > 0) {
        entity.launchDelayMs = launchDelay - delayed;
        if (entity.launchDelayMs > 0 || delayed >= step) continue;
      }
      const availableStep = step - delayed;
      const remainingBefore = entity.remainingMs === undefined ? Number.POSITIVE_INFINITY
        : Math.max(0, finite(entity.remainingMs, 0));
      const activeStep = Math.min(availableStep, remainingBefore);
      const expiresThisSlice = entity.remainingMs !== undefined && remainingBefore <= availableStep;
      if (entity.remainingMs !== undefined) entity.remainingMs = Math.max(0, remainingBefore - activeStep);
      if (activeStep <= 0) {
        if (expiresThisSlice) expireConstruct(entity, removed, emit);
        continue;
      }
      const construct = normalizeConstruct(entity.construct);
      if (!construct) continue;
      entity.attackRemainingMs = Math.max(0, finite(entity.attackRemainingMs, 0) - activeStep);
      const target = chooseBehaviorTarget(state, entity, construct);
      if (target && entity.kind === "summon" && (construct.moveSpeed ?? 0) > 0
        && distance(entity, target.position) > entity.range) {
        moveToward(entity, target.position, construct.moveSpeed!, activeStep, entity.range);
      }
      const currentTarget = chooseBehaviorTarget(state, entity, construct);
      const canAct = currentTarget !== undefined && distance(entity, currentTarget.position) <= entity.range
        && entity.attackRemainingMs <= 0;
      if (canAct && construct.behavior === "attack" && currentTarget.entity?.kind === "enemy") {
        if (construct.attackMode === "contact") {
          applyContactDamage(state, entity, currentTarget.entity, emit);
          entity.attackRemainingMs = construct.attackIntervalMs;
        } else {
          const launched = spawnProjectiles(state, entity.sourceCharacterId ?? "", {
            itemId: entity.sourceItemId ?? "",
            definitionId: entity.definitionId,
            ...(entity.element ? { element: entity.element } : {}),
            power: entity.damage,
            range: entity.range,
            casts: 1,
            speed: construct.projectileSpeed ?? 72,
            impact: entity.impact,
            attackRoll: entity.attackRoll,
            onHit: entity.onHit,
            origin: { x: entity.x, y: entity.y },
            sourceEntityId: entity.id,
          }, emit);
          if (launched) entity.attackRemainingMs = construct.attackIntervalMs;
        }
      } else if (canAct && construct.behavior === "heal") {
        applyConstructHeal(state, entity, currentTarget, emit);
        entity.attackRemainingMs = construct.attackIntervalMs;
      } else if (canAct && construct.behavior === "shield") {
        applyConstructShield(state, entity, currentTarget, emit);
        entity.attackRemainingMs = construct.attackIntervalMs;
      }
      if (expiresThisSlice) expireConstruct(entity, removed, emit);
    }
  }
  if (removed.size) state.entities = state.entities.filter(entity => !removed.has(entity.id));
}

function chooseBehaviorTarget(
  state: GameState,
  source: CombatEntity,
  spec: ConstructSpec,
): { position: { x: number; y: number }; entity?: CombatEntity } | undefined {
  if (spec.behavior === "attack") {
    const target = nearbyEnemies(state, source.x, source.y, 200)[0];
    return target ? { position: { x: target.x, y: target.y }, entity: target } : undefined;
  }
  if (spec.behavior === "shield") {
    const maxShield = state.territory.maxShield;
    if (!Number.isFinite(maxShield) || (state.territory.shield ?? 0) >= maxShield!) return undefined;
    return { position: { x: 50, y: 92 } };
  }

  const hurtAllies = state.entities.filter(entity => isConstruct(entity) && entity.hp > 0 && entity.hp < entity.maxHp)
    .map(entity => ({ entity, position: { x: entity.x, y: entity.y }, distance: distance(source, entity) }))
    .filter(entry => entry.entity.id !== source.id)
    .sort((a, b) => a.distance - b.distance || a.entity.id.localeCompare(b.entity.id));
  const territoryNeedsHealing = state.territory.hp > 0 && state.territory.hp < state.territory.maxHp;
  const territory = territoryNeedsHealing
    ? { position: { x: 50, y: 92 }, distance: distance(source, { x: 50, y: 92 }) }
    : undefined;
  const ally = hurtAllies[0];
  if (ally && (!territory || ally.distance <= territory.distance)) {
    return { position: ally.position, entity: ally.entity };
  }
  return territory;
}

function applyConstructHeal(
  state: GameState,
  source: CombatEntity,
  target: { position: { x: number; y: number }; entity?: CombatEntity },
  emit: CombatEmit,
): void {
  const amount = finiteNonnegative(source.damage);
  if (amount <= 0) return;
  if (target.entity && target.entity.hp > 0 && target.entity.hp < target.entity.maxHp) {
    const healed = Math.min(amount, target.entity.maxHp - target.entity.hp);
    if (healed <= 0) return;
    target.entity.hp += healed;
    emit("heal", { targetId: target.entity.id, sourceEntityId: source.id,
      sourceCharacterId: source.sourceCharacterId, sourceItemId: source.sourceItemId,
      amount: healed, effect: source.definitionId, x: target.entity.x, y: target.entity.y });
    return;
  }
  const healed = Math.min(amount, Math.max(0, state.territory.maxHp - state.territory.hp));
  if (healed <= 0) return;
  state.territory.hp += healed;
  emit("heal", { targetId: "territory", sourceEntityId: source.id,
    sourceCharacterId: source.sourceCharacterId, sourceItemId: source.sourceItemId,
    amount: healed, effect: source.definitionId, x: target.position.x, y: target.position.y });
}

function applyConstructShield(
  state: GameState,
  source: CombatEntity,
  target: { position: { x: number; y: number } },
  emit: CombatEmit,
): void {
  const maxShield = state.territory.maxShield;
  const amount = finiteNonnegative(source.damage);
  if (!Number.isFinite(maxShield) || amount <= 0) return;
  const restored = Math.min(amount, Math.max(0, maxShield! - (state.territory.shield ?? 0)));
  if (restored <= 0) return;
  state.territory.shield = (state.territory.shield ?? 0) + restored;
  emit("shieldRestored", { targetId: "territory", sourceEntityId: source.id,
    sourceCharacterId: source.sourceCharacterId, sourceItemId: source.sourceItemId,
    amount: restored, effect: source.definitionId, x: target.position.x, y: target.position.y });
}

function initialPosition(
  state: GameState,
  characterId: string,
  spec: ConstructCastSpec,
  construct: ConstructSpec,
): { x: number; y: number } {
  const anchor = getCharacterAnchor(state.characters, characterId);
  if (!anchor || construct.placement !== "target") return anchor ?? { x: 50, y: 84 };
  const target = chooseBehaviorTarget(state, {
    id: "construct-placement-source", x: anchor.x, y: anchor.y, kind: spec.kind, faction: "player",
    definitionId: spec.definitionId, hp: 1, maxHp: 1, damage: 0, speed: 0, range: spec.range,
    cooldownMs: 0, attackRemainingMs: 0,
  }, construct);
  return target ? { x: clamp(target.position.x, 0, 100), y: clamp(target.position.y, 0, 100) } : anchor;
}

function ownsSpell(state: GameState, characterId: string, itemId: string, definitionId: string): boolean {
  const item = state.items[itemId];
  const character = state.characters.find(candidate => candidate.id === characterId);
  return item?.kind === "spell" && item.definitionId === definitionId && !!character
    && character.wandIds.some(wandId => {
      const wand = state.wands.find(candidate => candidate.id === wandId);
      return wand?.characterId === characterId && wand.placements.some(placement => placement.itemId === itemId);
    });
}

function isConstruct(entity: CombatEntity): boolean {
  return entity.faction === "player" && (entity.kind === "summon" || entity.kind === "building");
}

function isLiveConstruct(entity: CombatEntity): boolean {
  return isConstruct(entity) && entity.hp > 0 && (entity.remainingMs === undefined || entity.remainingMs > 0);
}

function sameConstructSource(entity: CombatEntity, characterId: string, itemId: string, definitionId: string): boolean {
  return entity.sourceCharacterId === characterId && entity.sourceItemId === itemId && entity.definitionId === definitionId;
}

function expireConstruct(entity: CombatEntity, removed: Set<string>, emit: CombatEmit): void {
  if (removed.has(entity.id)) return;
  removed.add(entity.id);
  emit("constructExpired", { entityId: entity.id, definitionId: entity.definitionId,
    kind: entity.kind, x: entity.x, y: entity.y, reason: "lifetime" });
}

function nextConstructId(state: GameState, index: number, created: CombatEntity[]): string {
  const base = `construct-${state.wave}-${state.nextEventSeq}-${index}`;
  let id = base;
  let suffix = 1;
  while (state.entities.some(entity => entity.id === id) || created.some(entity => entity.id === id)) id = `${base}-${suffix++}`;
  return id;
}

function validPosition(value: unknown): value is { x: number; y: number } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const position = value as { x?: unknown; y?: unknown };
  return typeof position.x === "number" && Number.isFinite(position.x) && position.x >= 0 && position.x <= 100
    && typeof position.y === "number" && Number.isFinite(position.y) && position.y >= 0 && position.y <= 100;
}

function moveToward(source: CombatEntity, target: { x: number; y: number }, speed: number, dtMs: number, range: number): void {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy);
  const step = Math.min(Math.max(0, length - range), speed * dtMs / 1_000);
  if (length <= 0 || step <= 0) return;
  source.x = clamp(source.x + dx / length * step, 0, 100);
  source.y = clamp(source.y + dy / length * step, 0, 100);
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function finite(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

function finiteNonnegative(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
