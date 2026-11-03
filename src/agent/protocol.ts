import type { Command, CommandResult, RuntimePort } from '../contracts';

export const remoteCommandTypes = ['startWave', 'deploySpell', 'setPaused', 'setBackpack', 'placeItem',
  'removeItem', 'mergeRecipe', 'claimReward', 'equipWand', 'setCheats', 'cheat'] as const;
const identifier = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 160;
const integer = (value: unknown): value is number => Number.isSafeInteger(value);
/** Parse only the public semantic command schema; never pass arbitrary properties onward. */
export function parseRemoteCommand(input: unknown): Command | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return;
  const c = input as Record<string, unknown>;
  if (!identifier(c.id)) return;
  const id = c.id;
  switch (c.type) {
    case 'startWave': return { id, type: c.type };
    case 'setPaused': if (typeof c.paused === 'boolean') return {id,type:c.type,paused:c.paused}; break;
    case 'setBackpack': if (typeof c.open === 'boolean') return {id,type:c.type,open:c.open}; break;
    case 'setCheats': if (typeof c.enabled === 'boolean') return {id,type:c.type,enabled:c.enabled}; break;
    case 'deploySpell': {
      const position = c.position as Record<string, unknown> | null;
      if (identifier(c.wandId) && identifier(c.itemId) && position && !Array.isArray(position) &&
        typeof position.x === 'number' && Number.isFinite(position.x) &&
        typeof position.y === 'number' && Number.isFinite(position.y))
        return {id,type:c.type,wandId:c.wandId,itemId:c.itemId,position:{x:position.x,y:position.y}};
      break;
    }
    case 'placeItem':
      if (identifier(c.wandId) && identifier(c.itemId) && integer(c.x) && integer(c.y) &&
        integer(c.rotation) && c.rotation >= 0 && c.rotation <= 3)
        return {id,type:c.type,wandId:c.wandId,itemId:c.itemId,x:c.x,y:c.y,rotation:c.rotation as 0|1|2|3}; break;
    case 'removeItem': if (identifier(c.wandId) && identifier(c.itemId)) return {id,type:c.type,wandId:c.wandId,itemId:c.itemId}; break;
    case 'mergeRecipe':
      if (identifier(c.wandId) && identifier(c.recipeId) && Array.isArray(c.itemIds) && c.itemIds.length <= 64 && c.itemIds.every(identifier))
        return {id,type:c.type,wandId:c.wandId,recipeId:c.recipeId,itemIds:[...c.itemIds]}; break;
    case 'claimReward': if (identifier(c.rewardId)) return {id,type:c.type,rewardId:c.rewardId}; break;
    case 'equipWand': if (identifier(c.wandId) && identifier(c.characterId)) return {id,type:c.type,wandId:c.wandId,characterId:c.characterId}; break;
    case 'cheat':
      if (c.action === 'heal') return {id,type:c.type,action:'heal'};
      if (c.action === 'grantSpell' && identifier(c.definitionId)) return {id,type:c.type,action:'grantSpell',definitionId:c.definitionId};
  }
}
export function dispatchRemote(runtime: RuntimePort, input: unknown): CommandResult {
  const state = runtime.getState();
  const command = parseRemoteCommand(input);
  const raw = input && typeof input === 'object' ? input as Record<string,unknown> : {};
  const reject = (code: string): CommandResult => ({commandId:identifier(raw.id)?raw.id:'invalid',status:'rejected',revision:state.revision,code});
  if (!command) return reject('INVALID_COMMAND');
  if ((command.type === 'cheat' || command.type === 'setCheats') && !state.cheats.unlocked) return reject('FORBIDDEN');
  if (command.type === 'cheat' && !state.cheats.enabled) return reject('FORBIDDEN');
  if (command.type === 'mergeRecipe' && !state.knowledge.recipeIds.includes(command.recipeId)) return reject('UNAVAILABLE');
  // grantSpell may target an unknown ID after explicit local unlock; results never disclose its catalog.
  try { return sanitizeResult(runtime.dispatch(command)); } catch { return reject('COMMAND_FAILED'); }
}
/** Never return runtime diagnostics that could quote hidden content or internal stack traces. */
export function sanitizeResult(result: CommandResult): CommandResult {
  return {commandId:result.commandId,status:result.status,revision:result.revision,
    ...(result.status === 'rejected' ? {code:'COMMAND_REJECTED'} : {})};
}
