import type { ContentCatalog, GameEvent, GameState, Transition } from "../contracts";
import { compileWand } from "../loadout";
import { advanceAllies, castSpell } from "./effects";
import { advanceEnemies, beginWave } from "./waves";

export const BATTLE_STEP_MS = 50;
type Emit = (type: string, data: Record<string, unknown>) => void;

function transition(source: GameState, run: (state: GameState, emit: Emit) => void): Transition {
  const state = structuredClone(source);
  const events: GameEvent[] = [];
  const emit: Emit = (type, data) => {
    const event: GameEvent = { seq: state.nextEventSeq++, type, gameTimeMs: state.gameTimeMs, data };
    events.push(event);
  };
  run(state, emit);
  state.revision++;
  state.events.push(...events);
  return { state, events };
}

/** Runtime owns reward selection; the engine only opens a fresh combat wave. */
export function startBattle(state: GameState, _content: ContentCatalog): Transition {
  if (state.phase !== "ready" || state.paused || state.backpackOpen || state.territory.hp <= 0) {
    return { state, events: [] };
  }
  return transition(state, (next, emit) => beginWave(next, emit));
}

function settleDeaths(state: GameState, emit: Emit): void {
  for (const entity of state.entities) {
    if (entity.hp > 0 || entity.kind !== "enemy") continue;
    const xp = Math.max(1, Math.round(entity.maxHp / 8));
    state.xp += xp;
    state.rngState = (Math.imul(state.rngState, 1664525) + 1013904223) >>> 0;
    const coins = state.rngState / 0x100000000 < Math.min(0.8, Math.max(0.1, 0.25 + state.luck * 0.01)) ? 1 : 0;
    state.coins += coins;
    emit("enemyKilled", { entityId: entity.id, definitionId: entity.definitionId, xp, coins });
  }
  state.entities = state.entities.filter(entity => entity.hp > 0 && (entity.remainingMs === undefined || entity.remainingMs > 0));
  // XP is cumulative; each threshold is crossed once even for multi-level boss kills.
  while (state.xp >= state.playerLevel * (state.playerLevel + 1) * 10) {
    state.playerLevel++;
    emit("playerLevelUp", { level: state.playerLevel });
  }
}

/** Pure simulation: no timers, transport, reward UI or hidden second runtime. */
export function stepBattle(state: GameState, dtMs: number, content: ContentCatalog): Transition {
  if (state.phase !== "battle" || state.paused || state.backpackOpen || !Number.isFinite(dtMs) || dtMs <= 0) {
    return { state, events: [] };
  }
  return transition(state, (next, emit) => {
    let remaining = dtMs;
    while (remaining > 0 && next.phase === "battle") {
      const step = Math.min(BATTLE_STEP_MS, remaining);
      next.gameTimeMs += step;
      remaining -= step;
      settleDeaths(next, emit);
      advanceEnemies(next, step, emit);
      // Enemy attacks are resolved before casting; a fallen territory cannot be revived.
      if (next.territory.hp <= 0) {
        next.territory.hp = 0;
        next.phase = "defeat";
        emit("defeat", { wave: next.wave });
        break;
      }
      advanceAllies(next, step, content, emit);
      settleDeaths(next, emit);
      for (const character of next.characters) {
        character.mana = Math.min(character.maxMana, character.mana + character.manaRegen * step / 1000);
        for (const wand of next.wands.filter(wand => wand.characterId === character.id && character.wandIds.includes(wand.id))) {
          for (const itemId of Object.keys(wand.cooldowns)) {
            wand.cooldowns[itemId] = Math.max(0, wand.cooldowns[itemId] - step);
          }
          const compiled = compileWand(next, wand.id, content);
          for (const spell of compiled?.spells ?? []) {
            if ((wand.cooldowns[spell.itemId] ?? 0) > 0 || character.mana < spell.manaCost) continue;
            if (castSpell(next, character.id, { ...spell, definitionId: spell.id, casts: spell.copies }, content, emit)) {
              character.mana = Math.max(0, character.mana - spell.manaCost);
              wand.cooldowns[spell.itemId] = Math.max(BATTLE_STEP_MS, spell.cooldownMs);
            }
          }
        }
      }
      settleDeaths(next, emit);
      if (next.waveSpawnRemaining <= 0 && !next.entities.some(entity => entity.kind === "enemy" && entity.hp > 0)) {
        const coins = 5 + next.wave * 2;
        next.coins += coins;
        next.phase = "reward";
        next.entities = [];
        emit("waveCleared", { wave: next.wave, coins });
      }
    }
  });
}
