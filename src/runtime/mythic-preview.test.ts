import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameRuntime} from './index';
import {grantAuthorizedMythicWands} from './preview';
import {dispatchRemote,parseRemoteCommand} from '../agent/protocol';

test('high-level wand gifts require existing user authorization, execute once and preserve prior build',()=>{
  const runtime=createGameRuntime();assert.equal(grantAuthorizedMythicWands(runtime),undefined);
  runtime.dispatch({id:'preview:user-all-magic-20261104-03:unlock',type:'unlockCheats'});
  const before=runtime.getState(),report=grantAuthorizedMythicWands(runtime)!;
  assert.equal(report.status,'executed');assert.equal(report.grantedWands,3);
  assert.equal(report.preservedCoins,true);assert.equal(report.preservedLayouts,true);
  const after=runtime.getState();assert.deepEqual(after.wands[0],before.wands[0]);
  assert.ok(after.wands.slice(-3).every(wand=>wand.grade==='mythic'&&wand.level===50&&wand.width===5&&wand.height===5&&wand.characterId===null));
  assert.equal(after.cheats.enabled,before.cheats.enabled);
  assert.equal(grantAuthorizedMythicWands(runtime),undefined);assert.deepEqual(runtime.getState(),after);
  runtime.dispatch({id:'restart',type:'restart'});assert.equal(grantAuthorizedMythicWands(runtime),undefined);
});

test('combat waits for the durable boundary rather than saving a partial battle as its retry start',()=>{
  const runtime=createGameRuntime();runtime.dispatch({id:'preview:user-all-magic-20261104-03:unlock',type:'unlockCheats'});
  runtime.dispatch({id:'start',type:'startWave'});const before=runtime.checkpoint();
  assert.equal(grantAuthorizedMythicWands(runtime),undefined);assert.deepEqual(runtime.checkpoint(),before);
});

test('partial gift checkpoint resumes remaining wands once and restores the original cheat toggle',()=>{
  const original=createGameRuntime(),prefix='preview:user-mythic-wands-20261104-01';
  original.dispatch({id:'preview:user-all-magic-20261104-03:unlock',type:'unlockCheats'});
  original.dispatch({id:`${prefix}:enable-from-disabled`,type:'setCheats',enabled:true});
  for(let index=0;index<2;index++)original.dispatch({id:`${prefix}:wand:${index}`,type:'cheat',action:'grantWand',definitionId:'wand-5x5',grade:'mythic',level:50});
  const restored=createGameRuntime(undefined,original.checkpoint()),report=grantAuthorizedMythicWands(restored)!;
  assert.equal(report.status,'executed');assert.equal(report.grantedWands,1);
  assert.equal(restored.getState().wands.filter(wand=>wand.grade==='mythic').length,3);
  assert.equal(restored.getState().cheats.enabled,false);
  const after=restored.checkpoint();assert.equal(grantAuthorizedMythicWands(restored),undefined);assert.deepEqual(restored.checkpoint(),after);
});

test('remote custom wand growth remains cheat-gated and validates numeric and rarity inputs',()=>{
  const runtime=createGameRuntime(),command={id:'mythic',type:'cheat',action:'grantWand',definitionId:'wand-5x5',grade:'mythic',level:50};
  assert.equal(dispatchRemote(runtime,command).status,'rejected');
  runtime.dispatch({id:'unlock',type:'unlockCheats'});runtime.dispatch({id:'enable',type:'setCheats',enabled:true});
  assert.equal(dispatchRemote(runtime,command).status,'executed');
  assert.equal(runtime.getState().wands.at(-1)?.level,50);assert.equal(runtime.getState().wands.at(-1)?.grade,'mythic');
  const after=runtime.getState();assert.equal(dispatchRemote(runtime,command).status,'executed');assert.deepEqual(runtime.getState(),after);
  for(const level of [0,-1,1.5,Infinity,NaN])assert.equal(parseRemoteCommand({...command,id:'bad',level}),undefined);
  assert.equal(parseRemoteCommand({...command,id:'bad',grade:'unknown'}),undefined);
});
