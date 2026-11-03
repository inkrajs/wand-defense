import type { WandInstance } from '../contracts';

/** Full rectangular slots; these templates do not contain or relocate spells. */
export const wandTemplates = {
  'wand-4x4': { name: '扩展法杖', width: 4, height: 4, level: 1, grade: 'common' },
  'wand-5x5': { name: '大型法杖', width: 5, height: 5, level: 1, grade: 'common' },
} as const;

export function createWandFromTemplate(definitionId: string, instanceId: string): WandInstance | undefined {
  if (!Object.hasOwn(wandTemplates, definitionId)) return undefined;
  const template = wandTemplates[definitionId as keyof typeof wandTemplates];
  return { ...template, id: instanceId, characterId: null, placements: [], cooldowns: {} };
}
