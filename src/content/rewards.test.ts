import assert from "node:assert/strict";
import test from "node:test";
import { createWaveRewards } from "./rewards";
import { demoContent } from "./demo";

test("reward slots can all be buffs without repeating the same attribute",()=>{
  const cards=createWaveRewards(1,1,1,demoContent,()=>0);
  assert.equal(cards.length,4);
  assert.ok(cards.every(card=>card.kind==="buff"));
  assert.deepEqual(cards.map(card=>card.effect?.type),["attackPercent","maxMana","manaRegen","rangePercent"]);
  assert.equal(new Set(cards.map(card=>card.id)).size,4);
});

test("a saved random sequence gives reproducible complete cards with discoverable definitions",()=>{
  let index=0;const values=[.5,.8,.2,.9,.3,.7,.99,.99,.6,.1,.55,.4];
  const draw=()=>values[index++%values.length];
  const first=createWaveRewards(8,1,1,demoContent,draw);index=0;
  assert.deepEqual(createWaveRewards(8,1,1,demoContent,draw),first);
  for(const card of first) if(card.definitionId) assert.ok(demoContent.spells[card.definitionId]??demoContent.arcana[card.definitionId]);
  assert.notDeepEqual(first,createWaveRewards(8,1,1,demoContent,()=>0));
});
