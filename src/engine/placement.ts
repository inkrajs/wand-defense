import type { ContentCatalog, GameState } from '../contracts';
import { compileWand, type CompiledSpell } from '../loadout/compile';

export interface DeploymentRequest {
  wandId: string;
  itemId: string;
  position: { x: number; y: number };
}

export type DeploymentPreview =
  | { ok: true; spell: CompiledSpell; characterId: string }
  | { ok: false; code: string };

/** The logical battlefield uses an inclusive 0..100 coordinate space. */
export function validateBattlePosition(position: unknown): boolean {
  if (typeof position !== 'object' || position === null || Array.isArray(position)) return false;
  const candidate = position as { x?: unknown; y?: unknown };
  return typeof candidate.x === 'number' && Number.isFinite(candidate.x) && candidate.x >= 0 && candidate.x <= 100
    && typeof candidate.y === 'number' && Number.isFinite(candidate.y) && candidate.y >= 0 && candidate.y <= 100;
}

/**
 * Read-only validation for one immediate summon/building deployment.
 * The caller owns the transaction that spends mana, starts cooldown, and creates entities.
 */
export function previewDeployment(
  state: GameState,
  request: DeploymentRequest,
  content: ContentCatalog,
): DeploymentPreview {
  if (state.phase !== 'battle' || !(state.territory.hp > 0) || state.paused || state.backpackOpen) {
    return { ok: false, code: 'BATTLE_NOT_ACTIVE' };
  }
  if (!validateBattlePosition(request.position)) return { ok: false, code: 'INVALID_POSITION' };

  const wand = state.wands.find(candidate => candidate.id === request.wandId);
  const character = wand && state.characters.find(candidate => candidate.id === wand.characterId);
  // Keep all unknown, inaccessible, and unlearned sources indistinguishable.
  if (!wand || !character || !character.wandIds.includes(wand.id)) {
    return { ok: false, code: 'DEPLOYMENT_UNAVAILABLE' };
  }
  const item = state.items[request.itemId];
  if (!item || item.kind !== 'spell' || !state.knowledge.spellIds.includes(item.definitionId)) {
    return { ok: false, code: 'DEPLOYMENT_UNAVAILABLE' };
  }

  const compiled = compileWand(state, wand.id, content);
  const spell = compiled?.spells.find(candidate => candidate.itemId === item.id);
  if (!compiled || !spell || compiled.characterId !== character.id || spell.id !== item.definitionId
    || content.spells[item.definitionId]?.id !== item.definitionId
    || (spell.effect !== 'summon' && spell.effect !== 'building')) {
    return { ok: false, code: 'DEPLOYMENT_UNAVAILABLE' };
  }

  if (!Number.isFinite(spell.copies) || !Number.isInteger(spell.copies) || spell.copies < 1 || spell.copies > 2) {
    return { ok: false, code: 'CAPACITY' };
  }
  if ((wand.cooldowns[item.id] ?? 0) > 0) return { ok: false, code: 'COOLDOWN' };
  if (!Number.isFinite(character.mana) || !Number.isFinite(spell.manaCost) || spell.manaCost < 0 || character.mana < spell.manaCost) {
    return { ok: false, code: 'INSUFFICIENT_MANA' };
  }

  const activeFromSource = state.entities.filter(entity =>
    entity.sourceItemId === item.id
    && entity.faction === 'player'
    && (entity.kind === 'summon' || entity.kind === 'building')
    && entity.hp > 0
    && (entity.remainingMs === undefined || entity.remainingMs > 0),
  ).length;
  if (activeFromSource + spell.copies > 2) return { ok: false, code: 'CAPACITY' };

  return { ok: true, spell, characterId: character.id };
}
