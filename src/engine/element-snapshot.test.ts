import assert from 'node:assert/strict';
import test from 'node:test';
import type { CombatEntity, ContentCatalog, EffectType, Element, GameState, SpellDefinition } from '../contracts';
import { createFixtureState } from '../runtime/mock';
import { compileWand } from '../loadout/compile';
import { castSpell } from './effects';
import { advanceProjectiles, spawnProjectiles } from './projectiles';
import { advanceAreaEffects } from './areaEffects';
import { advanceBeams } from './beams';
import { advanceConstructs } from './constructs';

function definition(id:string,element:Element,effect:EffectType='projectile'):SpellDefinition {
  return {id,name:id,element,effect,level:1,grade:'common',shape:[{x:0,y:0}],asset:{key:id,label:id},
    power:10,manaCost:4,cooldownMs:1000,range:40,speed:40,
    ...(effect==='beam'?{beam:{width:3,durationMs:100,tickMs:100,maxTargets:1}}:{}),
    ...(effect==='chain'?{impact:{type:'chain',radius:10,maxTargets:1,falloff:1}}:{}),
    ...(effect==='area'?{area:{mode:'field',radius:12,delayMs:0,durationMs:200,tickMs:200,maxTargets:1,anchor:'target'}}:{}),
  };
}
function fixture(spells:SpellDefinition[]) {
  const content:ContentCatalog={spells:Object.fromEntries(spells.map(spell=>[spell.id,spell])),arcana:{},recipes:[],sequences:{}};
  const state=createFixtureState();state.phase='battle';state.waveSpawnRemaining=1;state.entities=[target()];
  state.wands[0].width=8;state.wands[0].placements=[];state.items={};
  for(const [index,spell] of spells.entries()){
    const itemId=`item-${spell.id}`;state.items[itemId]={id:itemId,definitionId:spell.id,kind:'spell',level:1,grade:'common'};
    state.wands[0].placements.push({itemId,x:index,y:0,rotation:0});
  }
  return {state,content};
}
function target():CombatEntity {
  return {id:'target',definitionId:'enemy-basic',kind:'enemy',faction:'enemy',x:50,y:65,hp:1000,maxHp:1000,
    damage:0,speed:0,range:1,cooldownMs:1000,attackRemainingMs:10000};
}
function record(){const events:{type:string;data:Record<string,unknown>}[]=[];return {events,emit:(type:string,data:Record<string,unknown>)=>{events.push({type,data})}};}
function cast(state:GameState,content:ContentCatalog,id:string,emit:ReturnType<typeof record>['emit']){
  const {element: _element,...spec}=content.spells[id];
  assert.equal(castSpell(state,'character-1',{...spec,itemId:`item-${id}`,definitionId:id,casts:1},content,emit),true);
}
function advance(state:GameState,effect:EffectType,emit:ReturnType<typeof record>['emit']){
  if(effect==='projectile')advanceProjectiles(state,1000,emit);
  if(effect==='beam')advanceBeams(state,100,emit);
  if(effect==='area')advanceAreaEffects(state,200,emit);
}

test('custom catalog casts snapshot water/lightning for projectile, beam, area and immediate chain reactions',()=>{
  for(const effect of ['projectile','beam','area','chain'] as const){
    const {state,content}=fixture([definition(`custom-water-${effect}`,'water',effect),definition(`custom-lightning-${effect}`,'lightning',effect)]),r=record();
    const [waterId,lightningId]=Object.keys(content.spells);
    cast(state,content,waterId,r.emit);
    assert.equal(state.entities.find(e=>e.definitionId===waterId)?.element,'water',effect);
    content.spells[waterId].element='fire';advance(state,effect,r.emit);
    assert.ok(state.entities[0].status?.wetRemainingMs,effect);
    cast(state,content,lightningId,r.emit);advance(state,effect,r.emit);
    assert.equal(state.entities[0].status?.wetRemainingMs,undefined,effect);
    assert.equal(r.events.filter(e=>e.type==='elementalReaction').length,1,effect);
    assert.equal(state.entities[0].hp,975,effect);
  }
});

test('a catalog redefining a bundled water id as fire does not inherit demo elemental behavior',()=>{
  const {state,content}=fixture([definition('water-bolt','fire')]),r=record();
  cast(state,content,'water-bolt',r.emit);advanceProjectiles(state,1000,r.emit);
  assert.equal(state.entities[0].hp,990);assert.equal(state.entities[0].status?.wetRemainingMs,undefined);
  assert.equal(r.events.some(e=>e.type==='statusApplied'&&e.data.statusType==='wet'),false);
});

test('impact fields and both contact/projectile constructs retain their casting element',()=>{
  const water=definition('custom-water-field','water');water.impact={type:'field',radius:8,maxTargets:1,durationMs:400,tickMs:200,trigger:'contact'};
  const field=fixture([water]),r=record();cast(field.state,field.content,water.id,r.emit);advanceProjectiles(field.state,1000,r.emit);
  assert.equal(field.state.entities.find(e=>e.kind==='area')?.element,'water');advanceAreaEffects(field.state,200,r.emit);
  assert.ok(field.state.entities[0].status?.wetRemainingMs);
  for(const mode of ['contact','projectile'] as const)for(const element of ['water','lightning'] as const){
    const summon=definition(`custom-${element}-${mode}`,element,'summon');
    summon.construct={hp:20,durationMs:1000,attackIntervalMs:500,maxAlive:1,attackMode:mode,behavior:'attack',placement:'target',projectileSpeed:40};
    const f=fixture([summon]),events=record();if(element==='lightning')f.state.entities[0].status={wetRemainingMs:1000};
    cast(f.state,f.content,summon.id,events.emit);assert.equal(f.state.entities.find(e=>e.kind==='summon')?.element,element);
    f.content.spells[summon.id].element='fire';advanceConstructs(f.state,50,events.emit);
    if(mode==='projectile'){
      assert.equal(f.state.entities.find(e=>e.kind==='projectile')?.element,element);advanceProjectiles(f.state,1000,events.emit);
    }
    if(element==='water')assert.ok(f.state.entities[0].status?.wetRemainingMs,mode);
    else assert.equal(events.events.filter(e=>e.type==='elementalReaction').length,1,mode);
  }
});

test('triggered area and projectile payloads use their own snapshotted element after catalog changes',()=>{
  for(const effect of ['area','projectile'] as const){
    const carrier=definition('custom-carrier','fire'),payload=definition('custom-payload','water',effect);
    const {state,content}=fixture([carrier,payload]),r=record();state.characters[0].sequenceId='none';
    content.arcana.trigger={id:'trigger',name:'Trigger',level:1,grade:'common',shape:[{x:0,y:0}],asset:{key:'trigger',label:'Trigger'},modifier:'hitTrigger',value:1};
    state.items.trigger={id:'trigger',definitionId:'trigger',kind:'arcana',level:1,grade:'common'};
    state.wands[0].placements[1].x=2;state.wands[0].placements.push({itemId:'trigger',x:1,y:0,rotation:0});
    const compiled=compileWand(state,'wand-1',content)!.spells[0];assert.equal(compiled.trigger?.payload.element,'water');
    assert.equal(castSpell(state,'character-1',{...compiled,definitionId:compiled.id,casts:1},content,r.emit),true);
    content.spells[payload.id].element='fire';advanceProjectiles(state,1000,r.emit);
    const entity=state.entities.find(e=>e.definitionId===payload.id)!;assert.equal(entity.element,'water');
    advance(state,effect,r.emit);assert.ok(state.entities[0].status?.wetRemainingMs,effect);
  }
});

test('legacy projectiles and impact fields without element keep bundled catalog fallback',()=>{
  const {state}=fixture([]),r=record();
  assert.equal(spawnProjectiles(state,'character-1',{itemId:'old-water',definitionId:'water-bolt',power:10,range:40,casts:1,speed:40,
    impact:{type:'field',radius:8,maxTargets:1,durationMs:400,tickMs:200,trigger:'contact'}},r.emit),true);
  assert.equal(state.entities.find(e=>e.kind==='projectile')?.element,undefined);
  advanceProjectiles(state,1000,r.emit);assert.equal(state.entities.find(e=>e.kind==='area')?.element,undefined);
  advanceAreaEffects(state,200,r.emit);assert.ok(state.entities[0].status?.wetRemainingMs);
  assert.equal(spawnProjectiles(state,'character-1',{itemId:'old-lightning',definitionId:'lightning-bolt',power:10,range:40,casts:1,speed:40},r.emit),true);
  advanceProjectiles(state,1000,r.emit);assert.equal(r.events.filter(e=>e.type==='elementalReaction').length,1);
});
