import assert from 'node:assert/strict';
import test from 'node:test';
import type { GameEvent, RewardOption } from '../contracts';
import { createGameRuntime } from './index';
import { createInitialState } from './initial';
import { restoreRewardHistory } from './rewardHistory';

const reward: RewardOption = { id:'offer-1', kind:'buff', label:'攻击提升', grade:'uncommon', effect:{type:'attackPercent',value:15}, details:[{label:'伤害',value:'+15%'}] };
function events(start:number):GameEvent[] {
  return [
    {seq:start,type:'reward.offered',gameTimeMs:100,data:{wave:3,rewards:[structuredClone(reward)]}},
    {seq:start+1,type:'reward.claimed',gameTimeMs:150,data:{rewardId:reward.id,kind:reward.kind}},
  ];
}

test('successful claims snapshot only the selected reward, survive event trimming/refresh and retries, and restart clears history',()=>{
  const runtime=createGameRuntime();
  assert.deepEqual(runtime.getState().rewardHistory,[]);assert.equal(runtime.getState().rewardHistoryComplete,true);
  const saved=runtime.checkpoint();saved.state.phase='reward';saved.state.wave=3;saved.state.gameTimeMs=150;
  saved.state.rewards=[structuredClone(reward),{id:'not-selected',kind:'coins',label:'金币',amount:10}];
  const active=createGameRuntime(undefined,saved);
  const command={id:'claim',type:'claimReward',rewardId:reward.id} as const;
  assert.equal(active.dispatch(command).status,'executed');
  const claimed=active.getState();
  assert.equal(claimed.rewardHistory!.length,1);
  assert.deepEqual(claimed.rewardHistory![0].reward,reward);
  assert.equal(claimed.rewardHistory![0].wave,3);assert.equal(claimed.rewardHistory![0].gameTimeMs,150);
  saved.state.rewards[0].details![0].value='changed';
  assert.equal(active.getState().rewardHistory![0].reward.details![0].value,'+15%');
  active.dispatch(command);assert.deepEqual(active.getState(),claimed);
  for(let i=0;i<520;i++) active.dispatch({id:`pause-${i}`,type:'setPaused',paused:!!(i%2)});
  assert.equal(active.getState().events.length,512);
  assert.equal(active.getState().events.some(event=>event.type==='reward.claimed'),false);
  const restored=createGameRuntime(undefined,active.checkpoint()),before=restored.getState();
  restored.dispatch(command);assert.deepEqual(restored.getState(),before);
  assert.deepEqual(before.rewardHistory,claimed.rewardHistory);assert.equal(before.rewardHistoryComplete,true);
  restored.dispatch({id:'restart',type:'restart'});
  assert.deepEqual(restored.getState().rewardHistory,[]);assert.equal(restored.getState().rewardHistoryComplete,true);
});

test('legacy checkpoints recover only matched offered/claimed evidence and preserve cached claim receipts',()=>{
  const state=createInitialState();delete state.rewardHistory;delete state.rewardHistoryComplete;
  state.wave=3;state.gameTimeMs=200;state.events=events(1);state.nextEventSeq=3;
  state.runBonuses={attackPercent:999};
  const before=structuredClone(state),full=restoreRewardHistory(state);
  assert.equal(full.rewardHistoryComplete,true);assert.equal(full.rewardHistory.length,1);
  assert.equal(full.rewardHistory[0].reward.effect?.value,15);assert.deepEqual(state,before);
  const restored=createGameRuntime(undefined,{checkpointVersion:1,state,pausedBeforeBackpack:false,results:[['old-claim',{commandId:'old-claim',status:'executed',revision:0}]]});
  const loaded=restored.getState();
  restored.dispatch({id:'old-claim',type:'claimReward',rewardId:reward.id});
  assert.deepEqual(restored.getState(),loaded);
  const partial=structuredClone(state);partial.events=events(400);partial.nextEventSeq=402;
  const recovered=restoreRewardHistory(partial);
  assert.equal(recovered.rewardHistoryComplete,false);assert.equal(recovered.rewardHistory.length,1);
  partial.events=[{seq:401,type:'reward.claimed',gameTimeMs:150,data:{rewardId:reward.id}}];
  assert.deepEqual(restoreRewardHistory(partial),{rewardHistory:[],rewardHistoryComplete:false});
  partial.events[0].data.rewards=[{...reward,effect:{type:'attackPercent',value:NaN}}];
  assert.equal(restoreRewardHistory(partial).rewardHistory.length,0);
});

test('invalid reward snapshots are rejected before effects; malformed stored history is filtered and marked partial',()=>{
  const runtime=createGameRuntime(),checkpoint=runtime.checkpoint();checkpoint.state.phase='reward';
  checkpoint.state.rewards=[{...reward,effect:{type:'attackPercent',value:NaN}}];
  const active=createGameRuntime(undefined,checkpoint),before=active.getState();
  assert.equal(active.dispatch({id:'bad',type:'claimReward',rewardId:reward.id}).status,'rejected');
  assert.deepEqual(active.getState(),before);
  const state=createInitialState();state.rewardHistory=[{id:'bad',wave:1,gameTimeMs:Infinity,reward}];
  assert.deepEqual(restoreRewardHistory(state),{rewardHistory:[],rewardHistoryComplete:false});
});
