import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameRuntime } from './index';
import { dispatchRemote } from '../agent/protocol';
import { projectFrame } from '../agent/projection';

test('discarding through the real semantic route persists exactly once and keeps earned totals and discoveries',()=>{
  const runtime=createGameRuntime(),before=runtime.getState();
  const command={id:'discard-bag',type:'discardItem',itemId:'amplify-1'};
  assert.equal(dispatchRemote(runtime,command).status,'executed');
  const after=runtime.getState();assert.equal(after.items['amplify-1'],undefined);
  assert.deepEqual(after.runStatistics,before.runStatistics);assert.deepEqual(after.knowledge,before.knowledge);
  assert.equal(after.coins,before.coins);assert.ok(!after.backpack.includes('amplify-1'));
  dispatchRemote(runtime,command);assert.deepEqual(runtime.getState(),after);
  const restored=createGameRuntime(undefined,runtime.checkpoint());
  dispatchRemote(restored,command);assert.deepEqual(restored.getState(),after);
  const frame=projectFrame(after,after.events,[]);
  assert.equal(frame.events.find(event=>event.type==='itemDiscarded')?.data.itemId,'amplify-1');
  assert.ok(frame.capabilities.commands.includes('discardWand'));
  assert.equal(dispatchRemote(restored,{id:'equipped',type:'discardWand',wandId:'wand-1'}).status,'rejected');
  assert.deepEqual(restored.getState(),after);
});
