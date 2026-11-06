import assert from "node:assert/strict";
import test from "node:test";
import { createGameRuntime } from "./index";
import { demoContent } from "../content/demo";
import { compileWand } from "../loadout";
import type { RewardBuffType } from "../contracts";

function buffRun(type:RewardBuffType,value:number) {
  const checkpoint=createGameRuntime().checkpoint();checkpoint.state.phase="reward";
  checkpoint.state.rewards=[{id:"attribute",kind:"buff",label:type,effect:{type,value}}];
  return createGameRuntime(demoContent,checkpoint);
}

test("attribute rewards change actual mana, regeneration, range and cooldown and survive reload",()=>{
  for(const type of ["maxMana","manaRegen","rangePercent","cooldownPercent"] as const) {
    const runtime=buffRun(type,10),before=runtime.getState(),oldSpell=compileWand(before,"wand-1",demoContent)!.spells[0];
    const command={id:`claim-${type}`,type:"claimReward" as const,rewardId:"attribute"};
    assert.equal(runtime.dispatch(command).status,"executed");
    const after=runtime.getState(),spell=compileWand(after,"wand-1",demoContent)!.spells[0];
    assert.equal(after.runBonuses![type],10);
    if(type==="maxMana") {assert.equal(after.characters[0].maxMana,110);assert.equal(after.characters[0].mana,110);}
    if(type==="manaRegen") assert.equal(after.characters[0].manaRegen,22);
    if(type==="rangePercent") assert.ok(Math.abs(spell.range-oldSpell.range*1.1)<1e-9);
    if(type==="cooldownPercent") assert.ok(Math.abs(spell.cooldownMs-oldSpell.cooldownMs*.9)<1e-9);
    assert.equal(spell.power,oldSpell.power);
    runtime.dispatch(command);assert.deepEqual(runtime.getState(),after);
    assert.deepEqual(createGameRuntime(demoContent,runtime.checkpoint()).getState(),after);
  }
});

test("new teammates inherit run mana bonuses and cooldown reduction stops at ninety percent",()=>{
  const checkpoint=createGameRuntime().checkpoint();checkpoint.state.phase="reward";
  checkpoint.state.runBonuses={attackPercent:20,maxMana:30,manaRegen:4,cooldownPercent:85};
  checkpoint.state.characters[0].maxMana=130;checkpoint.state.characters[0].mana=100;checkpoint.state.characters[0].manaRegen=16;
  checkpoint.state.rewards=[{id:"recruit",kind:"character",label:"同行者"}];
  const runtime=createGameRuntime(demoContent,checkpoint);
  runtime.dispatch({id:"recruit-now",type:"claimReward",rewardId:"recruit"});
  assert.equal(runtime.getState().characters[1].maxMana,130);assert.equal(runtime.getState().characters[1].manaRegen,16);
  const next=runtime.checkpoint();next.state.phase="reward";next.state.rewards=[{id:"cooldown",kind:"buff",label:"冷却",effect:{type:"cooldownPercent",value:15}}];
  const cap=createGameRuntime(demoContent,next);cap.dispatch({id:"reduce",type:"claimReward",rewardId:"cooldown"});
  assert.equal(cap.getState().runBonuses!.cooldownPercent,90);assert.equal(cap.getState().runBonuses!.attackPercent,20);
});

test("reward RNG belongs to the checkpoint and browser restarts can take fresh seeds",()=>{
  const checkpoint=createGameRuntime().checkpoint();checkpoint.state.phase="battle";checkpoint.state.wave=1;
  checkpoint.state.waveSpawnRemaining=0;checkpoint.state.entities=[];
  const first=createGameRuntime(demoContent,checkpoint);const copy=createGameRuntime(demoContent,checkpoint);
  first.tick(50);copy.tick(50);assert.deepEqual(first.getState().rewards,copy.getState().rewards);
  const saved=first.checkpoint(),restored=createGameRuntime(demoContent,saved);restored.tick(50);
  assert.deepEqual(restored.getState().rewards,saved.state.rewards);assert.equal(restored.getState().rngState,saved.state.rngState);
  let seed=10;const fresh=createGameRuntime(demoContent,undefined,{seedSource:()=>seed++});
  assert.equal(fresh.getState().rngState,10);fresh.dispatch({id:"new-run",type:"restart"});assert.equal(fresh.getState().rngState,11);
});
