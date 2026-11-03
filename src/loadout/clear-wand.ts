import type { Command, CommandTransition, GameState } from '../contracts';
import { commit, reject } from './transition';

type ClearWandCommand = Extract<Command, {type:'clearWand'}>;

/** Return all placed magic in one transaction, preserving the wand's cooldown ledger. */
export function applyClearWandCommand(state: GameState, command: ClearWandCommand): CommandTransition {
  if (state.phase==='defeat') return reject(state,command,'DEFEAT','失败后不能调整构筑');
  if (!(state.phase==='ready' || state.phase==='reward' || (state.phase==='battle' && state.paused))) return reject(state,command,'LOADOUT_REQUIRES_PAUSE','请先暂停战斗');
  const matches=state.wands.filter(wand=>wand.id===command.wandId);
  if (!matches.length) return reject(state,command,'WAND_NOT_FOUND','法杖不存在');
  if (matches.length!==1) return reject(state,command,'WAND_OWNERSHIP_INVALID','法杖实例 ID 不唯一');
  const wand=matches[0];
  const declarations=state.characters.flatMap(character=>character.wandIds.filter(id=>id===wand.id).map(()=>character.id));
  const validOwner=wand.characterId===null ? declarations.length===0
    : state.characters.filter(character=>character.id===wand.characterId).length===1 && declarations.length===1 && declarations[0]===wand.characterId;
  if (!validOwner) return reject(state,command,'WAND_OWNERSHIP_INVALID','法杖归属不一致');
  const returnedItemIds=wand.placements.map(placement=>placement.itemId);
  if (new Set(returnedItemIds).size!==returnedItemIds.length) return reject(state,command,'ITEM_LOCATION_INVALID','法杖物品重复引用');
  for (const itemId of returnedItemIds) {
    const item=Object.hasOwn(state.items,itemId)?state.items[itemId]:undefined;
    const locationCount=state.wands.reduce((total,current)=>total+current.placements.filter(placement=>placement.itemId===itemId).length,0);
    if (!item || item.id!==itemId || !['spell','arcana'].includes(item.kind)
        || Object.values(state.items).filter(candidate=>candidate?.id===itemId).length!==1
        || state.backpack.includes(itemId) || locationCount!==1) {
      return reject(state,command,'ITEM_LOCATION_INVALID','物品实例或位置不唯一');
    }
  }
  return commit(state,command,{
    wands:state.wands.map(candidate=>candidate.id===wand.id?{...candidate,placements:[]}:candidate),
    backpack:[...state.backpack,...returnedItemIds],
  },'wandCleared',{wandId:wand.id,returnedItemIds,count:returnedItemIds.length});
}
