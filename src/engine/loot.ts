import type {
  CombatEntity,
  ContentCatalog,
  GameState,
  GearDefinition,
  Grade,
  SupplyDefinition,
} from '../contracts';
import { createGearFromDefinition } from '../content/gear';
import { gradeOrder, gradePower } from '../content/grades';
import { createSupplyFromDefinition } from '../content/supplies';
import { nextCombatRandom } from './random';

const GEAR_BASE_CHANCE = 0.08;
const SUPPLY_CHANCE = 0.04;
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

function hasId(state: GameState, id: string): boolean {
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

function uniqueId(state: GameState, prefix: 'loot-gear' | 'loot-item', enemyId: string): string {
  const base = `${prefix}-${enemyId}`;
  if (!hasId(state, base)) return base;
  for (let suffix = 1; ; suffix++) {
    const candidate = `${base}-${suffix}`;
    if (!hasId(state, candidate)) return candidate;
  }
}

function selected<T>(state: GameState, definitions: Array<[string, T]>): [string, T] {
  return definitions[Math.min(definitions.length - 1, Math.floor(nextCombatRandom(state) * definitions.length))];
}

function addKnown(ids: string[] | undefined, id: string): string[] {
  const result = ids ? [...ids] : [];
  if (!result.includes(id)) result.push(id);
  return result;
}

/** Grant bounded, catalog-backed gear and supply drops for one settled enemy death. */
export function grantEnemyLoot(
  state: GameState,
  enemy: CombatEntity,
  sourceLuck: number,
  content: ContentCatalog,
  emit: (type: string, data: Record<string, unknown>) => void,
): void {
  if (enemy.kind !== 'enemy' || enemy.faction !== 'enemy' || !Number.isFinite(enemy.hp) || enemy.hp > 0) return;

  const gearPool = gearDefinitions(content);
  const supplyPool = supplyDefinitions(content);
  if (gearPool.length === 0 && supplyPool.length === 0) return;

  const minimumBossGrade = Object.hasOwn(MINIMUM_BOSS_GRADE, enemy.definitionId)
    ? MINIMUM_BOSS_GRADE[enemy.definitionId]
    : undefined;
  const isBoss = minimumBossGrade !== undefined;
  const firstGear = gearPool.length > 0
    && Object.keys(state.gear ?? {}).length === 0
    && (state.knowledge.gearIds?.length ?? 0) === 0;
  const guaranteedGear = gearPool.length > 0 && (firstGear || isBoss);
  const guaranteedSupply = isBoss && !guaranteedGear && supplyPool.length > 0;
  const dropsGear = gearPool.length > 0 && (guaranteedGear || nextCombatRandom(state) < gearChance(state, sourceLuck));
  const dropsSupply = supplyPool.length > 0
    && (guaranteedSupply || nextCombatRandom(state) < SUPPLY_CHANCE);
  if (!dropsGear && !dropsSupply) return;

  const grade = weightedGrade(state, minimumBossGrade);
  if (dropsGear) {
    const [definitionId, definition] = selected(state, gearPool);
    const instanceId = uniqueId(state, 'loot-gear', enemy.id);
    const instance = createGearFromDefinition(definition, instanceId, grade);
    if (instance.definitionId === definitionId) {
      state.gear ??= {};
      state.gear[instanceId] = instance;
      state.knowledge.gearIds = addKnown(state.knowledge.gearIds, definitionId);
      emit('lootGranted', {
        enemyId: enemy.id, kind: 'gear', instanceId, definitionId, grade: instance.grade, x: enemy.x, y: enemy.y,
      });
    }
  }
  if (dropsSupply) {
    const [definitionId, definition] = selected(state, supplyPool);
    const instanceId = uniqueId(state, 'loot-item', enemy.id);
    const instance = createSupplyFromDefinition(definition, instanceId, grade);
    if (instance.definitionId === definitionId) {
      state.supplies ??= {};
      state.supplies[instanceId] = instance;
      state.knowledge.itemIds = addKnown(state.knowledge.itemIds, definitionId);
      emit('lootGranted', {
        enemyId: enemy.id, kind: 'item', instanceId, definitionId, grade: instance.grade, x: enemy.x, y: enemy.y,
      });
    }
  }
}
