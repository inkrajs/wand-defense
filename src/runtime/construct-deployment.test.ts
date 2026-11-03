import assert from "node:assert/strict";
import test from "node:test";
import { createGameRuntime } from "./index";
import { demoContent } from "../content/demo";
import { parseRemoteCommand, dispatchRemote } from "../agent/protocol";
import { projectEvents, projectState } from "../agent/projection";
import { loadRun, saveRun } from "./session";

function fixture(definitionId = "ember-turret") {
  const initial=createGameRuntime(), checkpoint=initial.checkpoint(); initial.dispose();
  const state=checkpoint.state;
  state.coins=500;
  state.items={tower:{id:"tower",kind:"spell",definitionId,level:1,grade:"common"}};
  state.backpack=[];
  state.wands[0].placements=[{itemId:"tower",x:0,y:0,rotation:0}];
  state.knowledge.spellIds.push(definitionId);
  return createGameRuntime(demoContent,checkpoint);
}
const deploy={id:"place-tower",type:"deployConstruct" as const,characterId:"character-1",itemId:"tower",x:0,y:100};

test("manual construction charges once, permits field edges, and survives durable save/reload", () => {
  const runtime=fixture();
  assert.equal(dispatchRemote(runtime,deploy).status,"executed");
  const state=runtime.getState(), definition=demoContent.spells["ember-turret"];
  const tower=state.entities.find(entity=>entity.kind==="building")!;
  assert.ok(tower);
  assert.deepEqual([tower.x,tower.y],[0,100]);
  assert.equal(state.coins,500-definition.construct!.coinCost!);
  assert.equal(state.characters[0].mana,100-definition.manaCost);
  assert.equal(state.wands[0].cooldowns.tower,definition.cooldownMs);
  assert.equal(runtime.dispatch(deploy).status,"executed");
  assert.deepEqual(runtime.getState(),state);
  const data=new Map<string,string>();
  const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
  assert.equal(saveRun(storage,runtime.checkpoint()),true);
  const restored=createGameRuntime(demoContent,loadRun(storage));
  assert.deepEqual(restored.getState(),state);
  assert.equal(restored.dispatch(deploy).status,"executed");
  assert.deepEqual(restored.getState(),state);
  const visible=projectState(state,demoContent).entities.find(entity=>entity.id===tower.id)!;
  assert.equal(visible.construct?.behavior,"attack");
  const spawn=projectEvents(state,state.events).find(event=>event.type==="constructSpawned")!;
  assert.equal(spawn.data.entityId,tower.id);
  assert.equal(spawn.data.definitionId,definition.id);
  runtime.dispose(); restored.dispose();
});

test("deploy rejects invalid ownership, coordinates, resources, cooldown and capacity atomically", () => {
  for(const change of ["unknown","unequipped","coins","mana","cooldown","capacity"] as const) {
    const base=fixture(), checkpoint=base.checkpoint(); base.dispose();
    const state=checkpoint.state;
    if(change==="unknown")state.knowledge.spellIds=[];
    if(change==="unequipped")state.wands[0].placements=[];
    if(change==="coins")state.coins=0;
    if(change==="mana")state.characters[0].mana=0;
    if(change==="cooldown")state.wands[0].cooldowns.tower=1;
    if(change==="capacity") {
      const prepared=fixture(); prepared.dispatch(deploy);
      const entity=prepared.getState().entities.find(entity=>entity.kind==="building")!;
      state.entities=Array.from({length:3},(_,i)=>({...structuredClone(entity),id:`existing-${i}`}));
      prepared.dispose();
    }
    const runtime=createGameRuntime(demoContent,checkpoint), before=runtime.getState();
    assert.equal(runtime.dispatch({...deploy,id:`reject-${change}`}).status,"rejected",change);
    assert.deepEqual(runtime.getState(),before,change);
    runtime.dispose();
  }
  for(const x of [-1,101,NaN,Infinity]) {
    const runtime=fixture(), before=runtime.getState();
    assert.equal(parseRemoteCommand({...deploy,x}),undefined);
    assert.equal(runtime.dispatch({...deploy,x}).status,"rejected");
    assert.deepEqual(runtime.getState(),before);
    runtime.dispose();
  }
});

test("battle deployment requires pause; preparation freezes lifetime and later waves retain allies", () => {
  const runtime=fixture(); runtime.dispatch(deploy);
  const before=runtime.getState().entities[0];
  runtime.tick(500);
  assert.equal(runtime.getState().entities[0].remainingMs,before.remainingMs);
  runtime.dispatch({id:"start",type:"startWave"});
  assert.equal(runtime.getState().entities[0].remainingMs,before.remainingMs);
  const running=runtime.getState();
  assert.equal(runtime.dispatch({...deploy,id:"running",x:75,y:20}).status,"rejected");
  assert.deepEqual(runtime.getState(),running);
  const checkpoint=runtime.checkpoint();
  checkpoint.state.waveSpawnRemaining=0;
  checkpoint.state.spawnRemainingMs=10000;
  const clearing=createGameRuntime(demoContent,checkpoint);
  clearing.tick(50);
  assert.equal(clearing.getState().phase,"reward");
  const survivor=clearing.getState().entities.find(entity=>entity.kind==="building")!;
  assert.ok(survivor);
  assert.equal(survivor.remainingMs,before.remainingMs!-50);
  const reward=clearing.getState().rewards[0];
  assert.equal(clearing.dispatch({id:"claim",type:"claimReward",rewardId:reward.id}).status,"executed");
  assert.equal(clearing.dispatch({id:"next",type:"startWave"}).status,"executed");
  assert.equal(clearing.getState().entities.find(entity=>entity.id===survivor.id)?.remainingMs,survivor.remainingMs);
  runtime.dispose(); clearing.dispose();
});
