import assert from "node:assert/strict";
import test from "node:test";
import { createWaveRewards, rewardGrades } from "../content/rewards";
import { demoContent } from "../content/demo";
import { compileWand } from "../loadout/compile";
import { createGameRuntime } from "./index";
import { projectState } from "../agent/projection";

function rewardRun(wave=7) {
  const seed = createGameRuntime().checkpoint();
  seed.state.phase="reward";seed.state.wave=wave;
  seed.state.rewards=createWaveRewards(wave,1,1,demoContent);
  return seed;
}

test("attack reward changes attack spells once, keeps healing unchanged and survives refresh", () => {
  const seed=rewardRun();
  seed.state.items.growth={id:"growth",definitionId:"regrowth",kind:"spell",grade:"common",level:1};
  seed.state.wands[0].placements.push({itemId:"growth",x:1,y:1,rotation:0});
  const runtime=createGameRuntime(demoContent,seed), before=compileWand(runtime.getState(),"wand-1",demoContent)!;
  const offer=runtime.getState().rewards.find(reward => reward.kind === "buff")!;
  assert.equal(offer.grade,"rare");assert.equal(offer.effect?.value,20);
  const command={id:"claim",type:"claimReward" as const,rewardId:offer.id};
  assert.equal(runtime.dispatch(command).status,"executed");
  const after=runtime.getState(),compiled=compileWand(after,"wand-1",demoContent)!;
  assert.ok(Math.abs(compiled.spells[0].power - before.spells[0].power * 1.2)<1e-9);
  assert.equal(compiled.spells[1].power,before.spells[1].power);
  assert.equal(after.phase,"ready");assert.equal(after.rewards.length,0);
  assert.equal(projectState(after).runBonuses.attackPercent,20);
  runtime.dispatch(command);assert.deepEqual(runtime.getState(),after);
  const restored=createGameRuntime(demoContent,runtime.checkpoint());
  assert.equal(compileWand(restored.getState(),"wand-1",demoContent)!.spells[0].power,compiled.spells[0].power);
  restored.dispatch({id:"restart",type:"restart"});
  assert.equal(projectState(restored.getState()).runBonuses.attackPercent,0);
});

test("reward choices put each kind in its real destination and preserve grade", () => {
  for (const kind of ["item","character","wand"] as const) {
    const seed=rewardRun(kind === "wand" ? 2 : 1);
    const offer=seed.state.rewards.find(reward => reward.kind === kind)!;
    assert.ok(offer);
    const runtime=createGameRuntime(demoContent,seed),before=runtime.getState();
    assert.equal(runtime.dispatch({id:"claim",type:"claimReward",rewardId:offer.id}).status,"executed");
    const after=runtime.getState();
    if(kind === "item") assert.equal(after.backpack.length,before.backpack.length+1);
    if(kind === "character") {assert.equal(after.characters.length,2);assert.equal(after.characters[1].grade,offer.grade);}
    if(kind === "wand") {assert.equal(after.wands.at(-1)!.characterId,null);assert.equal(after.wands.at(-1)!.grade,offer.grade);}
  }
});

test("tier data reaches orange mythic and malformed buffs reject without consuming the choice", () => {
  assert.deepEqual(rewardGrades.map(tier => tier.attackPercent),[10,15,20,30,40,50]);
  assert.equal(createWaveRewards(16,3,6,demoContent)[0].grade,"mythic");
  const seed=rewardRun();seed.state.rewards[0].effect={type:"attackPercent",value:Infinity};
  const runtime=createGameRuntime(demoContent,seed),before=runtime.getState();
  assert.equal(runtime.dispatch({id:"invalid",type:"claimReward",rewardId:before.rewards[0].id}).status,"rejected");
  assert.deepEqual(runtime.getState(),before);
});
