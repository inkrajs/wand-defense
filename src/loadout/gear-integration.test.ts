import assert from 'node:assert/strict';
import test from 'node:test';
import { createFixtureState } from '../runtime/mock';
import { demoContent } from '../content/demo';
import { applyLoadoutCommand, compileWand } from './index';
import { applySupplyCommand } from '../runtime/supplies';

test('semantic equipment routing changes compiled damage and a potion restores the gear-expanded mana capacity',()=>{
  const state=createFixtureState();
  const content=structuredClone(demoContent);
  content.items={...content.items, mana:{id:'mana',name:'Mana',level:1,grade:'common',shape:[{x:0,y:0}],asset:{key:'mana',label:'Mana'},effect:{type:'partyMana',value:40}}};
  state.gear={helm:{id:'helm',name:'Helm',slot:'head',characterId:null,level:1,grade:'common',statBonuses:{attack:4,maxMana:30}}};
  state.supplies={potion:{id:'potion',definitionId:'mana',level:1,grade:'common'}};
  state.characters[0].mana=90;
  const before=structuredClone(state);
  const baseline=compileWand(state,'wand-1',content)!.spells[0].power;
  const equipped=applyLoadoutCommand(state,{id:'equip',type:'equipGear',gearId:'helm',characterId:'character-1'},content);
  assert.equal(equipped.result.status,'executed');
  const power=compileWand(equipped.state,'wand-1',content)!.spells[0].power;
  assert.ok(power>baseline);
  assert.ok(Math.abs(power-15.4)<1e-9); // (10 spell + 4 equipped attack) × 1.1 fire sequence.
  const used=applySupplyCommand(equipped.state,{id:'use',type:'useItem',itemId:'potion'},content);
  assert.equal(used.result.status,'executed');
  assert.equal(used.state.characters[0].mana,130);
  assert.equal(used.events[0].data.amount,40);
  assert.equal(used.state.supplies!.potion,undefined);
  assert.deepEqual(used.state.runStatistics,state.runStatistics);
  assert.deepEqual(state,before);
});

test('gear alias IDs and stale or wrong-slot ownership reject atomically through the public loadout route',()=>{
  for(const mode of ['alias','stale-owner','wrong-slot'] as const) {
    const state=createFixtureState();
    state.gear={helm:{id:'helm',name:'Helm',slot:'head',characterId:null,level:1,grade:'common',statBonuses:{attack:4}}};
    if(mode==='alias') state.gear.alias={...state.gear.helm};
    if(mode==='stale-owner') state.characters[0].gearIds={head:'helm'};
    if(mode==='wrong-slot') {state.gear.helm.characterId='character-1';state.characters[0].gearIds={body:'helm'};}
    const before=structuredClone(state);
    const rejected=applyLoadoutCommand(state,{id:'bad-gear',type:'equipGear',gearId:'helm',characterId:'character-1'},demoContent);
    assert.equal(rejected.result.status,'rejected',mode);
    assert.equal(rejected.state,state);assert.deepEqual(rejected.events,[]);assert.deepEqual(state,before);
  }
});
