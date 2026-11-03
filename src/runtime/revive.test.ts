import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameRuntime } from './index';
import { getCharacterStats } from '../content/characters';
import { demoContent } from '../content/demo';
import { dispatchRemote, parseRemoteCommand } from '../agent/protocol';

const command={id:'revive',type:'cheat',action:'revive'} as const;

test('revive preserves the run and progression, replenishes resources and retries the failed wave exactly once',()=>{
  const runtime=createGameRuntime(), checkpoint=runtime.checkpoint();
  const state=checkpoint.state;
  state.phase='defeat';state.wave=7;state.gameTimeMs=1234;state.coins=42;state.xp=33;
  state.territory.hp=0;state.territory.shield=0;
  state.characters[0].mana=0;state.wands[0].cooldowns={'spark-1':123};
  state.cheats={unlocked:true,enabled:true};state.paused=true;state.backpackOpen=true;
  state.waveSpawnRemaining=3;state.spawnRemainingMs=10;checkpoint.pausedBeforeBackpack=true;
  state.rewards=[{id:'pending',kind:'coins',label:'coins',amount:20}];
  state.entities=[{id:'pending',definitionId:'spark',kind:'projectile',faction:'player',x:0,y:0,hp:1,maxHp:1,damage:1,speed:1,range:1,cooldownMs:0,attackRemainingMs:0}];
  state.rewardHistory=[{id:'earlier',wave:1,gameTimeMs:100,reward:{id:'chosen',kind:'coins',label:'coins',amount:10}}];
  const active=createGameRuntime(undefined,checkpoint),before=active.getState();
  assert.deepEqual(parseRemoteCommand(command),command);
  assert.equal(dispatchRemote(active,command).status,'executed');
  const revived=active.getState();
  assert.equal(revived.phase,'ready');assert.equal(revived.wave,6);
  assert.equal(revived.territory.hp,before.territory.maxHp);assert.equal(revived.territory.shield,before.territory.maxShield);
  assert.equal(revived.characters[0].mana,getCharacterStats(before,before.characters[0].id,demoContent)!.final.maxMana);
  assert.equal(revived.id,before.id);assert.equal(revived.gameTimeMs,before.gameTimeMs);assert.equal(revived.rngState,before.rngState);
  assert.equal(revived.coins,before.coins);assert.equal(revived.xp,before.xp);
  assert.deepEqual(revived.characters.map(c=>({...c,mana:0})),before.characters.map(c=>({...c,mana:0})));
  assert.deepEqual(revived.wands,before.wands);assert.deepEqual(revived.items,before.items);
  assert.deepEqual(revived.rewardHistory,before.rewardHistory);
  assert.deepEqual(revived.entities,[]);assert.deepEqual(revived.rewards,[]);
  assert.equal(revived.waveSpawnRemaining,0);assert.equal(revived.spawnRemainingMs,0);
  assert.equal(revived.paused,false);assert.equal(revived.backpackOpen,false);assert.equal(active.checkpoint().pausedBeforeBackpack,false);
  assert.deepEqual(revived.events.slice(-2).map(e=>e.type),['game.revived','cheat.executed']);
  assert.deepEqual(revived.events.at(-2)!.data,{wave:7});
  dispatchRemote(active,command);assert.deepEqual(active.getState(),revived);
  active.dispatch({id:'retry-wave',type:'startWave'});assert.equal(active.getState().wave,7);
});

test('revive rejects locked/disabled cheats and non-defeat phases without healing',()=>{
  for(const mode of ['locked','disabled','alive'] as const) {
    const checkpoint=createGameRuntime().checkpoint();
    checkpoint.state.phase=mode==='alive'?'ready':'defeat';checkpoint.state.territory.hp=1;
    checkpoint.state.cheats={unlocked:mode!=='locked',enabled:mode==='alive'};
    const runtime=createGameRuntime(undefined,checkpoint),before=runtime.getState();
    assert.equal(runtime.dispatch(command).status,'rejected');assert.deepEqual(runtime.getState(),before);
  }
});
