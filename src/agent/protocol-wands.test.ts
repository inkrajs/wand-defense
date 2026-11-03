import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRemoteCommand } from './protocol';

test('protocol preserves legal wand slots and grant definitions while rejecting invalid inputs', () => {
  const base={id:'equip',type:'equipWand',wandId:'wand',characterId:'character'};
  for(const slot of [0,1] as const) assert.deepEqual(parseRemoteCommand({...base,slot}),{...base,slot});
  assert.deepEqual(parseRemoteCommand(base),base);
  for(const slot of [-1,2,NaN,null,'0']) assert.equal(parseRemoteCommand({...base,slot}),undefined);
  const grant={id:'grant',type:'cheat',action:'grantWand',definitionId:'wand-4x4'};
  assert.deepEqual(parseRemoteCommand(grant),grant);
  for(const definitionId of ['',null,NaN]) assert.equal(parseRemoteCommand({...grant,definitionId}),undefined);
});
