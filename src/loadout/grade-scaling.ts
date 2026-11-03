import type { ArcanaDefinition, Grade } from '../contracts';
import { gradeOrder, gradePower } from '../content/grades';

/** Prototype balance knobs; gradePower remains the shared rarity strength table. */
export const gradeModifierTuning = {
  amplifyBonus: 1,
  focusBonus: 1,
  extraCopiesPerGrade: 1,
} as const;

export function gradeStrengthRatio(instanceGrade: Grade, referenceGrade: Grade): number {
  return gradePower[instanceGrade] / gradePower[referenceGrade];
}

export function gradedArcanaValue(definition: ArcanaDefinition, instanceGrade: Grade): number {
  const ratio = gradeStrengthRatio(instanceGrade, definition.grade);
  switch (definition.modifier) {
    case 'amplify':
      return 1 + (definition.value - 1) * ratio * gradeModifierTuning.amplifyBonus;
    case 'focus':
      return 1 + (definition.value - 1) * ratio * gradeModifierTuning.focusBonus;
    case 'double':
    case 'split': {
      const steps = gradeOrder.indexOf(instanceGrade) - gradeOrder.indexOf(definition.grade);
      return Math.max(1, Math.floor(definition.value) + steps * gradeModifierTuning.extraCopiesPerGrade);
    }
  }
}
