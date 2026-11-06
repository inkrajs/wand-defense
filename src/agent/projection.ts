import type { CharacterStatBonuses, CommandResult, ContentCatalog, Element, EnemyStatus, GameEvent, GameState } from '../contracts';
import { remoteCommandTypes, sanitizeResult } from './protocol';
import { gradeOrder } from '../content/grades';
import { getTerritoryUpgrade, getTerritoryRepair } from '../content/territory';
import { getTerritoryRecovery } from '../content/territoryRecovery';
import { getExperienceProgress } from '../content/progression';
import { getCharacterStats } from '../content/characters';
import { getRewardRefreshQuote } from '../runtime/rewardRefresh';
import { getGatheringStats } from '../content/economy';
import { CHEAT_TARGET_LEVEL } from '../runtime/cheatCatalog';

function projectStatBonuses(source?: CharacterStatBonuses): CharacterStatBonuses | undefined {
  if (!source || typeof source !== 'object') return;
  const output: CharacterStatBonuses = {};
  for (const key of ['attack','castSpeedPercent','projectileSpeedPercent','range','accuracy','critChance','critMultiplier','luck','gatheringPercent','maxMana','manaRegen'] as const) {
    const value=source[key];
    if (typeof value === 'number' && Number.isFinite(value)) output[key]=value;
  }
  if (source.elementBonuses && typeof source.elementBonuses === 'object') {
    output.elementBonuses={};
    for (const element of ['fire','wood','metal','water','earth','light','dark','lightning','wind'] as Element[]) {
      const value=source.elementBonuses[element];
      if (typeof value === 'number' && Number.isFinite(value)) output.elementBonuses[element]=value;
    }
  }
  return output;
}

/** Only known definitions are exported. Catalog construction stays in the authoritative game. */
export function projectContent(state: GameState, catalog?: ContentCatalog) {
  const k = state.knowledge;
  const known = new Set([...k.spellIds, ...k.arcanaIds]);
  return {
    spellIds: [...k.spellIds], arcanaIds: [...k.arcanaIds],
    gearIds:[...(k.gearIds??[])],itemIds:[...(k.itemIds??[])],wandIds:[...(k.wandIds??[])],
    gear:catalog?(k.gearIds??[]).flatMap(id=>Object.hasOwn(catalog.gear??{},id)?[structuredClone(catalog.gear![id])]:[]):[],
    items:catalog?(k.itemIds??[]).flatMap(id=>Object.hasOwn(catalog.items??{},id)?[structuredClone(catalog.items![id])]:[]):[],
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

/** Visible conditions expose their current effect, never arbitrary saved status payloads. */
function projectEnemyStatus(source: EnemyStatus | undefined, known: ReadonlySet<string>) {
  if (!source || typeof source !== 'object') return undefined;
  const positive=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>0;
  const slow=source.slow&&positive(source.slow.remainingMs)&&positive(source.slow.multiplier)
    ? {multiplier:Math.min(1,source.slow.multiplier),remainingMs:source.slow.remainingMs} : undefined;
  const burns=Array.isArray(source.burns)?source.burns.slice(0,4).flatMap(burn=>{
    if(!burn||!positive(burn.remainingMs)||!positive(burn.damage)||!positive(burn.tickMs))return [];
    return [{remainingMs:burn.remainingMs,damage:burn.damage,tickMs:burn.tickMs,
      ...(known.has(burn.definitionId)?{definitionId:burn.definitionId}:{})}];
  }):[];
  return slow||burns.length ? {...(slow?{slow}:{}),...(burns.length?{burns}:{} )} : undefined;
}

/** Explicit fields prevent future internal state additions becoming public accidentally. */
export function projectState(state: GameState, catalog?: ContentCatalog) {
  const known = new Set([...state.knowledge.spellIds,...state.knowledge.arcanaIds]);
  const knownGear=new Set(state.knowledge.gearIds??[]),knownSupplies=new Set(state.knowledge.itemIds??[]);
  const items = Object.fromEntries(Object.entries(state.items).filter(([,i])=>known.has(i.definitionId)).map(([id,i])=>[id,structuredClone(i)]));
  return {
    schemaVersion:state.schemaVersion,id:state.id,revision:state.revision,phase:state.phase,
    gameTimeMs:state.gameTimeMs,speed:state.speed,paused:state.paused,backpackOpen:state.backpackOpen,wave:state.wave,
    territory:{...state.territory},coins:state.coins,xp:state.xp,playerLevel:state.playerLevel,luck:state.luck,
    runBonuses:{attackPercent:state.runBonuses?.attackPercent ?? 0,maxMana:state.runBonuses?.maxMana ?? 0,
      manaRegen:state.runBonuses?.manaRegen ?? 0,rangePercent:state.runBonuses?.rangePercent ?? 0,cooldownPercent:state.runBonuses?.cooldownPercent ?? 0,gatheringPercent:state.runBonuses?.gatheringPercent ?? 0},
    rewardRefresh:getRewardRefreshQuote(state),
    gathering:getGatheringStats(state,catalog),
    experienceMode:'perCharacter' as const,
    characters:state.characters.map(c=>{
      const stats=getCharacterStats(state,c.id,catalog);
      return {...structuredClone(c),baseStats:stats?.base,stats,
        xp:c.xp ?? 0,experienceProgress:getExperienceProgress(c.xp ?? 0,c.level),
        sequenceId:state.knowledge.sequenceIds.includes(c.sequenceId)?c.sequenceId:undefined};
    }),
    wands:state.wands.map(w=>({...structuredClone(w),statBonuses:projectStatBonuses(w.statBonuses),placements:w.placements.filter(p=>!!items[p.itemId]).map(p=>({...p})),
      cooldowns:Object.fromEntries(Object.entries(w.cooldowns).filter(([id])=>!!items[id]))})),
    items,backpack:state.backpack.filter(id=>!!items[id]),
    groundLoot:(state.groundLoot??[]).map(loot=>({id:loot.id,kind:loot.kind,x:loot.x,y:loot.y,grade:loot.instance.grade})),
    gear:Object.fromEntries(Object.entries(state.gear??{}).filter(([id,gear])=>gear.id===id&&(gear.definitionId
      ?knownGear.has(gear.definitionId):state.characters.some(character=>Object.values(character.gearIds??{}).includes(id))))
      .map(([id,gear])=>[id,{id:gear.id,definitionId:gear.definitionId,name:gear.name,slot:gear.slot,characterId:gear.characterId,
        level:gear.level,grade:gear.grade,statBonuses:projectStatBonuses(gear.statBonuses)}])),
    supplies:Object.fromEntries(Object.entries(state.supplies??{}).filter(([id,item])=>item.id===id&&knownSupplies.has(item.definitionId))
      .map(([id,item])=>[id,{id:item.id,definitionId:item.definitionId,level:item.level,grade:item.grade}])),
    entities:state.entities.filter(e=>e.kind === 'area' || (e.launchDelayMs??0)<=0).map(e=>({id:e.id,kind:e.kind,faction:e.faction,x:e.x,y:e.y,
      ...(['enemy','summon','building'].includes(e.kind)?{hp:e.hp,maxHp:e.maxHp}:{}),
      ...(e.kind === 'enemy' ? {status:projectEnemyStatus(e.status,known)} : {}),
      ...(typeof e.level === 'number' && Number.isFinite(e.level) ? {level:e.level} : {}),
      ...(gradeOrder.some(grade=>grade === e.grade) ? {grade:e.grade} : {}),
      ...(known.has(e.definitionId)?{definitionId:e.definitionId}:{}),element:e.element,remainingMs:e.remainingMs,
      speed:e.speed,moveSpeed:e.moveSpeed,originX:e.originX,originY:e.originY,targetX:e.targetX,targetY:e.targetY,
      ...(e.kind === 'beam' ? {beamWidth:e.beamWidth,maxTargets:e.maxTargets} : {}),
      ...(e.kind === 'area' && e.area ? {area:{mode:e.area.mode,radius:e.area.radius,delayMs:e.area.delayMs,durationMs:e.area.durationMs,maxTargets:e.area.maxTargets,
        tickMs:e.area.tickMs,anchor:e.area.anchor,moveSpeed:e.area.moveSpeed,pullRadius:e.area.pullRadius,pullStrength:e.area.pullStrength},launchDelayMs:e.launchDelayMs ?? 0} : {}),
      ...(e.kind === 'summon' || e.kind === 'building' ? {construct:e.construct?{
        behavior:e.construct.behavior,attackMode:e.construct.attackMode,durationMs:e.construct.durationMs,maxAlive:e.construct.maxAlive,
        attackIntervalMs:e.construct.attackIntervalMs}:undefined}:{}),
      sourceEntityId:e.sourceEntityId,sourceCharacterId:e.sourceCharacterId,sourceItemId:e.sourceItemId,targetId:e.targetId})),
    rewardHistory:(state.rewardHistory??[]).map(entry=>({id:entry.id,wave:entry.wave,gameTimeMs:entry.gameTimeMs,
      reward:entry.reward.definitionId&&!known.has(entry.reward.definitionId)
        ? {id:entry.reward.id,kind:entry.reward.kind,label:'未发现的奖励'} : structuredClone(entry.reward)})),
    rewardHistoryComplete:state.rewardHistoryComplete??false,
    runStatistics:state.runStatistics ? {
      version:1,complete:state.runStatistics.complete,
      ...Object.fromEntries(['spellsAcquired','arcanaAcquired','charactersAcquired','levelsGained','enemiesDefeated','bossesDefeated','coinsEarned','wavesCleared'].map(key=>{
        const value=state.runStatistics![key as keyof typeof state.runStatistics];
        return [key,typeof value === 'number' && Number.isSafeInteger(value) && value>=0 ? value : 0];
      })),
    } : undefined,
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
  'reward.offered','reward.refreshed','pause.changed','backpack.changed','cheats.unlocked','cheats.changed','cheat.executed',
  'damage','heal','spawn','despawn','playerLevelUp','player.levelReward','enemyAttacked','territoryAttacked','bossSpawned','enemySpawned',
  'loadout.placed','loadout.removed','loadout.merged','loadout.equipped','game.restarted','wandUnequipped','wandCleared','itemDiscarded','wandDiscarded','gearEquipped','gearUnequipped','gearDiscarded','itemUsed','supplyDiscarded','lootGranted','lootSpawned','lootCollected','speed.changed',
  'projectileSpawned','projectileExpired','beamSpawned','chainArc','areaSpawned','areaActivated','areaPulse','fieldTriggered','shieldRestored','attackMiss','itemsMerged','territoryUpgraded','territoryRepaired','territoryRecoveryUpgraded','characterLevelUp','character.levelReward','game.revived',
  'statusApplied','statusExpired','knockback','construct.deployed','constructSpawned','constructExpired','constructDestroyed','constructAttacked','constructHealed','constructDamaged','constructDied']);
const numericFields = new Set(['wave','amount','count','damage','hp','maxHp','coins','xp','level','previousLevel','cost','paidCount','freeRemaining','increase','rate','beamWidth','radius','delayMs','durationMs','remainingMs','multiplier','distance','tickMs','tickRemainingMs','x','y','originX','originY','targetX','targetY','territoryHp','territoryShield','shieldAbsorbed','hpDamage','bossTier','speed']);
const idFields = new Set(['itemId','gearId','replacedGearId','instanceId','wandId','characterId','xpCharacterId','entityId','targetId','sourceItemId','targetItemId','projectileId','beamId','chainId','areaId','rewardId','commandId','sourceCharacterId','sourceEntityId','enemyId','outputItemId','fromCharacterId','gameId']);
export function projectEvents(state: GameState, events: GameEvent[]): GameEvent[] {
  const known = new Set([...state.knowledge.spellIds,...state.knowledge.arcanaIds,...state.knowledge.recipeIds,...state.knowledge.sequenceIds,...(state.knowledge.gearIds??[]),...(state.knowledge.itemIds??[]),...(state.knowledge.wandIds??[])]);
  return events.map(event=>{
    const data: Record<string,unknown> = {};
    if (publicEventTypes.has(event.type)) for (const [key,value] of Object.entries(event.data)) {
      if (numericFields.has(key) && typeof value === 'number' && Number.isFinite(value)) data[key]=value;
      else if ((idFields.has(key) || (key === 'id' && (event.type === 'lootSpawned' || event.type === 'lootCollected'))) && typeof value === 'string') data[key]=value;
      else if (key === 'statusId' && typeof value === 'string'
        && (typeof event.data.effect !== 'string' || known.has(event.data.effect))) data[key]=value;
      else if (key === 'statusType' && ['slow','burn','knockback'].includes(String(value))) data[key]=value;
      else if (key === 'sourceKind' && value === 'status') data[key]=value;
      else if (['paused','open','enabled','critical'].includes(key) && typeof value === 'boolean') data[key]=value;
      else if (key === 'grade' && gradeOrder.some(grade => grade === value)) data[key]=value;
      else if (key === 'track' && (value === 'wall' || value === 'shield')) data[key]=value;
      else if(key==='slot'&&['head','body','feet','accessory'].includes(String(value)))data[key]=value;
      else if(key==='effectType'&&['territoryHeal','territoryShield','partyMana','territoryRestore','partyManaPercent','cooldownAdvance','territoryHealPercent','territoryShieldPercent'].includes(String(value)))data[key]=value;
      else if(key==='kind'&&['gear','item','wand','summon','building'].includes(String(value)))data[key]=value;
      else if(key==='behavior'&&['attack','heal','shield'].includes(String(value)))data[key]=value;
      else if(key==='attackMode'&&['contact','projectile'].includes(String(value)))data[key]=value;
      else if(key==='mode'&&['strike','ring','eruption','field','vortex'].includes(String(value)))data[key]=value;
      else if(key==='trigger'&&['contact','range','either'].includes(String(value)))data[key]=value;
      else if (key === 'reason' && typeof value === 'string' && ['timeout','targetLost','invalidPosition','outOfBounds','lifetime','damage','pickup','waveClear'].includes(value)) data[key]=value;
      else if (['definitionId','spellId','recipeId','sequenceId','effect'].includes(key) && typeof value === 'string' && known.has(value)) data[key]=value;
    }
    return {seq:event.seq,gameTimeMs:event.gameTimeMs,type:publicEventTypes.has(event.type)?event.type:'stateChanged',data};
  });
}
const commandSchemas = {
  startWave:{},pickupLoot:{lootId:'visible ground loot id'},deployConstruct:{characterId:'own character id',itemId:'equipped known summon/building spell id',x:'finite 0..100 world coordinate',y:'finite 0..100 world coordinate'},restart:{},setPaused:{paused:'boolean'},setSpeed:{speed:'0.25|0.5|0.75|1|2|3|5'},setBackpack:{open:'boolean'},
  upgradeTerritory:{track:'wall|shield'},repairTerritory:{track:'wall|shield'},upgradeTerritoryRecovery:{track:'wall|shield'},
  placeItem:{wandId:'id',itemId:'id',x:'integer',y:'integer',rotation:'0|1|2|3'},
  removeItem:{wandId:'id',itemId:'id'},mergeRecipe:{wandId:'id',recipeId:'known recipe id',itemIds:'id[]'},
  clearWand:{wandId:'equipped or stored wand id; returns its magic to shared inventory'},
  discardItem:{itemId:'owned known item id'},discardWand:{wandId:'unequipped wand id; contents return to backpack'},
  equipGear:{gearId:'owned known gear id',characterId:'character id'},unequipGear:{gearId:'equipped gear id'},discardGear:{gearId:'unequipped gear id'},
  useItem:{itemId:'owned known supply id'},discardSupply:{itemId:'owned known supply id'},
  mergeItems:{sourceItemId:'owned item id',targetItemId:'owned matching definition and grade item id'},
  claimReward:{rewardId:'id'},refreshRewards:{offerId:'current first reward id; prevents stale refresh charges'},equipWand:{wandId:'id',characterId:'id',slot:'0|1 (optional)'},unequipWand:{wandId:'id'},
  setCheats:{enabled:'boolean'},cheat:{
    action:'heal|revive|grantSpell|grantItem|grantWand|grantGear|grantSupply|grantAllMagic|maxMagic|grantAllWands|maxWands|grantAllGear|maxGear|grantAllSupplies|maxSupplies|levelCharacter',
    characterId:'levelCharacter：角色实例 ID，非空且最长160字符',
    levels:'levelCharacter：可选1至100的安全正整数；省略时为1',
    definitionId:'单项授予动作必填的定义 ID',
    grade:'单项授予可选品级；批量动作保留各物品现有品级',
    level:'单项授予可选等级，必须为安全正整数',
    description:`八种批量动作可授予或提升全部魔法、法杖、装备或药水。Lv.${CHEAT_TARGET_LEVEL}是试玩目标，不是硬上限；max动作保留各物品品级。levelCharacter接收characterId和可选levels。`,
  },
};
/** All commands also require a unique string id; accepted is queued, not executed. */
export function projectFrame(state: GameState, events: GameEvent[], results: CommandResult[], catalog?: ContentCatalog) {
  return {
    state:projectState(state,catalog),events:projectEvents(state,events),results:results.map(sanitizeResult),
    capabilities:{protocolVersion:1,commands:remoteCommandTypes.filter(t=>!['cheat','setCheats'].includes(t) || state.cheats.unlocked),
      territoryUpgrades:{wall:getTerritoryUpgrade(state,'wall'),shield:getTerritoryUpgrade(state,'shield')},
      territoryRepairs:{wall:getTerritoryRepair(state,'wall'),shield:getTerritoryRepair(state,'shield')},
      territoryRecovery:{wall:getTerritoryRecovery(state,'wall'),shield:getTerritoryRecovery(state,'shield')},
      commandSchemas:Object.fromEntries(Object.entries(commandSchemas).filter(([t])=>!['cheat','setCheats'].includes(t) || state.cheats.unlocked)),
      cheats:{...state.cheats},events:{cursor:true,sse:true},authority:'browser'},
    content:projectContent(state,catalog),
  };
}
