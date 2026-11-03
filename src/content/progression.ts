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
