import assert from 'node:assert/strict';
import test from 'node:test';
import type { ContentCatalog, Grade, SpellDefinition } from '../contracts';
import { createFixtureState } from '../runtime/mock';
import { expandedArcana, expandedArcanaDescriptions } from '../content/expandedArcana';
import { demoContent } from '../content/demo';
import { compileWand } from './compile';
import { spawnProjectiles } from '../engine/projectiles';

const definition:SpellDefinition={...demoContent.spells.spark,id:'test',shape:[{x:0,y:0},{x:1,y:0}],range:100,speed:80};
function configured(spell:SpellDefinition,mods:readonly (readonly [string,number,number])[],grade:Grade='common') {
  const state=createFixtureState();
  state.items={spell:{id:'spell',definitionId:'test',kind:'spell',level:1,grade:'common'}};
  state.backpack=[];state.wands[0]={...state.wands[0],width:8,height:6,placements:[{itemId:'spell',x:2,y:2,rotation:0}]};
  for(const [id,x,y]of mods) {state.items[id]={id,definitionId:id,kind:'arcana',level:1,grade};state.wands[0].placements.push({itemId:id,x,y,rotation:0});}
  const content:ContentCatalog={spells:{test:structuredClone(spell)},arcana:{...demoContent.arcana,...expandedArcana},recipes:[],sequences:{}};
  return {state,content};
}
function near(value:number,expected:number){assert.ok(Math.abs(value-expected)<1e-8,`${value} != ${expected}`);}

test('area scales field-impact radius and field/vortex radii while preserving movement, pull strength and timing',()=>{
  const definitions:SpellDefinition[]=[
    {...definition,impact:{type:'field',radius:6,maxTargets:4,durationMs:1000,tickMs:200,trigger:'contact'}},
    {...definition,effect:'area',area:{mode:'field',radius:7,delayMs:0,durationMs:1500,tickMs:250,maxTargets:4,anchor:'target'}},
    {...definition,effect:'area',area:{mode:'vortex',radius:5,pullRadius:9,pullStrength:0.2,moveSpeed:7,delayMs:0,durationMs:1500,tickMs:250,maxTargets:4,anchor:'target'}},
  ];
  for(const spell of definitions) {
    const {state,content}=configured(spell,[['area',4,2]]),before=structuredClone({state,content});
    const compiled=compileWand(state,'wand-1',content)!.spells[0];
    assert.ok(compiled.modifierItemIds.includes('area'));
    if(compiled.impact?.type==='field') {near(compiled.impact.radius,7.8);assert.equal(compiled.impact.durationMs,1000);assert.equal(compiled.impact.tickMs,200);}
    if(compiled.area) {
      near(compiled.area.radius,spell.area!.radius*1.3);
      assert.equal(compiled.range,100);
      if(compiled.area.mode==='vortex') {near(compiled.area.pullRadius!,11.7);assert.equal(compiled.area.pullStrength,0.2);assert.equal(compiled.area.moveSpeed,7);}
      assert.equal(compiled.area.durationMs,1500);assert.equal(compiled.area.tickMs,250);
    }
    assert.deepEqual({state,content},before);
  }
});

test('common four/six burst data produce real time-separated projectiles with a 120ms interval',()=>{
  for(const [id,count]of [['quadruple',4],['sextuple',6]] as const) {
    const arcana=expandedArcana[id];assert.ok(arcana);assert.equal(arcana.modifier,'double');assert.equal(arcana.value,count);
    assert.equal(arcana.shape.length,count);assert.ok(expandedArcanaDescriptions[id]);
    const {state,content}=configured(definition,[[id,2,0]]);
    const compiled=compileWand(state,'wand-1',content)!.spells[0];
    assert.equal(compiled.burstCount,count);assert.equal(compiled.splitCount,1);assert.equal(compiled.copies,count);
    state.phase='battle';state.wave=1;
    state.entities=[{id:'target',definitionId:'enemy-basic',kind:'enemy',faction:'enemy',x:50,y:70,hp:100,maxHp:100,damage:0,speed:0,range:1,cooldownMs:1000,attackRemainingMs:1000}];
    assert.equal(spawnProjectiles(state,'character-1',{...compiled,definitionId:compiled.id,casts:compiled.copies,speed:compiled.speed!},()=>{}),true);
    const bullets=state.entities.filter(entity=>entity.kind==='projectile');
    assert.equal(bullets.length,count);
    assert.deepEqual(bullets.map(entity=>entity.launchDelayMs),Array.from({length:count},(_,index)=>index*120));
  }
});

test('higher-grade bursts compose with simultaneous split branches within the 64 projectile budget',()=>{
  const {state,content}=configured(definition,[['quadruple',0,1],['sextuple',2,0],['split',4,2]],'mythic');
  const compiled=compileWand(state,'wand-1',content)!.spells[0];
  assert.equal(compiled.burstCount,64);assert.equal(compiled.splitCount,7);assert.equal(compiled.copies,64);
  state.phase='battle';state.wave=1;
  state.entities=[{id:'target',definitionId:'enemy-basic',kind:'enemy',faction:'enemy',x:50,y:70,hp:100,maxHp:100,damage:0,speed:0,range:1,cooldownMs:1000,attackRemainingMs:1000}];
  assert.equal(spawnProjectiles(state,'character-1',{...compiled,definitionId:compiled.id,casts:compiled.copies,speed:compiled.speed!},()=>{}),true);
  const bullets=state.entities.filter(entity=>entity.kind==='projectile');assert.equal(bullets.length,64);
  assert.equal(bullets.filter(entity=>entity.launchDelayMs===0).length,7);
  assert.equal(bullets.filter(entity=>entity.launchDelayMs===120).length,7);
  assert.ok(bullets.every(entity=>Number.isFinite(entity.launchDelayMs)));
});
