import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameRuntime} from './index';
import {dispatchRemote} from '../agent/protocol';
import {projectFrame} from '../agent/projection';

test('clearWand is a single durable remote transaction preserving inventory order and cooldowns',()=>{
  const checkpoint=createGameRuntime().checkpoint();checkpoint.state.wands[0].cooldowns={'spark-1':600};
  const runtime=createGameRuntime(undefined,checkpoint),before=runtime.getState();
  const command={id:'clear-wand',type:'clearWand',wandId:'wand-1'};
  const result=dispatchRemote(runtime,command);assert.equal(result.status,'executed');
  const after=runtime.getState();assert.deepEqual(after.backpack,['amplify-1','spark-1']);
  assert.deepEqual(after.wands[0].placements,[]);assert.deepEqual(after.wands[0].cooldowns,before.wands[0].cooldowns);
  assert.deepEqual(after.items,before.items);assert.deepEqual(after.runStatistics,before.runStatistics);
  assert.deepEqual(dispatchRemote(runtime,command),result);assert.deepEqual(runtime.getState(),after);
  const restored=createGameRuntime(undefined,runtime.checkpoint());
  assert.deepEqual(dispatchRemote(restored,command),result);assert.deepEqual(restored.getState(),after);
  const events=projectFrame(after,after.events,[]).events.filter(event=>event.type==='wandCleared');
  assert.equal(events.length,1);assert.equal(events[0].data.count,1);
});
