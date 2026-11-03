import test from 'node:test';
import assert from 'node:assert/strict';
import type { ContentCatalog, RuntimePort } from '../contracts';
import { createFixtureState } from '../runtime/mock';
import { projectFrame } from './projection';
import { dispatchRemote } from './protocol';

test('ordinary projection never discloses unknown definitions, recipe payloads, or errors', () => {
  const state = createFixtureState();
  const secret = 'UNSEEN_SECRET';
  state.knowledge.recipeIds.push('known-recipe');
  state.items.hidden = {id:'hidden',definitionId:secret,kind:'spell',level:1,grade:'rare'};
  state.backpack.push('hidden');
  state.rewards.push({id:'reward',kind:'item',definitionId:secret,label:secret});
  const catalog: ContentCatalog = {spells:{[secret]:{id:secret,name:secret,element:'fire',shape:[{x:0,y:0}],asset:{key:secret,label:secret},effect:'projectile',power:10,manaCost:1,cooldownMs:100,range:10,level:1,grade:'rare'}},arcana:{},sequences:{},recipes:[{id:'known-recipe',name:'已知配方',inputs:['spark',secret],output:secret,requireAdjacency:true}]};
  const frame = projectFrame(state,[{seq:1,type:secret,gameTimeMs:0,data:{message:secret,definitionId:secret}}],
    [{commandId:'c',status:'rejected',revision:0,code:secret,message:secret}],catalog);
  assert.equal(JSON.stringify(frame).includes(secret),false);
  assert.equal('rngState' in frame.state,false);
  assert.equal(frame.content.recipes.length,1);
  assert.deepEqual(frame.content.recipes[0].inputs,['spark']);
  assert.equal(frame.content.recipes[0].unknownInputCount,1);
  assert.equal('output' in frame.content.recipes[0],false);
  assert.equal(frame.events[0].type,'stateChanged');
  frame.state.territory.hp=0;
  assert.equal(state.territory.hp,100);
  state.cheats={unlocked:true,enabled:true};
  assert.equal(JSON.stringify(projectFrame(state,[],[],catalog)).includes(secret),false);
  state.knowledge.spellIds.push(secret);
  const discovered=projectFrame(state,[],[],catalog);
  assert.equal(discovered.content.recipes[0].output,secret);
  assert.equal(discovered.content.recipes[0].unknownInputCount,0);
  assert.equal(discovered.content.spells[0].id,secret);
});

test('network cannot unlock cheats, bypass toggle gates, or forward unknown fields', () => {
  const state=createFixtureState();
  const seen:unknown[]=[];
  const runtime:RuntimePort={getState:()=>state,dispatch:c=>{seen.push(c);return {commandId:c.id,status:'executed',revision:0}},subscribe:()=>()=>{}};
  for(const command of [{id:'u',type:'unlockCheats'},{id:'c',type:'cheat',action:'heal'},{id:'s',type:'setCheats',enabled:true}])
    assert.equal(dispatchRemote(runtime,command).status,'rejected');
  assert.equal(seen.length,0);
  dispatchRemote(runtime,{id:'p',type:'setPaused',paused:true,secret:'ignored'});
  assert.deepEqual(seen,[{id:'p',type:'setPaused',paused:true}]);
  state.cheats.unlocked=true;
  assert.equal(dispatchRemote(runtime,{id:'c2',type:'cheat',action:'heal'}).status,'rejected');
  state.cheats.enabled=true;
  assert.equal(dispatchRemote(runtime,{id:'c3',type:'cheat',action:'heal'}).status,'executed');
  assert.equal(dispatchRemote(runtime,{id:'r',type:'mergeRecipe',wandId:'wand-1',recipeId:'unknown',itemIds:[]}).status,'rejected');
});
