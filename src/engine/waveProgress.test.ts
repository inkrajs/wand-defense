import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState } from "../runtime/initial";
import { advanceEnemies, buildWaveSpec, getWaveSpec } from "./waves";
import { getWaveProgress } from "./waveProgress";

test("boss markers are the exact flattened encounter schedule used by actual spawns",()=>{
  for(const wave of [1,5,10,12,20,100,200]) {
    const spec=getWaveSpec(wave),state=createInitialState();
    state.phase="battle";state.wave=wave;state.territory.hp=1e9;
    state.waveSpawnRemaining=spec.count;
    const bosses:{index:number;tier:string}[]=[];
    for(let index=0;index<spec.count;index++) {
      state.spawnRemainingMs=0;advanceEnemies(state,1,()=>{});
      const enemy=state.entities.at(-1)!;
      if(enemy.definitionId.startsWith("boss-")) bosses.push({index,tier:enemy.definitionId.slice(5)});
    }
    assert.deepEqual(bosses,spec.bossNodes.map(node=>({index:node.spawnIndex,tier:node.tier})));
    assert.equal(getWaveProgress(state).progress,0);
    assert.deepEqual(getWaveProgress(state).markers.map(m=>m.position),spec.bossNodes.map(node=>node.spawnIndex/spec.count));
    assert.ok(getWaveProgress(state).markers.every(m=>!m.cleared));
  }
});

test("boss clear state follows its entity rather than progress passing its position",()=>{
  const state=createInitialState(),spec=getWaveSpec(10);
  state.phase="battle";state.wave=10;state.waveSpawnRemaining=0;
  const mid=spec.bossNodes[0],end=spec.bossNodes[1];
  state.entities=[{id:`enemy-10-${spec.count-mid.spawnIndex}`,definitionId:"boss-minor",kind:"enemy",faction:"enemy",
    x:50,y:0,hp:10,maxHp:10,damage:0,speed:0,range:0,cooldownMs:1000,attackRemainingMs:0}];
  let progress=getWaveProgress(state);
  assert.ok(progress.progress>progress.markers[0].position);
  assert.equal(progress.markers.find(m=>m.id===mid.id)!.cleared,false);
  assert.equal(progress.markers.find(m=>m.id===end.id)!.cleared,true);
  state.entities=[];progress=getWaveProgress(state);
  assert.ok(progress.markers.every(m=>m.cleared));assert.equal(progress.progress,1);
});

test("unspawned nodes, ready wave zero and reward boundaries are represented faithfully",()=>{
  const state=createInitialState();
  assert.deepEqual(getWaveProgress(state),{wave:1,preview:true,total:getWaveSpec(1).count,defeated:0,progress:0,markers:[]});
  state.wave=100;state.phase="battle";state.waveSpawnRemaining=getWaveSpec(100).count;
  assert.ok(getWaveProgress(state).markers.every(m=>!m.cleared));
  state.phase="reward";
  const progress=getWaveProgress(state);
  assert.equal(progress.progress,1);assert.equal(progress.defeated,progress.total);
  assert.ok(progress.markers.every(m=>m.cleared));
});

test("preparation previews next wave and ignores prior cleared enemies and counters",()=>{
  const state=createInitialState();state.wave=9;state.phase="reward";
  assert.equal(getWaveProgress(state).wave,9);
  assert.equal(getWaveProgress(state).progress,1);
  state.phase="ready";state.waveSpawnRemaining=0;
  const before=structuredClone(state),progress=getWaveProgress(state),spec=getWaveSpec(10);
  assert.equal(progress.wave,10);assert.equal(progress.preview,true);
  assert.equal(progress.progress,0);assert.equal(progress.defeated,0);
  assert.equal(progress.total,spec.count);
  assert.deepEqual(progress.markers.map(marker=>marker.id),spec.bossNodes.map(node=>node.id));
  assert.ok(progress.markers.every(marker=>!marker.cleared));
  assert.deepEqual(state,before);
  state.phase="battle";state.wave=10;state.waveSpawnRemaining=spec.count;
  const active=getWaveProgress(state);
  assert.equal(active.wave,10);assert.equal(active.preview,false);
  assert.deepEqual(active.markers,progress.markers);
});


test("ordered encounter definitions flatten repeated boss groups and respect the total budget",()=>{
  const spec=buildWaveSpec(20,[{type:"minions",count:2},{type:"boss",tier:"minor",count:2},
    {type:"minions",count:3},{type:"boss",tier:"major",count:1},{type:"minions",count:1},{type:"boss",tier:"apex",count:1}]);
  assert.equal(spec.count,10);
  assert.deepEqual(spec.bossNodes.map(node=>[node.spawnIndex,node.tier]),[[2,"minor"],[3,"minor"],[7,"major"],[9,"apex"]]);
  assert.equal(spec.bossTier,"apex");
  const capped=buildWaveSpec(100,[{type:"minions",count:55},{type:"boss",tier:"major",count:10},{type:"minions",count:20}]);
  assert.equal(capped.count,60);
  assert.deepEqual(capped.encounters,[{type:"minions",count:55},{type:"boss",tier:"major",count:5}]);
  assert.deepEqual(capped.bossNodes.map(node=>node.spawnIndex),[55,56,57,58,59]);
});

test("default encounters grow beyond two bosses and ordinary waves can contain boss interruptions",()=>{
  assert.deepEqual([5,10,20,100,200].map(wave=>getWaveSpec(wave).bossNodes.length),[1,2,3,11,12]);
  const interrupted=getWaveSpec(12);
  assert.ok(interrupted.bossNodes.length>0);
  assert.equal(interrupted.encounters.at(-1)?.type,"minions");
  assert.equal(interrupted.bossTier,"none");
  for(let wave=1;wave<=250;wave++) {
    const spec=getWaveSpec(wave);
    assert.equal(spec.count,Math.min(60,5+(wave-1)*2));
    assert.equal(spec.count,spec.encounters.reduce((sum,encounter)=>sum+encounter.count,0));
    assert.ok(spec.count<=60);
    assert.equal(new Set(spec.bossNodes.map(node=>node.id)).size,spec.bossNodes.length);
  }
});

test("legacy in-flight remaining counts cannot make progress negative or clear unspawned nodes",()=>{
  const state=createInitialState();state.phase="battle";state.wave=8;state.waveSpawnRemaining=19;
  assert.equal(getWaveSpec(8).count,19);
  assert.equal(getWaveProgress(state).progress,0);
  state.wave=20;state.waveSpawnRemaining=1000;
  const progress=getWaveProgress(state);
  assert.equal(progress.defeated,0);assert.equal(progress.progress,0);
  assert.ok(progress.markers.every(marker=>!marker.cleared));
});
