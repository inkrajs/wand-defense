import assert from 'node:assert/strict';
import test from 'node:test';
import { demoContent } from '../content/demo';
import { createWaveRewards } from '../content/rewards';
import { rewardLuckDescription } from '../content/randomRewards';
import { createInitialState } from './initial';
import { createGameRuntime } from './index';
import { getWaveRewardLuck } from './rewardLuck';

test('wave luck counts run luck once and only effective personal luck from the current team', () => {
  const state=createInitialState();
  state.luck=10;
  state.characters[0].baseStats!.luck=2;
  state.wands[0].statBonuses={luck:3};
  state.characters.push({...structuredClone(state.characters[0]),id:'second',wandIds:[],gearIds:{},baseStats:{...state.characters[0].baseStats!,luck:4}});
  state.gear={owned:{id:'owned',name:'幸运帽',slot:'head',characterId:'second',grade:'common',level:1,statBonuses:{luck:6}},
    unused:{id:'unused',name:'未装备',slot:'body',characterId:null,grade:'common',level:1,statBonuses:{luck:1000}}};
  state.characters[1].gearIds={head:'owned',body:'unused'};
  const before=structuredClone(state);
  assert.equal(getWaveRewardLuck(state,demoContent),25);
  assert.deepEqual(state,before);
  state.luck=20;
  assert.equal(getWaveRewardLuck(state,demoContent),35,'a run increase is applied once across two characters');
  state.characters=[];
  assert.equal(getWaveRewardLuck(state,demoContent),20);
  state.luck=Infinity;
  assert.equal(getWaveRewardLuck(state,demoContent),0);
});

function expectedRewards(state: ReturnType<typeof createInitialState>) {
  let seed=state.rngState;
  const rewards=createWaveRewards(state.wave,state.characters.length,state.wands.length,demoContent,()=>{
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/0x1_0000_0000;
  },{canHeal:state.territory.hp<state.territory.maxHp,cooldownCapped:false,luck:getWaveRewardLuck(state,demoContent)});
  return {rewards,seed};
}

test('clear-wave and paid/free refresh use effective luck with unchanged IDs, prices and idempotence', () => {
  const initial=createGameRuntime(), checkpoint=initial.checkpoint();initial.dispose();
  Object.assign(checkpoint.state,{phase:'battle',wave:10,waveSpawnRemaining:0,spawnRemainingMs:10000,luck:100,rngState:42});
  const expected=expectedRewards(checkpoint.state);
  const runtime=createGameRuntime(demoContent,checkpoint);
  runtime.tick(50);
  assert.equal(runtime.getState().phase,'reward');
  assert.deepEqual(runtime.getState().rewards,expected.rewards);
  assert.equal(runtime.getState().rngState,expected.seed);
  for(let refresh=1;refresh<=2;refresh++) {
    const before=runtime.getState(), next=expectedRewards(before);
    const command={id:`lucky-refresh-${refresh}`,type:'refreshRewards' as const,offerId:before.rewards[0].id};
    assert.equal(runtime.dispatch(command).status,'executed');
    const after=runtime.getState();
    assert.deepEqual(after.rewards,next.rewards.map(reward=>({...reward,id:`${reward.id}:refresh-${refresh}`})));
    assert.equal(after.rngState,next.seed);
    assert.equal(after.coins,before.coins-(refresh===1?0:1));
    assert.equal(after.rewardRefresh?.paidCount,refresh===1?0:1);
    runtime.dispatch(command);
    assert.deepEqual(runtime.getState(),after);
    assert.equal(runtime.dispatch({...command,id:`stale-${refresh}`}).status,'rejected');
    assert.deepEqual(runtime.getState(),after);
  }
  const saved=runtime.checkpoint(), before=runtime.getState();runtime.dispose();
  const restored=createGameRuntime(demoContent,saved);
  assert.deepEqual(restored.getState().rewards,before.rewards);
  assert.equal(restored.getState().rngState,before.rngState);
  restored.dispose();
});

test('restoring a lucky offer updates its copy without rerolling its value, grade or random stream', () => {
  const initial=createGameRuntime(), checkpoint=initial.checkpoint();initial.dispose();
  checkpoint.state.phase='reward';checkpoint.state.luck=100;
  checkpoint.state.rewards=[{id:'saved-luck',kind:'buff',label:'幸运 +3',grade:'rare',effect:{type:'luck',value:3},
    description:'提高击杀金币和装备掉落概率。'}];
  const before=structuredClone(checkpoint.state);
  const runtime=createGameRuntime(demoContent,checkpoint), after=runtime.getState();
  assert.deepEqual(after.rewards,[{...before.rewards[0],description:rewardLuckDescription}]);
  assert.equal(after.rngState,before.rngState);
  assert.equal(after.coins,before.coins);
  assert.equal(after.luck,before.luck);
  runtime.dispose();
});
