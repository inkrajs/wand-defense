import type { Command, CommandTransition, GameState, ItemInstance, WandInstance } from '../contracts';
import { commit, reject } from './transition';

type DiscardCommand = Extract<Command, {type:'discardItem'|'discardWand'}>;

function validWandOwnership(state: GameState, wand: WandInstance): boolean {
  if (state.wands.filter(candidate=>candidate.id===wand.id).length!==1) return false;
  const declarations=state.characters.flatMap(character=>character.wandIds.filter(id=>id===wand.id).map(()=>character.id));
  if (wand.characterId===null) return declarations.length===0;
  return state.characters.filter(character=>character.id===wand.characterId).length===1
    && declarations.length===1 && declarations[0]===wand.characterId;
}

/** One item record and exactly one real location, including the containing wand's ownership. */
function uniquelyLocatedItem(state: GameState, itemId: string): ItemInstance | undefined {
  if (!Object.hasOwn(state.items,itemId)) return;
  const item=state.items[itemId];
  if (!item || item.id!==itemId || !['spell','arcana'].includes(item.kind)
      || Object.values(state.items).filter(candidate=>candidate?.id===itemId).length!==1) return;
  let locations=state.backpack.filter(id=>id===itemId).length;
  for (const wand of state.wands) {
    const placements=wand.placements.filter(placement=>placement.itemId===itemId).length;
    if (placements && !validWandOwnership(state,wand)) return;
    locations+=placements;
  }
  return locations===1?item:undefined;
}

/** Only call after the drop is confirmed. Hovering over a target never performs a transaction. */
export function applyDiscardCommand(state: GameState, command: DiscardCommand): CommandTransition {
  if (state.phase==='defeat') return reject(state,command,'DEFEAT','失败后不能丢弃物品');
  if (!(state.phase==='ready' || state.phase==='reward' || (state.phase==='battle' && state.paused))) return reject(state,command,'LOADOUT_REQUIRES_PAUSE','请先暂停战斗');
  if (command.type==='discardItem') {
    if (!Object.hasOwn(state.items,command.itemId)) return reject(state,command,'ITEM_NOT_FOUND','物品不存在');
    const item=uniquelyLocatedItem(state,command.itemId);
    if (!item) return reject(state,command,'ITEM_LOCATION_INVALID','物品位置或归属不唯一');
    const items={...state.items};delete items[item.id];
    const wands=state.wands.map(wand=>{
      const cooldowns={...wand.cooldowns};delete cooldowns[item.id];
      return {...wand,placements:wand.placements.filter(placement=>placement.itemId!==item.id),cooldowns};
    });
    return commit(state,command,{items,wands,backpack:state.backpack.filter(id=>id!==item.id)},'itemDiscarded',{itemId:item.id,definitionId:item.definitionId});
  }
  if (command.type==='discardWand') {
    const matches=state.wands.filter(wand=>wand.id===command.wandId);
    if (!matches.length) return reject(state,command,'WAND_NOT_FOUND','法杖不存在');
    if (matches.length!==1 || !validWandOwnership(state,matches[0])) return reject(state,command,'WAND_OWNERSHIP_INVALID','法杖归属不唯一');
    const wand=matches[0];
    if (wand.characterId!==null) return reject(state,command,'WAND_EQUIPPED','请先卸下法杖');
    const returnedItemIds=wand.placements.map(placement=>placement.itemId);
    if (returnedItemIds.some(itemId=>!uniquelyLocatedItem(state,itemId))) return reject(state,command,'ITEM_LOCATION_INVALID','法杖内物品位置或实例无效');
    return commit(state,command,{
      wands:state.wands.filter(candidate=>candidate.id!==wand.id),
      backpack:[...state.backpack,...returnedItemIds],
    },'wandDiscarded',{wandId:wand.id,returnedItemIds});
  }
  return reject(state,command,'UNSUPPORTED_COMMAND','不支持此丢弃命令');
}
