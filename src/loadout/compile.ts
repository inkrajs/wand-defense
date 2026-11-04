import type { AttackRollStats, ContentCatalog, GameState, SpellDefinition, SpellTrigger } from '../contracts';
import { getCharacterStats } from '../content/characters';
import { areAdjacent, placementCells } from './geometry';
import { gradedArcanaValue, gradeStrengthRatio } from './grade-scaling';
import { applyAdvancedModifiers, isAdvancedModifier } from './advanced-modifiers';
import { composeSpellTriggers, isTriggerModifier } from './trigger-composition';

/** Numeric fields already include arcana and the owner's current sequence. */
export interface CompiledSpell extends SpellDefinition {
  itemId: string;
  copies: number;
  burstCount: number;
  splitCount: number;
  modifierItemIds: string[];
  attackRoll: AttackRollStats;
  trigger?: SpellTrigger;
  triggeredByItemId?: string;
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
  const stats = getCharacterStats(state, character.id, content);
  if (!stats) return undefined;
  const final = stats.final;
  const modifiers = wand.placements.flatMap(placement => {
    const item = state.items[placement.itemId];
    const definition = item?.kind === 'arcana' ? content.arcana[item.definitionId] : undefined;
    return definition ? [{ itemId: item.id, grade: item.grade, definition, cells: placementCells(definition.shape, placement) }] : [];
  });
  const spells = wand.placements.flatMap(placement => {
    const item = state.items[placement.itemId];
    const definition = item?.kind === 'spell' ? content.spells[item.definitionId] : undefined;
    if (!definition) return [];
    const isConstruct = definition.effect === 'summon' || definition.effect === 'building';
    const isAttack = definition.effect === 'projectile' || definition.effect === 'beam' || definition.effect === 'area' || definition.effect === 'chain'
      || (isConstruct && definition.construct?.behavior === 'attack');
    const spell: CompiledSpell = {
      ...definition,
      grade: item.grade, level: item.level,
      power: definition.power * gradeStrengthRatio(item.grade, definition.grade)
        * (isAttack ? final.attackMultiplier : 1)
        + (isAttack ? final.attack : 0),
      ...(definition.effect === 'projectile'
        ? { speed: (definition.speed ?? 72) * final.projectileSpeedMultiplier }
        : {}),
      range: definition.range * final.rangeMultiplier + final.range,
      cooldownMs: definition.cooldownMs * final.cooldownMultiplier,
      shape: definition.shape.map(cell => ({ ...cell })),
      ...(definition.fusionElements ? { fusionElements: [...definition.fusionElements] } : {}),
      asset: { ...definition.asset },
      ...(definition.impact ? { impact: { ...definition.impact } } : {}),
      ...(definition.beam ? { beam: { ...definition.beam } } : {}),
      ...(definition.area ? { area: { ...definition.area, ...(definition.area.shower ? { shower: { ...definition.area.shower } } : {}) } } : {}),
      ...(definition.construct ? { construct: { ...definition.construct } } : {}),
      ...(definition.onHit ? { onHit: {
        ...definition.onHit,
        ...(definition.onHit.slow ? { slow: { ...definition.onHit.slow } } : {}),
        ...(definition.onHit.burn ? { burn: { ...definition.onHit.burn } } : {}),
      } } : {}),
      itemId: item.id, copies: 1, burstCount:1, splitCount:1, modifierItemIds: [],
      attackRoll: {
        accuracy: final.accuracy,
        critChance: final.critChance,
        critMultiplier: final.critMultiplier,
        sourceLuck: final.luck,
      },
    };
    const cells = placementCells(definition.shape, placement);
    const appliedModifierItems = new Set<string>();
    for (const modifier of modifiers) {
      if (!areAdjacent(cells, modifier.cells)) continue;
      if (appliedModifierItems.has(modifier.itemId)) continue;
      if (isAdvancedModifier(modifier.definition.modifier) || isTriggerModifier(modifier.definition.modifier)) continue;
      if (modifier.definition.modifier === 'velocity' && spell.effect !== 'projectile') continue;
      if (modifier.definition.modifier === 'area'
        && !spell.beam
        && !(spell.impact && (spell.impact.type === 'splash' || spell.impact.type === 'chain' || spell.impact.type === 'field'))
        && !spell.area) continue;
      const value = gradedArcanaValue(modifier.definition, modifier.grade);
      if (!Number.isFinite(value) || value <= 0) continue;
      appliedModifierItems.add(modifier.itemId);
      spell.modifierItemIds.push(modifier.itemId);
      switch (modifier.definition.modifier) {
        case 'amplify': spell.power *= value; break;
        case 'double': spell.burstCount=Math.min(64,spell.burstCount*Math.max(1,Math.floor(value))); break;
        case 'split': spell.splitCount=Math.min(64,spell.splitCount*Math.max(1,Math.floor(value))); break;
        case 'focus': spell.power *= value; spell.range *= value; break;
        case 'haste': spell.cooldownMs *= value; break;
        case 'efficiency': spell.manaCost *= value; break;
        case 'reach': spell.range *= value; break;
        case 'velocity': spell.speed = (spell.speed ?? 72) * value; break;
        case 'area':
          if (spell.beam) spell.beam.width *= value;
          if (spell.impact && (spell.impact.type === 'splash' || spell.impact.type === 'chain' || spell.impact.type === 'field')) {
            spell.impact.radius *= value;
          }
          if (spell.area) {
            spell.area.radius *= value;
            if (spell.area.shower) spell.area.shower.spread *= value;
            if (spell.area.mode === 'vortex' && spell.area.pullRadius !== undefined) spell.area.pullRadius *= value;
            if (spell.area.mode === 'ring') spell.range *= value;
          }
          break;
      }
    }
    applyAdvancedModifiers(spell, modifiers.filter(modifier => areAdjacent(cells, modifier.cells)));
    spell.copies=Math.min(64,spell.burstCount*spell.splitCount);
    // Fused spells share the elemental bonus evenly, without counting an element twice.
    const elements = [...new Set([spell.element, ...(definition.fusionElements ?? [])])];
    const elementBonus = elements.reduce((sum, element) => {
      const bonus = final.elementBonuses[element] ?? 0;
      return sum + (Number.isFinite(bonus) ? bonus : 0);
    }, 0) / elements.length;
    const multiplier = Math.max(0, 1 + elementBonus);
    spell.power *= multiplier;
    if ((spell.effect === 'summon' || spell.effect === 'building') && spell.hp !== undefined) {
      spell.hp *= multiplier * gradeStrengthRatio(item.grade, definition.grade);
    }
    if (isConstruct && spell.construct) spell.construct.hp *= multiplier * gradeStrengthRatio(item.grade, definition.grade);
    return [spell];
  });
  composeSpellTriggers(spells, wand, modifiers, content);
  return { wandId: wand.id, characterId: character.id, spells };
}
