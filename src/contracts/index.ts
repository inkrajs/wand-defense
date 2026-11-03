export type Id = string;
export const GAME_SPEEDS = [0.25, 0.5, 0.75, 1, 2, 3, 5] as const;
export type GameSpeed = typeof GAME_SPEEDS[number];
export type Element = "fire" | "wood" | "metal" | "water" | "earth" | "light" | "dark" | "lightning" | "wind";
export type Grade = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
export interface Growth { level: number; grade: Grade }
export interface Cell { x: number; y: number }
export interface AssetRef { key: string; label: string; icon?: string; color?: string }
export type EffectType = "projectile" | "heal" | "summon" | "building";
export interface SpellDefinition extends Growth {
  id: Id; name: string; element: Element; shape: Cell[]; asset: AssetRef;
  effect: EffectType; power: number; manaCost: number; cooldownMs: number;
  range: number; durationMs?: number; hp?: number; speed?: number;
  summonBehavior?: "attack" | "heal";
}
export interface ArcanaDefinition extends Growth {
  id: Id; name: string; shape: Cell[]; asset: AssetRef;
  modifier: "amplify" | "double" | "split" | "focus"; value: number;
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
}
export interface ItemInstance extends Growth {
  id: Id; definitionId: Id; kind: "spell" | "arcana";
}
export interface Placement { itemId: Id; x: number; y: number; rotation: 0 | 1 | 2 | 3 }
export interface WandInstance extends Growth {
  id: Id; name: string; characterId: Id | null; width: number; height: number;
  placements: Placement[]; cooldowns: Record<Id, number>;
}
export interface CharacterInstance extends Growth {
  id: Id; name: string; sequenceId: Id; wandIds: Id[];
  mana: number; maxMana: number; manaRegen: number;
}
export interface CombatEntity {
  id: Id; definitionId: Id; kind: "enemy" | "summon" | "building" | "projectile";
  /** Optional for legacy saves; current enemies carry their spawned level and grade. */
  level?: number; grade?: Grade;
  faction: "enemy" | "player"; x: number; y: number; hp: number; maxHp: number;
  damage: number; speed: number; range: number; cooldownMs: number;
  /** speed is the movement cap; moveSpeed is the current simulation velocity. */
  moveSpeed?: number; moveRampMs?: number;
  originX?: number; originY?: number; targetX?: number; targetY?: number;
  attackRemainingMs: number; remainingMs?: number; element?: Element;
  sourceCharacterId?: Id; sourceItemId?: Id; targetId?: Id;
}
export type RewardKind = "item" | "character" | "wand" | "heal" | "coins" | "buff";
export interface RewardOption {
  id: Id; kind: RewardKind; label: string; definitionId?: Id; amount?: number;
  grade?: Grade; description?: string; details?: { label: string; value: string }[];
  effect?: { type: "attackPercent"; value: number };
}
export interface GameEvent {
  seq: number; type: string; gameTimeMs: number; data: Record<string, unknown>;
}
export interface GameState {
  schemaVersion: 1; id: Id; revision: number; phase: "ready" | "battle" | "reward" | "defeat";
  gameTimeMs: number; speed: GameSpeed; paused: boolean; backpackOpen: boolean;
  wave: number; waveSpawnRemaining: number; spawnRemainingMs: number; rngState: number;
  territory: { hp: number; maxHp: number; shield?: number; maxShield?: number; wallLevel?: number; shieldLevel?: number };
  coins: number; xp: number; playerLevel: number; luck: number;
  runBonuses?: { attackPercent: number };
  characters: CharacterInstance[]; wands: WandInstance[]; items: Record<Id, ItemInstance>;
  backpack: Id[]; entities: CombatEntity[]; rewards: RewardOption[];
  knowledge: { spellIds: Id[]; arcanaIds: Id[]; recipeIds: Id[]; sequenceIds: Id[] };
  cheats: { unlocked: boolean; enabled: boolean };
  events: GameEvent[]; nextEventSeq: number;
}
export type Command =
  | { id: Id; type: "startWave" }
  | { id: Id; type: "restart" }
  | { id: Id; type: "setPaused"; paused: boolean }
  | { id: Id; type: "setSpeed"; speed: GameSpeed }
  | { id: Id; type: "upgradeTerritory"; track: "wall" | "shield" }
  | { id: Id; type: "setBackpack"; open: boolean }
  | { id: Id; type: "placeItem"; wandId: Id; itemId: Id; x: number; y: number; rotation: 0|1|2|3 }
  | { id: Id; type: "removeItem"; wandId: Id; itemId: Id }
  | { id: Id; type: "mergeRecipe"; wandId: Id; recipeId: Id; itemIds: Id[] }
  | { id: Id; type: "mergeItems"; sourceItemId: Id; targetItemId: Id }
  | { id: Id; type: "claimReward"; rewardId: Id }
  | { id: Id; type: "equipWand"; wandId: Id; characterId: Id }
  | { id: Id; type: "unequipWand"; wandId: Id }
  | { id: Id; type: "unlockCheats" }
  | { id: Id; type: "setCheats"; enabled: boolean }
  | { id: Id; type: "cheat"; action: "heal" | "grantSpell" | "grantItem"; definitionId?: Id };
export interface CommandResult {
  commandId: Id; status: "accepted" | "executed" | "rejected";
  revision: number; code?: string; message?: string;
}
export interface Transition { state: GameState; events: GameEvent[] }
export interface CommandTransition extends Transition { result: CommandResult }
export interface RuntimePort {
  getState(): GameState;
  dispatch(command: Command): CommandResult;
  subscribe(listener: (state: GameState, events: GameEvent[]) => void): () => void;
}

