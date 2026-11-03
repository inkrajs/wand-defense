import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState } from "../runtime/initial";
import { advanceBloodMemory, BLOOD_LIMIT, bloodAppearance, bloodOpacity, bloodSpots, restoreBloodMemory, type BloodMemory } from "./floorBlood";

function scene() {
  const state = createInitialState(); state.wave = 1; state.gameTimeMs = 1000;
  return state;
}
function death(seq: number, data: Record<string, unknown> = {}) {
  return {seq, type:"enemyKilled", gameTimeMs:1000, data:{entityId:`enemy-${seq}`,x:50,y:50,maxHp:18,level:1,grade:"common",wave:1,...data}};
}
const empty = (): BloodMemory => ({runId:"demo",cursor:0,marks:[]});

test("death stains stay deterministic; fire chars them and rock increases their spread", () => {
  const state = scene(); state.events = [death(1), death(2,{effect:"spark"}),death(3,{effect:"rock-shot"})]; state.nextEventSeq=4;
  const memory = advanceBloodMemory(empty(),state);
  const [plain, fire, rock] = memory.marks;
  assert.equal(bloodAppearance(fire).color,"#34302b");
  assert.ok(bloodAppearance(rock).diameter > bloodAppearance(plain).diameter);
  assert.deepEqual(bloodSpots(rock),bloodSpots(rock));
  assert.equal(advanceBloodMemory(memory,state),memory);
  assert.equal(state.rngState,createInitialState().rngState);
});

test("stronger enemies leave larger, darker stains that resist time and wave erosion", () => {
  const state=scene();state.events=[death(1),death(2,{maxHp:600,level:20,grade:"epic"})];state.nextEventSeq=3;
  const [weak,strong]=advanceBloodMemory(empty(),state).marks;
  const a=bloodAppearance(weak),b=bloodAppearance(strong);
  assert.ok(b.diameter>a.diameter);assert.ok(b.opacity>a.opacity);assert.ok(b.lifetimeMs>a.lifetimeMs);
  assert.notEqual(a.color,b.color);
  assert.ok(bloodOpacity(weak,31_000,2)<bloodOpacity(weak,1000,1));
  assert.ok(bloodOpacity(strong,31_000,2)/b.opacity>bloodOpacity(weak,31_000,2)/a.opacity);
  assert.equal(bloodOpacity(weak,1_000_000,1),0);
});

test("real water hits rinse locally and repeated hits clean weak blood sooner", () => {
  const state=scene();state.events=[death(1),death(2,{maxHp:600,level:20,grade:"epic"}),death(3,{x:80})];state.nextEventSeq=4;
  const initial=advanceBloodMemory(empty(),state);
  for(let seq=4;seq<=6;seq++) state.events.push({seq,type:"damage",gameTimeMs:1000,data:{effect:"water-bolt",x:50,y:50,amount:8}});
  state.nextEventSeq=7;
  const cleaned=advanceBloodMemory(initial,state);
  assert.equal(cleaned.marks.some(mark=>mark.id===initial.marks[0].id),false);
  const strong=cleaned.marks.find(mark=>mark.id===initial.marks[1].id)!;
  assert.ok(strong.washed>0 && strong.washed<1);
  assert.equal(cleaned.marks.find(mark=>mark.id===initial.marks[2].id)!.washed,0);
  assert.equal(advanceBloodMemory(cleaned,state),cleaned);
});

test("floor art survives its bounded session cache and clears on a new run", () => {
  const state=scene();state.events=Array.from({length:BLOOD_LIMIT+20},(_,i)=>death(i+1,i===0?{maxHp:600,level:20,grade:"epic"}:{}));state.nextEventSeq=state.events.length+1;
  const memory=advanceBloodMemory(empty(),state);
  assert.equal(memory.marks.length,BLOOD_LIMIT);
  assert.ok(memory.marks.some(mark=>mark.id==="demo:1:enemy-1"));
  const restored=restoreBloodMemory(JSON.stringify({version:1,...memory}),state);
  assert.deepEqual(restored,memory);
  assert.equal(advanceBloodMemory(restored,state).marks.length,BLOOD_LIMIT);
  state.id="restarted";state.events=[];state.nextEventSeq=1;
  assert.equal(advanceBloodMemory(memory,state).marks.length,0);
  assert.equal(restoreBloodMemory("{broken",state).marks.length,0);
});
