import type { ArcanaDefinition, Grade } from '../contracts';
import { gradeOrder, gradePower } from '../content/grades';

/** Prototype balance knobs; gradePower remains the shared rarity strength table. */
export const gradeModifierTuning = {
  amplifyBonus: 1,
  focusBonus: 1,
  extraCopiesPerGrade: 1,
  minimumReductionMultiplier: 0.1,
} as const;

export function gradeStrengthRatio(instanceGrade: Grade, referenceGrade: Grade): number {
  return gradePower[instanceGrade] / gradePower[referenceGrade];
}

export function gradedArcanaValue(definition: ArcanaDefinition, instanceGrade: Grade): number {
  const ratio = gradeStrengthRatio(instanceGrade, definition.grade);
  switch (definition.modifier) {
    case 'hitTrigger':
    case 'timerTrigger':
      return definition.value;
    case 'amplify':
      return 1 + (definition.value - 1) * ratio * gradeModifierTuning.amplifyBonus;
    case 'focus':
      return 1 + (definition.value - 1) * ratio * gradeModifierTuning.focusBonus;
    case 'haste':
    case 'efficiency':
    case 'slow':
      return Math.max(gradeModifierTuning.minimumReductionMultiplier, 1 + (definition.value - 1) * ratio);
    case 'reach':
    case 'velocity':
    case 'area':
    case 'duration':
      return 1 + (definition.value - 1) * ratio;
    case 'pierce':
    case 'capacity':
    case 'burn':
    case 'knockback':
    case 'precision':
      return definition.value * ratio;
    case 'double':
    case 'split': {
      const steps = gradeOrder.indexOf(instanceGrade) - gradeOrder.indexOf(definition.grade);
      return Math.max(1, Math.floor(definition.value) + steps * gradeModifierTuning.extraCopiesPerGrade);
    }
  }
}
