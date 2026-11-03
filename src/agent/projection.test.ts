import test from 'node:test';
import assert from 'node:assert/strict';
import type { CharacterBaseStats, CharacterStatBonuses, CombatEntity, ContentCatalog, RuntimePort } from '../contracts';
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
  state.rewardHistory=[{id:'old-reward',wave:1,gameTimeMs:100,reward:{id:'hidden-history',kind:'item',definitionId:secret,label:secret}}];
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


test('character stats and contact events expose numeric contributions without extra payloads', () => {
  const state=createFixtureState();
  state.characters[0].baseStats={attack:4,range:3,castSpeedPercent:20,accuracy:.9,critChance:.1,critMultiplier:2,luck:2,elementBonuses:{fire:.2},secret:'HIDDEN_STATS'} as CharacterBaseStats & {secret:string};
  state.wands[0].statBonuses={attack:5,range:2,luck:3,secret:"HIDDEN_STATS",elementBonuses:{unseen:"HIDDEN_STATS"}} as unknown as CharacterStatBonuses;
  const frame=projectFrame(state,[{seq:1,gameTimeMs:0,type:'damage',data:{beamId:'beam-1',critical:true,amount:5,secret:'HIDDEN_STATS'}},
    {seq:2,gameTimeMs:0,type:'attackMiss',data:{targetId:'enemy-1',sourceCharacterId:state.characters[0].id,secret:'HIDDEN_STATS'}}],[]);
  assert.equal(frame.state.characters[0].stats?.base.attack,4);
  assert.equal(frame.state.characters[0].stats?.equipment.attack,5);
  assert.equal(frame.state.characters[0].stats?.final.attack,9);
  assert.equal(frame.state.characters[0].stats?.final.totalLuck,5);
  assert.equal(JSON.stringify(frame).includes('HIDDEN_STATS'),false);
  assert.deepEqual(frame.events[0].data,{beamId:'beam-1',critical:true,amount:5});
  assert.equal(frame.events[1].type,'attackMiss');
  frame.state.characters[0].stats!.base.elementBonuses.fire=99;
  assert.equal(state.characters[0].baseStats.elementBonuses.fire,.2);
});

test('area telegraphs and chain contacts expose visible geometry without internal life or unknown definitions',()=>{
  const state=createFixtureState();
  const hidden='UNSEEN_FIELD_DEFINITION';
  const field:CombatEntity={id:'area-1',definitionId:hidden,kind:'area',faction:'player',x:50,y:50,
    hp:1,maxHp:1,damage:123,speed:0,range:75,cooldownMs:400,attackRemainingMs:400,remainingMs:2000,launchDelayMs:300,
    area:{mode:'vortex',radius:8,delayMs:300,durationMs:2000,maxTargets:8,tickMs:400,anchor:'caster',moveSpeed:12,pullRadius:12,pullStrength:8}};
  state.entities=[field,{...field,id:'future-chain',kind:'chain'}];
  const frame=projectFrame(state,[{seq:1,type:'chainArc',gameTimeMs:50,data:{chainId:'chain-1',sourceCharacterId:'character-1',
    x:50,y:84,targetX:45,targetY:50,definitionId:hidden,damage:Infinity,secret:hidden}},
    {seq:2,type:'fieldTriggered',gameTimeMs:50,data:{areaId:'area-1',trigger:'contact',mode:'vortex',x:50,y:50,secret:hidden}}],[]);
  assert.equal(frame.state.entities.length,1);
  const visible=frame.state.entities[0];
  assert.equal(visible.launchDelayMs,300);assert.equal(visible.area?.pullRadius,12);
  assert.equal('hp' in visible,false);assert.equal('maxHp' in visible,false);assert.equal('damage' in visible,false);
  assert.equal(JSON.stringify(frame).includes(hidden),false);
  assert.deepEqual(frame.events[0].data,{chainId:'chain-1',sourceCharacterId:'character-1',x:50,y:84,targetX:45,targetY:50});
  assert.deepEqual(frame.events[1].data,{areaId:'area-1',trigger:'contact',mode:'vortex',x:50,y:50});
});

test('enemy conditions and periodic events disclose visible effects but keep unknown origins private',()=>{
  const state=createFixtureState(),hidden='UNKNOWN_BURN_SPELL';
  state.entities=[{id:'enemy',definitionId:'enemy-basic',kind:'enemy',faction:'enemy',x:50,y:30,hp:90,maxHp:100,
    damage:1,speed:10,range:1,cooldownMs:1000,attackRemainingMs:0,status:{
      slow:{multiplier:.6,remainingMs:1000},
      burns:[{id:`status:${hidden}`,definitionId:hidden,sourceLuck:123,damage:5,remainingMs:2000,tickMs:400,tickRemainingMs:200}],
    }}];
  const events=[{seq:1,gameTimeMs:0,type:'damage',data:{statusId:`status:${hidden}`,effect:hidden,
    targetId:'enemy',sourceKind:'status',statusType:'burn',amount:5,critical:false,secret:hidden}},
    {seq:2,gameTimeMs:0,type:'statusApplied',data:{targetId:'enemy',statusType:'slow',multiplier:.6,remainingMs:1000,secret:hidden}}];
  const frame=projectFrame(state,events,[]);
  assert.equal(JSON.stringify(frame).includes(hidden),false);
  assert.deepEqual(frame.state.entities[0].status,{slow:{multiplier:.6,remainingMs:1000},burns:[{damage:5,remainingMs:2000,tickMs:400}]});
  assert.deepEqual(frame.events[0].data,{targetId:'enemy',sourceKind:'status',statusType:'burn',amount:5,critical:false});
  assert.equal(frame.events[1].type,'statusApplied');
  frame.state.entities[0].status!.slow!.multiplier=.1;
  assert.equal(state.entities[0].status?.slow?.multiplier,.6);
});
