import type { ContentCatalog, RuntimePort } from "../contracts";
import type { GameRuntime } from "./index";
import { wandTemplates } from "../content/wands";
import { gradeOrder } from "../content/grades";

const chainPreviewId="user-chain-magic-20261104-01";
const chainDefinitions=["spark-hop","thunder-chain","storm-net"];
const wandPreviewId="user-large-wands-20261104-01";
const revivePreviewId="user-revive-20261104-01";
const allItemsPreviewId="user-all-items-20261104-02";
const mythicWandsPreviewId="user-mythic-wands-20261104-01";
const newMagicPreviewId="user-area-arcana-20261104-01";
const newMagicDefinitions=["thunder-strike","frost-ring","earth-spikes","haste","efficiency","reach","velocity","area"];
const fieldsPreviewId="user-fields-multicast-20261104-01";
const fieldsDefinitions=["fire-field-bolt","thunder-field-bolt","thunderstorm","moving-storm","quadruple","sextuple"];

export const MAX_CATALOG_PREVIEW_REQUEST = "user-max-catalog-20261104-01";
// Root must explicitly identify any replacement run; never broaden the shared legacy authorization.
export const MAX_CATALOG_TARGET_RUN_ID = "demo";

function authorizedPreview(runtime:GameRuntime) {
  const checkpoint=runtime.checkpoint();
  const executed=new Set(checkpoint.results.filter(([,result])=>result.status === "executed").map(([id])=>id));
  return {checkpoint,executed,authorized:checkpoint.state.id === "demo"&&checkpoint.state.cheats.unlocked
    &&executed.has("preview:user-all-magic-20261104-03:unlock")};
}

/** Three user-requested high-level mythic wands, once, in the identified preview run. */
export function grantAuthorizedMythicWands(runtime:GameRuntime) {
  const {checkpoint,executed,authorized}=authorizedPreview(runtime);
  const prefix=`preview:${mythicWandsPreviewId}`;
  if(!authorized||executed.has(`${prefix}:complete`))return;
  // Inventory gifts must reach the durable preparation/reward checkpoint, not
  // turn the current combat frame into a new wave-retry starting point.
  if(checkpoint.state.phase === "battle") return;
  const restoreDisabled=executed.has(`${prefix}:enable-from-disabled`)
    ||(!executed.has(`${prefix}:enable-from-enabled`)&&!checkpoint.state.cheats.enabled);
  runtime.dispatch({id:`${prefix}:enable-from-${restoreDisabled?"disabled":"enabled"}`,type:"setCheats",enabled:true});
  for(let index=0;index<3;index++)runtime.dispatch({id:`${prefix}:wand:${index}`,type:"cheat",action:"grantWand",definitionId:"wand-5x5",grade:"mythic",level:50});
  if(restoreDisabled)runtime.dispatch({id:`${prefix}:restore-toggle`,type:"setCheats",enabled:false});
  const after=runtime.getState(),added=after.wands.filter(wand=>!checkpoint.state.wands.some(previous=>previous.id===wand.id));
  const receipts=new Map(runtime.checkpoint().results);
  const complete=[0,1,2].every(index=>receipts.get(`${prefix}:wand:${index}`)?.status === "executed");
  if(complete)runtime.dispatch({id:`${prefix}:complete`,type:"setBackpack",open:true});
  return {requestId:mythicWandsPreviewId,status:complete?"executed":"partial",runId:after.id,wave:after.wave,
    grantedWands:added.length,grade:"mythic",level:50,width:5,height:5,
    preservedCoins:after.coins===checkpoint.state.coins,
    preservedLayouts:checkpoint.state.wands.every(wand=>JSON.stringify(after.wands.find(current=>current.id===wand.id))===JSON.stringify(wand))};
}

/** Continue the human's request to try newly implemented magic in this saved run. */
export function grantAuthorizedNewMagic(runtime:GameRuntime,content:ContentCatalog) {
  return grantAuthorizedMagicSet(runtime,content,newMagicPreviewId,newMagicDefinitions);
}

function grantAuthorizedMagicSet(runtime:GameRuntime,content:ContentCatalog,requestId:string,definitions:readonly string[]) {
  const {checkpoint,executed,authorized}=authorizedPreview(runtime);
  const prefix=`preview:${requestId}`;
  if(!authorized||checkpoint.state.phase === "battle"||executed.has(`${prefix}:complete`)
    ||!definitions.every(id=>content.spells[id]||content.arcana[id]))return;
  const restoreDisabled=executed.has(`${prefix}:enable-from-disabled`)
    ||(!executed.has(`${prefix}:enable-from-enabled`)&&!checkpoint.state.cheats.enabled);
  runtime.dispatch({id:`${prefix}:enable-from-${restoreDisabled?"disabled":"enabled"}`,type:"setCheats",enabled:true});
  const report=grantPreviewMagic(runtime,content,requestId,true,definitions);
  if(restoreDisabled)runtime.dispatch({id:`${prefix}:restore-toggle`,type:"setCheats",enabled:false});
  const after=runtime.getState(),owned=new Set(Object.values(after.items).map(item=>item.definitionId));
  const complete=definitions.every(id=>owned.has(id));
  if(complete)runtime.dispatch({id:`${prefix}:complete`,type:"setBackpack",open:true});
  return {...report,status:complete?"executed":"partial",wave:after.wave,preservedCoins:after.coins===checkpoint.state.coins,
    preservedLayouts:checkpoint.state.wands.every(wand=>JSON.stringify(after.wands.find(current=>current.id===wand.id))===JSON.stringify(wand))};
}

/** This explicit human request adds a full high-grade set without upgrading or moving existing items. */
export function grantAuthorizedMaxCatalog(runtime:GameRuntime,content:ContentCatalog) {
  const {checkpoint,executed}=authorizedPreview(runtime);
  const prefix=`preview:${MAX_CATALOG_PREVIEW_REQUEST}`;
  const before=checkpoint.state;
  const requestAuthorized=before.cheats.unlocked && (executed.has(`${prefix}:unlock`)
    || executed.has("preview:user-all-magic-20261104-03:unlock"));
  if(before.id!==MAX_CATALOG_TARGET_RUN_ID || !requestAuthorized) return {
    requestId:MAX_CATALOG_PREVIEW_REQUEST,status:"blocked",reason:"unauthorized-run",runId:before.id,wave:before.wave,
    expectedRunId:MAX_CATALOG_TARGET_RUN_ID,preservedCoins:true,preservedLayouts:true,
  };
  if(executed.has(`${prefix}:complete`))return;
  if(before.phase!=="ready" && before.phase!=="reward")return;
  const magic=[...Object.keys(content.spells),...Object.keys(content.arcana)];
  const template=wandTemplates["wand-5x5"];
  if(new Set(magic).size!==magic.length || !template || template.width!==5 || template.height!==5) return {
    requestId:MAX_CATALOG_PREVIEW_REQUEST,status:"blocked",reason:"invalid-catalog",runId:before.id,wave:before.wave,
    preservedCoins:true,preservedLayouts:true,
  };
  const grade=gradeOrder[gradeOrder.length-1];
  const level=50;
  type Gift={key:string;category:"magic"|"gear"|"supplies"|"wands";action:"grantItem"|"grantGear"|"grantSupply"|"grantWand";definitionId:string};
  const gifts:Gift[]=[
    ...magic.map(definitionId=>({key:`magic:${encodeURIComponent(definitionId)}`,category:"magic" as const,action:"grantItem" as const,definitionId})),
    ...Object.keys(content.gear??{}).map(definitionId=>({key:`gear:${encodeURIComponent(definitionId)}`,category:"gear" as const,action:"grantGear" as const,definitionId})),
    ...Object.keys(content.items??{}).map(definitionId=>({key:`supply:${encodeURIComponent(definitionId)}`,category:"supplies" as const,action:"grantSupply" as const,definitionId})),
    ...[0,1].map(index=>({key:`wand:${index}`,category:"wands" as const,action:"grantWand" as const,definitionId:"wand-5x5"})),
  ];
  const originalEnabled=executed.has(`${prefix}:original-enabled`)
    || (!executed.has(`${prefix}:original-disabled`) && before.cheats.enabled);
  if(!executed.has(`${prefix}:original-enabled`)&&!executed.has(`${prefix}:original-disabled`)) {
    const recorded=runtime.dispatch({id:`${prefix}:original-${originalEnabled?"enabled":"disabled"}`,type:"setCheats",enabled:originalEnabled});
    if(recorded.status!=="executed")return;
  }
  const attempt=runtime.getState().revision;
  const hasGift=(gift:Gift,receipts:Set<string>)=>[...receipts].some(id=>id.startsWith(`${prefix}:${gift.key}:attempt:`));
  try {
    if(!runtime.getState().cheats.enabled)runtime.dispatch({id:`${prefix}:enable:${attempt}`,type:"setCheats",enabled:true});
    for(const gift of gifts) {
      if(hasGift(gift,executed))continue;
      const id=`${prefix}:${gift.key}:attempt:${attempt}`;
      const result=runtime.dispatch({id,type:"cheat",action:gift.action,definitionId:gift.definitionId,grade,level});
      if(result.status==="executed")executed.add(id);
    }
  } finally {
    if(runtime.getState().cheats.enabled!==originalEnabled)runtime.dispatch({id:`${prefix}:restore:${attempt}`,type:"setCheats",enabled:originalEnabled});
  }
  const giftsComplete=gifts.every(gift=>hasGift(gift,executed));
  const complete=giftsComplete && runtime.dispatch({id:`${prefix}:complete`,type:"setCheats",enabled:originalEnabled}).status==="executed";
  const after=runtime.getState();
  const counts={magic:0,gear:0,supplies:0,wands:0};
  for(const gift of gifts)if(hasGift(gift,executed))counts[gift.category]++;
  const preservedProgress=JSON.stringify([after.id,after.wave,after.phase,after.gameTimeMs,after.rngState,after.xp,after.playerLevel,after.territory,after.runBonuses,after.paused,after.backpackOpen])
    ===JSON.stringify([before.id,before.wave,before.phase,before.gameTimeMs,before.rngState,before.xp,before.playerLevel,before.territory,before.runBonuses,before.paused,before.backpackOpen]);
  return {requestId:MAX_CATALOG_PREVIEW_REQUEST,status:complete?"executed":"partial",runId:after.id,wave:after.wave,
    grade,level,noHardLevelCap:true,consumableLevelIsMetadata:true,
    grantedMagic:counts.magic,spellKinds:Object.keys(content.spells).length,arcanaKinds:Object.keys(content.arcana).length,
    grantedGear:counts.gear,grantedSupplies:counts.supplies,grantedWands:counts.wands,
    expectedTotal:gifts.length,executedGiftReceipts:Object.values(counts).reduce((sum,count)=>sum+count,0),
    preservedProgress,preservedCoins:after.coins===before.coins,
    preservedCharacters:JSON.stringify(after.characters)===JSON.stringify(before.characters),
    preservedLayouts:before.wands.every(wand=>JSON.stringify(after.wands.find(current=>current.id===wand.id))===JSON.stringify(wand)),
    preservedEquipment:Object.entries(before.gear??{}).every(([id,gear])=>JSON.stringify(after.gear?.[id])===JSON.stringify(gear)),
    preservedExistingMagic:Object.entries(before.items).every(([id,item])=>JSON.stringify(after.items[id])===JSON.stringify(item)),
    preservedExistingSupplies:Object.entries(before.supplies??{}).every(([id,item])=>JSON.stringify(after.supplies?.[id])===JSON.stringify(item)),
    restoredCheatToggle:after.cheats.enabled===originalEnabled,
  };
}

/** Poll only pending requests at a durable boundary; completed requests need no recurring snapshots. */
export function applyAuthorizedPreviewGrants(runtime:GameRuntime,content:ContentCatalog,requestId?:string) {
  if(requestId!==undefined) {
    if(requestId!==MAX_CATALOG_PREVIEW_REQUEST)return {reports:[],pending:false};
    const report=grantAuthorizedMaxCatalog(runtime,content);
    const {executed}=authorizedPreview(runtime);
    const blocked=report?.status==="blocked";
    return {reports:report?[report]:[],pending:!blocked&&!executed.has(`preview:${MAX_CATALOG_PREVIEW_REQUEST}:complete`)};
  }
  const {authorized,executed}=authorizedPreview(runtime);
  if(!authorized)return {reports:[],pending:false};
  const requests=[
    {id:mythicWandsPreviewId,apply:()=>grantAuthorizedMythicWands(runtime)},
    {id:newMagicPreviewId,apply:()=>grantAuthorizedNewMagic(runtime,content)},
    {id:fieldsPreviewId,apply:()=>grantAuthorizedMagicSet(runtime,content,fieldsPreviewId,fieldsDefinitions)},
  ];
  const reports=requests.flatMap(request=>{
    if(executed.has(`preview:${request.id}:complete`))return [];
    const report=request.apply();
    if(report?.status === "executed")executed.add(`preview:${request.id}:complete`);
    return report?[report]:[];
  });
  return {reports,pending:requests.some(request=>!executed.has(`preview:${request.id}:complete`))};
}

/** The human requested all supported items for this exact existing preview run. */
export function fillAuthorizedInventory(runtime:GameRuntime,content:ContentCatalog) {
  const {checkpoint,executed,authorized}=authorizedPreview(runtime);
  const prefix=`preview:${allItemsPreviewId}`;
  if(!authorized||executed.has(`${prefix}:complete`))return;
  const report=grantPreviewMagic(runtime,content,allItemsPreviewId,true);
  const beforeWands=checkpoint.state.wands.length;
  runtime.dispatch({id:`${prefix}:enable-wands`,type:"setCheats",enabled:true});
  for(const [definitionId,template] of Object.entries(wandTemplates)) {
    if(runtime.getState().wands.some(wand=>wand.name===template.name&&wand.width===template.width&&wand.height===template.height))continue;
    runtime.dispatch({id:`${prefix}:${definitionId}`,type:"cheat",action:"grantWand",definitionId});
  }
  for(const definitionId of Object.keys(content.gear??{})) {
    if(Object.values(runtime.getState().gear??{}).some(gear=>gear.definitionId===definitionId))continue;
    runtime.dispatch({id:`${prefix}:gear:${definitionId}`,type:"cheat",action:"grantGear",definitionId});
  }
  for(const definitionId of Object.keys(content.items??{})) {
    if(Object.values(runtime.getState().supplies??{}).some(item=>item.definitionId===definitionId))continue;
    runtime.dispatch({id:`${prefix}:supply:${definitionId}`,type:"cheat",action:"grantSupply",definitionId});
  }
  if(!checkpoint.state.cheats.enabled)runtime.dispatch({id:`${prefix}:restore-toggle`,type:"setCheats",enabled:false});
  const after=runtime.getState(),owned=new Set(Object.values(after.items).map(item=>item.definitionId));
  const complete=[...Object.keys(content.spells),...Object.keys(content.arcana)].every(id=>owned.has(id))
    &&Object.values(wandTemplates).every(template=>after.wands.some(wand=>wand.name===template.name&&wand.width===template.width&&wand.height===template.height))
    &&Object.keys(content.gear??{}).every(id=>Object.values(after.gear??{}).some(gear=>gear.definitionId===id))
    &&Object.keys(content.items??{}).every(id=>Object.values(after.supplies??{}).some(item=>item.definitionId===id));
  if(complete)runtime.dispatch({id:`${prefix}:complete`,type:"setBackpack",open:true});
  return {...report,status:complete?"executed":"partial",wave:after.wave,
    spellKinds:Object.keys(content.spells).length,arcanaKinds:Object.keys(content.arcana).length,
    gearKinds:Object.keys(content.gear??{}).length,itemKinds:Object.keys(content.items??{}).length,
    grantedGear:Object.keys(after.gear??{}).length-Object.keys(checkpoint.state.gear??{}).length,
    grantedSupplies:Object.keys(after.supplies??{}).length-Object.keys(checkpoint.state.supplies??{}).length,
    grantedWands:after.wands.length-beforeWands,preservedCoins:after.coins===checkpoint.state.coins,
    preservedLayouts:checkpoint.state.wands.every(wand=>JSON.stringify(after.wands.find(current=>current.id===wand.id))===JSON.stringify(wand))};
}

/** This single revival was requested by the human; new runs never inherit it. */
export function reviveAuthorizedPreview(runtime:GameRuntime) {
  const {checkpoint,executed,authorized}=authorizedPreview(runtime);
  const commandId=`preview:${revivePreviewId}:revive`;
  if(!authorized||checkpoint.state.phase !== "defeat"||executed.has(commandId))return;
  const enabled=checkpoint.state.cheats.enabled;
  if(!enabled)runtime.dispatch({id:`preview:${revivePreviewId}:enable`,type:"setCheats",enabled:true});
  const result=runtime.dispatch({id:commandId,type:"cheat",action:"revive"});
  if(!enabled)runtime.dispatch({id:`preview:${revivePreviewId}:restore-toggle`,type:"setCheats",enabled:false});
  const after=runtime.getState();
  return {requestId:revivePreviewId,status:result.status,runId:after.id,phase:after.phase,
    failedWave:checkpoint.state.wave,nextWave:after.wave+1,
    preservedBuild:JSON.stringify(after.items)===JSON.stringify(checkpoint.state.items)
      &&JSON.stringify(after.wands)===JSON.stringify(checkpoint.state.wands),
    preservedCoins:after.coins===checkpoint.state.coins};
}

/** A human-authorized update to the previously filled preview run, never a new game. */
export function updateAuthorizedPreview(runtime:GameRuntime, content:ContentCatalog) {
  const {checkpoint,executed,authorized}=authorizedPreview(runtime);
  // The earlier grant ACK identified this exact run. Restart keeps command
  // receipts, so a receipt alone is insufficient proof of the same run.
  if (!authorized || !chainDefinitions.every(id=>content.spells[id])) return;
  const needsMagic=!executed.has(`preview:${chainPreviewId}:backpack`);
  const needsWands=!executed.has(`preview:${wandPreviewId}:wand-5x5`);
  if(!needsMagic&&!needsWands)return;
  const enabled=checkpoint.state.cheats.enabled;
  const beforeWands=checkpoint.state.wands.length;
  const report=needsMagic?grantPreviewMagic(runtime,content,chainPreviewId,true,chainDefinitions):undefined;
  if(needsWands) {
    runtime.dispatch({id:`preview:${wandPreviewId}:enable`,type:"setCheats",enabled:true});
    for(const definitionId of ["wand-4x4","wand-5x5"])
      runtime.dispatch({id:`preview:${wandPreviewId}:${definitionId}`,type:"cheat",action:"grantWand",definitionId});
    runtime.dispatch({id:`preview:${wandPreviewId}:backpack`,type:"setBackpack",open:true});
  }
  if (!enabled) runtime.dispatch({id:`preview:${wandPreviewId}:restore-toggle`,type:"setCheats",enabled:false});
  return {...(report??{requestId:wandPreviewId,runId:checkpoint.state.id,granted:0,definitions:0}),
    grantedWands:runtime.getState().wands.length-beforeWands};
}

/** Bounded, read-only local diagnosis; never grants, edits, or restarts a run. */
export function inspectPreviewInventory(runtime: RuntimePort, requestId: string) {
  const state = runtime.getState();
  return {requestId,runId:state.id,wave:state.wave,phase:state.phase,
    backpackItems:state.backpack.length,ownedItems:Object.keys(state.items).length,
    definitions:[...new Set(Object.values(state.items).map(item=>item.definitionId))].sort(),
    backpackDefinitions:state.backpack.flatMap(id=>state.items[id] ? [state.items[id].definitionId] : [])};
}

/** Explicit local preview requests only; normal starts and the remote protocol never unlock cheats. */
export function grantPreviewMagic(runtime: RuntimePort, content: ContentCatalog, requestId: string, onlyMissing = false, selectedDefinitions?:readonly string[]) {
  const before = runtime.getState();
  const runId = before.id;
  const prefix = `preview:${requestId}`;
  runtime.dispatch({id:`${prefix}:unlock`,type:"unlockCheats"});
  runtime.dispatch({id:`${prefix}:enable`,type:"setCheats",enabled:true});
  const owned = new Set(Object.values(before.items).map(item => item.definitionId));
  const definitions = [...Object.keys(content.spells),...Object.keys(content.arcana)]
    .filter(id=>!selectedDefinitions || selectedDefinitions.includes(id))
    .filter(id => !onlyMissing || !owned.has(id));
  definitions.forEach(definitionId => runtime.dispatch({
    id:`${prefix}:${definitionId}`,type:"cheat",action:"grantItem",definitionId,
  }));
  runtime.dispatch({id:`${prefix}:backpack`,type:"setBackpack",open:true});
  const after = runtime.getState();
  return {requestId,runId,unchangedRun:after.id === runId,
    granted:Object.keys(after.items).filter(id => !before.items[id]).length,
    definitions:definitions.length,backpackItems:after.backpack.length};
}
