import type { AttackRollStats, CombatEntity, Element, GameState, OnHitSpec, ProjectileImpact } from "../contracts";
import { getCharacterAnchors } from "../content/characterAnchors";
import { castPattern, type CastPattern } from "./castPattern";
import { applyContactDamage, nearbyEnemies, type CombatEmit } from "./targets";

export interface ChainCastSpec extends CastPattern {
  itemId: string;
  definitionId: string;
  element?: Element;
  power: number;
  range: number;
  impact: Extract<ProjectileImpact, { type: "chain" }>;
  attackRoll?: AttackRollStats;
  onHit?: OnHitSpec;
}

export const CHAIN_LIMITS = Object.freeze({
  maxTargets: 8,
  alive: 32,
  perCast: 8,
  maxLifetimeMs: 2_500,
  hopIntervalMs: 80,
  maxRadius: 100,
});

const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function isBattleActive(state: GameState): boolean {
  return state.phase === "battle" && !state.paused && !state.backpackOpen;
}

function liveChains(state: GameState): number {
  return state.entities.filter(entity => entity.kind === "chain" && entity.hp > 0
    && (entity.remainingMs ?? 0) > 0).length;
}

function targetAtBranch(state: GameState, chain: CombatEntity, origin: { x: number; y: number }): CombatEntity | undefined {
  const targets = nearbyEnemies(state, origin.x, origin.y, chain.range);
  if (targets.length === 0) return undefined;
  const branch = Math.max(0, Math.floor(finite(chain.splitBranchIndex ?? 0, 0)));
  return targets[branch % targets.length];
}

function expire(chain: CombatEntity): void {
  chain.hp = 0;
  chain.remainingMs = 0;
}

function hitTarget(state: GameState, chain: CombatEntity, target: CombatEntity, emit: CombatEmit): boolean {
  if (target.kind !== "enemy" || target.faction !== "enemy" || target.hp <= 0) return false;
  const hitIds = new Set(chain.hitIds ?? []);
  if (hitIds.has(target.id) || (chain.remainingImpacts ?? 0) <= 0) return false;

  const fromX = chain.x;
  const fromY = chain.y;
  const distance = Math.hypot(target.x - fromX, target.y - fromY);
  chain.headingX = distance > 0 ? (target.x - fromX) / distance : 0;
  chain.headingY = distance > 0 ? (target.y - fromY) / distance : 0;
  chain.x = target.x;
  chain.y = target.y;
  chain.targetId = target.id;
  chain.targetX = target.x;
  chain.targetY = target.y;
  hitIds.add(target.id);
  chain.hitIds = [...hitIds];
  chain.remainingImpacts = Math.max(0, (chain.remainingImpacts ?? 1) - 1);

  emit("chainArc", {
    chainId: chain.id,
    sourceCharacterId: chain.sourceCharacterId,
    sourceItemId: chain.sourceItemId,
    definitionId: chain.definitionId,
    x: fromX,
    y: fromY,
    targetX: target.x,
    targetY: target.y,
    targetId: target.id,
  });
  applyContactDamage(state, chain, target, emit);
  if (chain.impact?.type === "chain" && (chain.impact.blastRadius ?? 0) > 0) {
    const radius = clamp(finite(chain.impact.blastRadius!, 0), 0, CHAIN_LIMITS.maxRadius);
    const limit = clamp(Math.floor(finite(chain.impact.blastMaxTargets ?? 1, 1)), 1, 4);
    emit("chainBlast", { chainId: chain.id, definitionId: chain.definitionId,
      sourceCharacterId: chain.sourceCharacterId, sourceItemId: chain.sourceItemId, x: target.x, y: target.y, radius });
    for (const neighbor of nearbyEnemies(state, target.x, target.y, radius, new Set([target.id])).slice(0, limit)) {
      applyContactDamage(state, chain, neighbor, emit);
    }
  }

  const falloff = chain.impact?.type === "chain" ? chain.impact.falloff : 1;
  chain.damage = Math.max(0, finite(chain.damage, 0) * clamp(finite(falloff, 1), 0, 1));
  if (chain.impact?.type === "chain") chain.range = chain.impact.radius;
  chain.attackRemainingMs = CHAIN_LIMITS.hopIntervalMs;
  if (chain.remainingImpacts <= 0) expire(chain);
  return true;
}

function launchFirst(state: GameState, chain: CombatEntity, origin: { x: number; y: number }, emit: CombatEmit): boolean {
  const target = targetAtBranch(state, chain, origin);
  if (!target) {
    expire(chain);
    return false;
  }
  chain.x = origin.x;
  chain.y = origin.y;
  chain.originX = origin.x;
  chain.originY = origin.y;
  return hitTarget(state, chain, target, emit);
}

/** Starts one immediate chain cast. The caller owns mana and cooldown accounting. */
export function spawnChains(
  state: GameState,
  characterId: string,
  spec: ChainCastSpec,
  emit: CombatEmit,
): boolean {
  if (!isBattleActive(state) || spec.impact?.type !== "chain") return false;
  const origin = getCharacterAnchors(state.characters).find(anchor => anchor.characterId === characterId);
  if (!origin) return false;
  const range = Math.max(0, finite(spec.range, 0));
  const radius = clamp(finite(spec.impact?.radius ?? 0, 0), 0, CHAIN_LIMITS.maxRadius);
  const maxTargets = clamp(Math.floor(finite(spec.impact?.maxTargets ?? 1, 1)), 1, CHAIN_LIMITS.maxTargets);
  const falloff = clamp(finite(spec.impact?.falloff ?? 1, 1), 0, 1);
  const firstTargets = nearbyEnemies(state, origin.x, origin.y, range);
  if (firstTargets.length === 0) return false;

  const available = Math.max(0, Math.min(CHAIN_LIMITS.perCast, CHAIN_LIMITS.alive - liveChains(state)));
  if (available <= 0) return false;
  const pattern = castPattern(spec, available);
  if (pattern.length === 0) return false;

  const usedIds = new Set(state.entities.map(entity => entity.id));
  let casts = 0;
  let firstTargetId: string | undefined;
  for (let i = 0; i < pattern.length; i++) {
    const instruction = pattern[i];
    const baseId = `chain-${state.wave}-${state.nextEventSeq}-${i}`;
    let id = baseId;
    let suffix = 1;
    while (usedIds.has(id)) id = `${baseId}-${suffix++}`;
    usedIds.add(id);
    const chain: CombatEntity = {
      id,
      definitionId: spec.definitionId,
      ...(spec.element ? { element: spec.element } : {}),
      kind: "chain",
      faction: "player",
      x: origin.x,
      y: origin.y,
      hp: 1,
      maxHp: 1,
      damage: Math.max(0, finite(spec.power, 0)),
      speed: 0,
      range,
      impact: { type: "chain", radius, maxTargets, falloff,
        ...(spec.impact.blastRadius !== undefined ? { blastRadius: clamp(finite(spec.impact.blastRadius, 0), 0, CHAIN_LIMITS.maxRadius) } : {}),
        ...(spec.impact.blastMaxTargets !== undefined ? { blastMaxTargets: clamp(Math.floor(finite(spec.impact.blastMaxTargets, 1)), 1, 4) } : {}) },
      hitIds: [],
      remainingImpacts: maxTargets,
      cooldownMs: CHAIN_LIMITS.hopIntervalMs,
      attackRemainingMs: 0,
      remainingMs: CHAIN_LIMITS.maxLifetimeMs,
      sourceCharacterId: characterId,
      sourceItemId: spec.itemId,
      originX: origin.x,
      originY: origin.y,
      launchDelayMs: instruction.delay,
      splitBranchIndex: instruction.branch,
      splitBranchCount: instruction.branches,
      attackRoll: spec.attackRoll ? { ...spec.attackRoll } : undefined,
      ...(spec.onHit ? { onHit: structuredClone(spec.onHit) } : {}),
    };
    state.entities.push(chain);
    if (instruction.delay > 0) {
      casts++;
      continue;
    }
    if (launchFirst(state, chain, origin, emit)) {
      casts++;
      firstTargetId ??= chain.targetId;
    }
  }

  if (casts === 0) return false;
  emit("spellCast", {
    sourceCharacterId: characterId,
    sourceItemId: spec.itemId,
    definitionId: spec.definitionId,
    casts,
    targetId: firstTargetId ?? firstTargets[0].id,
  });
  return true;
}

function advanceOneChain(state: GameState, chain: CombatEntity, dtMs: number, emit: CombatEmit): void {
  const life = Math.min(CHAIN_LIMITS.maxLifetimeMs, Math.max(0, finite(chain.remainingMs ?? 0, 0)));
  const activeDt = Math.min(dtMs, life);
  let timeLeft = activeDt;

  if ((chain.launchDelayMs ?? 0) > 0) {
    const delay = Math.max(0, finite(chain.launchDelayMs ?? 0, 0));
    const wait = Math.min(timeLeft, delay);
    chain.launchDelayMs = delay - wait;
    timeLeft -= wait;
    if (chain.launchDelayMs > 0) {
      if (chain.hp > 0) {
        chain.remainingMs = life - activeDt;
        if (chain.remainingMs <= 0) expire(chain);
      }
      return;
    }
    const origin = { x: chain.originX ?? chain.x, y: chain.originY ?? chain.y };
    if (!launchFirst(state, chain, origin, emit)) {
      if (chain.hp > 0) chain.remainingMs = life - activeDt;
      return;
    }
  }

  let hops = 0;
  while (chain.hp > 0 && chain.remainingImpacts !== undefined && chain.remainingImpacts > 0 && hops < CHAIN_LIMITS.maxTargets) {
    const wait = Math.max(0, finite(chain.attackRemainingMs, 0));
    if (wait > timeLeft) {
      chain.attackRemainingMs = wait - timeLeft;
      timeLeft = 0;
      break;
    }
    timeLeft -= wait;
    const hitIds = new Set(chain.hitIds ?? []);
    const target = nearbyEnemies(state, chain.x, chain.y, chain.range, hitIds)[0];
    if (!target || !hitTarget(state, chain, target, emit)) {
      expire(chain);
      break;
    }
    hops++;
    if (timeLeft <= 0) break;
  }

  if (chain.hp > 0) {
    chain.remainingMs = life - activeDt;
    if (chain.remainingMs <= 0) expire(chain);
  }
}

/** Advances delayed bursts and jumps using only simulation time. */
export function advanceChains(state: GameState, dtMs: number, emit: CombatEmit): void {
  const dt = Math.max(0, finite(dtMs, 0));
  if (!isBattleActive(state) || dt <= 0) return;
  const active = state.entities.filter(entity => entity.kind === "chain" && entity.hp > 0
    && (entity.remainingMs ?? 0) > 0);
  for (const chain of active) advanceOneChain(state, chain, dt, emit);
}
