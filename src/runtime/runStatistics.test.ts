import assert from 'node:assert/strict';
import test from 'node:test';
import type { GameEvent } from '../contracts';
import { demoContent } from '../content/demo';
import { createInitialState } from './initial';
import { createGameRuntime } from './index';
import { accumulateBattleStatistics, createRunStatistics, restoreRunStatistics } from './runStatistics';

function unlocked() {
  const runtime=createGameRuntime();
  runtime.dispatch({id:'unlock',type:'unlockCheats'});runtime.dispatch({id:'enable',type:'setCheats',enabled:true});
  return runtime;
}

test('actual item grants increment once, initial items and rearrangement/merge consumption do not count as acquisition',()=>{
  const runtime=unlocked();
  assert.deepEqual(runtime.getState().runStatistics,createRunStatistics());
  const grant={id:'grant',type:'cheat',action:'grantItem',definitionId:'amplify'} as const;
  runtime.dispatch(grant);runtime.dispatch(grant);
  const granted=runtime.getState();assert.equal(granted.runStatistics!.arcanaAcquired,1);
  const source=granted.backpack.find(id=>id!=='amplify-1')!;
  runtime.dispatch({id:'merge',type:'mergeItems',sourceItemId:source,targetItemId:'amplify-1'});
  assert.equal(runtime.getState().runStatistics!.arcanaAcquired,1);
  const before=runtime.getState();
  runtime.dispatch({id:'invalid',type:'cheat',action:'grantItem',definitionId:'unknown'});
  assert.deepEqual(runtime.getState(),before);
});

test('battle event accumulation counts bosses as enemies, cross-level gains and positive income exactly once per transition',()=>{
  const events:GameEvent[]=[
    {seq:1,type:'enemyKilled',gameTimeMs:1,data:{definitionId:'boss-minor'}},
    {seq:2,type:'enemyKilled',gameTimeMs:1,data:{definitionId:'enemy-basic'}},
    {seq:3,type:'characterLevelUp',gameTimeMs:1,data:{level:4,previousLevel:1}},
    {seq:4,type:'waveCleared',gameTimeMs:1,data:{wave:1}},
  ];
  const original=createRunStatistics(),stats=accumulateBattleStatistics(original,[...events,events[0]],9);
  assert.equal(stats.enemiesDefeated,2);assert.equal(stats.bossesDefeated,1);
  assert.equal(stats.levelsGained,3);assert.equal(stats.wavesCleared,1);assert.equal(stats.coinsEarned,9);
  assert.equal(accumulateBattleStatistics(stats,[],-5).coinsEarned,9);
  assert.deepEqual(original,createRunStatistics());
  const checkpoint=createGameRuntime().checkpoint();checkpoint.state.phase='battle';checkpoint.state.wave=5;checkpoint.state.waveSpawnRemaining=0;
  checkpoint.state.entities=['boss-minor','enemy-basic'].map((definitionId,index)=>({id:`dead-${index}`,definitionId,kind:'enemy',faction:'enemy',x:1,y:1,hp:0,maxHp:10,damage:0,speed:0,range:0,cooldownMs:0,attackRemainingMs:0}));
  const runtime=createGameRuntime(undefined,checkpoint);runtime.tick(50);
  const actual=runtime.getState();
  assert.equal(actual.runStatistics!.enemiesDefeated,2);assert.equal(actual.runStatistics!.bossesDefeated,1);
  assert.equal(actual.runStatistics!.wavesCleared,1);assert.equal(actual.runStatistics!.coinsEarned,actual.coins-checkpoint.state.coins);
});

test('reward income and recruits persist after event trimming and checkpoint retry, revive retains totals and restart resets',()=>{
  const saved=unlocked().checkpoint();saved.state.phase='reward';saved.state.wave=1;
  saved.state.rewards=[{id:'recruit',kind:'character',label:'同伴'}];
  const recruit=createGameRuntime(undefined,saved);recruit.dispatch({id:'recruit',type:'claimReward',rewardId:'recruit'});
  assert.equal(recruit.getState().runStatistics!.charactersAcquired,1);assert.equal(recruit.getState().runStatistics!.spellsAcquired,1);
  const next=recruit.checkpoint();next.state.phase='reward';next.state.rewards=[{id:'coins',kind:'coins',label:'金币',amount:40}];
  const runtime=createGameRuntime(undefined,next),claim={id:'coins',type:'claimReward',rewardId:'coins'} as const;
  runtime.dispatch(claim);runtime.dispatch(claim);
  assert.equal(runtime.getState().runStatistics!.coinsEarned,40);
  runtime.dispatch({id:'spend',type:'upgradeTerritory',track:'wall'});
  assert.equal(runtime.getState().runStatistics!.coinsEarned,40);
  for(let i=0;i<520;i++)runtime.dispatch({id:`pause-${i}`,type:'setPaused',paused:false});
  const snapshot=runtime.checkpoint(),stats=structuredClone(snapshot.state.runStatistics);
  snapshot.state.phase='defeat';snapshot.state.territory.hp=0;
  const restored=createGameRuntime(undefined,snapshot);restored.dispatch(claim);
  assert.deepEqual(restored.getState().runStatistics,stats);
  restored.dispatch({id:'revive',type:'cheat',action:'revive'});assert.deepEqual(restored.getState().runStatistics,stats);
  restored.dispatch({id:'restart',type:'restart'});assert.deepEqual(restored.getState().runStatistics,createRunStatistics());
});

test('legacy recovery reports only non-overlapping confirmed lower bounds and stays incomplete',()=>{
  const state=createInitialState();delete state.runStatistics;
  state.characters[0].level=4;
  state.items['actual-grant']={...state.items['spark-1'],id:'actual-grant'};
  state.items['recipe:output']={...state.items['spark-1'],id:'recipe:output'};
  state.rewardHistory=[{id:'claim',wave:1,gameTimeMs:1,reward:{id:'spell',kind:'item',label:'火花',definitionId:'spark'}}];
  state.events=[{seq:900,type:'enemyKilled',gameTimeMs:1,data:{definitionId:'boss-major',coins:1}}];
  const before=structuredClone(state),stats=restoreRunStatistics(state,demoContent);
  assert.equal(stats.complete,false);assert.equal(stats.spellsAcquired,1);assert.equal(stats.arcanaAcquired,0);
  assert.equal(stats.levelsGained,3);assert.equal(stats.enemiesDefeated,1);assert.equal(stats.bossesDefeated,1);assert.equal(stats.coinsEarned,1);
  assert.deepEqual(state,before);
});

test('authoritative repair routing spends coins without reducing lifetime income and retries do not spend again',()=>{
  const checkpoint=createGameRuntime().checkpoint();
  checkpoint.state.coins=100;checkpoint.state.runStatistics!.coinsEarned=100;
  checkpoint.state.territory.hp=50;
  const runtime=createGameRuntime(undefined,checkpoint);
  const command={id:'repair',type:'repairTerritory',track:'wall'} as const;
  assert.equal(runtime.dispatch(command).status,'executed');
  const repaired=runtime.getState();
  assert.equal(repaired.territory.hp,repaired.territory.maxHp);
  assert.ok(repaired.coins<100);assert.equal(repaired.runStatistics!.coinsEarned,100);
  runtime.dispatch(command);assert.deepEqual(runtime.getState(),repaired);
});

test('fractional or unsafe saved counts fall back to incomplete integer lower bounds',()=>{
  for(const value of [1.5,Number.MAX_SAFE_INTEGER+1,Infinity,NaN,-1]) {
    const state=createInitialState();state.runStatistics!.enemiesDefeated=value;
    state.coins=12.5;
    const restored=restoreRunStatistics(state,demoContent);
    assert.equal(restored.complete,false);
    assert.equal(restored.enemiesDefeated,0);
    assert.equal(restored.coinsEarned,12);
    for(const [key,count] of Object.entries(restored)) if(key!=='complete') assert.ok(Number.isSafeInteger(count) && (count as number)>=0);
  }
});

test('counter overflow saturates safely and marks incomplete across engine and grant paths',()=>{
  const stats=createRunStatistics();stats.enemiesDefeated=Number.MAX_SAFE_INTEGER;stats.coinsEarned=Number.MAX_SAFE_INTEGER;
  const next=accumulateBattleStatistics(stats,[{seq:1,type:'enemyKilled',gameTimeMs:0,data:{definitionId:'enemy-basic'}}],1);
  assert.equal(next.complete,false);assert.equal(next.enemiesDefeated,Number.MAX_SAFE_INTEGER);assert.equal(next.coinsEarned,Number.MAX_SAFE_INTEGER);
  assert.equal(stats.complete,true);
  const badLevel=accumulateBattleStatistics(createRunStatistics(),[{seq:1,type:'characterLevelUp',gameTimeMs:0,data:{level:Number.MAX_SAFE_INTEGER+1,previousLevel:1}}],0);
  assert.equal(badLevel.complete,false);assert.equal(badLevel.levelsGained,0);
  const checkpoint=unlocked().checkpoint();checkpoint.state.runStatistics!.spellsAcquired=Number.MAX_SAFE_INTEGER;
  const runtime=createGameRuntime(undefined,checkpoint);
  runtime.dispatch({id:'overflow-grant',type:'cheat',action:'grantSpell',definitionId:'spark'});
  assert.equal(runtime.getState().runStatistics!.spellsAcquired,Number.MAX_SAFE_INTEGER);
  assert.equal(runtime.getState().runStatistics!.complete,false);
});
