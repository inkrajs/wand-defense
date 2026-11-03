import type { Command, CommandResult, ContentCatalog, GameEvent, GameState, Id, RuntimePort } from "../contracts";
import { demoContent } from "../content/demo";
import { createWaveRewards } from "../content/rewards";
import { startBattle, stepBattle } from "../engine";
import { applyLoadoutCommand } from "../loadout";
import { createInitialState } from "./initial";
import { GAME_SPEEDS } from "../contracts";
import { applyTerritoryUpgrade } from "./territory";

export interface RuntimeCheckpoint {
  checkpointVersion: 1;
  state: GameState;
  pausedBeforeBackpack: boolean;
  results: [Id, CommandResult][];
}
export interface GameRuntime extends RuntimePort {
  tick(dtMs: number): void;
  checkpoint(): RuntimeCheckpoint;
  dispose(): void;
}
export function createGameRuntime(content: ContentCatalog = demoContent, checkpoint?: RuntimeCheckpoint): GameRuntime {
  let state = checkpoint ? structuredClone(checkpoint.state) : createInitialState();
  // Older tab checkpoints predate speed controls.
  if (!GAME_SPEEDS.includes(state.speed)) state.speed = 1;
  let pausedBeforeBackpack = checkpoint?.pausedBeforeBackpack ?? false;
  let disposed = false;
  const listeners = new Set<(s: GameState, e: GameEvent[]) => void>();
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
          try { listener(structuredClone(notification.state), structuredClone(notification.events)); }
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
  }
  function giveItem(definitionId: Id) {
    const definition = content.spells[definitionId] ?? content.arcana[definitionId];
    if (!definition) return false;
    const id = "item-" + state.revision + "-" + state.nextEventSeq + "-" + Object.keys(state.items).length;
    state.items[id] = {id, definitionId, kind: content.spells[definitionId] ? "spell" : "arcana", level: definition.level, grade: definition.grade};
    state.backpack.push(id);
    discover(definitionId);
    return true;
  }
  function prepareRewards() {
    state.rewards = createWaveRewards(state.wave,state.characters.length,state.wands.length,content);
    // Reward offers are visible discoveries; unoffered definitions stay undisclosed.
    for (const reward of state.rewards) if (reward.definitionId) discover(reward.definitionId);
    emit("reward.offered", {wave: state.wave, rewards: structuredClone(state.rewards)});
  }
  function applyLocal(command: Command): string | undefined {
    switch (command.type) {
      case "restart": {
        const previous = state;
        state = createInitialState();
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
      case "claimReward": {
        if (state.phase !== "reward") return "REWARD_NOT_AVAILABLE";
        const reward = state.rewards.find(r => r.id === command.rewardId);
        if (!reward) return "REWARD_NOT_AVAILABLE";
        if (reward.kind === "item") {
          if (!reward.definitionId || !giveItem(reward.definitionId)) return "REWARD_NOT_AVAILABLE";
        } else if (reward.kind === "buff") {
          const effect = reward.effect;
          if (effect?.type !== "attackPercent" || !Number.isFinite(effect.value) || effect.value <= 0 || effect.value > 100) return "REWARD_NOT_AVAILABLE";
          state.runBonuses = {attackPercent:(state.runBonuses?.attackPercent ?? 0) + effect.value};
        } else if (reward.kind === "heal") {
          state.territory.hp = Math.min(state.territory.maxHp, state.territory.hp + (reward.amount ?? 0));
        } else if (reward.kind === "coins") {
          state.coins += reward.amount ?? 0;
        } else if (reward.kind === "character") {
          if (state.characters.length >= 3) return "TEAM_FULL";
          const index = state.characters.length + 1;
          const characterId = "character-" + index, wandId = "wand-" + (state.wands.length + 1);
          const sequenceId = index === 2 ? "wood-9" : "metal-9";
          state.characters.push({id: characterId, name: "同行者 " + index, sequenceId,
            level:1,grade:reward.grade ?? "common",wandIds:[wandId],mana:100,maxMana:100,manaRegen:12});
          state.wands.push({id:wandId,name:"同行法杖",characterId,level:1,grade:"common",
            width:3,height:3,placements:[],cooldowns:{}});
          if (!state.knowledge.sequenceIds.includes(sequenceId)) state.knowledge.sequenceIds.push(sequenceId);
          giveItem(index === 2 ? "regrowth" : "metal-needle");
        } else if (reward.kind === "wand") {
          const id = "wand-" + (state.wands.length + 1);
          state.wands.push({id,name:"备用法杖",characterId:null,level:1,grade:reward.grade ?? "common",
            width:3,height:3,placements:[],cooldowns:{}});
        }
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
        if (command.action === "heal") state.territory.hp = state.territory.maxHp;
        else if (command.action === "grantSpell" || command.action === "grantItem") {
          if (!command.definitionId || (command.action === "grantSpell" && !content.spells[command.definitionId]) ||
            !giveItem(command.definitionId)) return "CHEAT_UNAVAILABLE";
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
      if (["placeItem", "removeItem", "mergeRecipe", "mergeItems", "equipWand", "unequipWand"].includes(command.type)) {
        const transition = applyLoadoutCommand(state, command, content);
        state = transition.state;
        result = transition.result;
      } else if (command.type === "upgradeTerritory") {
        const transition = applyTerritoryUpgrade(state, command);
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
    subscribe(listener) {listeners.add(listener);return () => {listeners.delete(listener)}},
    tick(dtMs) {
      if (disposed || !Number.isFinite(dtMs) || dtMs <= 0 || state.phase !== "battle" || state.paused || state.backpackOpen) return;
      const afterSeq = state.nextEventSeq - 1;
      const oldRevision = state.revision;
      const oldLevel = state.playerLevel;
      state = stepBattle(state, Math.min(dtMs, 250) * state.speed, content).state;
      for (let level = oldLevel + 1; level <= state.playerLevel; level++) {
        const candidates = ["amplify", "regrowth", "double"];
        const definitionId = candidates[(level - 2) % candidates.length];
        if (giveItem(definitionId)) emit("player.levelReward", {level, definitionId});
      }
      if (state.phase === "reward" && state.rewards.length === 0) prepareRewards();
      if (state.revision !== oldRevision || state.nextEventSeq - 1 !== afterSeq) notify(afterSeq);
    },
    dispose() {disposed=true;listeners.clear()}
  };
}
