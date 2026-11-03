import assert from 'node:assert/strict';
import test from 'node:test';
import type { ContentCatalog, GameState, Grade, SpellDefinition } from '../contracts';
import { expandedArcana, expandedArcanaDescriptions } from '../content/expandedArcana';
import { createFixtureState } from '../runtime/mock';
import { compileWand } from './compile';
import { gradedArcanaValue } from './grade-scaling';
import { placementCells, validatePlacement } from './geometry';
import { castSpell } from '../engine/effects';
import { stepBattle } from '../engine';
import { advanceAreaEffects } from '../engine/areaEffects';

const spell: SpellDefinition={id:'test',name:'Test',effect:'projectile',element:'fire',level:1,grade:'common',shape:[{x:0,y:0},{x:1,y:0}],asset:{key:'test',label:'Test'},power:10,manaCost:10,cooldownMs:1000,range:20,speed:100};
const positions={haste:[2,1],efficiency:[3,1],reach:[2,3],velocity:[1,2],area:[4,2]} as const;
function setup(definition: SpellDefinition=spell, grade: Grade='common') {
  const content:ContentCatalog={spells:{test:structuredClone(definition)},arcana:structuredClone(expandedArcana),recipes:[],sequences:{}};
  const state:GameState=createFixtureState();
  state.items={spell:{id:'spell',definitionId:'test',kind:'spell',level:1,grade:'common'}};state.backpack=[];
  state.wands[0]={...state.wands[0],width:6,height:6,placements:[{itemId:'spell',x:2,y:2,rotation:0}]};
  for(const [id,[x,y]] of Object.entries(positions)) {
    state.items[id]={id,definitionId:id,kind:'arcana',level:1,grade};
    state.wands[0].placements.push({itemId:id,x,y,rotation:0});
  }
  return {state,content};
}
function close(actual:number|undefined,expected:number) {assert.ok(actual!==undefined && Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);}

test('five usable arcana definitions have real shapes, descriptions and independent adjacent numeric effects',()=>{
  const {state,content}=setup();
  const occupied: {x:number;y:number}[]=[];
  for(const p of state.wands[0].placements) {
    const shape=p.itemId==='spell'?spell.shape:expandedArcana[p.itemId].shape;
    const cells=placementCells(shape,p);
    assert.equal(validatePlacement(6,6,cells,occupied).valid,true);occupied.push(...cells);
  }
  assert.ok(Object.keys(positions).every(id=>Object.hasOwn(expandedArcana,id)));
  for(const id of Object.keys(positions)) {assert.ok(expandedArcanaDescriptions[id]);assert.equal(expandedArcana[id].grade,'common');}
  const before=structuredClone({state,content});
  const result=compileWand(state,'wand-1',content)!.spells[0];
  close(result.cooldownMs,850);close(result.manaCost,8);close(result.range,25);close(result.speed,130);close(result.power,10);
  assert.equal(result.modifierItemIds.length,4);
  assert.equal(result.modifierItemIds.includes('area'),false); // Plain projectiles have no area geometry.
  assert.deepEqual({state,content},before);
  state.wands[0].placements=state.wands[0].placements.map(p=>p.itemId==='haste'?{...p,x:0,y:0}:p);
  close(compileWand(state,'wand-1',content)!.spells[0].cooldownMs,1000);
});

test('higher instance grades strengthen reductions and increments without free or negative costs',()=>{
  for(const [grade,cooldown,mana,range,speed] of [
    ['uncommon',812.5,7.5,26.25,137.5],['mythic',490,3.2,37,202],
  ] as const) {
    const {state,content}=setup(spell,grade),result=compileWand(state,'wand-1',content)!.spells[0];
    close(result.cooldownMs,cooldown);close(result.manaCost,mana);close(result.range,range);close(result.speed,speed);
  }
  close(gradedArcanaValue({...expandedArcana.haste,value:0.1},'mythic'),0.1);
  close(gradedArcanaValue({...expandedArcana.efficiency,value:0.1},'mythic'),0.1);
});

test('area changes beam width, splash and chain radii, and every area radius without mutating definitions',()=>{
  const definitions:SpellDefinition[]=[
    {...spell,effect:'beam',beam:{width:2,durationMs:500,tickMs:100,maxTargets:3}},
    {...spell,impact:{type:'splash',radius:4,maxTargets:3}},
    {...spell,impact:{type:'chain',radius:5,maxTargets:3,falloff:0.8}},
    ...(['strike','eruption','ring'] as const).map(mode=>({...spell,effect:'area' as const,area:{mode,radius:10,delayMs:0,durationMs:500,maxTargets:3}})),
  ];
  for(const definition of definitions) {
    const {state,content}=setup(definition),before=structuredClone(content);
    const result=compileWand(state,'wand-1',content)!.spells[0];
    if(result.beam){close(result.beam.width,2.6);assert.equal(result.modifierItemIds.includes('velocity'),false);result.beam.width=999;}
    if(result.impact && result.impact.type!=='pierce')close(result.impact.radius,definition.impact!.type==='splash'?5.2:6.5);
    if(result.area){close(result.area.radius,13);close(result.range,result.area.mode==='ring'?32.5:25);result.area.radius=999;}
    assert.deepEqual(content,before);
  }
});

test('compiled ring area and reach modifiers extend real target acquisition and the emitted damage radius',()=>{
  const ring:SpellDefinition={...spell,effect:'area',area:{mode:'ring',radius:10,delayMs:0,durationMs:650,maxTargets:3}};
  const {state,content}=setup(ring);
  state.phase='battle';state.entities=[{id:'distant',definitionId:'enemy-basic',kind:'enemy',faction:'enemy',x:50,y:54,hp:100,maxHp:100,damage:0,speed:0,range:1,cooldownMs:1000,attackRemainingMs:1000}];
  const compiled=compileWand(state,'wand-1',content)!.spells[0];
  close(compiled.range,32.5);
  assert.equal(castSpell(state,'character-1',{...compiled,definitionId:compiled.id,casts:compiled.copies},content,()=>{}),true);
  const entity=state.entities.find(entity=>entity.kind==='area')!;
  close(entity.area!.radius,32.5); // Runtime ring geometry uses effective cast range, not the static template radius.
  advanceAreaEffects(state,650,()=>{});
  assert.ok(state.entities.find(entity=>entity.id==='distant')!.hp<100);
});

test('battle consumes modified mana and cooldown and launches a genuinely faster projectile',()=>{
  const {state,content}=setup();
  state.phase='battle';state.wave=1;state.waveSpawnRemaining=1;state.spawnRemainingMs=100000;
  state.characters[0].manaRegen=0;
  state.entities=[{id:'target',definitionId:'enemy-basic',kind:'enemy',faction:'enemy',x:50,y:70,hp:100,maxHp:100,damage:0,speed:0,range:1,cooldownMs:1000,attackRemainingMs:1000}];
  const result=stepBattle(state,50,content).state;
  close(result.characters[0].mana,92);
  close(result.wands[0].cooldowns.spell,850);
  close(result.entities.find(entity=>entity.kind==='projectile')!.speed,130);
});
