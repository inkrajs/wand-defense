import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameRuntime } from './index';
import { dispatchRemote } from '../agent/protocol';

test('grantWand respects cheat gates, rejects unknown templates and is idempotent; swapping does not migrate spells', () => {
  const runtime=createGameRuntime();
  const grant={id:'grant',type:'cheat',action:'grantWand',definitionId:'wand-5x5'} as const;
  assert.equal(runtime.dispatch({...grant,id:'locked'}).status,'rejected');
  runtime.dispatch({id:'unlock',type:'unlockCheats'});
  assert.equal(runtime.dispatch({...grant,id:'disabled'}).status,'rejected');
  runtime.dispatch({id:'enable',type:'setCheats',enabled:true});
  const before=runtime.getState();
  assert.equal(dispatchRemote(runtime,grant).status,'executed');
  const granted=runtime.getState(),wand=granted.wands.find(w=>!before.wands.some(old=>old.id===w.id))!;
  assert.equal(wand.width,5);assert.equal(wand.height,5);assert.equal(wand.characterId,null);
  assert.deepEqual(wand.placements,[]);assert.deepEqual(granted.items,before.items);
  dispatchRemote(runtime,grant);assert.deepEqual(runtime.getState(),granted);
  assert.equal(runtime.dispatch({...grant,id:'unknown',definitionId:'nope'}).status,'rejected');
  assert.deepEqual(runtime.getState(),granted);
  const swap={id:'swap',type:'equipWand',wandId:wand.id,characterId:'character-1',slot:0} as const;
  assert.equal(dispatchRemote(runtime,swap).status,'executed');
  const swapped=runtime.getState();
  assert.equal(swapped.wands.find(w=>w.id==='wand-1')!.characterId,null);
  assert.deepEqual(swapped.wands.find(w=>w.id==='wand-1')!.placements,before.wands[0].placements);
  assert.deepEqual(swapped.wands.find(w=>w.id===wand.id)!.placements,[]);
  dispatchRemote(runtime,swap);assert.deepEqual(runtime.getState(),swapped);
});
