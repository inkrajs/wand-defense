import type { GameState } from "../contracts";
import { createCharacterBaseStats } from "../content/characters";
import { createRunStatistics } from "./runStatistics";
export function createInitialState(): GameState {
  return {
    schemaVersion: 1, id: "demo", revision: 0, phase: "ready", gameTimeMs: 0,
    speed: 1, paused: false, backpackOpen: false, wave: 0, waveSpawnRemaining: 0,
    spawnRemainingMs: 0, rngState: 20261103, territory: {hp: 100, maxHp: 100, shield: 50, maxShield: 50, wallLevel: 1, shieldLevel: 1, wallRepairLevel:0, shieldRepairLevel:0},
    runStatistics: createRunStatistics(),
    rewardRefresh: {wave:0,freeUsed:0,paidCount:0,refreshCount:0},coinIncomeRemainder:0,
    coins: 0, xp: 0, playerLevel: 1, luck: 0,
    gear:{},supplies:{},
    characters: [{id: "character-1", name: "初始角色", sequenceId: "fire-9", growthProfileId:"fire",
      level: 1, xp: 0, grade: "common", baseStats:createCharacterBaseStats(), wandIds: ["wand-1"], mana: 100, maxMana: 100, manaRegen: 12}],
    wands: [{id:"wand-1", name:"初始法杖", characterId:"character-1", level:1,
      grade:"common", width:3, height:3, placements:[{itemId:"spark-1",x:0,y:0,rotation:0}],cooldowns:{}}],
    items: {
      "spark-1": {id:"spark-1", definitionId:"spark", kind:"spell", level:1, grade:"common"},
      "amplify-1": {id:"amplify-1",definitionId:"amplify",kind:"arcana",level:1,grade:"common"}
    },
    backpack:["amplify-1"], entities:[], rewards:[], rewardHistory:[], rewardHistoryComplete:true,
    knowledge:{spellIds:["spark"],arcanaIds:["amplify"],recipeIds:["fireball-recipe"],sequenceIds:["fire-9"],gearIds:[],itemIds:[]},
    cheats:{unlocked:false,enabled:false},events:[],nextEventSeq:1
  };
}
