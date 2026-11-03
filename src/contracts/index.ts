export type Id = string;
export const GAME_SPEEDS = [0.25, 0.5, 0.75, 1, 2, 3, 5] as const;
export type GameSpeed = typeof GAME_SPEEDS[number];
export type Element = "fire" | "wood" | "metal" | "water" | "earth" | "light" | "dark" | "lightning" | "wind";
export type Grade = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
export interface Growth { level: number; grade: Grade }
export interface Cell { x: number; y: number }
export interface AssetRef { key: string; label: string; icon?: string; color?: string }
export type EffectType = "projectile" | "heal" | "shield" | "beam" | "chain" | "area" | "summon" | "building";
export type ProjectileImpact =
  | { type: "pierce"; maxTargets: number; falloff?: number }
  | { type: "splash"; radius: number; maxTargets: number }
  | { type: "chain"; radius: number; maxTargets: number; falloff: number }
  | { type: "field"; radius: number; maxTargets: number; durationMs: number; tickMs: number; trigger: "contact" | "range" | "either" };
export interface BeamSpec { width: number; durationMs: number; tickMs: number; maxTargets: number }
export interface AreaSpec {
  mode: "strike" | "ring" | "eruption" | "field" | "vortex";
  radius: number; delayMs: number; durationMs: number; maxTargets: number;
  tickMs?: number; anchor?: "target" | "caster" | "field";
  moveSpeed?: number; pullRadius?: number; pullStrength?: number;
}
/** Enemy effects resolved only after a real successful contact. Durations use simulation time. */
export interface OnHitSpec {
  knockback?: number;
  slow?: { multiplier: number; durationMs: number };
  burn?: { powerRatio: number; durationMs: number; tickMs: number };
}
/** Periodic damage retains its original cast provenance after the spell entity expires. */
export interface BurnStatus {
  id: string; definitionId: Id; sourceCharacterId?: Id; sourceItemId?: Id; sourceLuck: number;
  damage: number; remainingMs: number; tickMs: number; tickRemainingMs: number;
}
export interface EnemyStatus {
  slow?: { multiplier: number; remainingMs: number };
  burns?: BurnStatus[];
}
/** Stateful summoned allies and placed structures; all durations use simulation time. */
export interface ConstructSpec {
  hp:number; durationMs:number; attackIntervalMs:number; maxAlive:number;
  attackMode:"contact"|"projectile"; behavior:"attack"|"heal"|"shield";
  moveSpeed?:number; projectileSpeed?:number; coinCost?:number;
  bodySize?:MonsterBodySize; placement?:"caster"|"target";
}
export interface SpellDefinition extends Growth {
  id: Id; name: string; element: Element; shape: Cell[]; asset: AssetRef;
  effect: EffectType; power: number; manaCost: number; cooldownMs: number;
  range: number; durationMs?: number; hp?: number; speed?: number;
  summonBehavior?: "attack" | "heal";
  construct?: ConstructSpec;
  impact?: ProjectileImpact; beam?: BeamSpec; area?: AreaSpec; onHit?: OnHitSpec;
}
export interface ArcanaDefinition extends Growth {
  id: Id; name: string; shape: Cell[]; asset: AssetRef;
  modifier: "amplify" | "double" | "split" | "focus" | "haste" | "efficiency" | "reach" | "velocity" | "area"
    | "pierce" | "slow" | "burn" | "knockback" | "duration" | "capacity" | "precision"; value: number;
}
export interface RecipeDefinition {
  id: Id; name: string; inputs: Id[]; output: Id; requireAdjacency: boolean;
}
export interface AdvancementRequirement {
  id: Id; kind: "characterLevel" | "equippedWandLevel" | "equippedSpellLevel" | "node" | "coins";
  value: number; definitionId?: Id; mode: "live" | "completed" | "consume";
}
export interface SequenceDefinition {
  id: Id; pathwayId: Id; number: number; name: string; previousId?: Id;
  bonuses: Partial<Record<Element, number>>; requirements: AdvancementRequirement[];
}
export interface ContentCatalog {
  spells: Record<Id, SpellDefinition>; arcana: Record<Id, ArcanaDefinition>;
  recipes: RecipeDefinition[]; sequences: Record<Id, SequenceDefinition>;
  gear?:Record<Id,GearDefinition>; items?:Record<Id,SupplyDefinition>;
}
export interface ItemInstance extends Growth {
  id: Id; definitionId: Id; kind: "spell" | "arcana";
}
export interface Placement { itemId: Id; x: number; y: number; rotation: 0 | 1 | 2 | 3 }
export interface CharacterBaseStats {
  /** Flat additional attack power, percentage-point casting speed, and world-unit range. */
  attack: number; castSpeedPercent: number; range: number;
  /** Projectile travel speed percentage points; optional only for legacy values. */
  projectileSpeedPercent?: number;
  /** Probabilities 0..1; critical damage multiplier is at least 1. */
  accuracy: number; critChance: number; critMultiplier: number;
  /** Percentage points added to coin-drop probability; element values are fractional bonuses. */
  luck: number; elementBonuses: Partial<Record<Element, number>>;
  /** Percentage points contributed to the party's coin income bonus. */
  gatheringPercent?: number;
}
export type CharacterStatBonuses = Partial<CharacterBaseStats> & {maxMana?: number;manaRegen?: number};
export type GearSlot = "head" | "body" | "feet" | "accessory";
export interface GearDefinition extends Growth {
  id:Id;name:string;slot:GearSlot;shape:Cell[];asset:AssetRef;statBonuses:CharacterStatBonuses;
}
export interface SupplyDefinition extends Growth {
  id:Id;name:string;shape:Cell[];asset:AssetRef;
  effect:{type:"territoryHeal"|"territoryShield"|"partyMana"|"territoryRestore"|"partyManaPercent"|"cooldownAdvance"|"territoryHealPercent"|"territoryShieldPercent";value:number};
}
export interface SupplyInstance extends Growth {id:Id;definitionId:Id}
export interface GearInstance extends Growth {
  id:Id;name:string;slot:GearSlot;characterId:Id|null;statBonuses?:CharacterStatBonuses;definitionId?:Id;
}
export interface AttackRollStats {accuracy:number;critChance:number;critMultiplier:number;sourceLuck:number}
export interface WandInstance extends Growth {
  statBonuses?: CharacterStatBonuses;
  id: Id; name: string; characterId: Id | null; width: number; height: number;
  placements: Placement[]; cooldowns: Record<Id, number>;
}
export interface CharacterInstance extends Growth {
  baseStats?: CharacterBaseStats;
  /** Static per-level growth profile; absent only in legacy checkpoints. */
  growthProfileId?: string;
  gearIds?: Partial<Record<GearSlot,Id>>;
  id: Id; name: string; sequenceId: Id; wandIds: Id[];
  /** Cumulative personal experience; absent only in legacy checkpoints. */
  xp?: number;
  mana: number; maxMana: number; manaRegen: number;
}
export type MonsterBodySize="small"|"normal"|"large"|"huge"|"colossal";
export interface CombatEntity {
  id: Id; definitionId: Id; kind: "enemy" | "summon" | "building" | "projectile" | "beam" | "chain" | "area";
  /** Optional for legacy saves; current enemies carry their spawned level and grade. */
  level?: number; grade?: Grade;
  bodySize?:MonsterBodySize;
  onHit?: OnHitSpec;
  construct?:ConstructSpec;
  /** True emission origin for construct projectiles; character/item still own damage and XP. */
  sourceEntityId?:Id;
  armor?:number; regenerationPerSecond?:number;
  /** Bounded active enemy conditions; absent on older checkpoints. */
  status?: EnemyStatus;
  faction: "enemy" | "player"; x: number; y: number; hp: number; maxHp: number;
  damage: number; speed: number; range: number; cooldownMs: number;
  /** speed is the movement cap; moveSpeed is the current simulation velocity. */
  moveSpeed?: number; moveRampMs?: number;
  /** Enemy routes share character anchors with the battlefield renderer. */
  movementMode?: "straight" | "huntCharacter"; targetCharacterId?: Id;
  originX?: number; originY?: number; targetX?: number; targetY?: number;
  attackRemainingMs: number; remainingMs?: number; element?: Element;
  sourceCharacterId?: Id; sourceItemId?: Id; targetId?: Id;
  impact?: ProjectileImpact; hitIds?: Id[]; remainingImpacts?: number;
  beamWidth?: number; maxTargets?: number;
  area?: AreaSpec;
  attackRoll?: AttackRollStats;
  /** Simulation-time burst scheduling and a real initial split flight segment. */
  launchDelayMs?: number; splitBranchIndex?: number; splitBranchCount?: number;
  splitWaypointX?: number; splitWaypointY?: number;
  headingX?:number; headingY?:number;
  travelledDistance?: number;
}
export type RewardKind = "item" | "character" | "wand" | "heal" | "coins" | "buff";
export type RewardBuffType = "attackPercent" | "maxMana" | "manaRegen" | "rangePercent" | "cooldownPercent" | "luck" | "gatheringPercent";
/** Free usage belongs to one wave; paid count and refresh count belong to the run. */
export interface RewardRefreshState { wave: number; freeUsed: number; paidCount: number; refreshCount: number }
export interface RewardRefreshQuote {
  freeTotal: number; freeRemaining: number; paidCount: number;
  nextPaidCost: number | null; cost: number | null; canRefresh: boolean;
}
export interface RewardOption {
  id: Id; kind: RewardKind; label: string; definitionId?: Id; amount?: number;
  grade?: Grade; description?: string; details?: { label: string; value: string }[];
  effect?: { type: RewardBuffType; value: number };
}
export interface GameEvent {
  seq: number; type: string; gameTimeMs: number; data: Record<string, unknown>;
}
export interface ClaimedReward {
  id:Id; wave:number; gameTimeMs:number; reward:RewardOption;
}
/** Durable run totals. Legacy saves can only report confirmed lower bounds. */
export interface RunStatistics {
  version:1; complete:boolean;
  spellsAcquired:number; arcanaAcquired:number; charactersAcquired:number;
  levelsGained:number; enemiesDefeated:number; bossesDefeated:number;
  coinsEarned:number; wavesCleared:number;
}
export interface GameState {
  schemaVersion: 1; id: Id; revision: number; phase: "ready" | "battle" | "reward" | "defeat";
  gameTimeMs: number; speed: GameSpeed; paused: boolean; backpackOpen: boolean;
  wave: number; waveSpawnRemaining: number; spawnRemainingMs: number; rngState: number;
  territory: { hp: number; maxHp: number; shield?: number; maxShield?: number; wallLevel?: number; shieldLevel?: number; wallRepairLevel?:number; shieldRepairLevel?:number };
  coins: number;
  /** Legacy aggregate XP and first-character level alias; not shared progression. */
  xp: number; playerLevel: number;
  luck: number;
  runBonuses?: { attackPercent: number; maxMana?: number; manaRegen?: number; rangePercent?: number; cooldownPercent?: number; gatheringPercent?: number };
  /** Fractional positive coin income carried forward; never applied to spending. */
  coinIncomeRemainder?: number;
  gear?: Record<Id,GearInstance>;
  supplies?:Record<Id,SupplyInstance>;
  characters: CharacterInstance[]; wands: WandInstance[]; items: Record<Id, ItemInstance>;
  backpack: Id[]; entities: CombatEntity[]; rewards: RewardOption[];
  /** Absent only in older checkpoints. */
  rewardRefresh?: RewardRefreshState;
  /** Durable chosen-reward ledger; absent only in older checkpoints. */
  rewardHistory?:ClaimedReward[];
  rewardHistoryComplete?:boolean;
  runStatistics?:RunStatistics;
  knowledge: { spellIds: Id[]; arcanaIds: Id[]; recipeIds: Id[]; sequenceIds: Id[]; gearIds?:Id[];itemIds?:Id[] };
  cheats: { unlocked: boolean; enabled: boolean };
  events: GameEvent[]; nextEventSeq: number;
}
export type Command =
  | { id: Id; type: "startWave" }
  | { id:Id; type:"deployConstruct"; characterId:Id; itemId:Id; x:number; y:number }
  | { id: Id; type: "restart" }
  | { id: Id; type: "setPaused"; paused: boolean }
  | { id: Id; type: "setSpeed"; speed: GameSpeed }
  | { id: Id; type: "upgradeTerritory"; track: "wall" | "shield" }
  | { id: Id; type: "repairTerritory"; track: "wall" | "shield" }
  | { id: Id; type: "upgradeTerritoryRecovery"; track: "wall" | "shield" }
  | { id: Id; type: "setBackpack"; open: boolean }
  | { id: Id; type: "placeItem"; wandId: Id; itemId: Id; x: number; y: number; rotation: 0|1|2|3 }
  | { id: Id; type: "removeItem"; wandId: Id; itemId: Id }
  | { id: Id; type: "clearWand"; wandId: Id }
  | { id: Id; type: "discardItem"; itemId: Id }
  | { id: Id; type: "discardWand"; wandId: Id }
  | { id: Id; type: "equipGear"; gearId: Id; characterId:Id }
  | { id: Id; type: "unequipGear"; gearId: Id }
  | { id: Id; type: "discardGear"; gearId: Id }
  | { id: Id; type: "discardSupply"; itemId: Id }
  | { id: Id; type: "useItem"; itemId: Id }
  | { id: Id; type: "mergeRecipe"; wandId: Id; recipeId: Id; itemIds: Id[] }
  | { id: Id; type: "mergeItems"; sourceItemId: Id; targetItemId: Id }
  | { id: Id; type: "claimReward"; rewardId: Id }
  | { id: Id; type: "refreshRewards"; offerId: Id }
  | { id: Id; type: "equipWand"; wandId: Id; characterId: Id; slot?:0|1 }
  | { id: Id; type: "unequipWand"; wandId: Id }
  | { id: Id; type: "unlockCheats" }
  | { id: Id; type: "setCheats"; enabled: boolean }
  | { id: Id; type: "cheat"; action: "grantWand" | "grantSpell" | "grantItem" | "grantGear" | "grantSupply"; definitionId?: Id; grade?: Grade; level?: number }
  | { id: Id; type: "cheat"; action: "heal" | "revive"; definitionId?: Id };
export interface CommandResult {
  commandId: Id; status: "accepted" | "executed" | "rejected";
  revision: number; code?: string; message?: string;
}
export interface Transition { state: GameState; events: GameEvent[] }
export interface CommandTransition extends Transition { result: CommandResult }
/** Small notification metadata for consumers that do not need a full state snapshot. */
export type RuntimeSummary = Pick<GameState,"id"|"phase"|"wave"|"revision"|"gameTimeMs">;
export interface RuntimePort {
  getState(): GameState;
  dispatch(command: Command): CommandResult;
  subscribe(listener: (state: GameState, events: GameEvent[]) => void): () => void;
  /** Optional for older adapters; events remain isolated per subscriber and ordered with subscribe. */
  subscribeEvents?(listener: (summary: RuntimeSummary, events: GameEvent[]) => void): () => void;
}

