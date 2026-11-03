import type { ContentCatalog, GameState, SpellDefinition } from '../contracts';
import { areAdjacent, placementCells } from './geometry';
import { gradedArcanaValue, gradeStrengthRatio } from './grade-scaling';

/** Numeric fields already include arcana and the owner's current sequence. */
export interface CompiledSpell extends SpellDefinition {
  itemId: string;
  copies: number;
  modifierItemIds: string[];
}
export interface CompiledWand {
  wandId: string;
  characterId: string;
  spells: CompiledSpell[];
}

/** Compile on demand after a layout change. Never mutates definitions or state. */
export function compileWand(
  state: GameState, wandId: string, content: ContentCatalog,
): CompiledWand | undefined {
  const wand = state.wands.find(candidate => candidate.id === wandId);
  if (!wand || wand.characterId === null) return undefined;
  const character = state.characters.find(candidate => candidate.id === wand.characterId);
  if (!character || !character.wandIds.includes(wand.id)) return undefined;
  const sequence = content.sequences[character.sequenceId];
  const modifiers = wand.placements.flatMap(placement => {
    const item = state.items[placement.itemId];
    const definition = item?.kind === 'arcana' ? content.arcana[item.definitionId] : undefined;
    return definition ? [{ itemId: item.id, grade: item.grade, definition, cells: placementCells(definition.shape, placement) }] : [];
  });
  const spells = wand.placements.flatMap(placement => {
    const item = state.items[placement.itemId];
    const definition = item?.kind === 'spell' ? content.spells[item.definitionId] : undefined;
    if (!definition) return [];
    const spell: CompiledSpell = {
      ...definition,
      grade: item.grade, level: item.level,
      power: definition.power * gradeStrengthRatio(item.grade, definition.grade),
      shape: definition.shape.map(cell => ({ ...cell })),
      asset: { ...definition.asset },
      itemId: item.id, copies: 1, modifierItemIds: [],
    };
    const cells = placementCells(definition.shape, placement);
    for (const modifier of modifiers) {
      if (!areAdjacent(cells, modifier.cells)) continue;
      const value = gradedArcanaValue(modifier.definition, modifier.grade);
      if (!Number.isFinite(value) || value <= 0) continue;
      spell.modifierItemIds.push(modifier.itemId);
      switch (modifier.definition.modifier) {
        case 'amplify': spell.power *= value; break;
        case 'double':
        case 'split': spell.copies *= Math.max(1, Math.floor(value)); break;
        case 'focus': spell.power *= value; spell.range *= value; break;
      }
    }
    const bonus = sequence?.bonuses[spell.element] ?? 0;
    const multiplier = Number.isFinite(bonus) ? Math.max(0, 1 + bonus) : 1;
    spell.power *= multiplier;
    const attackPercent = state.runBonuses?.attackPercent ?? 0;
    if (spell.effect === 'projectile' && Number.isFinite(attackPercent)) spell.power *= Math.max(0,1 + attackPercent / 100);
    if ((spell.effect === 'summon' || spell.effect === 'building') && spell.hp !== undefined) {
      spell.hp *= multiplier;
    }
    return [spell];
  });
  return { wandId: wand.id, characterId: character.id, spells };
}
