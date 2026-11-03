import type { CombatEntity, GameState } from "../contracts";
import { getCharacterAnchor } from "../content/characterAnchors";
import { integrateMotion } from "./motion";
import { getMonsterSize, getUnlockedMinionDefinitions } from "../content/monsters";

export type BossTier = "none" | "minor" | "major" | "apex";

export type WaveEncounter =
  | {type:"minions";count:number}
  | {type:"boss";tier:Exclude<BossTier,"none">;count:number};

export interface WaveSpec {
  encounters: WaveEncounter[];
  count: number;
  spawnIntervalMs: number;
  bossTier: BossTier;
  bossNodes: { id: string; spawnIndex: number; tier: Exclude<BossTier,"none"> }[];
}

const MAX_WAVE_ENEMIES = 60;
const FIELD_MIN = 0;
const FIELD_MAX = 100;
const CHARACTER_ANCHOR_Y = 84;
const TERRITORY_Y = 92;

/** Flatten any ordered encounter configuration into the same authoritative spawn schedule. */
export function buildWaveSpec(wave:number, encounters:readonly WaveEncounter[]):WaveSpec {
  const safeWave = Math.max(1,Math.floor(Number.isFinite(wave)?wave:1));
  const stages:WaveEncounter[] = [],bossNodes:WaveSpec["bossNodes"] = [];
  let count = 0;
  for (const encounter of encounters) {
    if (count >= MAX_WAVE_ENEMIES) break;
    const requested = Number.isFinite(encounter.count) ? Math.max(0,Math.floor(encounter.count)) : 0;
    const size = Math.min(requested,MAX_WAVE_ENEMIES-count);
    if (size === 0) continue;
    const stageIndex = stages.length;
    stages.push({...encounter,count:size});
    if (encounter.type === "boss") {
      for (let offset=0;offset<size;offset++) bossNodes.push({
        id:`boss-${safeWave}-${stageIndex}-${offset}`,spawnIndex:count+offset,tier:encounter.tier,
      });
    }
    count += size;
  }
  const last = stages.at(-1);
  return {encounters:stages,count,bossNodes,bossTier:last?.type==="boss"?last.tier:"none",
    spawnIntervalMs:Math.max(350,1000-Math.min(safeWave-1,65)*10)};
}

/** Deterministic prototype configurations; counts remain compatible with existing waves. */
export function getWaveSpec(wave: number): WaveSpec {
  const safeWave = Math.max(1,Math.floor(Number.isFinite(wave)?wave:1));
  const terminalTier:BossTier = safeWave%100===0?"apex":safeWave%10===0?"major":safeWave%5===0?"minor":"none";
  const count = Math.min(MAX_WAVE_ENEMIES,5+(safeWave-1)*2);
  const bossCount = terminalTier!=="none" ? Math.min(12,1+Math.floor(safeWave/10))
    : safeWave>=12&&safeWave%4===0 ? Math.min(4,1+Math.floor(safeWave/30)) : 0;
  const blocks = bossCount>0 ? bossCount+(terminalTier==="none"?1:0) : 1+safeWave%3;
  const minions = count-bossCount;
  const encounters:WaveEncounter[] = [];
  for (let index=0;index<blocks;index++) {
    const size = Math.floor(minions/blocks)+(index<minions%blocks?1:0);
    if (size>0) encounters.push({type:"minions",count:size});
    if (index<bossCount) {
      const finalBoss = index===bossCount-1&&terminalTier!=="none";
      const tier = finalBoss ? terminalTier : terminalTier==="apex"&&index%3===2 ? "major" : "minor";
      encounters.push({type:"boss",count:1,tier});
    }
  }
  return buildWaveSpec(safeWave,encounters);
}

/** Starts the next wave in place; rewards and wave completion are handled by runtime. */
export function beginWave(
  state: GameState,
  emit: (type: string, data: Record<string, unknown>) => void,
): void {
  state.wave += 1;
  state.phase = "battle";
  state.waveSpawnRemaining = getWaveSpec(state.wave).count;
  state.spawnRemainingMs = 0;
  state.entities = [];
  emit("waveStarted", { wave: state.wave, ...getWaveSpec(state.wave) });
}

/** Spawns, advances, and lets enemies attack. The caller supplies fixed steps (at most 50 ms). */
export function advanceEnemies(
  state: GameState,
  dtMs: number,
  emit: (type: string, data: Record<string, unknown>) => void,
): void {
  const dt = Math.max(0, Number.isFinite(dtMs) ? dtMs : 0);
  if (state.phase !== "battle" || state.paused || state.backpackOpen || dt === 0) return;

  state.spawnRemainingMs = Math.max(0, state.spawnRemainingMs - dt);
  if (state.waveSpawnRemaining > 0 && state.spawnRemainingMs <= 0) {
    spawnEnemy(state, emit);
    state.waveSpawnRemaining -= 1;
    state.spawnRemainingMs = getWaveSpec(state.wave).spawnIntervalMs;
  }

  for (const enemy of state.entities) {
    if (enemy.kind !== "enemy" || enemy.hp <= 0) continue;
    enemy.attackRemainingMs = Math.max(0, enemy.attackRemainingMs - dt);
    const target = getEnemyMovementTarget(state, enemy);
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const remaining = Math.hypot(dx, dy);
    if (remaining > 0) {
      const cap = Number.isFinite(enemy.speed) ? Math.max(0,enemy.speed) : 0;
      // Preserve old saves' current velocity; freshly spawned enemies carry a low entry speed.
      const current = Number.isFinite(enemy.moveSpeed) ? Math.max(0,Math.min(cap,enemy.moveSpeed!)) : cap;
      const rampMs = typeof enemy.moveRampMs === "number" && Number.isFinite(enemy.moveRampMs)
        ? enemy.moveRampMs : 1_200;
      const motion = integrateEnemyMotion(enemy, current, cap, rampMs, dt);
      enemy.moveSpeed = motion.speed;
      const step = Math.min(remaining, motion.distance);
      enemy.x = clamp(enemy.x + (dx / remaining) * step, FIELD_MIN, FIELD_MAX);
      // Off-screen arrivals keep their real position until they walk across y=0.
      enemy.y = clamp(enemy.y + (dy / remaining) * step, Math.min(FIELD_MIN, enemy.y), FIELD_MAX);
    }
    if (enemy.y >= TERRITORY_Y && enemy.attackRemainingMs <= 0) {
      const damage = Math.max(0, enemy.damage);
      const shield = Math.max(0, state.territory.shield ?? 0);
      const shieldAbsorbed = Math.min(shield, damage);
      const hpDamage = damage - shieldAbsorbed;
      if (state.territory.shield !== undefined) state.territory.shield = shield - shieldAbsorbed;
      state.territory.hp = Math.max(0, state.territory.hp - hpDamage);
      enemy.attackRemainingMs = enemy.cooldownMs;
      emit("territoryAttacked", { enemyId: enemy.id, sourceEntityId: enemy.id,
        targetId: "territory", x: enemy.x, y: enemy.y, damage, shieldAbsorbed, hpDamage,
        territoryShield: state.territory.shield ?? 0, territoryHp: state.territory.hp });
    }
  }
}

/** Applies slow only to distance during its remaining simulation-time segment. */
function integrateEnemyMotion(
  enemy: CombatEntity,
  current: number,
  cap: number,
  rampMs: number,
  dt: number,
): { speed: number; distance: number } {
  const slow = enemy.status?.slow;
  const remainingMs = slow && Number.isFinite(slow.remainingMs) ? Math.max(0, slow.remainingMs) : 0;
  const multiplier = slow && Number.isFinite(slow.multiplier) ? Math.max(0.1, Math.min(1, slow.multiplier)) : 1;
  const slowedMs = Math.min(dt, remainingMs);
  if (slowedMs <= 0 || multiplier >= 1) return integrateMotion(current, cap, rampMs, dt);

  const slowed = integrateMotion(current, cap, rampMs, slowedMs);
  const normal = integrateMotion(slowed.speed, cap, rampMs, dt - slowedMs);
  return { speed: normal.speed, distance: slowed.distance * multiplier + normal.distance };
}

function spawnEnemy(
  state: GameState,
  emit: (type: string, data: Record<string, unknown>) => void,
): void {
  const remainingBeforeSpawn = state.waveSpawnRemaining;
  const spec = getWaveSpec(state.wave);
  const spawnIndex = spec.count - remainingBeforeSpawn;
  const node = spec.bossNodes.find(candidate => candidate.spawnIndex === spawnIndex);
  const isBoss = node !== undefined;
  const tier = node?.tier ?? "none";
  const random = nextRandom(state);
  const minionOrdinal = spawnIndex - spec.bossNodes.filter(candidate => candidate.spawnIndex < spawnIndex).length;
  const unlocked = getUnlockedMinionDefinitions(state.wave);
  const firstWaveBasic = state.wave === 1
    ? unlocked.find(definition => definition.id === "enemy-basic")
    : undefined;
  const minionDefinition = !isBoss
    ? firstWaveBasic ?? unlocked[(minionOrdinal + Math.max(0, state.wave - 2)) % Math.max(1, unlocked.length)]
    : undefined;
  const fallbackMovement = spawnIndex % 2 === 1 ? "huntCharacter" : "straight";
  const movementMode = isBoss ? fallbackMovement : minionDefinition?.spawn?.movementMode ?? fallbackMovement;
  const huntsCharacter = movementMode === "huntCharacter" && state.characters.length > 0;
  const targetCharacter = huntsCharacter
    ? state.characters[Math.min(state.characters.length - 1, Math.floor(random * state.characters.length))]
    : undefined;
  const spawnX = state.wave === 1 ? 30 + random * 40 : FIELD_MIN + 10 + random * 80;
  const baseHp = 18 + (state.wave - 1) * 3;
  const tierMultiplier = tier === "apex" ? 16 : tier === "major" ? 7 : tier === "minor" ? 3 : 1;
  const spawn = isBoss ? undefined : minionDefinition?.spawn;
  const speed = isBoss ? 7 : (10 + Math.min(state.wave - 1,10) * 0.5) * (spawn?.speedMultiplier ?? 1);
  const definitionId = isBoss ? `boss-${tier}` : minionDefinition?.id ?? "enemy-basic";
  const hpMultiplier = spawn?.hpMultiplier ?? 1;
  const damageMultiplier = spawn?.damageMultiplier ?? 1;
  const cooldownMultiplier = spawn?.cooldownMultiplier ?? 1;
  const baseCooldownMs = Math.max(400, 1_000 - (state.wave - 1) * 5);
  const enemy: CombatEntity = {
    id: `enemy-${state.wave}-${remainingBeforeSpawn}`,
    definitionId,
    kind: "enemy",
    level: Math.max(1, Number.isFinite(state.wave) ? Math.floor(state.wave) : 1),
    grade: tier === "apex" ? "mythic" : tier === "major" ? "epic" : tier === "minor" ? "rare" : "common",
    faction: "enemy",
    x: spawnX,
    // Leave room for the full body and health strip, including larger bosses.
    y: -(getMonsterSize({ definitionId }).pixels / 6 + 2),
    movementMode: huntsCharacter ? "huntCharacter" : "straight",
    ...(targetCharacter ? { targetCharacterId: targetCharacter.id } : {}),
    hp: baseHp * tierMultiplier * hpMultiplier,
    maxHp: baseHp * tierMultiplier * hpMultiplier,
    damage: (2 + state.wave - 1) * (isBoss ? (tier === "apex" ? 5 : tier === "major" ? 3 : 2) : damageMultiplier),
    speed, moveSpeed: speed * .18, moveRampMs: isBoss ? 1_800 : 1_200,
    range: 4,
    cooldownMs: isBoss ? baseCooldownMs : Math.max(400, baseCooldownMs * cooldownMultiplier),
    attackRemainingMs: 0,
  };
  state.entities.push(enemy);
  emit(isBoss ? "bossSpawned" : "enemySpawned", {
    enemyId: enemy.id, definitionId, wave: state.wave, bossTier: tier,
  });
}

function getEnemyMovementTarget(state: GameState, enemy: CombatEntity): { x: number; y: number } {
  if (enemy.movementMode !== "huntCharacter") return { x: enemy.x, y: TERRITORY_Y };

  if (state.characters.length === 0) {
    enemy.movementMode = "straight";
    delete enemy.targetCharacterId;
    return { x: enemy.x, y: TERRITORY_Y };
  }

  let anchor = enemy.targetCharacterId
    ? getCharacterAnchor(state.characters, enemy.targetCharacterId)
    : undefined;
  if (!anchor) {
    const fallback = state.characters[0];
    enemy.targetCharacterId = fallback.id;
    anchor = getCharacterAnchor(state.characters, fallback.id);
  }
  if (!anchor) return { x: enemy.x, y: TERRITORY_Y };

  // Clamp the route at the character line, then continue down its lane to the territory.
  return enemy.y < CHARACTER_ANCHOR_Y
    ? { x: anchor.x, y: CHARACTER_ANCHOR_Y }
    : { x: anchor.x, y: TERRITORY_Y };
}

function nextRandom(state: GameState): number {
  state.rngState = (Math.imul(1_664_525, state.rngState >>> 0) + 1_013_904_223) >>> 0;
  return state.rngState / 0x1_0000_0000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
