import type { Command, CommandResult, RuntimePort } from '../contracts';
import { GAME_SPEEDS, type GameSpeed } from '../contracts';
import { gradeOrder } from '../content/grades';

export const remoteCommandTypes = ['startWave', 'deployConstruct', 'restart', 'setPaused', 'setSpeed', 'upgradeTerritory', 'repairTerritory', 'upgradeTerritoryRecovery', 'setBackpack', 'placeItem',
  'removeItem', 'clearWand', 'discardItem', 'discardWand', 'equipGear', 'unequipGear', 'discardGear', 'useItem', 'discardSupply', 'mergeRecipe', 'mergeItems', 'claimReward', 'refreshRewards', 'equipWand', 'unequipWand', 'setCheats', 'cheat'] as const;
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
    case 'deployConstruct':
      if(identifier(c.characterId)&&identifier(c.itemId)&&typeof c.x==='number'&&Number.isFinite(c.x)&&c.x>=0&&c.x<=100
        &&typeof c.y==='number'&&Number.isFinite(c.y)&&c.y>=0&&c.y<=100)
        return {id,type:c.type,characterId:c.characterId,itemId:c.itemId,x:c.x,y:c.y}; break;
    case 'restart': return { id, type: c.type };
    case 'setPaused': if (typeof c.paused === 'boolean') return {id,type:c.type,paused:c.paused}; break;
    case 'setSpeed': if (GAME_SPEEDS.includes(c.speed as GameSpeed)) return {id,type:c.type,speed:c.speed as GameSpeed}; break;
    case 'upgradeTerritory':
    case 'upgradeTerritoryRecovery':
    case 'repairTerritory': if (c.track === 'wall' || c.track === 'shield') return {id,type:c.type,track:c.track}; break;
    case 'setBackpack': if (typeof c.open === 'boolean') return {id,type:c.type,open:c.open}; break;
    case 'setCheats': if (typeof c.enabled === 'boolean') return {id,type:c.type,enabled:c.enabled}; break;
    case 'placeItem':
      if (identifier(c.wandId) && identifier(c.itemId) && integer(c.x) && integer(c.y) &&
        integer(c.rotation) && c.rotation >= 0 && c.rotation <= 3)
        return {id,type:c.type,wandId:c.wandId,itemId:c.itemId,x:c.x,y:c.y,rotation:c.rotation as 0|1|2|3}; break;
    case 'removeItem': if (identifier(c.wandId) && identifier(c.itemId)) return {id,type:c.type,wandId:c.wandId,itemId:c.itemId}; break;
    case 'discardItem': if(identifier(c.itemId))return {id,type:c.type,itemId:c.itemId};break;
    case 'discardWand': if(identifier(c.wandId))return {id,type:c.type,wandId:c.wandId};break;
    case 'clearWand': if(identifier(c.wandId))return {id,type:c.type,wandId:c.wandId};break;
    case 'equipGear': if(identifier(c.gearId)&&identifier(c.characterId))return {id,type:c.type,gearId:c.gearId,characterId:c.characterId};break;
    case 'unequipGear':
    case 'discardGear': if(identifier(c.gearId))return {id,type:c.type,gearId:c.gearId};break;
    case 'useItem':
    case 'discardSupply': if(identifier(c.itemId))return {id,type:c.type,itemId:c.itemId};break;
    case 'mergeRecipe':
      if (identifier(c.wandId) && identifier(c.recipeId) && Array.isArray(c.itemIds) && c.itemIds.length <= 64 && c.itemIds.every(identifier))
        return {id,type:c.type,wandId:c.wandId,recipeId:c.recipeId,itemIds:[...c.itemIds]}; break;
    case 'mergeItems':
      if (identifier(c.sourceItemId) && identifier(c.targetItemId)) return {id,type:c.type,sourceItemId:c.sourceItemId,targetItemId:c.targetItemId}; break;
    case 'claimReward': if (identifier(c.rewardId)) return {id,type:c.type,rewardId:c.rewardId}; break;
    case 'refreshRewards': if (identifier(c.offerId)) return {id,type:c.type,offerId:c.offerId}; break;
    case 'equipWand':
      if (identifier(c.wandId) && identifier(c.characterId) && (c.slot === undefined || c.slot === 0 || c.slot === 1))
        return {id,type:c.type,wandId:c.wandId,characterId:c.characterId,...(c.slot !== undefined ? {slot:c.slot} : {})}; break;
    case 'unequipWand': if (identifier(c.wandId)) return {id,type:c.type,wandId:c.wandId}; break;
    case 'cheat':
      if (c.action === 'heal' || c.action === 'revive') return {id,type:c.type,action:c.action};
      if((c.action === 'grantWand' || c.action === 'grantSpell' || c.action === 'grantItem' || c.action === 'grantGear' || c.action === 'grantSupply') && identifier(c.definitionId)
        && (c.grade === undefined || gradeOrder.some(grade=>grade === c.grade))
        && (c.level === undefined || (integer(c.level) && c.level >= 1)))
        return {id,type:c.type,action:c.action,definitionId:c.definitionId,...(c.grade !== undefined ? {grade:c.grade as typeof gradeOrder[number]} : {}),...(c.level !== undefined ? {level:c.level as number} : {})};
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
  if(command.type === 'deployConstruct') {
    const item=Object.hasOwn(state.items,command.itemId)?state.items[command.itemId]:undefined;
    if(!item || !state.knowledge.spellIds.includes(item.definitionId))return reject('UNAVAILABLE');
  }
  if (command.type === 'mergeRecipe' && !state.knowledge.recipeIds.includes(command.recipeId)) return reject('UNAVAILABLE');
  if(command.type === 'discardItem') {
    const item=Object.hasOwn(state.items,command.itemId)?state.items[command.itemId]:undefined;
    if(item&&![...state.knowledge.spellIds,...state.knowledge.arcanaIds].includes(item.definitionId))return reject('UNAVAILABLE');
  }
  if(command.type === 'equipGear'||command.type === 'unequipGear'||command.type === 'discardGear') {
    const gear=Object.hasOwn(state.gear??{},command.gearId)?state.gear![command.gearId]:undefined;
    if(gear?.definitionId&&!(state.knowledge.gearIds??[]).includes(gear.definitionId))return reject('UNAVAILABLE');
  }
  if(command.type === 'useItem'||command.type === 'discardSupply') {
    const supply=Object.hasOwn(state.supplies??{},command.itemId)?state.supplies![command.itemId]:undefined;
    if(supply&&!(state.knowledge.itemIds??[]).includes(supply.definitionId))return reject('UNAVAILABLE');
  }
  // grantSpell may target an unknown ID after explicit local unlock; results never disclose its catalog.
  try { return sanitizeResult(runtime.dispatch(command)); } catch { return reject('COMMAND_FAILED'); }
}
/** Never return runtime diagnostics that could quote hidden content or internal stack traces. */
export function sanitizeResult(result: CommandResult): CommandResult {
  return {commandId:result.commandId,status:result.status,revision:result.revision,
    ...(result.status === 'rejected' ? {code:'COMMAND_REJECTED'} : {})};
}
