import assert from 'node:assert/strict';
import test from 'node:test';
import type { GameState } from '../contracts';
import { createFixtureState } from '../runtime/mock';
import { demoContent } from '../content/demo';
import { applyLoadoutCommand } from './index';
import { spawnProjectiles, advanceProjectiles } from '../engine/projectiles';

const command={id:'clear',type:'clearWand',wandId:'wand-1'} as const;
function filled() {
  const state=createFixtureState();
  state.wands[0].placements.push({itemId:'amplify-1',x:1,y:0,rotation:0});
  state.backpack=['bag-existing'];
  state.items['bag-existing']={...state.items['spark-1'],id:'bag-existing'};
  state.wands[0].cooldowns={'spark-1':600,'amplify-1':25};
  state.wands.push({...structuredClone(state.wands[0]),id:'other',characterId:null,placements:[],cooldowns:{}});
  return state;
}

test('clear returns all magic in placement order with one event, retaining bag order, instances and cooldowns',()=>{
  const state=filled(),before=structuredClone(state);
  const cleared=applyLoadoutCommand(state,command,demoContent);
  assert.equal(cleared.result.status,'executed');
  assert.deepEqual(cleared.state.wands[0].placements,[]);
  assert.deepEqual(cleared.state.backpack,['bag-existing','spark-1','amplify-1']);
  assert.deepEqual(cleared.state.wands[0].cooldowns,before.wands[0].cooldowns);
  assert.equal(cleared.state.wands[1],state.wands[1]);
  assert.equal(cleared.state.items,state.items);assert.equal(cleared.state.knowledge,state.knowledge);
  assert.equal(cleared.state.runStatistics,state.runStatistics);assert.equal(cleared.state.coins,state.coins);
  assert.deepEqual(state,before);assert.equal(cleared.state.revision,state.revision+1);
  assert.equal(cleared.events.length,1);
  assert.deepEqual(cleared.events[0].data,{commandId:'clear',wandId:'wand-1',returnedItemIds:['spark-1','amplify-1'],count:2});
  const placed=applyLoadoutCommand(cleared.state,{id:'place',type:'placeItem',wandId:'wand-1',itemId:'spark-1',x:0,y:0,rotation:0},demoContent);
  assert.equal(placed.state.wands[0].cooldowns['spark-1'],600);
});

test('unknown wand, bad ownership and duplicate or missing item references reject atomically',()=>{
  const changes: ((s:GameState)=>void)[]=[
    s=>{s.wands=[];},
    s=>{s.wands.push(structuredClone(s.wands[0]));},
    s=>{s.characters[0].wandIds=[];},
    s=>{s.wands[0].placements.push({...s.wands[0].placements[0]});},
    s=>{s.backpack.push('spark-1');},
    s=>{s.wands[1].placements.push({...s.wands[0].placements[0]});},
    s=>{delete s.items['amplify-1'];},
    s=>{s.items.alias={...s.items['spark-1']};},
  ];
  for(const change of changes) {
    const state=filled();change(state);const before=structuredClone(state);
    const result=applyLoadoutCommand(state,command,demoContent);
    assert.equal(result.result.status,'rejected');assert.equal(result.state,state);
    assert.deepEqual(result.events,[]);assert.deepEqual(state,before);
  }
});

test('empty wand is an executed single-event no-op on cooldowns; only editable phases allow clearing',()=>{
  const empty=createFixtureState();empty.wands[0].placements=[];empty.wands[0].cooldowns={'spark-1':700};
  const result=applyLoadoutCommand(empty,command,demoContent);
  assert.equal(result.result.status,'executed');assert.deepEqual(result.state.backpack,empty.backpack);
  assert.deepEqual(result.state.wands[0].cooldowns,empty.wands[0].cooldowns);assert.equal(result.events.length,1);
  for(const phase of ['battle','defeat'] as const) {
    const state=filled();state.phase=phase;state.paused=false;
    const rejected=applyLoadoutCommand(state,command,demoContent);
    assert.equal(rejected.result.status,'rejected');assert.equal(rejected.state,state);
  }
  const paused=filled();paused.phase='battle';paused.paused=true;
  assert.equal(applyLoadoutCommand(paused,command,demoContent).result.status,'executed');
});

test('launched projectiles keep their snapshot after the source wand is cleared',()=>{
  const state=createFixtureState();state.phase='battle';
  state.entities=[{id:'target',definitionId:'enemy-basic',kind:'enemy',faction:'enemy',x:50,y:70,hp:100,maxHp:100,damage:0,speed:0,range:1,cooldownMs:1000,attackRemainingMs:1000}];
  assert.equal(spawnProjectiles(state,'character-1',{itemId:'spark-1',definitionId:'spark',power:11,range:24,casts:1,speed:72},()=>{}),true);
  state.paused=true;
  const result=applyLoadoutCommand(state,command,demoContent);
  assert.equal(result.result.status,'executed');assert.deepEqual(result.state.entities,state.entities);
  const resumed=structuredClone(result.state);resumed.paused=false;advanceProjectiles(resumed,1000,()=>{});
  assert.equal(resumed.entities.find(entity=>entity.id==='target')!.hp,89);
});
