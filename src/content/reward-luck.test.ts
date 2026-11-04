import assert from 'node:assert/strict';
import test from 'node:test';
import { demoContent } from './demo';
import { gradeOrder } from './grades';
import { createWaveRewards } from './rewards';
import { fillUniqueRewardOffers, getRewardOfferKey } from './randomRewards';

function seeded(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x1_0000_0000; };
}

test('zero reward luck retains the original grade/type draws and saved random stream', () => {
  const values = [0,0,0,.5,.2,.7,.9,.8,.99,.999,0,.6];
  for (const luck of [undefined, 0, -10, NaN, Infinity]) {
    let index = 0;
    const cards = createWaveRewards(8,1,1,demoContent,()=>values[index++ % values.length],{luck});
    assert.equal(index,12);
    assert.deepEqual(cards.map(({id,kind,grade,definitionId,effect,amount})=>({id,kind,grade,definitionId,effect,amount})),[
      {id:'reward-8-0',kind:'buff',grade:'common',definitionId:undefined,effect:{type:'attackPercent',value:10},amount:undefined},
      {id:'reward-8-1',kind:'item',grade:'uncommon',definitionId:'frost-pylon',effect:undefined,amount:undefined},
      {id:'reward-8-2',kind:'wand',grade:'legendary',definitionId:undefined,effect:undefined,amount:undefined},
      {id:'reward-8-3',kind:'coins',grade:'uncommon',definitionId:undefined,effect:undefined,amount:15},
    ]);
  }
});

test('positive reward luck is deterministic and raises quality and rare types without duplicates or extra draws', () => {
  function sample(luck: number) {
    const draw = seeded(0xa17e);
    let calls=0, rareGrades=0, rareKinds=0, rankTotal=0, common=0;
    const random=()=>{ calls++; return draw(); };
    const first=[];
    for(let wave=1;wave<=2048;wave++) {
      const cards=createWaveRewards(wave,1,1,demoContent,random,{luck});
      assert.equal(cards.length,4);
      assert.equal(new Set(cards.map(getRewardOfferKey)).size,4);
      for(const card of cards) {
        const rank=gradeOrder.indexOf(card.grade!);
        rankTotal+=rank;
        if(rank>=2)rareGrades++;
        if(rank===0)common++;
        if(['item','character','wand'].includes(card.kind))rareKinds++;
      }
      if(wave<=3)first.push(cards);
    }
    return {calls,rareGrades,rareKinds,rankTotal,common,first};
  }
  const zero=sample(0), high=sample(100), repeat=sample(100);
  assert.deepEqual(high,repeat);
  assert.equal(zero.calls,2048*12);
  assert.equal(high.calls,zero.calls);
  assert.ok(high.rareGrades>zero.rareGrades*2);
  assert.ok(high.rankTotal>zero.rankTotal);
  assert.ok(high.rareKinds>zero.rareKinds);
  assert.ok(high.common>0,'luck never guarantees a high grade');
  assert.deepEqual(createWaveRewards(1,1,1,demoContent,seeded(123),{luck:Number.MAX_VALUE}),
    createWaveRewards(1,1,1,demoContent,seeded(123),{luck:1_000_000}));
});

test('lucky duplicate repair preserves existing offers and the luck description mentions wave rewards', () => {
  const existing=createWaveRewards(1,1,1,demoContent,()=>0);
  const repaired=fillUniqueRewardOffers([existing[0],existing[0],existing[2],existing[3]],
    {wave:1,characterCount:1,wandCount:1,content:demoContent,random:seeded(7),luck:100});
  assert.equal(repaired.length,4);
  assert.equal(repaired[0],existing[0]);
  assert.equal(repaired[2],existing[2]);
  assert.equal(new Set(repaired.map(getRewardOfferKey)).size,4);
  let index=0;const values=[0,.8,0];
  const luck=createWaveRewards(1,1,1,demoContent,()=>values[index++%values.length]).find(card=>card.effect?.type==='luck');
  assert.ok(luck?.description?.includes('清波奖励品质'));
});
