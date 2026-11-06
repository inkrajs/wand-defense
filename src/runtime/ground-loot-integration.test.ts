import assert from 'node:assert/strict';
import test from 'node:test';
import type { CombatEntity } from '../contracts';
import { demoContent } from '../content/demo';
import { dispatchRemote, parseRemoteCommand } from '../agent/protocol';
import { projectFrame } from '../agent/projection';
import { createGameRuntime } from './index';
import { loadRun, saveRun, shouldPersistRunChange } from './session';

function enemy(id: string, y: number, hp: number, definitionId = 'enemy-basic'): CombatEntity {
  return {id,definitionId,kind:'enemy',faction:'enemy',x:50,y,hp,maxHp:20,damage:0,speed:0,range:0,cooldownMs:1000,attackRemainingMs:1000};
}
function storage() {
  const records = new Map<string,string>();
  return {getItem:(key:string)=>records.get(key)??null,setItem:(key:string,value:string)=>{records.set(key,value);}};
}

test('visible ground loot stays undiscovered until an idempotent HTTP pickup, including checkpoint restore', () => {
  const content={...demoContent,gear:{'apprentice-hat':demoContent.gear!['apprentice-hat']},items:{}};
  const checkpoint=createGameRuntime(content).checkpoint();
  assert.equal(checkpoint.state.groundLoot,undefined, 'legacy checkpoints need no migration');
  Object.assign(checkpoint.state,{phase:'battle',wave:1,waveSpawnRemaining:0,entities:[enemy('dead',70,0),enemy('live',50,20)]});
  const runtime=createGameRuntime(content,checkpoint);runtime.tick(50);
  const before=runtime.getState(), [loot]=before.groundLoot!;
  assert.equal(loot.kind,'gear');assert.equal(before.gear?.[loot.id],undefined);assert.deepEqual(before.knowledge.gearIds??[],[]);
  assert.equal(before.events.some(e=>e.type==='lootGranted'),false);
  const frame=projectFrame(before,before.events,[],content);
  assert.deepEqual(frame.state.groundLoot,[{id:loot.id,kind:'gear',x:50,y:70,grade:loot.instance.grade}]);
  assert.equal(JSON.stringify(frame).includes(loot.definitionId),false);
  assert.ok(frame.capabilities.commands.includes('pickupLoot'));
  assert.deepEqual(parseRemoteCommand({id:'pick',type:'pickupLoot',lootId:loot.id,instance:'ignored'}),{id:'pick',type:'pickupLoot',lootId:loot.id});
  assert.equal(parseRemoteCommand({id:'bad',type:'pickupLoot',lootId:''}),undefined);
  const store=storage();assert.equal(saveRun(store,runtime.checkpoint()),true);
  const restored=createGameRuntime(content,loadRun(store));assert.deepEqual(restored.getState().groundLoot,before.groundLoot);
  restored.dispatch({id:'pause',type:'setPaused',paused:true});
  const command={id:'pick',type:'pickupLoot' as const,lootId:loot.id};
  const receipt=dispatchRemote(restored,command);assert.equal(receipt.status,'executed');
  assert.deepEqual(dispatchRemote(restored,command),receipt);
  assert.equal(restored.dispatch({...command,id:'second-pick'}).code,'LOOT_NOT_FOUND');
  const after=restored.getState();assert.deepEqual(after.groundLoot,[]);
  assert.deepEqual(after.gear?.[loot.id],loot.instance);assert.deepEqual(after.knowledge.gearIds,[loot.definitionId]);
  const collected=after.events.filter(e=>e.type==='lootCollected');assert.equal(collected.length,1);
  assert.equal(collected[0].data.reason,'pickup');assert.deepEqual(collected[0].data.instance,loot.instance);
  assert.equal(after.events.filter(e=>e.type==='lootGranted').length,1);
  assert.equal(shouldPersistRunChange(after,collected),false,'in-wave changes preserve the wave-entry autosave policy');
  assert.equal(saveRun(store,restored.checkpoint()),true);
  const reloaded=createGameRuntime(content,loadRun(store));assert.deepEqual(dispatchRemote(reloaded,command),receipt);
  assert.deepEqual(reloaded.getState().gear,after.gear);
  runtime.dispose();restored.dispose();reloaded.dispose();
});

test('the last real kill spawns and auto-collects loot before waveCleared in the same notification', () => {
  const content={...demoContent,items:{},spells:{...demoContent.spells,spark:{...demoContent.spells.spark,power:500,range:100}}};
  const checkpoint=createGameRuntime(content).checkpoint();
  Object.assign(checkpoint.state,{phase:'battle',wave:1,waveSpawnRemaining:0,entities:[enemy('last-boss',68,1,'boss-minor')]});
  const runtime=createGameRuntime(content,checkpoint);
  let clearing: ReturnType<typeof runtime.getState>['events']=[];
  runtime.subscribeEvents((_state,events)=>{if(events.some(e=>e.type==='waveCleared'))clearing=events;});
  for(let i=0;i<25&&runtime.getState().phase==='battle';i++)runtime.tick(50);
  const state=runtime.getState();assert.equal(state.phase,'reward');assert.deepEqual(state.groundLoot,[]);
  const relevant=clearing.filter(e=>['enemyKilled','lootSpawned','lootCollected','lootGranted','waveCleared'].includes(e.type));
  assert.deepEqual(relevant.map(e=>e.type),['enemyKilled','lootSpawned','lootCollected','lootGranted','waveCleared']);
  const [kill,spawn,collect,grant,clear]=relevant;
  assert.equal(kill.data.entityId,'last-boss');assert.equal(spawn.data.id,collect.data.id);assert.equal(grant.data.instanceId,spawn.data.id);
  assert.equal(collect.gameTimeMs,clear.gameTimeMs);assert.equal(collect.data.reason,'waveClear');
  assert.deepEqual(collect.data.instance,state.gear?.[String(collect.data.id)]);
  assert.equal(shouldPersistRunChange(state,clearing),true);
  const receipt=runtime.dispatch({id:'too-late',type:'pickupLoot',lootId:String(spawn.data.id)});
  assert.equal(receipt.code,'LOOT_NOT_FOUND');assert.equal(Object.keys(state.gear??{}).length,1);
  runtime.dispose();
});
