import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameRuntime} from './index';
import {demoContent} from '../content/demo';
import {getCharacterStats} from '../content/characters';
import {dispatchRemote} from '../agent/protocol';
import {projectFrame} from '../agent/projection';

test('real gear and supplies routes preserve discovery, effective stats and command receipts',()=>{
  const runtime=createGameRuntime();
  runtime.dispatch({id:'unlock',type:'unlockCheats'});runtime.dispatch({id:'enabled',type:'setCheats',enabled:true});
  assert.equal(dispatchRemote(runtime,{id:'hat',type:'cheat',action:'grantGear',definitionId:'apprentice-hat'}).status,'executed');
  assert.equal(dispatchRemote(runtime,{id:'potion',type:'cheat',action:'grantSupply',definitionId:'mana-potion'}).status,'executed');
  const allocated=runtime.getState(),gearId=Object.keys(allocated.gear!)[0],itemId=Object.keys(allocated.supplies!)[0];
  const before=getCharacterStats(allocated,'character-1',demoContent)!;
  assert.equal(dispatchRemote(runtime,{id:'wear',type:'equipGear',gearId,characterId:'character-1'}).status,'executed');
  const equipped=runtime.getState(),stats=getCharacterStats(equipped,'character-1',demoContent)!;
  assert.equal(stats.final.maxMana,before.final.maxMana+15);
  const use={id:'drink',type:'useItem',itemId};
  const first=dispatchRemote(runtime,use);assert.equal(first.status,'executed');
  const after=runtime.getState();assert.equal(after.characters[0].mana,115);assert.equal(after.supplies![itemId],undefined);
  assert.deepEqual(dispatchRemote(runtime,use),first);assert.deepEqual(runtime.getState(),after);
  const frame=projectFrame(after,after.events,[],demoContent);
  assert.deepEqual(frame.content.gearIds,['apprentice-hat']);assert.equal(frame.content.gear.length,1);
  assert.deepEqual(frame.content.itemIds,['mana-potion']);assert.equal(frame.content.items.length,1);
  assert.equal(JSON.stringify(frame).includes('spring-pendant'),false);
  assert.equal(frame.state.gear[gearId].characterId,'character-1');
  const restored=createGameRuntime(demoContent,runtime.checkpoint());assert.deepEqual(restored.getState(),after);
  assert.equal(dispatchRemote(restored,{id:'take-off',type:'unequipGear',gearId}).status,'executed');
  assert.equal(restored.getState().characters[0].mana,100);
  assert.equal(getCharacterStats(restored.getState(),'character-1',demoContent)!.final.maxMana,100);
});

test('a settled real enemy death grants discoverable equipment once and never replays loot on refresh',()=>{
  const checkpoint=createGameRuntime().checkpoint();checkpoint.state.phase='battle';checkpoint.state.wave=1;checkpoint.state.waveSpawnRemaining=0;
  checkpoint.state.entities=[{id:'first-loot',kind:'enemy',faction:'enemy',definitionId:'enemy-basic',x:50,y:30,hp:0,maxHp:18,damage:1,speed:0,range:0,cooldownMs:1000,attackRemainingMs:0}];
  const runtime=createGameRuntime(demoContent,checkpoint);runtime.tick(50);
  const state=runtime.getState();assert.equal(Object.keys(state.gear!).length,1);assert.equal(state.knowledge.gearIds!.length,1);
  assert.equal(state.events.filter(event=>event.type==='lootGranted'&&event.data.kind==='gear').length,1);
  assert.equal(projectFrame(state,state.events,[],demoContent).content.gear.length,1);
  const restored=createGameRuntime(demoContent,runtime.checkpoint());restored.tick(50);
  assert.deepEqual(restored.getState(),state);
});
