import type { ContentCatalog, GameEvent, GameState, Transition } from "../contracts";
import { compileWand } from "../loadout";
import { experienceThreshold } from "../content/progression";
import { castSpell } from "./effects";
import { advanceProjectiles } from "./projectiles";
import { advanceEnemies, beginWave } from "./waves";

export const BATTLE_STEP_MS = 50;
type Emit = (type: string, data: Record<string, unknown>) => void;
type KillCause = { effect?: string; sourceItemId?: string; sourceCharacterId?: string };
type PendingKills = Map<string, KillCause>;

function transition(source: GameState, run: (state: GameState, emit: Emit, pendingKills: PendingKills) => void): Transition {
  const state = structuredClone(source);
  const events: GameEvent[] = [];
  const pendingKills: PendingKills = new Map();
  const emit: Emit = (type, data) => {
    // Damage is emitted after HP changes. Retain only a real lethal hit from this transition.
    if (type === "damage" && typeof data.targetId === "string" && typeof data.amount === "number" && data.amount > 0) {
      const target = state.entities.find(entity => entity.id === data.targetId && entity.kind === "enemy");
      if (target && target.hp <= 0) pendingKills.set(target.id, {
        ...(typeof data.effect === "string" ? { effect: data.effect } : {}),
        ...(typeof data.sourceItemId === "string" ? { sourceItemId: data.sourceItemId } : {}),
        ...(typeof data.sourceCharacterId === "string" ? { sourceCharacterId: data.sourceCharacterId } : {}),
      });
    }
    const event: GameEvent = { seq: state.nextEventSeq++, type, gameTimeMs: state.gameTimeMs, data };
    events.push(event);
  };
  run(state, emit, pendingKills);
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

function settleDeaths(state: GameState, emit: Emit, pendingKills: PendingKills): void {
  for (const entity of state.entities) {
    if (entity.hp > 0 || entity.kind !== "enemy") continue;
    const xp = Math.max(1, Math.round(entity.maxHp / 8));
    state.xp += xp;
    state.rngState = (Math.imul(state.rngState, 1664525) + 1013904223) >>> 0;
    const coins = state.rngState / 0x100000000 < Math.min(0.8, Math.max(0.1, 0.25 + state.luck * 0.01)) ? 1 : 0;
    state.coins += coins;
    const cause = pendingKills.get(entity.id);
    pendingKills.delete(entity.id);
    const level = typeof entity.level === "number" && Number.isFinite(entity.level) && entity.level >= 1
      ? entity.level : Math.max(1, Number.isFinite(state.wave) ? Math.floor(state.wave) : 1);
    emit("enemyKilled", { entityId: entity.id, definitionId: entity.definitionId, xp, coins,
      x: entity.x, y: entity.y, maxHp: entity.maxHp, level, grade: entity.grade ?? "common", wave: state.wave,
      ...cause });
  }
  state.entities = state.entities.filter(entity => entity.hp > 0 && (entity.remainingMs === undefined || entity.remainingMs > 0));
  // XP is cumulative; each threshold is crossed once even for multi-level boss kills.
  while (state.xp >= experienceThreshold(state.playerLevel)) {
    state.playerLevel++;
    emit("playerLevelUp", { level: state.playerLevel });
  }
}

/** Pure simulation: no timers, transport, reward UI or hidden second runtime. */
export function stepBattle(state: GameState, dtMs: number, content: ContentCatalog): Transition {
  if (state.phase !== "battle" || state.paused || state.backpackOpen || !Number.isFinite(dtMs) || dtMs <= 0) {
    return { state, events: [] };
  }
  return transition(state, (next, emit, pendingKills) => {
    let remaining = dtMs;
    while (remaining > 0 && next.phase === "battle") {
      const step = Math.min(BATTLE_STEP_MS, remaining);
      next.gameTimeMs += step;
      remaining -= step;
      settleDeaths(next, emit, pendingKills);
      advanceEnemies(next, step, emit);
      // Enemy attacks are resolved before casting; a fallen territory cannot be revived.
      if (next.territory.hp <= 0) {
        next.territory.hp = 0;
        next.phase = "defeat";
        next.entities = next.entities.filter(entity => entity.kind !== "projectile");
        emit("defeat", { wave: next.wave });
        break;
      }
      // Advance only existing projectiles. New casts start flying on the next slice.
      advanceProjectiles(next, step, emit);
      settleDeaths(next, emit, pendingKills);
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
      settleDeaths(next, emit, pendingKills);
      if (next.waveSpawnRemaining <= 0 && !next.entities.some(entity => entity.kind === "enemy" && entity.hp > 0)) {
        const coins = 5 + next.wave * 2;
        next.coins += coins;
        for (const character of next.characters) character.mana = character.maxMana;
        next.phase = "reward";
        next.entities = [];
        emit("waveCleared", { wave: next.wave, coins });
      }
    }
  });
}
