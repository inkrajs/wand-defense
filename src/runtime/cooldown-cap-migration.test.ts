import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameRuntime } from './index';

test('legacy cooldown offer keeps identity, quality, value and RNG; collecting now caps at 90 percent', () => {
  const checkpoint = createGameRuntime().checkpoint();
  const offer = {id:'cooldown-old',kind:'buff' as const,label:'冷却缩减',grade:'rare' as const,
    effect:{type:'cooldownPercent' as const,value:8},description:'缩短本局全队法术冷却，同类加成相加，总缩减上限70%。',
    details:[{label:'冷却缩减',value:'+8%'}]};
  checkpoint.state.phase='reward';checkpoint.state.rewards=[offer];
  checkpoint.state.runBonuses={attackPercent:0,cooldownPercent:88};
  const runtime=createGameRuntime(undefined,checkpoint),restored=runtime.getState();
  assert.deepEqual(restored.rewards,[{...offer,description:offer.description.replace('70%','90%')}]);
  assert.equal(restored.rngState,checkpoint.state.rngState);
  assert.equal(checkpoint.state.rewards[0].description,offer.description);
  assert.equal(runtime.dispatch({id:'claim-cooldown',type:'claimReward',rewardId:offer.id}).status,'executed');
  assert.equal(runtime.getState().runBonuses?.cooldownPercent,90);
  runtime.dispose();
});
