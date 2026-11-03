// Synthetic runtime pressure check, not a browser FPS benchmark.
// Run: SPEED=1 node --import tsx scripts/measure-combat.mjs (also SPEED=5).
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const sourceRoot=path.resolve(process.env.SOURCE_ROOT??fileURLToPath(new URL("../src",import.meta.url)));
const [runtimeMod,initialMod,demoMod,monstersMod,wavesMod,geometryMod,compileMod,projectilesMod]=await Promise.all([
  import(pathToFileURL(path.join(sourceRoot,"runtime/index.ts")).href),
  import(pathToFileURL(path.join(sourceRoot,"runtime/initial.ts")).href),
  import(pathToFileURL(path.join(sourceRoot,"content/demo.ts")).href),
  import(pathToFileURL(path.join(sourceRoot,"content/monsters.ts")).href),
  import(pathToFileURL(path.join(sourceRoot,"engine/waves.ts")).href),
  import(pathToFileURL(path.join(sourceRoot,"loadout/geometry.ts")).href),
  import(pathToFileURL(path.join(sourceRoot,"loadout/compile.ts")).href),
  import(pathToFileURL(path.join(sourceRoot,"engine/projectiles.ts")).href),
]);
const {createGameRuntime}=runtimeMod;
const {createInitialState}=initialMod;
const {demoContent}=demoMod;
const {getMonsterSize,getUnlockedMinionDefinitions}=monstersMod;
const {getWaveSpec}=wavesMod;
const {areAdjacent,placementCells}=geometryMod;
const {compileWand}=compileMod;
const {spawnProjectiles}=projectilesMod;

const mode=process.env.MODE??"measure";
const variant=process.env.VARIANT??"unlabeled";
const speed=Number(process.env.SPEED??1);
const seed=0x5eedc0de;
const simMs=mode==="smoke"?3000:20000;
const calls=simMs/(50*speed);
const spellSets=[
  ["spark","metal-needle","fire-field-bolt","prism-ray"],
  ["water-bolt","ember-comet","storm-spear","tidal-prison"],
  ["wind-blade","flame-lance","cinder-ring","ember-familiar"],
  ["spark","metal-needle","fire-field-bolt","prism-ray"],
  ["water-bolt","ember-comet","storm-spear","moving-storm"],
  ["wind-blade","flame-lance","cinder-ring","ember-familiar"],
];

function findPlacement(wand,itemId,shape,occupied){
  for(let y=0;y<wand.height;y++)for(let x=0;x<wand.width;x++){
    const placement={itemId,x,y,rotation:0},cells=placementCells(shape,placement);
    if(!cells.every(c=>c.x>=0&&c.y>=0&&c.x<wand.width&&c.y<wand.height&&!occupied.has(`${c.x},${c.y}`)))continue;
    for(const c of cells)occupied.add(`${c.x},${c.y}`);
    return placement;
  }
  throw new Error(`cannot place ${itemId} on ${wand.id}`);
}

function findAdjacentPlacement(wand,itemId,shape,occupied,spellPlacements){
  for(const spellPlacement of spellPlacements){
    const spell=demoContent.spells[spellPlacement.definitionId];
    const spellCells=placementCells(spell.shape,spellPlacement.placement);
    for(let y=0;y<wand.height;y++)for(let x=0;x<wand.width;x++){
      const placement={itemId,x,y,rotation:0},cells=placementCells(shape,placement);
      if(!cells.every(c=>c.x>=0&&c.y>=0&&c.x<wand.width&&c.y<wand.height&&!occupied.has(`${c.x},${c.y}`)))continue;
      if(!areAdjacent(spellCells,cells))continue;
      for(const c of cells)occupied.add(`${c.x},${c.y}`);
      return placement;
    }
  }
  throw new Error(`cannot place adjacent modifier ${itemId} on ${wand.id}`);
}

function makeFixture(){
  const state=createInitialState();
  state.id=`mixed-perf-${seed.toString(16)}`;state.phase="battle";state.paused=false;state.backpackOpen=false;
  state.speed=speed;state.wave=30;state.gameTimeMs=0;state.waveSpawnRemaining=0;state.spawnRemainingMs=0;state.rngState=seed;
  state.coins=50_000;state.territory.hp=state.territory.maxHp=50_000;state.territory.shield=state.territory.maxShield=50_000;
  state.events=[];state.nextEventSeq=1;state.revision=0;state.wands=[];state.items={};state.backpack=[];state.entities=[];
  state.characters=state.characters.slice(0,1).flatMap((base)=>Array.from({length:3},(_,i)=>({...structuredClone(base),id:`character-${i+1}`,name:`fixture-${i+1}`,sequenceId:["fire-9","wood-9","metal-9"][i],growthProfileId:["fire","wood","balanced"][i],level:12,xp:1000,grade:"rare",wandIds:[],mana:10_000,maxMana:10_000,manaRegen:1_000})));
  state.knowledge.spellIds=Object.keys(demoContent.spells);state.knowledge.arcanaIds=Object.keys(demoContent.arcana);
  state.knowledge.sequenceIds=state.characters.map(c=>c.sequenceId);

  const waveSpec=getWaveSpec(state.wave),unlocked=getUnlockedMinionDefinitions(state.wave),baseHp=18+(state.wave-1)*3;
  const bossBefore=index=>waveSpec.bossNodes.filter(node=>node.spawnIndex<index).length;
  for(let i=0;i<60;i++){
    const node=waveSpec.bossNodes.find(candidate=>candidate.spawnIndex===i),tier=node?.tier??"none",isBoss=!!node;
    const ordinal=i-bossBefore(i),minion=isBoss?undefined:unlocked[(ordinal+Math.max(0,state.wave-2))%Math.max(1,unlocked.length)],spawn=minion?.spawn;
    const mult=tier==="apex"?16:tier==="major"?7:tier==="minor"?3:1;
    const definitionId=isBoss?`boss-${tier}`:minion?.id??"enemy-basic",id=`enemy-${state.wave}-checkpoint-${i}`;
    const x=8+((i*37)%84),y=30+(i%7)*2,hp=baseHp*mult*(spawn?.hpMultiplier??1)*30;
    state.entities.push({id,definitionId,kind:"enemy",level:state.wave,grade:tier==="apex"?"mythic":tier==="major"?"epic":tier==="minor"?"rare":"common",bodySize:getMonsterSize({definitionId}).id,faction:"enemy",x,y,hp,maxHp:hp,damage:(2+state.wave-1)*(isBoss?(tier==="apex"?5:tier==="major"?3:2):(spawn?.damageMultiplier??1)),speed:isBoss?7:(10+Math.min(state.wave-1,10)*.5)*(spawn?.speedMultiplier??1),moveSpeed:4,moveRampMs:1200,movementMode:isBoss?(i%2?"huntCharacter":"straight"):spawn?.movementMode??"straight",...(spawn?.movementMode==="huntCharacter"?{targetCharacterId:state.characters[i%3].id}:{}),range:4,cooldownMs:Math.max(400,1000*(spawn?.cooldownMultiplier??1)),attackRemainingMs:0});
  }

  const compiledByWand=[];
  for(let wi=0;wi<6;wi++){
    const character=state.characters[Math.floor(wi/2)],wand={id:`wand-mixed-${wi+1}`,name:`mixed-${wi+1}`,characterId:character.id,level:8,grade:"rare",width:6,height:6,placements:[],cooldowns:{}};
    const occupied=new Set(),spellPlacements=[];
    for(let si=0;si<4;si++){
      const definitionId=spellSets[wi][si],definition=demoContent.spells[definitionId];
      if(!definition)throw new Error(`missing spell ${definitionId}`);
      const itemId=`equipped-${wi}-${si}`;state.items[itemId]={id:itemId,definitionId,kind:"spell",level:8,grade:"epic"};
      const placement=findPlacement(wand,itemId,definition.shape,occupied);wand.placements.push(placement);spellPlacements.push({definitionId,placement});
    }
    const arcanaId=wi<3?"split":"double",arcana=demoContent.arcana[arcanaId],arcanaItemId=`equipped-${wi}-modifier`;
    state.items[arcanaItemId]={id:arcanaItemId,definitionId:arcanaId,kind:"arcana",level:8,grade:"rare"};
    wand.placements.push(findAdjacentPlacement(wand,arcanaItemId,arcana.shape,occupied,spellPlacements));
    state.wands.push(wand);character.wandIds.push(wand.id);
    const compiled=compileWand(state,wand.id,demoContent);
    if(compiled?.spells.length!==4)throw new Error(`${wand.id} compile count ${compiled?.spells.length}`);
    compiledByWand.push(compiled);
  }
  const backpackDefs=[...Object.keys(demoContent.spells),...Object.keys(demoContent.arcana)];
  for(let i=0;i<44;i++){
    const definitionId=backpackDefs[(i*11+5)%backpackDefs.length],kind=demoContent.spells[definitionId]?"spell":"arcana",definition=demoContent.spells[definitionId]??demoContent.arcana[definitionId],id=`bag-${i}`;
    state.items[id]={id,definitionId,kind,level:3,grade:definition.grade};state.backpack.push(id);
  }
  const all=compiledByWand.flatMap(w=>w.spells);
  const impactTypes=new Set(all.map(s=>s.impact?.type).filter(Boolean));
  const areaModes=new Set(all.map(s=>s.area?.mode).filter(Boolean));
  const effects=new Set(all.map(s=>s.effect));
  const onHitCount=all.filter(s=>s.onHit&&Object.keys(s.onHit).length).length;
  const splitCount=Math.max(...all.map(s=>s.splitCount));
  const burstCount=Math.max(...all.map(s=>s.burstCount));
  const coverage={spellCount:Object.keys(demoContent.spells).length,monsterCount:Object.keys(monstersMod.monsterDefinitions).length,impactTypes:[...impactTypes].sort(),areaModes:[...areaModes].sort(),effects:[...effects].sort(),onHitSpells:onHitCount,splitCount,burstCount};
  for(const required of ["pierce","splash","chain","field"])if(!impactTypes.has(required))throw new Error(`compiled fixture missing ${required}`);
  for(const required of ["projectile","chain","beam","area","summon"])if(!effects.has(required))throw new Error(`compiled fixture missing effect ${required}`);
  for(const required of ["ring","vortex","field"])if(!areaModes.has(required))throw new Error(`compiled fixture missing area ${required}`);
  if(onHitCount===0||splitCount<2||burstCount<2)throw new Error(`onHit/split/double missing: ${JSON.stringify(coverage)}`);

  const seedEmit=(type,data)=>state.events.push({seq:state.nextEventSeq++,type,gameTimeMs:state.gameTimeMs,data});
  for(let i=0;i<100;i++)if(!spawnProjectiles(state,state.characters[i%3].id,{itemId:`pressure-launcher-${i}`,definitionId:"spark",power:1,range:100,casts:1,speed:120},seedEmit))throw new Error(`seed projectile ${i} failed`);
  const initialProjectiles=state.entities.filter(e=>e.kind==="projectile"&&e.hp>0).length;
  if(initialProjectiles!==100)throw new Error(`seed projectiles ${initialProjectiles}`);
  state.events.push({seq:state.nextEventSeq++,type:"waveStarted",gameTimeMs:state.gameTimeMs,data:{wave:state.wave}});
  state.revision=state.nextEventSeq-1;
  return {state,coverage,initialProjectiles};
}

const fixture=makeFixture();
const runtime=createGameRuntime(demoContent,{checkpointVersion:1,state:fixture.state,pausedBeforeBackpack:false,results:[]},{seedSource:()=>seed});
const counts={},eventLog=[],entitySamples=[runtime.checkpoint().state.entities.length],tickSamples=[];
runtime.subscribe((_state,events)=>entitySamples.push(_state.entities.length));
runtime.subscribeEvents((_summary,events)=>{for(const event of events){counts[event.type]=(counts[event.type]??0)+1;eventLog.push({seq:event.seq,type:event.type,data:event.data})}});
for(let i=0;i<calls;i++){
  const start=performance.now();runtime.tick(50);tickSamples.push(performance.now()-start);
}
const end=runtime.checkpoint().state;
const requiredEvents=["damage","projectileSpawned","chainArc","beamSpawned","areaSpawned","statusApplied","constructSpawned"];
const missing=requiredEvents.filter(type=>!(counts[type]>0));
const activeCalls=end.gameTimeMs/(50*speed);
const result={mode,variant,speed,requestedCalls:calls,activeCalls,simulatedMs:end.gameTimeMs,phase:end.phase,initialEnemies:60,liveEnemies:end.entities.filter(e=>e.kind==="enemy"&&e.hp>0).length,initialProjectiles:fixture.initialProjectiles,coverage:fixture.coverage,events:counts,requiredEventCounts:Object.fromEntries(requiredEvents.map(k=>[k,counts[k]??0])),missingEvents:missing,damageEvents:counts.damage??0,kills:counts.enemyKilled??0,loot:counts.lootGranted??0,territory:end.territory,characterXp:end.characters.map(c=>({id:c.id,xp:c.xp,level:c.level,mana:c.mana,maxMana:c.maxMana})),projectileLifespans:{expired:counts.projectileExpired??0,remaining:end.entities.filter(e=>e.kind==="projectile"&&e.hp>0).length},entitySamples:{count:entitySamples.length,mean:entitySamples.reduce((a,b)=>a+b,0)/entitySamples.length,peak:Math.max(...entitySamples)},timingMs:{mean:tickSamples.reduce((a,b)=>a+b,0)/tickSamples.length,p50:[...tickSamples].sort((a,b)=>a-b)[Math.ceil(tickSamples.length*.5)-1],p95:[...tickSamples].sort((a,b)=>a-b)[Math.ceil(tickSamples.length*.95)-1],max:Math.max(...tickSamples)},stateDigest:createHash("sha256").update(JSON.stringify({phase:end.phase,gameTimeMs:end.gameTimeMs,rngState:end.rngState,territory:end.territory,characters:end.characters.map(c=>[c.id,c.xp,c.level,c.mana]),entities:end.entities.map(e=>[e.id,e.kind,e.hp,e.x,e.y,e.remainingMs]),coins:end.coins,xp:end.xp})).digest("hex"),eventDigest:createHash("sha256").update(JSON.stringify(eventLog)).digest("hex"),eventCount:eventLog.length};
if(missing.length)throw new Error(`effect smoke failed: ${missing.join(", ")} counts=${JSON.stringify(counts)} coverage=${JSON.stringify(fixture.coverage)}`);
if(end.phase!=="battle"||result.simulatedMs!==simMs||activeCalls!==calls)throw new Error(`window incomplete: ${result.simulatedMs}/${simMs}ms phase=${end.phase}`);
const outDir=process.env.OUT_DIR??path.resolve(".local/combat-measurement");fs.mkdirSync(outDir,{recursive:true});fs.writeFileSync(path.join(outDir,`${mode}-speed${speed}.json`),JSON.stringify(result,null,2));
runtime.dispose();console.log(JSON.stringify(result));
