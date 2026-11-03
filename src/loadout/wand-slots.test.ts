import assert from 'node:assert/strict';
import test from 'node:test';
import { createFixtureState } from '../runtime/mock';
import { createWandFromTemplate } from '../content/wands';
import { demoContent } from '../content/demo';
import { applyLoadoutCommand } from './transactions';

test('slot replacement preserves both wand layouts and cooldowns, replacing atomically even at capacity', () => {
  const state=createFixtureState();
  const large=createWandFromTemplate('wand-4x4','large')!;
  large.placements=[{itemId:'amplify-1',x:3,y:3,rotation:1}]; large.cooldowns={'amplify-1':12};
  state.backpack=[];
  const second=createWandFromTemplate('wand-5x5','second')!;second.characterId='character-1';
  state.wands.push(large,second);state.characters[0].wandIds.push(second.id);
  state.wands[0].cooldowns={'spark-1':100};
  const before=structuredClone(state);
  const command={id:'swap',type:'equipWand',wandId:'large',characterId:'character-1',slot:0} as const;
  const result=applyLoadoutCommand(state,command,demoContent);
  assert.equal(result.result.status,'executed');
  assert.deepEqual(result.state.characters[0].wandIds,['large','second']);
  assert.equal(result.state.wands[0].characterId,null);
  assert.equal(result.state.wands[1].characterId,'character-1');
  for(let i=0;i<state.wands.length;i++) {
    assert.deepEqual(result.state.wands[i].placements,before.wands[i].placements);
    assert.deepEqual(result.state.wands[i].cooldowns,before.wands[i].cooldowns);
  }
  assert.deepEqual(result.state.items,before.items);assert.deepEqual(state,before);
  assert.equal(result.state.revision,state.revision+1);assert.equal(result.events.length,1);
  const active=structuredClone(state);active.phase='battle';active.paused=false;
  const denied=applyLoadoutCommand(active,command,demoContent);
  assert.equal(denied.result.status,'rejected');assert.equal(denied.state,active);
  const invalid=applyLoadoutCommand(state,{...command,slot:9 as 0},demoContent);
  assert.equal(invalid.result.status,'rejected');assert.equal(invalid.state,state);
});

test('cross-character slot transfer unbinds the source owner and rejects invalid ownership atomically', () => {
  const state=createFixtureState();
  const large=createWandFromTemplate('wand-5x5','large')!;large.characterId='character-2';
  state.wands.push(large);
  state.characters.push({...structuredClone(state.characters[0]),id:'character-2',wandIds:['large']});
  const command={id:'cross-owner',type:'equipWand',wandId:'large',characterId:'character-1',slot:0} as const;
  const result=applyLoadoutCommand(state,command,demoContent);
  assert.equal(result.result.status,'executed');
  assert.deepEqual(result.state.characters.map(character=>character.wandIds),[['large'],[]]);
  assert.equal(result.state.wands.find(wand=>wand.id==='wand-1')!.characterId,null);
  assert.equal(result.state.wands.find(wand=>wand.id==='large')!.characterId,'character-1');
  assert.equal(result.events.length,1);
  const invalid=structuredClone(state);invalid.characters[0].wandIds.push('large');
  const before=structuredClone(invalid);
  const denied=applyLoadoutCommand(invalid,command,demoContent);
  assert.equal(denied.result.status,'rejected');assert.equal(denied.state,invalid);
  assert.deepEqual(denied.events,[]);assert.deepEqual(invalid,before);
});

test('dropping into slot one of an empty character appends into the first free dense slot', () => {
  const state=createFixtureState();
  state.characters[0].wandIds=[];state.wands[0].characterId=null;
  const incoming=createWandFromTemplate('wand-4x4','incoming')!;state.wands.push(incoming);
  const result=applyLoadoutCommand(state,{id:'empty-slot',type:'equipWand',wandId:incoming.id,characterId:'character-1',slot:1},demoContent);
  assert.equal(result.result.status,'executed');
  assert.deepEqual(result.state.characters[0].wandIds,['incoming']);
  assert.equal(result.events[0].data.slot,0);
  assert.equal(result.state.wands[0].characterId,null);
});
