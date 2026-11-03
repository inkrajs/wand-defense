import type { CommandResult, ContentCatalog, GameEvent, GameState } from '../contracts';
import { remoteCommandTypes, sanitizeResult } from './protocol';

/** Only known definitions are exported. Catalog construction stays in the authoritative game. */
export function projectContent(state: GameState, catalog?: ContentCatalog) {
  const k = state.knowledge;
  const known = new Set([...k.spellIds, ...k.arcanaIds]);
  return {
    spellIds: [...k.spellIds], arcanaIds: [...k.arcanaIds],
    recipeIds: [...k.recipeIds], sequenceIds: [...k.sequenceIds],
    spells: catalog ? k.spellIds.flatMap(id => catalog.spells[id] ? [structuredClone(catalog.spells[id])] : []) : [],
    arcana: catalog ? k.arcanaIds.flatMap(id => catalog.arcana[id] ? [structuredClone(catalog.arcana[id])] : []) : [],
    // A discovered recipe remains usable without granting discovery of unknown ingredients/output.
    recipes: catalog ? catalog.recipes.filter(r => k.recipeIds.includes(r.id)).map(r => ({
      id:r.id,name:r.name,inputs:r.inputs.filter(id=>known.has(id)),
      unknownInputCount:r.inputs.filter(id=>!known.has(id)).length,requireAdjacency:r.requireAdjacency,
      ...(known.has(r.output)?{output:r.output}:{}),
    })) : [],
    sequences: catalog ? k.sequenceIds.flatMap(id => {
      const s = catalog.sequences[id];
      if (!s) return [];
      return [{id:s.id,pathwayId:s.pathwayId,number:s.number,name:s.name,bonuses:{...s.bonuses},
        ...(s.previousId && k.sequenceIds.includes(s.previousId) ? {previousId:s.previousId} : {}),
        requirements:s.requirements.filter(r => !r.definitionId || known.has(r.definitionId)).map(r => structuredClone(r))}];
    }) : [],
  };
}

/** Explicit fields prevent future internal state additions becoming public accidentally. */
export function projectState(state: GameState) {
  const known = new Set([...state.knowledge.spellIds,...state.knowledge.arcanaIds]);
  const items = Object.fromEntries(Object.entries(state.items).filter(([,i])=>known.has(i.definitionId)).map(([id,i])=>[id,structuredClone(i)]));
  return {
    schemaVersion:state.schemaVersion,id:state.id,revision:state.revision,phase:state.phase,
    gameTimeMs:state.gameTimeMs,paused:state.paused,backpackOpen:state.backpackOpen,wave:state.wave,
    territory:{...state.territory},coins:state.coins,xp:state.xp,playerLevel:state.playerLevel,luck:state.luck,
    characters:state.characters.map(c=>({...structuredClone(c),sequenceId:state.knowledge.sequenceIds.includes(c.sequenceId)?c.sequenceId:undefined})),
    wands:state.wands.map(w=>({...structuredClone(w),placements:w.placements.filter(p=>!!items[p.itemId]).map(p=>({...p})),
      cooldowns:Object.fromEntries(Object.entries(w.cooldowns).filter(([id])=>!!items[id]))})),
    items,backpack:state.backpack.filter(id=>!!items[id]),
    entities:state.entities.map(e=>({id:e.id,kind:e.kind,faction:e.faction,x:e.x,y:e.y,hp:e.hp,maxHp:e.maxHp,
      ...(known.has(e.definitionId)?{definitionId:e.definitionId}:{}),element:e.element,remainingMs:e.remainingMs})),
    rewards:state.rewards.map(r => r.definitionId && !known.has(r.definitionId)
      ? {id:r.id,kind:r.kind,label:'未发现的奖励',amount:r.amount}
      : structuredClone(r)),
    knowledge:structuredClone(state.knowledge),cheats:{...state.cheats},nextEventSeq:state.nextEventSeq,
  };
}

// Event names/data are an extensible explicit allowlist, never arbitrary engine payloads.
const publicEventTypes = new Set(['waveStarted','waveCleared','enemyKilled','territoryDamaged','defeat',
  'rewardClaimed','itemPlaced','itemRemoved','recipeMerged','wandEquipped','spellCast','entitySpawned','entityDied',
  'healed','paused','backpackChanged','cheatsChanged','commandExecuted','commandRejected',
  'wave.started','wave.cleared','enemy.killed','territory.damaged','reward.claimed','spell.cast',
  'reward.offered','pause.changed','backpack.changed','cheats.unlocked','cheats.changed','cheat.executed',
  'damage','heal','spawn','despawn','playerLevelUp','player.levelReward','enemyAttacked','territoryAttacked','bossSpawned','enemySpawned',
  'loadout.placed','loadout.removed','loadout.merged','loadout.equipped']);
const numericFields = new Set(['wave','amount','damage','hp','maxHp','coins','xp','level','x','y','territoryHp','territoryShield','shieldAbsorbed','hpDamage','bossTier']);
const idFields = new Set(['itemId','wandId','characterId','entityId','targetId','sourceItemId','rewardId','commandId','sourceCharacterId','sourceEntityId','enemyId','outputItemId','fromCharacterId']);
export function projectEvents(state: GameState, events: GameEvent[]): GameEvent[] {
  const known = new Set([...state.knowledge.spellIds,...state.knowledge.arcanaIds,...state.knowledge.recipeIds,...state.knowledge.sequenceIds]);
  return events.map(event=>{
    const data: Record<string,unknown> = {};
    if (publicEventTypes.has(event.type)) for (const [key,value] of Object.entries(event.data)) {
      if (numericFields.has(key) && typeof value === 'number' && Number.isFinite(value)) data[key]=value;
      else if (idFields.has(key) && typeof value === 'string') data[key]=value;
      else if (['paused','open','enabled'].includes(key) && typeof value === 'boolean') data[key]=value;
      else if (['definitionId','spellId','recipeId','sequenceId','effect'].includes(key) && typeof value === 'string' && known.has(value)) data[key]=value;
    }
    return {seq:event.seq,gameTimeMs:event.gameTimeMs,type:publicEventTypes.has(event.type)?event.type:'stateChanged',data};
  });
}
const commandSchemas = {
  startWave:{},setPaused:{paused:'boolean'},setBackpack:{open:'boolean'},
  placeItem:{wandId:'id',itemId:'id',x:'integer',y:'integer',rotation:'0|1|2|3'},
  removeItem:{wandId:'id',itemId:'id'},mergeRecipe:{wandId:'id',recipeId:'known recipe id',itemIds:'id[]'},
  claimReward:{rewardId:'id'},equipWand:{wandId:'id',characterId:'id'},
  setCheats:{enabled:'boolean'},cheat:{action:'heal|grantSpell',definitionId:'id (required for grantSpell)'},
};
/** All commands also require a unique string id; accepted is queued, not executed. */
export function projectFrame(state: GameState, events: GameEvent[], results: CommandResult[], catalog?: ContentCatalog) {
  return {
    state:projectState(state),events:projectEvents(state,events),results:results.map(sanitizeResult),
    capabilities:{protocolVersion:1,commands:remoteCommandTypes.filter(t=>!['cheat','setCheats'].includes(t) || state.cheats.unlocked),
      commandSchemas:Object.fromEntries(Object.entries(commandSchemas).filter(([t])=>!['cheat','setCheats'].includes(t) || state.cheats.unlocked)),
      cheats:{...state.cheats},events:{cursor:true,sse:true},authority:'browser'},
    content:projectContent(state,catalog),
  };
}
