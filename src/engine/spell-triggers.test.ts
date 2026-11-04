import assert from 'node:assert/strict';
import test from 'node:test';
import type { ArcanaDefinition, CombatEntity, ContentCatalog, GameState, SpellTrigger } from '../contracts';
import { TRIGGER_LIMITS } from '../contracts/trigger-limits';
import { createFixtureState } from '../runtime/mock';
import { compileWand } from '../loadout/compile';
import { gradedArcanaValue } from '../loadout/grade-scaling';
import { stepBattle } from './index';
import { castSpell } from './effects';
import { advanceProjectiles, spawnProjectiles } from './projectiles';
import { advanceAreaEffects } from './areaEffects';

function fixture(mode: 'hit' | 'timer' = 'hit') {
  const content: ContentCatalog = {
    spells: {
      spark: { id:'spark', name:'Spark', element:'fire', level:1, grade:'common', shape:[{x:0,y:0}], asset:{key:'spark',label:'Spark'},
        effect:'projectile', power:10, manaCost:4, cooldownMs:1000, range:40, speed:40 },
      'ice-ring': { id:'ice-ring', name:'Ice ring', element:'water', level:1, grade:'common', shape:[{x:0,y:0}], asset:{key:'ice-ring',label:'Ice ring'},
        effect:'area', power:20, manaCost:7, cooldownMs:2000, range:15,
        area:{mode:'ring',radius:15,delayMs:0,durationMs:400,maxTargets:8}, onHit:{slow:{multiplier:.5,durationMs:1000}} },
    },
    arcana: { trigger:{id:'trigger',name:'Trigger',level:1,grade:'common',shape:[{x:0,y:0}],asset:{key:'trigger',label:'Trigger'},
      modifier: mode === 'hit' ? 'hitTrigger' : 'timerTrigger', value: mode === 'hit' ? 1 : 200} },
    recipes:[], sequences:{'fire-9':{id:'fire-9',name:'Fire',pathwayId:'fire',number:9,bonuses:{},requirements:[]}},
  };
  const state = createFixtureState();
  state.phase='battle'; state.wave=1; state.waveSpawnRemaining=1; state.spawnRemainingMs=100000;
  state.characters[0].manaRegen=0;
  state.wands[0].placements=[{itemId:'spark-1',x:0,y:0,rotation:0},{itemId:'trigger-1',x:1,y:0,rotation:0},{itemId:'payload-1',x:2,y:0,rotation:0}];
  state.items['trigger-1']={id:'trigger-1',definitionId:'trigger',kind:'arcana',level:1,grade:'common'};
  state.items['payload-1']={id:'payload-1',definitionId:'ice-ring',kind:'spell',level:1,grade:'common'};
  state.backpack=[];
  state.entities=[enemy('target',50,65)];
  return {state,content};
}
function enemy(id:string,x:number,y:number): CombatEntity {
  return {id,definitionId:'enemy-basic',kind:'enemy',faction:'enemy',x,y,hp:1000,maxHp:1000,damage:0,speed:0,range:1,cooldownMs:1000,attackRemainingMs:10000};
}
function recorder() {
  const events: {type:string;data:Record<string,unknown>}[]=[];
  return {events,emit:(type:string,data:Record<string,unknown>)=>{events.push({type,data})}};
}
function compiledCast(state:GameState,content:ContentCatalog,emit:ReturnType<typeof recorder>['emit']) {
  const spell=compileWand(state,'wand-1',content)!.spells.find(s=>s.itemId==='spark-1')!;
  assert.equal(castSpell(state,'character-1',{...spell,definitionId:spell.id,casts:spell.copies},content,emit),true);
  return spell;
}

test('bridge compiles detached, in grid order, with existing adjacent modifiers and one combined charge',()=>{
  const {state,content}=fixture();
  content.arcana.amplify={...structuredClone(content.arcana.trigger),id:'amplify',modifier:'amplify',value:2};
  state.wands[0].placements.push({itemId:'amplify-1',x:0,y:1,rotation:0});
  const before=structuredClone({state,content});
  const spells=compileWand(state,'wand-1',content)!.spells;
  const carrier=spells.find(s=>s.itemId==='spark-1')!,payload=spells.find(s=>s.itemId==='payload-1')!;
  assert.equal(carrier.power,20); assert.equal(carrier.manaCost,11); assert.equal(carrier.cooldownMs,2000);
  assert.equal(payload.triggeredByItemId,carrier.itemId); assert.equal(carrier.trigger?.payload.power,20);
  assert.deepEqual(carrier.modifierItemIds,['amplify-1','trigger-1']);
  state.wands[0].placements.reverse();
  assert.deepEqual(compileWand(state,'wand-1',content)!.spells.find(s=>s.itemId==='spark-1'),carrier);
  state.wands[0].placements.reverse();
  carrier.trigger!.payload.area!.radius=99;
  assert.deepEqual({state,content},before);
  assert.equal(gradedArcanaValue(content.arcana.trigger,'mythic'),1);
});

test('real hit releases the ice ring at collision point once, without an independent payload cast',()=>{
  const {state:initial,content}=fixture(); let state=initial;
  const first=stepBattle(state,50,content);state=first.state;
  assert.equal(state.characters[0].mana,89);
  assert.equal(state.wands[0].cooldowns['spark-1'],2000);assert.equal(state.wands[0].cooldowns['payload-1'],2000);
  assert.equal(first.events.filter(e=>e.type==='spellCast').length,1);
  assert.equal(state.entities.some(e=>e.kind==='area'),false);
  const events=[...first.events];
  for(let i=0;i<18;i++){const next=stepBattle(state,50,content);state=next.state;events.push(...next.events);}
  const triggers=events.filter(e=>e.type==='spellTriggered');assert.equal(triggers.length,1);
  assert.equal(triggers[0].data.mode,'hit');assert.equal(triggers[0].data.x,50);
  assert.ok(Number(triggers[0].data.y)>65 && Number(triggers[0].data.y)<68);
  const area=events.find(e=>e.type==='areaSpawned')!;
  assert.deepEqual([area.data.x,area.data.y],[triggers[0].data.x,triggers[0].data.y]);
  const damage=events.filter(e=>e.type==='damage');assert.equal(damage.filter(e=>e.data.sourceItemId==='spark-1').length,1);
  assert.equal(damage.filter(e=>e.data.sourceItemId==='payload-1').length,1);
  assert.equal(state.entities.find(e=>e.id==='target')!.hp,970);
  assert.ok(damage.every(e=>e.data.sourceCharacterId==='character-1'));
  assert.equal(events.filter(e=>e.type==='spellCast'&&e.data.sourceItemId==='payload-1').length,1);
  assert.equal(state.characters[0].mana,89);
});

test('timer clips a large movement slice to the exact simulated point and waits through pauses',()=>{
  const {state,content}=fixture('timer'),{events,emit}=recorder();compiledCast(state,content,emit);
  const bullet=state.entities.find(e=>e.kind==='projectile')!;
  state.paused=true;advanceProjectiles(state,1000,emit);
  assert.equal(bullet.triggerRemainingMs,200);assert.equal(bullet.y,84);
  state.paused=false;state.backpackOpen=true;advanceProjectiles(state,1000,emit);assert.equal(bullet.triggerRemainingMs,200);
  state.backpackOpen=false;advanceProjectiles(state,1000,emit);
  const trigger=events.find(e=>e.type==='spellTriggered')!;
  assert.deepEqual([trigger.data.x,trigger.data.y],[50,76]);assert.equal(bullet.hp,0);
  const area=state.entities.find(e=>e.kind==='area')!;assert.deepEqual([area.x,area.y],[50,76]);
  assert.equal(state.entities.find(e=>e.id==='target')!.hp,1000);
  advanceAreaEffects(state,400,emit);assert.equal(state.entities.find(e=>e.id==='target')!.hp,980);
  advanceProjectiles(state,1000,emit);assert.equal(events.filter(e=>e.type==='spellTriggered').length,1);
});

test('early collision cancels timer payload; a hit bridge still releases on armor-blocked contact',()=>{
  const timed=fixture('timer'),r=recorder();timed.state.entities[0].y=80;
  compiledCast(timed.state,timed.content,r.emit);advanceProjectiles(timed.state,1000,r.emit);
  assert.equal(r.events.some(e=>e.type==='spellTriggered'),false);assert.equal(timed.state.entities.some(e=>e.kind==='area'),false);
  const hit=fixture(),r2=recorder();hit.state.entities[0].armor=100;
  compiledCast(hit.state,hit.content,r2.emit);advanceProjectiles(hit.state,1000,r2.emit);
  assert.equal(hit.state.entities[0].hp,1000);assert.equal(r2.events.filter(e=>e.type==='spellTriggered').length,1);
});

test('timer does not tick during delayed bursts, and payload bursts preserve the trigger origin',()=>{
  const {state,content}=fixture('timer'),{events,emit}=recorder();
  const trigger=compileWand(state,'wand-1',content)!.spells[0].trigger!;
  assert.equal(spawnProjectiles(state,'character-1',{itemId:'spark-1',definitionId:'spark',power:10,range:40,casts:2,burstCount:2,splitCount:1,speed:10,trigger},emit),true);
  const bullets=state.entities.filter(e=>e.kind==='projectile');advanceProjectiles(state,100,emit);
  assert.equal(bullets[0].triggerRemainingMs,100);assert.equal(bullets[1].triggerRemainingMs,200);
  advanceProjectiles(state,100,emit);assert.equal(bullets[1].triggerRemainingMs,120);
  const direct=fixture('timer'),r=recorder();direct.content.spells['ice-ring']={...direct.content.spells.spark,id:'ice-ring',manaCost:7,cooldownMs:2000};
  const compiled=compileWand(direct.state,'wand-1',direct.content)!.spells[0];
  compiled.trigger!.payload.burstCount=2;compiled.trigger!.payload.casts=2;
  castSpell(direct.state,'character-1',{...compiled,definitionId:compiled.id,casts:1},direct.content,r.emit);
  advanceProjectiles(direct.state,200,r.emit);
  let payloads=direct.state.entities.filter(e=>e.sourceItemId==='payload-1');assert.equal(payloads.length,2);
  assert.ok(payloads.every(e=>e.x===50&&e.y===76&&e.remainingMs===5000));
  advanceProjectiles(direct.state,120,r.emit);
  const launches=r.events.filter(e=>e.type==='projectileSpawned'&&e.data.sourceItemId==='payload-1');
  assert.equal(launches.length,2);assert.ok(launches.every(e=>e.data.originY===76));
  assert.ok(payloads.every(e=>!e.trigger));
});

test('missing, ambiguous and unsupported bridges leave ordinary spells active with their original costs',()=>{
  for(const invalid of ['single','three','unsupported'] as const){
    const {state,content}=fixture();
    if(invalid==='single')state.wands[0].placements.pop();
    if(invalid==='three'){
      state.items.extra={...state.items['payload-1'],id:'extra'};state.wands[0].placements.push({itemId:'extra',x:1,y:1,rotation:0});
    }
    if(invalid==='unsupported')content.spells['ice-ring'].effect='heal';
    const compiled=compileWand(state,'wand-1',content)!;
    assert.ok(compiled.spells.every(s=>!s.trigger&&!s.triggeredByItemId));
    assert.equal(compiled.spells.find(s=>s.id==='spark')!.manaCost,4);
  }
});

test('insufficient combined mana or payload cooldown prevents the entire cast without partial charges',()=>{
  for(const gate of ['mana','cooldown','noTarget'] as const){
    const {state,content}=fixture();
    if(gate==='mana')state.characters[0].mana=10;
    if(gate==='cooldown')state.wands[0].cooldowns['payload-1']=500;
    if(gate==='noTarget')state.entities[0].y=0;
    const before=state.characters[0].mana,next=stepBattle(state,50,content);
    assert.equal(next.state.characters[0].mana,before);assert.equal(next.events.some(e=>e.type==='spellCast'),false);
    assert.equal(next.state.wands[0].cooldowns['spark-1']??0,0);
  }
});

test('in-flight payload snapshot survives a loadout change and pure step pause freezes timer and resources',()=>{
  const {state,content}=fixture('timer');let current=stepBattle(state,50,content).state;
  current.wands[0].placements=[];current.items={};
  current.paused=true;const paused=structuredClone(current);assert.deepEqual(stepBattle(current,500,content).state,paused);
  current.paused=false;
  const result=stepBattle(current,200,content);
  assert.equal(result.events.filter(e=>e.type==='spellTriggered').length,1);
  assert.equal(result.state.entities.find(e=>e.kind==='area')?.sourceItemId,'payload-1');
  assert.equal(result.state.characters[0].mana,89);assert.equal(current.gameTimeMs,50);
});

test('carrier, payload, depth and per-step release budgets bound dense compositions',()=>{
  const {state,content}=fixture('timer'),r=recorder();
  const trigger:SpellTrigger=compileWand(state,'wand-1',content)!.spells[0].trigger!;
  trigger.payload.burstCount=64;trigger.payload.splitCount=64;trigger.payload.casts=64;
  for(let i=0;i<4;i++)spawnProjectiles(state,'character-1',{itemId:`carrier-${i}`,definitionId:'spark',power:1,range:40,casts:64,splitCount:64,speed:0,trigger},r.emit);
  assert.equal(state.entities.filter(e=>e.kind==='projectile').length,4*TRIGGER_LIMITS.carrierCopies);
  advanceProjectiles(state,200,r.emit);
  assert.equal(r.events.filter(e=>e.type==='spellTriggered').length,TRIGGER_LIMITS.releasesPerStep);
  assert.equal(r.events.filter(e=>e.type==='spellTriggerSuppressed').length,16);
  assert.ok(state.entities.filter(e=>e.kind==='area').length<=32);
  assert.ok(r.events.filter(e=>e.type==='spellCast'&&e.data.sourceItemId==='payload-1').every(e=>Number(e.data.casts)<=TRIGGER_LIMITS.payloadCopies));
  assert.ok(state.entities.every(e=>!e.trigger));
});

test('a missed flight never releases a hit payload; piercing contact releases it at most once',()=>{
  const missed=fixture(),r=recorder();compiledCast(missed.state,missed.content,r.emit);
  missed.state.entities[0].x=90;advanceProjectiles(missed.state,5000,r.emit);
  assert.equal(r.events.some(e=>e.type==='spellTriggered'),false);assert.equal(missed.state.entities.some(e=>e.kind==='area'),false);
  const pierced=fixture(),r2=recorder();
  pierced.content.spells.spark.impact={type:'pierce',maxTargets:2};
  pierced.state.entities.push(enemy('second',50,60));compiledCast(pierced.state,pierced.content,r2.emit);
  advanceProjectiles(pierced.state,1000,r2.emit);advanceProjectiles(pierced.state,1000,r2.emit);
  assert.equal(r2.events.filter(e=>e.type==='damage').length,2);assert.equal(r2.events.filter(e=>e.type==='spellTriggered').length,1);
});

test('shared-payload and nested bridges are reserved once with a hard depth of one',()=>{
  const {state,content}=fixture();
  content.spells['ice-ring']={...content.spells.spark,id:'ice-ring'};
  state.wands[0].width=5;
  state.items['trigger-2']={...state.items['trigger-1'],id:'trigger-2'};
  state.items.third={...state.items['payload-1'],id:'third'};
  state.wands[0].placements.push({itemId:'trigger-2',x:3,y:0,rotation:0},{itemId:'third',x:4,y:0,rotation:0});
  const compiled=compileWand(state,'wand-1',content)!;
  assert.equal(compiled.spells.filter(s=>s.trigger).length,1);
  assert.equal(compiled.spells.filter(s=>s.triggeredByItemId).length,1);
  assert.equal(compiled.spells.find(s=>s.itemId==='third')?.triggeredByItemId,undefined);
  assert.equal('trigger' in compiled.spells[0].trigger!.payload,false);
  assert.equal(TRIGGER_LIMITS.depth,1);
});
