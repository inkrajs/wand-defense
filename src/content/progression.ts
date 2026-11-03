import type { GameState } from "../contracts";

/** Prototype cumulative XP curve shared by simulation and presentation. */
export function experienceThreshold(level: number): number {
  const safeLevel = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  return safeLevel * (safeLevel + 1) * 10;
}
export function getExperienceProgress(xp: number, level: number): {value: number; max: number} {
  const safeLevel = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  const lower = safeLevel === 1 ? 0 : experienceThreshold(safeLevel - 1);
  const max = experienceThreshold(safeLevel) - lower;
  return {value: Math.max(0, Math.min(max, (Number.isFinite(xp) ? xp : 0) - lower)), max};
}


/** One-time legacy migration, applied by the runtime before simulation; emits no rewards. */
export function normalizeCharacterProgression(state: GameState): void {
  const legacyXp = Number.isFinite(state.xp) ? Math.max(0, state.xp) : 0;
  for (const [index, character] of state.characters.entries()) {
    if (character.xp !== undefined) continue;
    const level = Math.max(1, Math.floor(Number.isFinite(character.level) ? character.level : 1));
    const lower = level === 1 ? 0 : experienceThreshold(level - 1);
    character.xp = index === 0 ? Math.max(legacyXp, lower) : lower;
    // Invert the cumulative curve instead of replaying historical level-up events.
    const xpLevel = Math.floor((Math.sqrt(1 + 0.4 * character.xp) - 1) / 2) + 1;
    character.level = Math.max(level, xpLevel);
  }
  state.playerLevel = state.characters[0]?.level ?? 1;
}
