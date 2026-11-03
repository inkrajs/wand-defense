import type { AssetRef, CombatEntity, MonsterBodySize } from "../contracts";

export interface MonsterSizePreset {
  readonly id: MonsterBodySize;
  readonly pixels: number;
  readonly hitRadius: number;
}

export interface MonsterDefinition {
  readonly id: string;
  readonly name: string;
  readonly bodySize: MonsterBodySize;
  readonly asset: Readonly<AssetRef>;
  readonly spawn?: Readonly<{
    unlockWave: number;
    hpMultiplier: number;
    damageMultiplier: number;
    speedMultiplier: number;
    cooldownMultiplier: number;
    movementMode?: "straight" | "huntCharacter";
  }>;
}

const spawn = (
  unlockWave: number,
  hpMultiplier: number,
  damageMultiplier: number,
  speedMultiplier: number,
  cooldownMultiplier: number,
  movementMode?: "straight" | "huntCharacter",
) => Object.freeze({ unlockWave, hpMultiplier, damageMultiplier, speedMultiplier, cooldownMultiplier, movementMode });

/** Shared visual and collision dimensions, detached when read through getMonsterSize. */
export const MONSTER_SIZE_PRESETS: Readonly<Record<MonsterBodySize, MonsterSizePreset>> = Object.freeze({
  small: Object.freeze({ id: "small", pixels: 24, hitRadius: 1.35 }),
  normal: Object.freeze({ id: "normal", pixels: 32, hitRadius: 1.8 }),
  large: Object.freeze({ id: "large", pixels: 48, hitRadius: 2.7 }),
  huge: Object.freeze({ id: "huge", pixels: 64, hitRadius: 3.6 }),
  colossal: Object.freeze({ id: "colossal", pixels: 80, hitRadius: 4.5 }),
});

/** Stable monster IDs map to replaceable presentation keys and gameplay body sizes. */
export const monsterDefinitions: Readonly<Record<string, MonsterDefinition>> = Object.freeze({
  "enemy-basic": Object.freeze({
    id: "enemy-basic", name: "灰泥怪", bodySize: "normal",
    asset: Object.freeze({ key: "monster.basic", label: "灰泥怪", icon: "☠", color: "#8b8178" }),
    spawn: spawn(1, 1, 1, 1, 1),
  }),
  "enemy-moss": Object.freeze({
    id: "enemy-moss", name: "苔团", bodySize: "small",
    asset: Object.freeze({ key: "monster.moss", label: "苔团", icon: "●", color: "#65a85b" }),
    spawn: spawn(2, 0.8, 0.8, 0.9, 1.1, "straight"),
  }),
  "enemy-ember": Object.freeze({
    id: "enemy-ember", name: "焰灵", bodySize: "small",
    asset: Object.freeze({ key: "monster.ember", label: "焰灵", icon: "✦", color: "#ef6b45" }),
    spawn: spawn(3, 0.75, 1.2, 1.2, 0.9, "huntCharacter"),
  }),
  "enemy-frost-moth": Object.freeze({
    id: "enemy-frost-moth", name: "霜蛾", bodySize: "small",
    asset: Object.freeze({ key: "monster.frost-moth", label: "霜蛾", icon: "❋", color: "#79cde8" }),
    spawn: spawn(4, 0.65, 0.8, 1.35, 1.1, "huntCharacter"),
  }),
  "enemy-shadow-bat": Object.freeze({
    id: "enemy-shadow-bat", name: "影蝠", bodySize: "small",
    asset: Object.freeze({ key: "monster.shadow-bat", label: "影蝠", icon: "◈", color: "#a784d9" }),
    spawn: spawn(6, 0.7, 1, 1.4, 0.9, "huntCharacter"),
  }),
  "enemy-sand-beetle": Object.freeze({
    id: "enemy-sand-beetle", name: "砂甲虫", bodySize: "large",
    asset: Object.freeze({ key: "monster.sand-beetle", label: "砂甲虫", icon: "⬟", color: "#c5a05d" }),
    spawn: spawn(8, 1.8, 1.3, 0.7, 1.2, "straight"),
  }),
  "enemy-crystal-crab": Object.freeze({
    id: "enemy-crystal-crab", name: "晶蟹", bodySize: "normal",
    asset: Object.freeze({ key: "monster.crystal-crab", label: "晶蟹", icon: "⬢", color: "#8e9fe8" }),
    spawn: spawn(10, 1.4, 1.15, 0.85, 1),
  }),
  "boss-minor": Object.freeze({
    id: "boss-minor", name: "小型首领", bodySize: "large",
    asset: Object.freeze({ key: "monster.boss.minor", label: "小型首领", icon: "♟", color: "#c77d53" }),
  }),
  "boss-major": Object.freeze({
    id: "boss-major", name: "大型首领", bodySize: "huge",
    asset: Object.freeze({ key: "monster.boss.major", label: "大型首领", icon: "♜", color: "#a57ad2" }),
  }),
  "boss-apex": Object.freeze({
    id: "boss-apex", name: "顶级首领", bodySize: "colossal",
    asset: Object.freeze({ key: "monster.boss.apex", label: "顶级首领", icon: "♛", color: "#e3a743" }),
  }),
});

const noUnlockedMinions: readonly MonsterDefinition[] = Object.freeze([]);

/** Returns eligible minion definitions in their stable catalog order. */
export function getUnlockedMinionDefinitions(wave: number): readonly MonsterDefinition[] {
  if (!Number.isFinite(wave) || wave < 1) return noUnlockedMinions;
  return Object.freeze(Object.values(monsterDefinitions).filter(definition =>
    definition.spawn !== undefined && definition.spawn.unlockWave <= wave));
}

const legalBodySizes = new Set<string>(["small", "normal", "large", "huge", "colossal"]);
const normalPreset = MONSTER_SIZE_PRESETS.normal;

/** Resolve a runtime entity size without exposing mutable shared definition data. */
export function getMonsterSize(entity: Pick<CombatEntity, "definitionId" | "bodySize">): MonsterSizePreset {
  const explicit = entity.bodySize as unknown;
  const id = typeof explicit === "string" && legalBodySizes.has(explicit)
    ? explicit as MonsterBodySize
    : getDefinitionBodySize(entity.definitionId);
  const preset = MONSTER_SIZE_PRESETS[id] ?? normalPreset;
  return { id: preset.id, pixels: preset.pixels, hitRadius: preset.hitRadius };
}

function getDefinitionBodySize(definitionId: string): MonsterBodySize {
  if (!Object.hasOwn(monsterDefinitions, definitionId)) return "normal";
  return monsterDefinitions[definitionId].bodySize;
}
