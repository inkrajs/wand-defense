import assert from 'node:assert/strict';
import test from 'node:test';
import type { GameState } from '../contracts';
import { createFixtureState } from '../runtime/mock';
import { demoContent } from '../content/demo';
import { applyLoadoutCommand } from './index';
import { spawnProjectiles, advanceProjectiles } from '../engine/projectiles';

function unowned(): GameState {
  const state=createFixtureState();
  state.wands[0].characterId=null;state.characters[0].wandIds=[];
  return state;
}

test('discard a uniquely located bag or wand item without refund, lost knowledge, statistics changes or input mutation',()=>{
  for(const itemId of ['amplify-1','spark-1']) {
    const state=createFixtureState();state.coins=8;
    state.wands[0].cooldowns={[itemId]:700,'other-ledger':15};
    const before=structuredClone(state);
    const result=applyLoadoutCommand(state,{id:'discard',type:'discardItem',itemId},demoContent);
    assert.equal(result.result.status,'executed');
    assert.equal(result.state.items[itemId],undefined);
    assert.equal(result.state.backpack.includes(itemId),false);
    assert.equal(result.state.wands.some(wand=>wand.placements.some(p=>p.itemId===itemId)),false);
    assert.equal(result.state.wands[0].cooldowns[itemId],undefined);
    assert.equal(result.state.wands[0].cooldowns['other-ledger'],15);
    assert.equal(result.state.coins,8);
    assert.deepEqual(result.state.knowledge,before.knowledge);
    assert.deepEqual(result.state.runStatistics,before.runStatistics);
    assert.deepEqual(result.state.entities,before.entities);assert.deepEqual(state,before);
    assert.equal(result.state.revision,state.revision+1);assert.equal(result.events.length,1);
    assert.equal(result.events[0].seq,state.nextEventSeq);
    assert.equal(result.events[0].type,'itemDiscarded');assert.equal(result.events[0].data.itemId,itemId);
  }
});

test('discard an unowned wand returns its spells to the bag and leaves every other layout intact',()=>{
  const state=unowned();
  const other={...structuredClone(state.wands[0]),id:'other',placements:[{itemId:'amplify-1',x:1,y:1,rotation:0 as const}],cooldowns:{'amplify-1':99}};
  state.wands.push(other);state.backpack=[];
  const before=structuredClone(state);
  const result=applyLoadoutCommand(state,{id:'discard',type:'discardWand',wandId:'wand-1'},demoContent);
  assert.equal(result.result.status,'executed');
  assert.deepEqual(result.state.wands,[other]);assert.deepEqual(result.state.items,before.items);
  assert.deepEqual(result.state.backpack,['spark-1']);assert.deepEqual(state,before);
  assert.deepEqual(result.events[0].data.returnedItemIds,['spark-1']);
  assert.equal(result.events[0].type,'wandDiscarded');
  assert.deepEqual(result.state.runStatistics,before.runStatistics);assert.equal(result.state.coins,before.coins);
});

test('unknown, duplicate and invalid ownership references reject before any deletion',()=>{
  const changes: ((s:GameState)=>void)[]=[
    s=>{delete s.items['spark-1'];},
    s=>{s.backpack.push('spark-1');},
    s=>{s.wands[0].placements.push({...s.wands[0].placements[0]});},
    s=>{s.items.alias={...s.items['spark-1']};},
    s=>{s.characters[0].wandIds=[];},
    s=>{s.wands.push({...structuredClone(s.wands[0]),placements:[]});},
  ];
  for(const change of changes) {
    const state=createFixtureState();change(state);const before=structuredClone(state);
    const result=applyLoadoutCommand(state,{id:'bad-item',type:'discardItem',itemId:'spark-1'},demoContent);
    assert.equal(result.result.status,'rejected');assert.equal(result.state,state);
    assert.deepEqual(state,before);assert.deepEqual(result.events,[]);
  }
  for(const mode of ['equipped','stale-owner','duplicate-id','missing-contained-item','duplicate-contained-item'] as const) {
    const state=mode==='equipped'?createFixtureState():unowned();
    if(mode==='stale-owner')state.characters[0].wandIds=['wand-1'];
    if(mode==='duplicate-id')state.wands.push(structuredClone(state.wands[0]));
    if(mode==='missing-contained-item')delete state.items['spark-1'];
    if(mode==='duplicate-contained-item')state.backpack.push('spark-1');
    const before=structuredClone(state);
    const result=applyLoadoutCommand(state,{id:'bad-wand',type:'discardWand',wandId:'wand-1'},demoContent);
    assert.equal(result.result.status,'rejected',mode);assert.equal(result.state,state);
    assert.deepEqual(state,before);assert.deepEqual(result.events,[]);
  }
});

test('discard requires an editable phase and paused battle allows it',()=>{
  for(const phase of ['battle','defeat'] as const) {
    const state=unowned();state.phase=phase;state.paused=false;
    for(const command of [{id:'item',type:'discardItem',itemId:'spark-1'},{id:'wand',type:'discardWand',wandId:'wand-1'}] as const) {
      const result=applyLoadoutCommand(state,command,demoContent);
      assert.equal(result.result.status,'rejected');assert.equal(result.state,state);
    }
  }
  const state=unowned();state.phase='battle';state.paused=true;
  assert.equal(applyLoadoutCommand(state,{id:'paused',type:'discardWand',wandId:'wand-1'},demoContent).result.status,'executed');
});

test('already launched projectile keeps its damage snapshot after its source spell is discarded',()=>{
  const state=createFixtureState();state.phase='battle';state.paused=false;
  state.entities=[{id:'target',definitionId:'enemy-basic',kind:'enemy',faction:'enemy',x:50,y:70,hp:100,maxHp:100,damage:0,speed:0,range:1,cooldownMs:1000,attackRemainingMs:1000}];
  assert.equal(spawnProjectiles(state,'character-1',{itemId:'spark-1',definitionId:'spark',power:11,range:24,casts:1,speed:72},()=>{}),true);
  state.paused=true;
  const result=applyLoadoutCommand(state,{id:'source-discard',type:'discardItem',itemId:'spark-1'},demoContent);
  assert.equal(result.result.status,'executed');assert.deepEqual(result.state.entities,state.entities);
  const resumed=structuredClone(result.state);resumed.paused=false;
  advanceProjectiles(resumed,1000,()=>{});
  assert.equal(resumed.entities.find(entity=>entity.id==='target')!.hp,89);
});
