import type { AreaSpec, AttackRollStats, CombatEntity, Element, GameState, OnHitSpec, ProjectileImpact } from "../contracts";
import { getMonsterSize } from "../content/monsters";
import { getCharacterAnchors } from "../content/characterAnchors";
import { applyContactDamage, nearbyEnemies, type CombatEmit } from "./targets";
import { branchAngle, castPattern, type CastPattern } from "./castPattern";

export const AREA_LIMITS = Object.freeze({
  perCast: 8,
  alive: 32,
  maxTargets: 8,
  maxFieldTargets: 64,
  maxRadius: 100,
  maxDelayMs: 2_500,
  maxDurationMs: 2_000,
  maxFieldDurationMs: 5_000,
  maxVortexDurationMs: 5_000,
  maxTickMs: 5_000,
  minTickMs: 200,
  maxTotalLifetimeMs: 5_000,
});

export interface AreaCastSpec extends CastPattern {
  itemId: string;
  definitionId: string;
  element?: Element;
  power: number;
  range: number;
  burstCount?: number;
  splitCount?: number;
  area: AreaSpec;
  attackRoll?: AttackRollStats;
  onHit?: OnHitSpec;
  /** A paid trigger materializes at this exact point even when there is no nearby target. */
  position?: { x: number; y: number };
  maxCasts?: number;
}

type Point = { x: number; y: number };
type AreaEntity = CombatEntity & { kind: "area"; area: AreaSpec };
type ProjectileField = Extract<ProjectileImpact, { type: "field" }>;
const finite = (value: number | undefined, fallback: number): number =>
  value !== undefined && Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

/** Creates the persistent field left by a field-impact projectile without direct contact damage. */
export function spawnProjectileField(
  state: GameState,
  source: CombatEntity,
  point: Point,
  impact: ProjectileField,
  emit: CombatEmit,
): boolean {
  if (activeAreaCount(state) >= AREA_LIMITS.alive) return false;
  const id = nextAreaId(state);
  const tickMs = clamp(finite(impact.tickMs, 400), AREA_LIMITS.minTickMs, AREA_LIMITS.maxTickMs);
  const durationMs = clamp(finite(impact.durationMs, 400), 1, AREA_LIMITS.maxFieldDurationMs);
  const area: AreaSpec = {
    mode: "field",
    radius: clamp(finite(impact.radius, 0), 0, AREA_LIMITS.maxRadius),
    delayMs: 0,
    durationMs,
    maxTargets: Math.floor(clamp(finite(impact.maxTargets, 1), 1, AREA_LIMITS.maxTargets)),
    tickMs,
    anchor: "target",
  };
  const field: AreaEntity = {
    id,
    definitionId: source.definitionId,
    ...(source.element ? { element: source.element } : {}),
    kind: "area",
    faction: "player",
    x: point.x,
    y: point.y,
    hp: 1,
    maxHp: 1,
    damage: Math.max(0, finite(source.damage, 0)),
    speed: 0,
    range: area.radius,
    cooldownMs: tickMs,
    attackRemainingMs: tickMs,
    remainingMs: durationMs,
    area,
    hitIds: [],
    attackRoll: source.attackRoll ? { ...source.attackRoll } : undefined,
    ...(source.onHit ? { onHit: structuredClone(source.onHit) } : {}),
    sourceCharacterId: source.sourceCharacterId,
    sourceItemId: source.sourceItemId,
    originX: point.x,
    originY: point.y,
    launchDelayMs: 0,
  };
  state.entities.push(field);
  emitAreaSpawned(field, emit);
  return true;
}

/** Creates delayed, ground-targeted area entities; damage is only applied by advanceAreaEffects. */
export function spawnAreaEffects(
  state: GameState,
  characterId: string,
  spec: AreaCastSpec,
  emit: CombatEmit,
): boolean {
  if (state.phase !== "battle" || state.paused || state.backpackOpen) return false;
  const area = normalizeArea(spec.area);
  if (!area) return false;

  const castRange = Math.max(0, finite(spec.range, 0));
  const effectRange = area.mode === "ring" ? clamp(castRange, 0, AREA_LIMITS.maxRadius) : castRange;
  if (spec.position && (![spec.position.x, spec.position.y].every(Number.isFinite)
    || spec.position.x < 0 || spec.position.x > 100 || spec.position.y < 0 || spec.position.y > 100)) return false;
  const origin = spec.position ?? getCharacterAnchors(state.characters).find(anchor => anchor.characterId === characterId);
  if (!origin) return false;
  const groundTargets = area.mode === "strike" || area.mode === "eruption"
    || (area.mode === "field" && area.anchor === "target")
    ? nearbyEnemies(state, origin.x, origin.y, castRange) : [];
  const ringTarget = area.mode === "ring" ? findRingTarget(state, origin, effectRange) : undefined;
  let center: Point | undefined;
  let initialTarget: CombatEntity | undefined;
  if (area.mode === "strike" || area.mode === "eruption") {
    initialTarget = groundTargets[0];
    if (initialTarget) center = { x: initialTarget.x, y: initialTarget.y };
  } else if (area.mode === "ring" || area.mode === "vortex") {
    center = origin;
    initialTarget = area.mode === "ring" ? ringTarget
      : findAreaTarget(state, origin, Math.max(area.radius, area.pullRadius ?? 12));
  } else if (area.mode === "field") {
    if (area.anchor === "field") {
      center = { x: 50, y: 50 };
      initialTarget = findAreaTarget(state, center, area.radius, true);
    } else if (area.anchor === "caster") {
      center = origin;
      initialTarget = findAreaTarget(state, center, area.radius);
    } else {
      initialTarget = groundTargets[0];
      if (initialTarget) center = { x: initialTarget.x, y: initialTarget.y };
    }
  }
  if (spec.position) center = { ...spec.position };
  if (!initialTarget && !spec.position) return false;

  const alive = state.entities.filter(entity => entity.kind === "area" && entity.hp > 0
    && (entity.remainingMs === undefined || entity.remainingMs > 0)).length;
  const available = Math.max(0, AREA_LIMITS.alive - alive);
  if (available === 0) return false;
  const requestedLimit = Number.isFinite(spec.maxCasts) ? Math.max(0, Math.floor(spec.maxCasts!)) : AREA_LIMITS.perCast;
  const budget = Math.min(AREA_LIMITS.perCast, available, requestedLimit);
  const casts = castPattern(spec, budget);
  const pattern = area.mode === "strike" && area.shower
    ? casts.flatMap(cast => Array.from({ length: area.shower!.count }, (_, impact) => ({
      ...cast, delay: cast.delay + impact * area.shower!.intervalMs, impact,
    }))).slice(0, budget)
    : casts.map(cast => ({ ...cast, impact: 0 }));
  if (pattern.length === 0) return false;

  const damage = Math.max(0, finite(spec.power, 0));
  const usedIds = new Set(state.entities.map(entity => entity.id));
  for (let index = 0; index < pattern.length; index++) {
    const branch = pattern[index].branch;
    const target = area.mode === "ring" ? ringTarget
      : area.mode === "strike" || area.mode === "eruption" ? groundTargets[(branch + pattern[index].impact) % groundTargets.length]
      : initialTarget;
    let branchCenter = !spec.position && center && (area.mode === "strike" || area.mode === "eruption") && target
      ? groundPoint(target, branch, pattern[index].branches, groundTargets.length, area.radius)
      : center!;
    if (area.mode === "strike" && area.shower && pattern[index].impact > 0 && groundTargets.length === 1) {
      const angle = pattern[index].impact * 2.399963229728653;
      const distance = area.shower.spread * Math.sqrt(pattern[index].impact / area.shower.count);
      branchCenter = { x: clamp(branchCenter.x + Math.cos(angle) * distance, 0, 100), y: clamp(branchCenter.y + Math.sin(angle) * distance, 0, 100) };
    }
    const delayMs = Math.min(AREA_LIMITS.maxTotalLifetimeMs - 1, area.delayMs + pattern[index].delay);
    const requestedDuration = area.durationMs * (area.mode === "ring" ? 1 + branch * 0.15 : 1);
    const durationLimit = area.mode === "vortex" ? AREA_LIMITS.maxVortexDurationMs
      : area.mode === "field" ? AREA_LIMITS.maxFieldDurationMs : AREA_LIMITS.maxDurationMs;
    const durationMs = Math.max(1, Math.min(durationLimit, requestedDuration, AREA_LIMITS.maxTotalLifetimeMs - delayMs));
    const resolvedArea: AreaSpec = {
      ...area,
      radius: area.mode === "ring" ? effectRange : area.radius,
      delayMs,
      durationMs,
    };
    const baseId = `area-${state.wave}-${state.nextEventSeq}-${index}`;
    let id = baseId;
    let suffix = 1;
    while (usedIds.has(id)) id = `${baseId}-${suffix++}`;
    usedIds.add(id);

    const effect: AreaEntity = {
      id,
      definitionId: spec.definitionId,
      ...(spec.element ? { element: spec.element } : {}),
      kind: "area",
      faction: "player",
      x: branchCenter.x,
      y: branchCenter.y,
      hp: 1,
      maxHp: 1,
      damage,
      speed: 0,
      range: area.mode === "ring" ? effectRange
        : area.mode === "field" || area.mode === "vortex" ? area.radius : castRange,
      cooldownMs: area.tickMs ?? 0,
      attackRemainingMs: area.mode === "field" || area.mode === "vortex" ? area.tickMs ?? 400 : 0,
      remainingMs: durationMs,
      area: resolvedArea,
      hitIds: [],
      attackRoll: spec.attackRoll ? { ...spec.attackRoll } : undefined,
      ...(spec.onHit ? { onHit: structuredClone(spec.onHit) } : {}),
      sourceCharacterId: characterId,
      sourceItemId: spec.itemId,
      launchDelayMs: delayMs,
      splitBranchIndex: branch,
      splitBranchCount: pattern[index].branches,
      ...(area.mode === "vortex" ? { originX: origin.x, originY: origin.y, ...firstWaypoint() } : {}),
    };
    state.entities.push(effect);
    emitAreaSpawned(effect, emit);
  }

  emit("spellCast", {
    sourceCharacterId: characterId,
    sourceItemId: spec.itemId,
    definitionId: spec.definitionId,
    casts: pattern.length,
    ...(initialTarget ? { targetId: initialTarget.id } : {}),
  });
  return true;
}

/** Advances persistent area visuals and resolves contacts once per target. */
export function advanceAreaEffects(
  state: GameState,
  dtMs: number,
  emit: CombatEmit,
  candidates: readonly CombatEntity[] = state.entities,
): void {
  if (state.phase !== "battle" || state.paused || state.backpackOpen || !Number.isFinite(dtMs) || dtMs <= 0) return;

  for (const entity of candidates) {
    if (entity.kind !== "area" || entity.hp <= 0) continue;
    const area = entity.area;
    if (!area || !Number.isFinite(entity.x) || !Number.isFinite(entity.y)
        || !Number.isFinite(entity.remainingMs) || entity.remainingMs! <= 0) {
      entity.hp = 0;
      entity.remainingMs = 0;
      continue;
    }

    let slice = dtMs;
    if (entity.launchDelayMs !== undefined) {
      const waiting = Math.min(slice, Math.max(0, finite(entity.launchDelayMs, 0)));
      entity.launchDelayMs = Math.max(0, finite(entity.launchDelayMs, 0) - waiting);
      slice -= waiting;
      if (entity.launchDelayMs > 0) continue;
      delete entity.launchDelayMs;
      emit("areaActivated", {
        entityId: entity.id,
        definitionId: entity.definitionId,
        sourceCharacterId: entity.sourceCharacterId,
        sourceItemId: entity.sourceItemId,
        x: entity.x,
        y: entity.y,
        mode: area.mode,
        radius: area.radius,
        range: entity.range,
        durationMs: area.durationMs,
        splitBranchIndex: entity.splitBranchIndex,
        splitBranchCount: entity.splitBranchCount,
      });
      if (area.mode === "strike" || area.mode === "eruption") resolveGroundArea(state, entity as AreaEntity, emit);
    }

    const duration = Math.max(1, finite(area.durationMs, 1));
    const before = Math.min(duration, Math.max(0, entity.remainingMs!));
    const elapsedBefore = duration - before;
    const activeMs = Math.min(slice, before);
    const after = before - activeMs;
    entity.remainingMs = after;

    if (area.mode === "ring" && activeMs > 0) {
      const previousRadius = entity.range * elapsedBefore / duration;
      const nextRadius = entity.range * (duration - after) / duration;
      resolveRingSweep(state, entity as AreaEntity, previousRadius, nextRadius, emit);
    }
    if (area.mode === "field" && activeMs > 0) advancePulsingArea(state, entity as AreaEntity, activeMs, emit, false);
    if (area.mode === "vortex" && activeMs > 0) advancePulsingArea(state, entity as AreaEntity, activeMs, emit, true);
    if (after <= 0) {
      entity.hp = 0;
      entity.remainingMs = 0;
    }
  }
}

function normalizeArea(area: AreaSpec): AreaSpec | undefined {
  if (area.mode !== "strike" && area.mode !== "ring" && area.mode !== "eruption"
      && area.mode !== "field" && area.mode !== "vortex") return undefined;
  const anchor = area.mode === "field"
    ? area.anchor === "field" ? "field" : area.anchor === "caster" ? "caster" : "target"
    : area.mode === "vortex" ? "caster" : area.anchor;
  const maxTargets = Math.floor(clamp(finite(area.maxTargets, 1), 1,
    area.mode === "field" && anchor === "field" ? AREA_LIMITS.maxFieldTargets : AREA_LIMITS.maxTargets));
  const durationLimit = area.mode === "vortex" ? AREA_LIMITS.maxVortexDurationMs
    : area.mode === "field" ? AREA_LIMITS.maxFieldDurationMs : AREA_LIMITS.maxDurationMs;
  const normalized: AreaSpec = {
    mode: area.mode,
    radius: clamp(finite(area.radius, 0), 0, AREA_LIMITS.maxRadius),
    delayMs: clamp(finite(area.delayMs, 0), 0, AREA_LIMITS.maxDelayMs),
    durationMs: clamp(finite(area.durationMs, 100), 1, durationLimit),
    maxTargets,
  };
  if (area.mode === "strike" && area.shower) normalized.shower = {
    count: Math.floor(clamp(finite(area.shower.count, 1), 1, AREA_LIMITS.perCast)),
    intervalMs: clamp(finite(area.shower.intervalMs, 250), 0, 1000),
    spread: clamp(finite(area.shower.spread, 0), 0, AREA_LIMITS.maxRadius),
  };
  if (area.mode === "field" || area.mode === "vortex") {
    normalized.tickMs = clamp(finite(area.tickMs, 400), AREA_LIMITS.minTickMs, AREA_LIMITS.maxTickMs);
    normalized.anchor = anchor;
  }
  if (area.mode === "vortex") {
    normalized.moveSpeed = clamp(finite(area.moveSpeed, 12), 0, 100);
    normalized.pullRadius = clamp(finite(area.pullRadius, 12), 0, AREA_LIMITS.maxRadius);
    normalized.pullStrength = clamp(finite(area.pullStrength, 8), 0, 100);
  }
  return normalized;
}

function groundPoint(target: CombatEntity, branch: number, branches: number, targetCount: number, radius: number): Point {
  if (branches <= 1 || targetCount > 1) return { x: target.x, y: target.y };
  const offset = Math.min(1.5, Math.max(0.25, radius * 0.2));
  const angle = branchAngle(branch, branches, Math.PI / 4);
  return { x: target.x + Math.cos(angle) * offset, y: target.y + Math.sin(angle) * offset };
}

function findRingTarget(state: GameState, origin: Point, range: number): CombatEntity | undefined {
  return state.entities.filter(entity => entity.kind === "enemy" && entity.faction === "enemy" && entity.hp > 0
    && Number.isFinite(entity.x) && Number.isFinite(entity.y))
    .map(entity => ({ entity, distance: Math.hypot(entity.x - origin.x, entity.y - origin.y) }))
    .filter(entry => entry.distance <= range + getMonsterSize(entry.entity).hitRadius)
    .sort((left, right) => left.distance - right.distance || left.entity.id.localeCompare(right.entity.id))[0]?.entity;
}

function findAreaTarget(state: GameState, center: Point, radius: number, strictBounds = false): CombatEntity | undefined {
  return state.entities.filter(entity => entity.kind === "enemy" && entity.faction === "enemy" && entity.hp > 0
    && Number.isFinite(entity.x) && Number.isFinite(entity.y)
    && (!strictBounds || isInsideField(entity)))
    .map(entity => ({ entity, distance: Math.hypot(entity.x - center.x, entity.y - center.y) }))
    .filter(entry => entry.distance <= radius + getMonsterSize(entry.entity).hitRadius)
    .sort((left, right) => left.distance - right.distance || left.entity.id.localeCompare(right.entity.id))[0]?.entity;
}

function firstWaypoint(): Pick<CombatEntity, "targetX" | "targetY"> {
  const first = vortexWaypoints()[0];
  return { targetX: first.x, targetY: first.y };
}

function vortexWaypoints(): Point[] {
  return [
    { x: 15, y: 20 },
    { x: 85, y: 20 },
    { x: 85, y: 80 },
    { x: 15, y: 80 },
  ];
}

function advanceVortexWaypoint(area: AreaEntity): void {
  const points = vortexWaypoints();
  const current = points.findIndex(point => Math.hypot(point.x - (area.targetX ?? Infinity), point.y - (area.targetY ?? Infinity)) < 1e-7);
  const next = points[(current < 0 ? 0 : current + 1) % points.length];
  area.targetX = next.x;
  area.targetY = next.y;
}

function advancePulsingArea(state: GameState, area: AreaEntity, activeMs: number, emit: CombatEmit, vortex: boolean): void {
  const tickMs = clamp(finite(area.area.tickMs, 400), AREA_LIMITS.minTickMs, AREA_LIMITS.maxTickMs);
  let left = activeMs;
  while (left > 0) {
    const untilPulse = Math.max(1, finite(area.attackRemainingMs, tickMs));
    const step = Math.min(50, left, untilPulse);
    if (vortex) {
      moveVortex(area, step);
      pullEnemies(state, area, step);
    }
    area.attackRemainingMs = untilPulse - step;
    left -= step;
    if (area.attackRemainingMs <= 1e-8) {
      pulseArea(state, area, emit);
      area.attackRemainingMs += tickMs;
    }
  }
}

function moveVortex(area: AreaEntity, dtMs: number): void {
  const speed = Math.max(0, finite(area.area.moveSpeed, 12));
  let distanceLeft = speed * dtMs / 1_000;
  for (let turn = 0; turn < 16 && distanceLeft > 1e-8; turn++) {
    if (!Number.isFinite(area.targetX) || !Number.isFinite(area.targetY)) advanceVortexWaypoint(area);
    const dx = area.targetX! - area.x;
    const dy = area.targetY! - area.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 1e-8) {
      advanceVortexWaypoint(area);
      continue;
    }
    const moved = Math.min(distance, distanceLeft);
    area.x += dx / distance * moved;
    area.y += dy / distance * moved;
    distanceLeft -= moved;
    if (distance <= moved + 1e-8) {
      area.x = area.targetX!;
      area.y = area.targetY!;
      advanceVortexWaypoint(area);
    }
  }
}

function pullEnemies(state: GameState, area: AreaEntity, dtMs: number): void {
  const radius = Math.max(0, finite(area.area.pullRadius, 12));
  const strength = Math.max(0, finite(area.area.pullStrength, 8));
  const maxPull = strength * dtMs / 1_000;
  if (maxPull <= 0) return;
  for (const enemy of state.entities) {
    if (enemy.kind !== "enemy" || enemy.faction !== "enemy" || enemy.hp <= 0
        || !Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) continue;
    const dx = area.x - enemy.x;
    const dy = area.y - enemy.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 1e-8 || distance > radius) continue;
    const moved = Math.min(distance, maxPull);
    enemy.x += dx / distance * moved;
    enemy.y += dy / distance * moved;
  }
}

function pulseArea(state: GameState, area: AreaEntity, emit: CombatEmit): void {
  const strictBounds = area.area.mode === "field" && area.area.anchor === "field";
  const targets = state.entities.filter(entity => entity.kind === "enemy" && entity.faction === "enemy" && entity.hp > 0
    && Number.isFinite(entity.x) && Number.isFinite(entity.y)
    && (!strictBounds || isInsideField(entity)))
    .map(entity => ({ entity, distance: Math.hypot(entity.x - area.x, entity.y - area.y) }))
    .filter(entry => entry.distance <= area.area.radius + (area.area.mode === "vortex" || area.area.mode === "field"
      ? getMonsterSize(entry.entity).hitRadius : 0))
    .sort((left, right) => left.distance - right.distance || left.entity.id.localeCompare(right.entity.id))
    .slice(0, area.area.maxTargets);
  for (const { entity: target } of targets) applyContactDamage(state, area, target, emit);
}

function isInsideField(entity: CombatEntity): boolean {
  return entity.x >= 0 && entity.x <= 100 && entity.y >= 0 && entity.y <= 100;
}

function activeAreaCount(state: GameState): number {
  return state.entities.filter(entity => entity.kind === "area" && entity.hp > 0
    && (entity.remainingMs === undefined || entity.remainingMs > 0)).length;
}

function nextAreaId(state: GameState): string {
  const usedIds = new Set(state.entities.map(entity => entity.id));
  const base = `area-${state.wave}-${state.nextEventSeq}`;
  let id = base;
  let suffix = 1;
  while (usedIds.has(id)) id = `${base}-${suffix++}`;
  return id;
}

function emitAreaSpawned(area: AreaEntity, emit: CombatEmit): void {
  emit("areaSpawned", {
    entityId: area.id,
    definitionId: area.definitionId,
    sourceCharacterId: area.sourceCharacterId,
    sourceItemId: area.sourceItemId,
    x: area.x,
    y: area.y,
    mode: area.area.mode,
    radius: area.area.radius,
    range: area.range,
    delayMs: area.area.delayMs,
    durationMs: area.area.durationMs,
    tickMs: area.area.tickMs,
    anchor: area.area.anchor,
    targetX: area.targetX,
    targetY: area.targetY,
    splitBranchIndex: area.splitBranchIndex,
    splitBranchCount: area.splitBranchCount,
  });
}

function resolveGroundArea(state: GameState, area: AreaEntity, emit: CombatEmit): void {
  const hitIds = new Set(area.hitIds ?? []);
  const remainingTargets = Math.max(0, area.area.maxTargets - hitIds.size);
  if (remainingTargets === 0) return;
  const targets = state.entities.filter(entity => entity.kind === "enemy" && entity.faction === "enemy"
    && entity.hp > 0 && !hitIds.has(entity.id) && Number.isFinite(entity.x) && Number.isFinite(entity.y))
    .map(entity => ({ entity, distance: Math.hypot(entity.x - area.x, entity.y - area.y) }))
    .filter(entry => entry.distance <= area.area.radius + getMonsterSize(entry.entity).hitRadius)
    .sort((left, right) => left.distance - right.distance || left.entity.id.localeCompare(right.entity.id))
    .slice(0, remainingTargets);
  for (const { entity: target } of targets) {
    hitIds.add(target.id);
    applyContactDamage(state, area, target, emit);
  }
  area.hitIds = [...hitIds];
}

function resolveRingSweep(state: GameState, area: AreaEntity, fromRadius: number, toRadius: number, emit: CombatEmit): void {
  const hitIds = new Set(area.hitIds ?? []);
  const remainingTargets = Math.max(0, area.area.maxTargets - hitIds.size);
  if (remainingTargets === 0) return;
  const targets = state.entities.filter(entity => entity.kind === "enemy" && entity.faction === "enemy"
    && entity.hp > 0 && !hitIds.has(entity.id) && Number.isFinite(entity.x) && Number.isFinite(entity.y))
    .map(entity => ({ entity, distance: Math.hypot(entity.x - area.x, entity.y - area.y) }))
    .filter(entry => {
      const bodyRadius = getMonsterSize(entry.entity).hitRadius;
      return entry.distance + bodyRadius >= Math.max(0, fromRadius)
        && entry.distance - bodyRadius <= toRadius;
    })
    .sort((left, right) => left.distance - right.distance || left.entity.id.localeCompare(right.entity.id))
    .slice(0, remainingTargets);
  for (const { entity: target } of targets) {
    hitIds.add(target.id);
    applyContactDamage(state, area, target, emit);
  }
  area.hitIds = [...hitIds];
}
