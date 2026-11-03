import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState } from "../runtime/initial";
import { advanceEnemies } from "./waves";

function moving() {
  const state=createInitialState();state.phase="battle";state.wave=1;
  state.entities=[{id:"moving",definitionId:"enemy-basic",kind:"enemy" as const,faction:"enemy" as const,
    x:50,y:0,hp:100,maxHp:100,damage:0,speed:10,moveSpeed:1.8,moveRampMs:1200,
    range:0,cooldownMs:1000,attackRemainingMs:1000}];
  return state;
}
const emit=()=>{};

test("enemy accelerates smoothly from its entry speed and never exceeds its cap", () => {
  const state=moving();let previousSpeed=state.entities[0].moveSpeed!;
  let previousDistance=0;
  for(let i=0;i<80;i++) {
    const before=state.entities[0].y;
    advanceEnemies(state,50,emit);
    const enemy=state.entities[0],distance=enemy.y-before;
    assert.ok(enemy.moveSpeed!>=previousSpeed);assert.ok(enemy.moveSpeed!<=enemy.speed);
    assert.ok(distance>=previousDistance-1e-10);
    previousSpeed=enemy.moveSpeed!;previousDistance=distance;
  }
  assert.ok(previousSpeed>9.7);assert.ok(state.entities[0].y<40);
});

test("movement integration is independent of tick size and pause freezes the ramp", () => {
  const once=moving(),many=moving();
  advanceEnemies(once,1000,emit);
  for(let i=0;i<20;i++) advanceEnemies(many,50,emit);
  assert.ok(Math.abs(once.entities[0].y-many.entities[0].y)<1e-10);
  assert.ok(Math.abs(once.entities[0].moveSpeed!-many.entities[0].moveSpeed!)<1e-10);
  for(const flag of ["paused","backpackOpen"] as const) {
    const state=moving();state[flag]=true;const before=structuredClone(state);
    advanceEnemies(state,1000,emit);assert.deepEqual(state,before);
  }
  const legacy=moving();delete legacy.entities[0].moveSpeed;
  advanceEnemies(legacy,1000,emit);assert.equal(legacy.entities[0].y,10);
});
