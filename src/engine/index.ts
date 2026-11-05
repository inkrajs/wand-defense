import type { CharacterInstance, ContentCatalog, GameEvent, GameState, Transition } from "../contracts";
import { compileWand } from "../loadout";
import { experienceThreshold } from "../content/progression";
import { castSpell } from "./effects";
import { advanceProjectiles } from "./projectiles";
import { advanceBeams } from "./beams";
import { advanceAreaEffects } from "./areaEffects";
import { advanceChains } from "./chains";
import { advanceEnemyStatuses } from "./statusEffects";
import { nextCombatRandom } from "./random";
import { getCharacterStats } from "../content/characters";
import { advanceEnemies, beginWave } from "./waves";
import { advanceTerritoryRecovery } from "./territoryRecovery";
import { grantEnemyLoot } from "./loot";
import { grantCoinIncome } from "../content/economy";
import { discardExpiredRemains, rememberFallenUnit } from "./remains";
import { advanceConstructs, releaseConstructDeathBurst } from "./constructs";

export const BATTLE_STEP_MS = 50;
type Emit = (type: string, data: Record<string, unknown>) => void;
type KillCause = { effect?: string; sourceItemId?: string; sourceCharacterId?: string; sourceLuck?: number };
type PendingKills = Map<string, KillCause>;

function transition(source: GameState, run: (state: GameState, emit: Emit, pendingKills: PendingKills) => void, owned = false): Transition {
  const state = owned ? source : structuredClone(source);
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
        ...(typeof data.sourceLuck === "number" && Number.isFinite(data.sourceLuck) && data.sourceLuck !== 0 ? { sourceLuck: data.sourceLuck } : {}),
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

function settleDeaths(state: GameState, emit: Emit, pendingKills: PendingKills, content: ContentCatalog): void {
  discardExpiredRemains(state);
  const beneficiaries = new Set<CharacterInstance>();
  for (const entity of state.entities) {
    if (entity.hp > 0) continue;
    rememberFallenUnit(state, entity);
    if (entity.kind !== "enemy") {
      if (entity.deathBurst) releaseConstructDeathBurst(state, entity, emit);
      continue;
    }
    const xp = Math.max(1, Math.round(entity.maxHp / 8));
    state.xp += xp;
    const cause = pendingKills.get(entity.id);
    const sourceLuck = cause?.sourceCharacterId ? Math.max(0,cause.sourceLuck ?? 0) : 0;
    const baseCoins = nextCombatRandom(state) < Math.min(0.8,Math.max(0.1,0.25+(state.luck+sourceLuck)*0.01)) ? 1 : 0;
    const coins = grantCoinIncome(state,baseCoins,content).amount;
    pendingKills.delete(entity.id);
    // Projectiles retain their firing character even if their wand changes hands in flight.
    const beneficiary = cause?.sourceCharacterId
      ? state.characters.find(character => character.id === cause.sourceCharacterId) : undefined;
    if (beneficiary) {
      beneficiary.xp = (beneficiary.xp ?? 0) + xp;
      beneficiaries.add(beneficiary);
    }
    const level = typeof entity.level === "number" && Number.isFinite(entity.level) && entity.level >= 1
      ? entity.level : Math.max(1, Number.isFinite(state.wave) ? Math.floor(state.wave) : 1);
    emit("enemyKilled", { entityId: entity.id, definitionId: entity.definitionId, xp, coins,
      x: entity.x, y: entity.y, maxHp: entity.maxHp, level, grade: entity.grade ?? "common", wave: state.wave,
      ...cause, ...(beneficiary ? { xpCharacterId: beneficiary.id } : {}) });
    grantEnemyLoot(state,entity,sourceLuck,content,emit);
  }
  state.entities = state.entities.filter(entity => entity.hp > 0 && (entity.remainingMs === undefined || entity.remainingMs > 0));
  // Each character owns a cumulative pool. The team tally never drives upgrades.
  for (const character of beneficiaries) {
    while ((character.xp ?? 0) >= experienceThreshold(character.level)) {
      const previousLevel = character.level;
      character.level++;
      // The new level's growth and currently owned equipment determine the refill cap.
      character.mana = getCharacterStats(state, character.id, content)?.final.maxMana ?? character.maxMana;
      emit("characterLevelUp", { characterId: character.id, level: character.level, previousLevel });
    }
  }
  state.playerLevel = state.characters[0]?.level ?? 1;
}

/** Pure simulation: no timers, transport, reward UI or hidden second runtime. */
export function stepBattle(state: GameState, dtMs: number, content: ContentCatalog): Transition {
  return advanceBattle(state,dtMs,content,false);
}

/** Internal runtime path: the caller exclusively owns state and publishes only cloned snapshots. */
export function advanceOwnedBattle(state: GameState, dtMs: number, content: ContentCatalog): Transition {
  return advanceBattle(state,dtMs,content,true);
}

function advanceBattle(state: GameState, dtMs: number, content: ContentCatalog, owned: boolean): Transition {
  if (state.phase !== "battle" || state.paused || state.backpackOpen || !Number.isFinite(dtMs) || dtMs <= 0) {
    return { state, events: [] };
  }
  return transition(state, (next, emit, pendingKills) => {
    let remaining = dtMs;
    while (remaining > 0 && next.phase === "battle") {
      const step = Math.min(BATTLE_STEP_MS, remaining);
      next.gameTimeMs += step;
      remaining -= step;
      settleDeaths(next, emit, pendingKills, content);
      advanceEnemies(next, step, emit);
      // Enemy attacks are resolved before casting; a fallen territory cannot be revived.
      if (next.territory.hp <= 0) {
        next.territory.hp = 0;
        next.phase = "defeat";
        delete next.remains;
        next.entities = next.entities.filter(entity => entity.kind === "enemy");
        emit("defeat", { wave: next.wave });
        break;
      }
      advanceEnemyStatuses(next, step, emit);
      settleDeaths(next, emit, pendingKills, content);
      advanceTerritoryRecovery(next,step);
      // Advance only existing projectiles. New casts start flying on the next slice.
      const areasAtEntry = next.entities.filter(entity => entity.kind === "area");
      advanceProjectiles(next, step, emit);
      advanceBeams(next, step, emit);
      advanceChains(next, step, emit);
      advanceAreaEffects(next, step, emit, areasAtEntry);
      advanceConstructs(next,step,emit);
      settleDeaths(next, emit, pendingKills, content);
      for (const character of next.characters) {
        const view = getCharacterStats(next,character.id,content);
        if (!view) continue;
        const stats = view.final;
        character.mana = Math.min(stats.maxMana, character.mana + stats.manaRegen * step / 1000);
        for (const wand of next.wands.filter(wand => wand.characterId === character.id && character.wandIds.includes(wand.id))) {
          for (const itemId of Object.keys(wand.cooldowns)) {
            wand.cooldowns[itemId] = Math.max(0, wand.cooldowns[itemId] - step);
          }
          const compiled = compileWand(next, wand.id, content);
          for (const spell of compiled?.spells ?? []) {
            if(spell.effect === "building" || spell.triggeredByItemId) continue;
            const linkedItemId = spell.trigger?.payload.itemId ?? spell.condensedItemId;
            const additionalItemId = spell.trigger?.additionalPayload?.itemId;
            if ((linkedItemId && (wand.cooldowns[linkedItemId] ?? 0) > 0)
              || (additionalItemId && (wand.cooldowns[additionalItemId] ?? 0) > 0)) continue;
            const constructCost=spell.effect === "summon"?(spell.construct?.coinCost??0):0;
            if(!Number.isSafeInteger(constructCost) || constructCost < 0 || next.coins < constructCost)continue;
            if ((wand.cooldowns[spell.itemId] ?? 0) > 0 || character.mana < spell.manaCost) continue;
            if (castSpell(next, character.id, { ...spell, definitionId: spell.id, casts: spell.copies }, content, emit)) {
              character.mana = Math.max(0, character.mana - spell.manaCost);
              next.coins-=constructCost;
              wand.cooldowns[spell.itemId] = Math.max(BATTLE_STEP_MS, spell.cooldownMs);
              if (linkedItemId) wand.cooldowns[linkedItemId] = wand.cooldowns[spell.itemId];
              if (additionalItemId) wand.cooldowns[additionalItemId] = wand.cooldowns[spell.itemId];
            }
          }
        }
      }
      settleDeaths(next, emit, pendingKills, content);
      if (next.waveSpawnRemaining <= 0 && !next.entities.some(entity => entity.kind === "enemy" && entity.hp > 0)) {
        const coins = grantCoinIncome(next,5+next.wave*2,content).amount;
        for (const character of next.characters) {
          const view = getCharacterStats(next,character.id,content);
          if (view) character.mana = view.final.maxMana;
        }
        next.phase = "reward";
        delete next.remains;
        next.entities = next.entities.filter(entity=>entity.faction === "player" && (entity.kind === "summon" || entity.kind === "building")
          && entity.hp > 0 && (entity.remainingMs??0)>0);
        emit("waveCleared", { wave: next.wave, coins });
      }
    }
  },owned);
}
