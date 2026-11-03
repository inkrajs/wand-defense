import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameRuntime } from './index';

test('restoring current reward cards enriches their effect text without rerolling or changing reward identity',()=>{
  const checkpoint=createGameRuntime().checkpoint();
  checkpoint.state.phase='reward';checkpoint.state.wave=21;checkpoint.state.coins=92;
  checkpoint.state.rewards=[
    {id:'chosen-water',kind:'item',definitionId:'water-bolt',label:'水弹',grade:'rare',description:'获得此法术或奥术，发现其定义并存入共享背包。'},
    {id:'chosen-heal',kind:'item',definitionId:'regrowth',label:'回春',grade:'uncommon'},
  ];
  const original=structuredClone(checkpoint),runtime=createGameRuntime(undefined,checkpoint),after=runtime.getState();
  assert.equal(after.rngState,original.state.rngState);assert.equal(after.wave,21);assert.equal(after.coins,92);
  assert.deepEqual(after.rewards.map(({description,...reward})=>reward),original.state.rewards.map(({description,...reward})=>reward));
  assert.match(after.rewards[0].description!,/冲洗/);assert.equal(after.rewards[1].description,'恢复领地生命。');
  assert.deepEqual(checkpoint,original);
  const restored=createGameRuntime(undefined,runtime.checkpoint());assert.deepEqual(restored.getState(),after);
  assert.equal(runtime.dispatch({id:'claim',type:'claimReward',rewardId:'chosen-water'}).status,'executed');
  assert.ok(Object.values(runtime.getState().items).some(item=>item.definitionId==='water-bolt'&&item.grade==='rare'));
});
