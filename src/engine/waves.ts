import type { CombatEntity, GameState } from "../contracts";

export type BossTier = "none" | "minor" | "major" | "apex";

export interface WaveSpec {
  count: number;
  spawnIntervalMs: number;
  bossTier: BossTier;
}

const MAX_WAVE_ENEMIES = 60;
const FIELD_MIN = 0;
const FIELD_MAX = 100;
const TERRITORY_Y = 92;

/** Returns bounded combat pacing while allowing wave numbers to grow forever. */
export function getWaveSpec(wave: number): WaveSpec {
  const safeWave = Math.max(1, Math.floor(Number.isFinite(wave) ? wave : 1));
  const bossTier: BossTier = safeWave % 100 === 0
    ? "apex"
    : safeWave % 10 === 0
      ? "major"
      : safeWave % 5 === 0
        ? "minor"
        : "none";

  return {
    count: Math.min(MAX_WAVE_ENEMIES, 5 + (safeWave - 1) * 2),
    spawnIntervalMs: Math.max(350, 1_000 - Math.min(safeWave - 1, 65) * 10),
    bossTier,
  };
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
    const dx = 50 - enemy.x;
    const dy = TERRITORY_Y - enemy.y;
    const remaining = Math.hypot(dx, dy);
    if (remaining > 0) {
      const step = Math.min(remaining, Math.max(0, enemy.speed) * dt / 1_000);
      enemy.x = clamp(enemy.x + (dx / remaining) * step, FIELD_MIN, FIELD_MAX);
      enemy.y = clamp(enemy.y + (dy / remaining) * step, FIELD_MIN, FIELD_MAX);
    }
    if (enemy.y >= TERRITORY_Y && enemy.attackRemainingMs <= 0) {
      const damage = Math.max(0, enemy.damage);
      const shield = Math.max(0, state.territory.shield ?? 0);
      const shieldAbsorbed = Math.min(shield, damage);
      const hpDamage = damage - shieldAbsorbed;
      if (state.territory.shield !== undefined) state.territory.shield = shield - shieldAbsorbed;
      state.territory.hp = Math.max(0, state.territory.hp - hpDamage);
      enemy.attackRemainingMs = enemy.cooldownMs;
      emit("territoryAttacked", { enemyId: enemy.id, damage, shieldAbsorbed, hpDamage,
        territoryShield: state.territory.shield ?? 0, territoryHp: state.territory.hp });
    }
  }
}

function spawnEnemy(
  state: GameState,
  emit: (type: string, data: Record<string, unknown>) => void,
): void {
  const remainingBeforeSpawn = state.waveSpawnRemaining;
  const spec = getWaveSpec(state.wave);
  const isBoss = remainingBeforeSpawn === 1 && spec.bossTier !== "none";
  const tier = isBoss ? spec.bossTier : "none";
  const random = nextRandom(state);
  const baseHp = 18 + (state.wave - 1) * 3;
  const tierMultiplier = tier === "apex" ? 16 : tier === "major" ? 7 : tier === "minor" ? 3 : 1;
  const enemy: CombatEntity = {
    id: `enemy-${state.wave}-${remainingBeforeSpawn}`,
    definitionId: isBoss ? `boss-${tier}` : "enemy-basic",
    kind: "enemy",
    faction: "enemy",
    x: FIELD_MIN + 10 + random * 80,
    y: FIELD_MIN,
    hp: baseHp * tierMultiplier,
    maxHp: baseHp * tierMultiplier,
    damage: (2 + state.wave - 1) * (isBoss ? (tier === "apex" ? 5 : tier === "major" ? 3 : 2) : 1),
    speed: isBoss ? 7 : 10 + Math.min(state.wave - 1, 10) * 0.5,
    range: 4,
    cooldownMs: Math.max(400, 1_000 - (state.wave - 1) * 5),
    attackRemainingMs: 0,
  };
  state.entities.push(enemy);
  emit(isBoss ? "bossSpawned" : "enemySpawned", { enemyId: enemy.id, wave: state.wave, bossTier: tier });
}

function nextRandom(state: GameState): number {
  state.rngState = (Math.imul(1_664_525, state.rngState >>> 0) + 1_013_904_223) >>> 0;
  return state.rngState / 0x1_0000_0000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
