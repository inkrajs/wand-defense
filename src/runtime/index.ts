import type { Command, CommandResult, ContentCatalog, GameEvent, GameState, Id, RuntimePort } from "../contracts";
import { demoContent } from "../content/demo";
import { startBattle, stepBattle } from "../engine";
import { applyLoadoutCommand } from "../loadout";
import { createInitialState } from "./initial";

export interface GameRuntime extends RuntimePort { tick(dtMs: number): void; dispose(): void }
export function createGameRuntime(content: ContentCatalog = demoContent): GameRuntime {
  let state = createInitialState();
  let pausedBeforeBackpack = false;
  let disposed = false;
  const listeners = new Set<(s: GameState, e: GameEvent[]) => void>();
  const results = new Map<Id, CommandResult>();
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
    state.items[id] = {id, definitionId, kind: content.spells[definitionId] ? "spell" : "arcana", level: 1, grade: "common"};
    state.backpack.push(id);
    discover(definitionId);
    return true;
  }
  function prepareRewards() {
    const ids = ["amplify", "double", "regrowth", "fire-spirit", "metal-needle", "wood-spirit", "metal-spirit", "split", "focus"];
    const definitionId = ids[(state.wave - 1) % ids.length];
    const definition = content.spells[definitionId] ?? content.arcana[definitionId];
    state.rewards = [
      {id: "reward-" + state.wave + "-item", kind: "item", definitionId, label: "获得 " + (definition?.name ?? "构筑材料")},
      {id: "reward-" + state.wave + "-heal", kind: "heal", amount: 35, label: "领地恢复 35 点生命"}
    ];
    if (state.characters.length < 3 && (state.wave === 1 || state.wave % 3 === 0)) {
      state.rewards.push({id: "reward-" + state.wave + "-character", kind: "character", label: "招募一名同行者"});
    } else if (state.wands.length < state.characters.length * 2) {
      state.rewards.push({id: "reward-" + state.wave + "-wand", kind: "wand", label: "获得一根额外法杖"});
    } else {
      state.rewards.push({id: "reward-" + state.wave + "-coins", kind: "coins", amount: 20, label: "获得 20 金币"});
    }
    // Reward offers are visible discoveries; unoffered definitions stay undisclosed.
    if (definition) discover(definitionId);
    emit("reward.offered", {wave: state.wave, rewards: structuredClone(state.rewards)});
  }
  function applyLocal(command: Command): string | undefined {
    switch (command.type) {
      case "startWave": {
        if (state.phase !== "ready" || state.backpackOpen || state.paused) return "WAVE_NOT_READY";
        state = startBattle(state, content).state;
        return;
      }
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
            level:1,grade:"common",wandIds:[wandId],mana:100,maxMana:100,manaRegen:12});
          state.wands.push({id:wandId,name:"同行法杖",characterId,level:1,grade:"common",
            width:3,height:3,placements:[],cooldowns:{}});
          if (!state.knowledge.sequenceIds.includes(sequenceId)) state.knowledge.sequenceIds.push(sequenceId);
          giveItem(index === 2 ? "regrowth" : "metal-needle");
        } else if (reward.kind === "wand") {
          const owner = state.characters.find(c => c.wandIds.length < 2);
          if (!owner) return "WAND_SLOTS_FULL";
          const id = "wand-" + (state.wands.length + 1);
          state.wands.push({id,name:"备用法杖",characterId:owner.id,level:1,grade:"common",
            width:3,height:3,placements:[],cooldowns:{}});
          owner.wandIds.push(id);
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
        else if (command.action === "grantSpell") {
          if (!command.definitionId || !content.spells[command.definitionId]) return "CHEAT_UNAVAILABLE";
          giveItem(command.definitionId);
        } else return "CHEAT_UNAVAILABLE";
        emit("cheat.executed", {action:command.action});
        return;
      default:
        return "UNKNOWN_COMMAND";
    }
  }
  return {
    getState: () => structuredClone(state),
    dispatch(command) {
      if (disposed) return {commandId:command.id,status:"rejected",revision:state.revision,code:"DISPOSED"};
      const previous = results.get(command.id);
      if (previous) return structuredClone(previous);
      const oldRevision = state.revision, afterSeq = state.nextEventSeq - 1;
      let result: CommandResult;
      if (["placeItem", "removeItem", "mergeRecipe", "equipWand"].includes(command.type)) {
        const transition = applyLoadoutCommand(state, command, content);
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
      state = stepBattle(state, Math.min(dtMs, 250), content).state;
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

