import type { Command, CommandResult, ContentCatalog, GameEvent, GameState, Grade, Id, RuntimePort, RuntimeSummary } from "../contracts";
import { gradeOrder } from "../content/grades";
import { createWandFromTemplate } from "../content/wands";
import { createGearFromDefinition } from "../content/gear";
import { createSupplyFromDefinition } from "../content/supplies";
import { demoContent } from "../content/demo";
import { createWaveRewards } from "../content/rewards";
import { fillUniqueRewardOffers, getRewardOfferKey } from "../content/randomRewards";
import { enrichMagicReward } from "../content/magicDescriptions";
import { discoverAvailableRecipes } from "../content/recipeKnowledge";
import { normalizeCharacterProgression } from "../content/progression";
import { createCharacterBaseStats, getCharacterStats, normalizeCharacterStats } from "../content/characters";
import { startBattle, stepBattle } from "../engine";
import { applyLoadoutCommand } from "../loadout";
import { createInitialState } from "./initial";
import { GAME_SPEEDS } from "../contracts";
import { applyTerritoryUpgrade, applyTerritoryRepair } from "./territory";
import { applyTerritoryRecoveryUpgrade } from "./territoryRecovery";
import { applySupplyCommand } from "./supplies";
import { addRunStatistic, accumulateBattleStatistics, restoreRunStatistics } from "./runStatistics";
import { createClaimedReward, restoreRewardHistory, snapshotRewardOption } from "./rewardHistory";
import { getRewardRefreshQuote, normalizeRewardRefresh } from "./rewardRefresh";
import { grantCoinIncome } from "../content/economy";

export interface RuntimeCheckpoint {
  checkpointVersion: 1;
  state: GameState;
  pausedBeforeBackpack: boolean;
  results: [Id, CommandResult][];
}
export interface GameRuntime extends RuntimePort {
  subscribeEvents(listener: (summary: RuntimeSummary, events: GameEvent[]) => void): () => void;
  tick(dtMs: number): void;
  checkpoint(): RuntimeCheckpoint;
  dispose(): void;
}
export interface RuntimeOptions { seedSource?: () => number }
function nextRewardDraw(state: GameState): number {
  state.rngState = (Math.imul(state.rngState,1664525) + 1013904223) >>> 0;
  return state.rngState / 0x1_0000_0000;
}
export function createGameRuntime(content: ContentCatalog = demoContent, checkpoint?: RuntimeCheckpoint, options: RuntimeOptions = {}): GameRuntime {
  const freshState = () => {
    const next = createInitialState();
    const seed = options.seedSource?.();
    if (typeof seed === "number" && Number.isFinite(seed)) next.rngState = seed >>> 0;
    return next;
  };
  let state = checkpoint ? structuredClone(checkpoint.state) : freshState();
  // Older tab checkpoints predate speed controls.
  if (!GAME_SPEEDS.includes(state.speed)) state.speed = 1;
  normalizeCharacterProgression(state);
  normalizeCharacterStats(state);
  Object.assign(state, restoreRewardHistory(state));
  state.runStatistics = restoreRunStatistics(state, content);
  state.rewardRefresh = normalizeRewardRefresh(state.rewardRefresh, state.wave);
  // Refresh presentation of already-offered cards without drawing new rewards.
  state.rewards=state.rewards.map(reward=>enrichMagicReward(reward,content));
  // Repair only legacy duplicate offers. Existing distinct choices and their IDs stay stable.
  if (state.phase === "reward" && new Set(state.rewards.map(getRewardOfferKey)).size < state.rewards.length) {
    state.rewards=fillUniqueRewardOffers(state.rewards,{
      wave:state.wave,characterCount:state.characters.length,wandCount:state.wands.length,content,
      random:()=>nextRewardDraw(state),canHeal:state.territory.hp<state.territory.maxHp,
      cooldownCapped:(state.runBonuses?.cooldownPercent??0)>=70,
    });
    // Newly visible replacement cards are discoveries, not grants or historical claims.
    for (const reward of state.rewards) {
      const id=reward.definitionId;
      if (!id) continue;
      const list=Object.hasOwn(content.spells,id)?state.knowledge.spellIds
        :Object.hasOwn(content.arcana,id)?state.knowledge.arcanaIds:undefined;
      if (list&&!list.includes(id)) list.push(id);
    }
  }
  state.knowledge.recipeIds=discoverAvailableRecipes(state.knowledge,content);
  let pausedBeforeBackpack = checkpoint?.pausedBeforeBackpack ?? false;
  let disposed = false;
  type Subscriber =
    | { type:"state"; callback:(s:GameState,e:GameEvent[])=>void }
    | { type:"events"; callback:(s:RuntimeSummary,e:GameEvent[])=>void };
  // One ordered collection preserves mixed subscriber registration and reentrant dispatch order.
  const listeners = new Set<Subscriber>();
  const results = new Map<Id, CommandResult>(checkpoint ? structuredClone(checkpoint.results) : []);
  const notifications: {state: GameState; events: GameEvent[]}[] = [];
  let notifying = false;
  function emit(type: string, data: Record<string, unknown> = {}) {
    const event: GameEvent = { seq: state.nextEventSeq++, type, gameTimeMs: state.gameTimeMs, data };
    state.events.push(event);
  }
  function notify(afterSeq: number) {
    state.events = state.events.slice(-512);
    const events = state.events.filter(e => e.seq > afterSeq);
    notifications.push({state: structuredClone(state), events: structuredClone(events)});
    if (notifying) return;
    notifying = true;
    try {
      while (notifications.length) {
        const notification = notifications.shift()!;
        for (const listener of [...listeners]) {
          try {
            const events=structuredClone(notification.events);
            if(listener.type==="state") listener.callback(structuredClone(notification.state),events);
            else {
              const {id,phase,wave,revision,gameTimeMs}=notification.state;
              listener.callback({id,phase,wave,revision,gameTimeMs},events);
            }
          }
          catch (error) { console.error("Runtime subscriber failed", error); }
        }
      }
    } finally {
      notifying = false;
    }
  }
  function discover(definitionId: Id) {
    const list = content.spells[definitionId] ? state.knowledge.spellIds : state.knowledge.arcanaIds;
    if (!list.includes(definitionId)) list.push(definitionId);
    state.knowledge.recipeIds=discoverAvailableRecipes(state.knowledge,content);
  }
  function giveItem(definitionId: Id, grade?: Grade, level?: number) {
    const definition = content.spells[definitionId] ?? content.arcana[definitionId];
    if (!definition) return false;
    const id = "item-" + state.revision + "-" + state.nextEventSeq + "-" + Object.keys(state.items).length;
    state.items[id] = {id, definitionId, kind: content.spells[definitionId] ? "spell" : "arcana", level: level ?? definition.level, grade: grade ?? definition.grade};
    state.backpack.push(id);
    const counter = state.items[id].kind === "spell" ? "spellsAcquired" : "arcanaAcquired";
    state.runStatistics = addRunStatistic(state.runStatistics!, counter, 1);
    discover(definitionId);
    return true;
  }
  function prepareRewards() {
    state.rewardRefresh = normalizeRewardRefresh(state.rewardRefresh, state.wave);
    state.rewards = createWaveRewards(state.wave,state.characters.length,state.wands.length,content,()=>nextRewardDraw(state),
      {canHeal:state.territory.hp < state.territory.maxHp,cooldownCapped:(state.runBonuses?.cooldownPercent ?? 0) >= 70});
    // Reward offers are visible discoveries; unoffered definitions stay undisclosed.
    for (const reward of state.rewards) if (reward.definitionId) discover(reward.definitionId);
    emit("reward.offered", {wave: state.wave, rewards: structuredClone(state.rewards)});
  }
  function applyLocal(command: Command): string | undefined {
    switch (command.type) {
      case "restart": {
        const previous = state;
        state = freshState();
        state.id = globalThis.crypto?.randomUUID?.() ?? "run-" + Date.now() + "-" + previous.nextEventSeq;
        state.revision = previous.revision;
        state.nextEventSeq = previous.nextEventSeq;
        // Keep the transport cursor monotonic while starting a fresh gameplay run.
        state.events = [];
        pausedBeforeBackpack = false;
        emit("game.restarted", {gameId: state.id});
        return;
      }
      case "startWave": {
        if (state.phase !== "ready" || state.territory.hp <= 0) return "WAVE_NOT_READY";
        if (state.backpackOpen) emit("backpack.changed",{open:false});
        if (state.paused) emit("pause.changed",{paused:false});
        state.backpackOpen = false;
        state.paused = false;
        pausedBeforeBackpack = false;
        state = startBattle(state, content).state;
        state.rewardRefresh = normalizeRewardRefresh(state.rewardRefresh, state.wave);
        return;
      }
      case "setSpeed":
        if (!GAME_SPEEDS.includes(command.speed)) return "INVALID_SPEED";
        state.speed = command.speed;
        emit("speed.changed", {speed: state.speed});
        return;
      case "setPaused":
        if (state.backpackOpen && !command.paused) return "BACKPACK_REQUIRES_PAUSE";
        state.paused = command.paused;
        emit("pause.changed", {paused: state.paused});
        return;
      case "setBackpack":
        if (command.open && !state.backpackOpen) pausedBeforeBackpack = state.paused;
        if (!command.open && state.backpackOpen) state.paused = pausedBeforeBackpack;
        state.backpackOpen = command.open;
        if (command.open) state.paused = true;
        emit("backpack.changed", {open: command.open});
        return;
      case "refreshRewards": {
        if (state.phase !== "reward" || !state.rewards.length) return "REWARD_NOT_AVAILABLE";
        if (command.offerId !== state.rewards[0].id) return "STALE_REWARD_OFFER";
        const quote = getRewardRefreshQuote(state);
        if (!quote.canRefresh || quote.cost === null) return "REWARD_REFRESH_UNAVAILABLE";
        const refresh = normalizeRewardRefresh(state.rewardRefresh, state.wave);
        let rng = state.rngState;
        const rewards = createWaveRewards(state.wave,state.characters.length,state.wands.length,content,()=>{
          rng = (Math.imul(rng,1664525) + 1013904223) >>> 0;
          return rng / 0x1_0000_0000;
        }, {canHeal:state.territory.hp<state.territory.maxHp,cooldownCapped:(state.runBonuses?.cooldownPercent??0)>=70});
        if (rewards.length !== 4 || new Set(rewards.map(getRewardOfferKey)).size !== rewards.length) return "REWARD_REFRESH_UNAVAILABLE";
        const refreshCount = refresh.refreshCount + 1;
        state.coins -= quote.cost;
        state.rngState = rng;
        state.rewardRefresh = {...refresh,refreshCount,
          freeUsed:refresh.freeUsed+(quote.freeRemaining>0?1:0),
          paidCount:refresh.paidCount+(quote.freeRemaining>0?0:1)};
        state.rewards = rewards.map(reward=>({...reward,id:`${reward.id}:refresh-${refreshCount}`}));
        for (const reward of state.rewards) if (reward.definitionId) discover(reward.definitionId);
        emit("reward.refreshed", {wave:state.wave,cost:quote.cost,paidCount:state.rewardRefresh.paidCount,
          freeRemaining:getRewardRefreshQuote(state).freeRemaining});
        emit("reward.offered", {wave:state.wave,rewards:structuredClone(state.rewards)});
        return;
      }
      case "claimReward": {
        if (state.phase !== "reward") return "REWARD_NOT_AVAILABLE";
        const offered = state.rewards.find(r => r.id === command.rewardId);
        const reward = snapshotRewardOption(offered);
        if (!reward) return "REWARD_NOT_AVAILABLE";
        if (reward.kind === "item") {
          if (!reward.definitionId || (reward.grade !== undefined && !gradeOrder.includes(reward.grade)) || !giveItem(reward.definitionId,reward.grade)) return "REWARD_NOT_AVAILABLE";
        } else if (reward.kind === "buff") {
          const effect = reward.effect;
          if (!effect || !["attackPercent","maxMana","manaRegen","rangePercent","cooldownPercent","luck","gatheringPercent"].includes(effect.type)
            || !Number.isFinite(effect.value) || effect.value <= 0 || effect.value > 100) return "REWARD_NOT_AVAILABLE";
          if (effect.type === "luck") {
            if (!Number.isFinite(state.luck) || !Number.isFinite(state.luck+effect.value)) return "REWARD_NOT_AVAILABLE";
            state.luck += effect.value;
          } else {
          const bonuses = state.runBonuses ?? {attackPercent:0};
          const current = bonuses[effect.type] ?? 0;
          if (!Number.isFinite(current)) return "REWARD_NOT_AVAILABLE";
          const next = effect.type === "cooldownPercent" ? Math.min(70,current+effect.value) : current+effect.value;
          if (!Number.isFinite(next) || next <= current) return "REWARD_NOT_AVAILABLE";
          state.runBonuses = {...bonuses,[effect.type]:next};
          if (effect.type === "maxMana") for (const character of state.characters) {
            character.maxMana += effect.value; character.mana += effect.value;
          }
          if (effect.type === "manaRegen") for (const character of state.characters) character.manaRegen += effect.value;
          }
        } else if (reward.kind === "heal") {
          state.territory.hp = Math.min(state.territory.maxHp, state.territory.hp + (reward.amount ?? 0));
        } else if (reward.kind === "coins") {
          const granted = grantCoinIncome(state,reward.amount??0,content);
          if (granted.baseAmount === 0 && (reward.amount??0) > 0) return "REWARD_NOT_AVAILABLE";
          const income = granted.amount;
          state.runStatistics = addRunStatistic(state.runStatistics!, "coinsEarned", Math.max(0, income));
        } else if (reward.kind === "character") {
          if (state.characters.length >= 3) return "TEAM_FULL";
          const index = state.characters.length + 1;
          state.runStatistics = addRunStatistic(state.runStatistics!, "charactersAcquired", 1);
          const characterId = "character-" + index, wandId = "wand-" + (state.wands.length + 1);
          const sequenceId = index === 2 ? "wood-9" : "metal-9";
          state.characters.push({id: characterId, name: "同行者 " + index, sequenceId,growthProfileId:index===2?"wood":"balanced",
            level:1,xp:0,baseStats:createCharacterBaseStats(),grade:reward.grade ?? "common",wandIds:[wandId],mana:100+(state.runBonuses?.maxMana ?? 0),maxMana:100+(state.runBonuses?.maxMana ?? 0),manaRegen:12+(state.runBonuses?.manaRegen ?? 0)});
          state.wands.push({id:wandId,name:"同行法杖",characterId,level:1,grade:"common",
            width:3,height:3,placements:[],cooldowns:{}});
          if (!state.knowledge.sequenceIds.includes(sequenceId)) state.knowledge.sequenceIds.push(sequenceId);
          giveItem(index === 2 ? "regrowth" : "metal-needle");
        } else if (reward.kind === "wand") {
          const id = "wand-" + (state.wands.length + 1);
          state.wands.push({id,name:"备用法杖",characterId:null,level:1,grade:reward.grade ?? "common",
            width:3,height:3,placements:[],cooldowns:{}});
        }
        state.rewardHistory = [...(state.rewardHistory ?? []), createClaimedReward(reward, state.wave, state.gameTimeMs, state.nextEventSeq)];
        state.rewards = [];
        state.phase = "ready";
        emit("reward.claimed", {rewardId: reward.id, kind:reward.kind});
        return;
      }
      case "unlockCheats":
        state.cheats.unlocked = true;
        emit("cheats.unlocked");
        return;
      case "setCheats":
        if (!state.cheats.unlocked) return "CHEATS_LOCKED";
        state.cheats.enabled = command.enabled;
        emit("cheats.changed", {enabled:command.enabled});
        return;
      case "cheat":
        if (!state.cheats.unlocked || !state.cheats.enabled) return "CHEATS_LOCKED";
        if (command.action === "revive") {
          if (state.phase !== "defeat") return "REVIVE_REQUIRES_DEFEAT";
          const failedWave = state.wave;
          const manaCaps = state.characters.map(character => getCharacterStats(state, character.id, content)?.final.maxMana);
          if (manaCaps.some(cap => cap === undefined || !Number.isFinite(cap) || cap < 0)) return "CHEAT_UNAVAILABLE";
          state.territory.hp = state.territory.maxHp;
          state.territory.shield = state.territory.maxShield ?? 0;
          state.characters.forEach((character, index) => { character.mana = manaCaps[index]!; });
          state.entities = [];
          state.rewards = [];
          state.waveSpawnRemaining = 0;
          state.spawnRemainingMs = 0;
          state.wave = Math.max(0, failedWave - 1);
          state.rewardRefresh = normalizeRewardRefresh(state.rewardRefresh, state.wave);
          state.phase = "ready";
          state.paused = false;
          state.backpackOpen = false;
          pausedBeforeBackpack = false;
          emit("game.revived", {wave: failedWave});
        }
        else if (command.action === "heal") state.territory.hp = state.territory.maxHp;
        else if (command.action === "grantWand") {
          if (!command.definitionId) return "CHEAT_UNAVAILABLE";
          if(command.grade !== undefined && !gradeOrder.includes(command.grade)) return "CHEAT_UNAVAILABLE";
          if(command.level !== undefined && (!Number.isSafeInteger(command.level) || command.level < 1)) return "CHEAT_UNAVAILABLE";
          const baseId = `wand-cheat-${state.revision}-${state.nextEventSeq}`;
          let instanceId = baseId, suffix = 1;
          while (state.wands.some(wand => wand.id === instanceId) || Object.hasOwn(state.items, instanceId)) instanceId = `${baseId}-${suffix++}`;
          const wand = createWandFromTemplate(command.definitionId, instanceId);
          if (!wand) return "CHEAT_UNAVAILABLE";
          if(command.grade !== undefined) wand.grade=command.grade;
          if(command.level !== undefined) wand.level=command.level;
          state.wands.push(wand);
        }
        else if(command.action === "grantGear"||command.action === "grantSupply") {
          if(command.grade !== undefined && !gradeOrder.includes(command.grade)) return "CHEAT_UNAVAILABLE";
          if(command.level !== undefined && (!Number.isSafeInteger(command.level) || command.level < 1)) return "CHEAT_UNAVAILABLE";
          const catalog=command.action === "grantGear"?content.gear:content.items;
          if(!command.definitionId||!catalog||!Object.hasOwn(catalog,command.definitionId))return "CHEAT_UNAVAILABLE";
          const id=`${command.action === "grantGear"?"gear":"supply"}-cheat-${state.revision}-${state.nextEventSeq}`;
          if(command.action === "grantGear") {
            const gear=createGearFromDefinition(content.gear![command.definitionId],id,command.grade);
            if(command.level !== undefined) gear.level=command.level;
            state.gear={...state.gear,[id]:gear};
            state.knowledge.gearIds=[...new Set([...(state.knowledge.gearIds??[]),command.definitionId])];
          } else {
            const supply=createSupplyFromDefinition(content.items![command.definitionId],id,command.grade);
            if(command.level !== undefined) supply.level=command.level;
            state.supplies={...state.supplies,[id]:supply};
            state.knowledge.itemIds=[...new Set([...(state.knowledge.itemIds??[]),command.definitionId])];
          }
        }
        else if (command.action === "grantSpell" || command.action === "grantItem") {
          if(command.grade !== undefined && !gradeOrder.includes(command.grade)) return "CHEAT_UNAVAILABLE";
          if(command.level !== undefined && (!Number.isSafeInteger(command.level) || command.level < 1)) return "CHEAT_UNAVAILABLE";
          if (!command.definitionId || (command.action === "grantSpell" && !content.spells[command.definitionId]) ||
            !giveItem(command.definitionId,command.grade,command.level)) return "CHEAT_UNAVAILABLE";
        } else return "CHEAT_UNAVAILABLE";
        emit("cheat.executed", {action:command.action});
        return;
      default:
        return "UNKNOWN_COMMAND";
    }
  }
  return {
    getState: () => structuredClone(state),
    checkpoint: () => structuredClone({checkpointVersion: 1, state, pausedBeforeBackpack, results: [...results]}),
    dispatch(command) {
      if (disposed) return {commandId:command.id,status:"rejected",revision:state.revision,code:"DISPOSED"};
      const previous = results.get(command.id);
      if (previous) return structuredClone(previous);
      const oldRevision = state.revision, afterSeq = state.nextEventSeq - 1;
      let result: CommandResult;
      if (["placeItem", "removeItem", "clearWand", "discardItem", "discardWand", "mergeRecipe", "mergeItems", "equipWand", "unequipWand", "equipGear", "unequipGear", "discardGear"].includes(command.type)) {
        const transition = applyLoadoutCommand(state, command, content);
        state = transition.state;
        if (transition.result.status === "executed") state.knowledge.recipeIds=discoverAvailableRecipes(state.knowledge,content);
        if (transition.result.status === "executed") for (const character of state.characters) {
          const view = getCharacterStats(state,character.id,content);
          if (view) character.mana = Math.min(character.mana,view.final.maxMana);
        }
        result = transition.result;
      } else if(command.type === "useItem"||command.type === "discardSupply") {
        const transition=applySupplyCommand(state,command,content);
        state=transition.state;
        result=transition.result;
      } else if (command.type === "upgradeTerritoryRecovery") {
        const transition=applyTerritoryRecoveryUpgrade(state,command);
        state=transition.state;
        result=transition.result;
      } else if (command.type === "upgradeTerritory" || command.type === "repairTerritory") {
        const transition = command.type === "repairTerritory" ? applyTerritoryRepair(state, command) : applyTerritoryUpgrade(state, command);
        state = transition.state;
        result = transition.result;
      } else {
        const code = applyLocal(command);
        if (!code) state.revision = Math.max(state.revision, oldRevision + 1);
        result = {commandId:command.id,status:code ? "rejected" : "executed",revision:state.revision,...(code ? {code} : {})};
      }
      results.set(command.id, structuredClone(result));
      if (state.revision !== oldRevision || state.nextEventSeq - 1 !== afterSeq) notify(afterSeq);
      return structuredClone(result);
    },
    subscribe(listener) {
      const entry=[...listeners].find(item=>item.type==="state"&&item.callback===listener)
        ?? {type:"state" as const,callback:listener};
      listeners.add(entry);
      return () => {listeners.delete(entry)};
    },
    subscribeEvents(listener) {
      const entry=[...listeners].find(item=>item.type==="events"&&item.callback===listener)
        ?? {type:"events" as const,callback:listener};
      listeners.add(entry);
      return () => {listeners.delete(entry)};
    },
    tick(dtMs) {
      if (disposed || !Number.isFinite(dtMs) || dtMs <= 0 || state.phase !== "battle" || state.paused || state.backpackOpen) return;
      const afterSeq = state.nextEventSeq - 1;
      const oldRevision = state.revision;
      const coinsBefore = state.coins;
      const transition = stepBattle(state, Math.min(dtMs, 250) * state.speed, content);
      state = transition.state;
      state.runStatistics = accumulateBattleStatistics(state.runStatistics!, transition.events, Math.max(0, state.coins - coinsBefore));
      for (const event of transition.events.filter(event => event.type === "characterLevelUp")) {
        const { characterId, level } = event.data;
        if (typeof level !== "number" || !Number.isSafeInteger(level) || level < 2 || typeof characterId !== "string") continue;
        const candidates = ["amplify", "regrowth", "double"];
        const definitionId = candidates[(level - 2) % candidates.length];
        if (giveItem(definitionId)) emit("character.levelReward", {characterId, level, definitionId});
      }
      if (state.phase === "reward" && state.rewards.length === 0) prepareRewards();
      if (state.revision !== oldRevision || state.nextEventSeq - 1 !== afterSeq) notify(afterSeq);
    },
    dispose() {disposed=true;listeners.clear()}
  };
}
