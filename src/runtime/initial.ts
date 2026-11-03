import type { GameState } from "../contracts";
export function createInitialState(): GameState {
  return {
    schemaVersion: 1, id: "demo", revision: 0, phase: "ready", gameTimeMs: 0,
    paused: false, backpackOpen: false, wave: 0, waveSpawnRemaining: 0,
    spawnRemainingMs: 0, rngState: 20261103, territory: {hp: 100, maxHp: 100},
    coins: 0, xp: 0, playerLevel: 1, luck: 0,
    characters: [{id: "character-1", name: "初始角色", sequenceId: "fire-9",
      level: 1, grade: "common", wandIds: ["wand-1"], mana: 100, maxMana: 100, manaRegen: 12}],
    wands: [{id:"wand-1", name:"初始法杖", characterId:"character-1", level:1,
      grade:"common", width:3, height:3, placements:[{itemId:"spark-1",x:0,y:0,rotation:0}],cooldowns:{}}],
    items: {
      "spark-1": {id:"spark-1", definitionId:"spark", kind:"spell", level:1, grade:"common"},
      "amplify-1": {id:"amplify-1",definitionId:"amplify",kind:"arcana",level:1,grade:"common"}
    },
    backpack:["amplify-1"], entities:[], rewards:[],
    knowledge:{spellIds:["spark"],arcanaIds:["amplify"],recipeIds:["fireball-recipe"],sequenceIds:["fire-9"]},
    cheats:{unlocked:false,enabled:false},events:[],nextEventSeq:1
  };
}
