import type {
  CombatEntity,
  ContentCatalog,
  GameState,
  GearDefinition,
  Grade,
  GroundLoot,
  SupplyDefinition,
} from '../contracts';
import { createGearFromDefinition } from '../content/gear';
import { gradeOrder, gradePower } from '../content/grades';
import { createSupplyFromDefinition } from '../content/supplies';
import { nextCombatRandom } from './random';
import { createWandFromTemplate } from '../content/wands';

const GEAR_BASE_CHANCE = 0.08;
const SUPPLY_CHANCE = 0.04;
const WAND_MIN_WAVE = 8;
const WAND_CHANCE = 0.005;
const BOSS_WAND_CHANCE = 0.03;
const MAX_GEAR_CHANCE = 0.3;
const GRADE_WEIGHTS: Record<Grade, number> = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 0.8,
  mythic: 0.2,
};
const MINIMUM_BOSS_GRADE: Record<string, Grade> = {
  'boss-minor': 'rare',
  'boss-major': 'epic',
  'boss-apex': 'legendary',
};
const GEAR_SLOTS = ['head', 'body', 'feet', 'accessory'] as const;
const SUPPLY_EFFECTS = ['territoryHeal', 'territoryShield', 'partyMana', 'territoryRestore',
  'partyManaPercent', 'cooldownAdvance', 'territoryHealPercent', 'territoryShieldPercent'] as const;

function isGrade(value: unknown): value is Grade {
  return typeof value === 'string' && gradeOrder.includes(value as Grade) && Number.isFinite(gradePower[value as Grade]);
}

function validShape(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0
    && value.every(cell => cell !== null && typeof cell === 'object'
      && Number.isFinite(cell.x) && Number.isFinite(cell.y));
}

function validSingleOriginGearShape(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== 1) return false;
  const cell = value[0];
  return cell !== null && typeof cell === 'object'
    && Number.isSafeInteger(cell.x) && cell.x === 0
    && Number.isSafeInteger(cell.y) && cell.y === 0;
}

function validAsset(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const asset = value as Record<string, unknown>;
  return typeof asset.key === 'string' && asset.key.length > 0 && typeof asset.label === 'string';
}

function gearDefinitions(catalog: ContentCatalog): Array<[string, GearDefinition]> {
  const source = catalog.gear;
  if (!source || typeof source !== 'object') return [];
  return Object.keys(source).flatMap(id => {
    if (!Object.hasOwn(source, id)) return [];
    const definition = source[id];
    if (!definition || definition.id !== id || typeof definition.name !== 'string'
        || !GEAR_SLOTS.includes(definition.slot) || !Number.isSafeInteger(definition.level) || definition.level < 1
        || !isGrade(definition.grade) || !validSingleOriginGearShape(definition.shape) || !validAsset(definition.asset)
        || !definition.statBonuses || typeof definition.statBonuses !== 'object') return [];
    return [[id, definition]];
  });
}

function supplyDefinitions(catalog: ContentCatalog): Array<[string, SupplyDefinition]> {
  const source = catalog.items;
  if (!source || typeof source !== 'object') return [];
  return Object.keys(source).flatMap(id => {
    if (!Object.hasOwn(source, id)) return [];
    const definition = source[id];
    if (!definition || definition.id !== id || typeof definition.name !== 'string'
        || !Number.isSafeInteger(definition.level) || definition.level < 1
        || !isGrade(definition.grade) || !validShape(definition.shape) || !validAsset(definition.asset)
        || !definition.effect || !SUPPLY_EFFECTS.includes(definition.effect.type)
        || !Number.isFinite(definition.effect.value) || definition.effect.value <= 0) return [];
    return [[id, definition]];
  });
}

function safeLuck(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function gearChance(state: GameState, sourceLuck: number): number {
  const luck = Math.min(Number.MAX_SAFE_INTEGER, safeLuck(state.luck) + safeLuck(sourceLuck));
  return Math.min(MAX_GEAR_CHANCE, Math.max(GEAR_BASE_CHANCE, GEAR_BASE_CHANCE + luck * 0.001));
}

function weightedGrade(state: GameState, minimum: Grade | undefined): Grade {
  const roll = nextCombatRandom(state) * 100;
  let remaining = roll;
  let sampled: Grade = 'mythic';
  for (const grade of gradeOrder) {
    remaining -= GRADE_WEIGHTS[grade];
    if (remaining < 0) {
      sampled = grade;
      break;
    }
  }
  if (!minimum) return sampled;
  return gradeOrder[Math.max(gradeOrder.indexOf(sampled), gradeOrder.indexOf(minimum))];
}

function hasOwnedId(state: GameState, id: string): boolean {
  const inRegistry = (registry: Record<string, { id: string }> | undefined) => !!registry
    && (Object.hasOwn(registry, id) || Object.values(registry).some(instance => instance?.id === id));
  return inRegistry(state.items)
    || inRegistry(state.gear)
    || inRegistry(state.supplies)
    || state.wands.some(instance => instance.id === id)
    || state.characters.some(instance => instance.id === id)
    || state.entities.some(instance => instance.id === id)
    || state.backpack.includes(id);
}

function uniqueId(state: GameState, kind: GroundLoot['kind']): string {
  const base = `loot-${kind}-${state.wave}-${state.nextEventSeq}`;
  const taken = (id: string) => hasOwnedId(state, id) || state.groundLoot?.some(loot => loot.id === id);
  if (!taken(base)) return base;
  for (let suffix = 1; ; suffix++) if (!taken(`${base}-${suffix}`)) return `${base}-${suffix}`;
}

function selected<T>(state: GameState, definitions: Array<[string, T]>): [string, T] {
  return definitions[Math.min(definitions.length - 1, Math.floor(nextCombatRandom(state) * definitions.length))];
}

function addKnown(ids: string[] | undefined, id: string): string[] {
  const result = ids ? [...ids] : [];
  if (!result.includes(id)) result.push(id);
  return result;
}

type Emit = (type: string, data: Record<string, unknown>) => void;

function describeLoot(loot: GroundLoot) {
  return { enemyId: loot.enemyId, kind: loot.kind, instanceId: loot.id,
    definitionId: loot.definitionId, grade: loot.instance.grade, x: loot.x, y: loot.y };
}

function spawnLoot(state: GameState, loot: GroundLoot, emit: Emit): void {
  (state.groundLoot ??= []).push(loot);
  emit('lootSpawned', { ...describeLoot(loot), id: loot.id, instance: structuredClone(loot.instance) });
}

function awardLoot(state: GameState, loot: GroundLoot, reason: 'pickup' | 'waveClear', emit: Emit): void {
  if (loot.kind === 'gear') {
    (state.gear ??= {})[loot.id] = loot.instance;
    state.knowledge.gearIds = addKnown(state.knowledge.gearIds, loot.definitionId);
  } else if (loot.kind === 'item') {
    (state.supplies ??= {})[loot.id] = loot.instance;
    state.knowledge.itemIds = addKnown(state.knowledge.itemIds, loot.definitionId);
  } else {
    state.wands.push(loot.instance);
    state.knowledge.wandIds = addKnown(state.knowledge.wandIds, loot.definitionId);
  }
  const data = describeLoot(loot);
  emit('lootCollected', { ...data, id: loot.id, instance: structuredClone(loot.instance), reason });
  emit('lootGranted', data);
}

/** Ownership is changed exactly once, after an authoritative ground ID is removed. */
export function pickupGroundLoot(state: GameState, id: string, emit: Emit): boolean {
  const drops = state.groundLoot;
  const index = drops?.findIndex(loot => loot.id === id) ?? -1;
  if (!drops || index < 0 || hasOwnedId(state, id)) return false;
  const [loot] = drops.splice(index, 1);
  awardLoot(state, loot, 'pickup', emit);
  return true;
}

/** Drain all remaining drops, including those spawned by the last death in this step. */
export function collectWaveLoot(state: GameState, emit: Emit): void {
  const drops = state.groundLoot;
  if (!drops?.length) return;
  state.groundLoot = [];
  for (const loot of drops) if (!hasOwnedId(state, loot.id)) awardLoot(state, loot, 'waveClear', emit);
}

/** Roll bounded, catalog-backed loot and leave it at the defeated enemy's position. */
export function spawnEnemyLoot(state: GameState, enemy: CombatEntity, sourceLuck: number, content: ContentCatalog, emit: Emit): void {
  if (enemy.kind !== 'enemy' || enemy.faction !== 'enemy' || !Number.isFinite(enemy.hp) || enemy.hp > 0) return;
  if (!Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) return;
  const gearPool = gearDefinitions(content);
  const supplyPool = supplyDefinitions(content);
  // A catalog with no valid loot pools keeps its coin-only RNG stream.
  if (gearPool.length === 0 && supplyPool.length === 0) return;
  const minimumBossGrade = Object.hasOwn(MINIMUM_BOSS_GRADE, enemy.definitionId)
    ? MINIMUM_BOSS_GRADE[enemy.definitionId] : undefined;
  const isBoss = minimumBossGrade !== undefined;
  const firstGear = gearPool.length > 0
    && Object.keys(state.gear ?? {}).length === 0
    && (state.knowledge.gearIds?.length ?? 0) === 0
    && !state.groundLoot?.some(loot => loot.kind === 'gear');
  const guaranteedGear = gearPool.length > 0 && (firstGear || isBoss);
  const guaranteedSupply = isBoss && !guaranteedGear && supplyPool.length > 0;
  const dropsGear = gearPool.length > 0 && (guaranteedGear || nextCombatRandom(state) < gearChance(state, sourceLuck));
  const dropsSupply = supplyPool.length > 0 && (guaranteedSupply || nextCombatRandom(state) < SUPPLY_CHANCE);
  const dropsWand = state.wave >= WAND_MIN_WAVE && nextCombatRandom(state) < (isBoss ? BOSS_WAND_CHANCE : WAND_CHANCE);
  if (!dropsGear && !dropsSupply && !dropsWand) return;

  const grade = weightedGrade(state, minimumBossGrade);
  const point = { enemyId: enemy.id, x: Math.max(0, Math.min(100, enemy.x)), y: Math.max(0, Math.min(100, enemy.y)) };
  if (dropsGear) {
    const [definitionId, definition] = selected(state, gearPool);
    const id = uniqueId(state, 'gear');
    const instance = createGearFromDefinition(definition, id, grade);
    if (instance.definitionId === definitionId) spawnLoot(state, { ...point, id, kind: 'gear', definitionId, instance }, emit);
  }
  if (dropsSupply) {
    const [definitionId, definition] = selected(state, supplyPool);
    const id = uniqueId(state, 'item');
    const instance = createSupplyFromDefinition(definition, id, grade);
    if (instance.definitionId === definitionId) spawnLoot(state, { ...point, id, kind: 'item', definitionId, instance }, emit);
  }
  if (dropsWand) {
    const definitionId = state.wave >= 20 && nextCombatRandom(state) < 0.15 ? 'wand-5x5' : 'wand-4x4';
    const id = uniqueId(state, 'wand');
    const instance = createWandFromTemplate(definitionId, id);
    if (instance) spawnLoot(state, { ...point, id, kind: 'wand', definitionId, instance: { ...instance, grade } }, emit);
  }
}
