import type { ContentCatalog, GameState } from '../contracts';
import { getCharacterStats } from '../content/characters';

const boundedLuck = (value: unknown): number => typeof value === 'number' && Number.isFinite(value)
  ? Math.max(0, Math.min(1_000_000, value)) : 0;

/** Current characters are the deployed team. final.luck excludes the run-wide bonus. */
export function getWaveRewardLuck(state: GameState, content?: ContentCatalog): number {
  let total = boundedLuck(state.luck);
  const seen = new Set<string>();
  for (const character of state.characters) {
    if (seen.has(character.id)) continue;
    seen.add(character.id);
    const stats = getCharacterStats(state, character.id, content);
    total = Math.min(1_000_000, total + boundedLuck(stats?.final.luck));
  }
  return total;
}
