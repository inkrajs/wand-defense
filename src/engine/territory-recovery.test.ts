import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState } from "../runtime/initial";
import { advanceTerritoryRecovery } from "./territoryRecovery";

function battle() {
  const state = createInitialState();
  state.phase = "battle";
  state.territory = {hp:40,maxHp:100,shield:10,maxShield:50,wallRepairLevel:2,shieldRepairLevel:3};
  return state;
}

test("independent recovery tracks consume simulation seconds without spending or emitting", () => {
  const state = battle(), before = structuredClone(state);
  advanceTerritoryRecovery(state, 250);
  assert.equal(state.territory.hp,40.5);
  assert.equal(state.territory.shield,11.5);
  assert.deepEqual({...state,territory:before.territory},before);
  for (const track of ["wallRepairLevel","shieldRepairLevel"] as const) {
    const solo = battle(); delete solo.territory[track];
    advanceTerritoryRecovery(solo,1_000);
    assert.equal(solo.territory.hp,track==="wallRepairLevel"?40:42);
    assert.equal(solo.territory.shield,track==="shieldRepairLevel"?10:16);
  }
});

test("pause, backpack, other phases and a fallen wall cannot recover or revive", () => {
  const blocked = [
    {...battle(),paused:true}, {...battle(),backpackOpen:true},
    ...(["ready","reward","defeat"] as const).map(phase=>({...battle(),phase})),
    {...battle(),territory:{...battle().territory,hp:0}},
  ];
  for (const state of blocked) {
    const before=structuredClone(state);
    advanceTerritoryRecovery(state,10_000);
    assert.deepEqual(state,before);
  }
  for (const dt of [0,-1,Number.NaN,Infinity]) {
    const state=battle(), before=structuredClone(state);
    advanceTerritoryRecovery(state,dt);
    assert.deepEqual(state,before);
  }
});

test("recovery clamps to real capacity and tolerates huge finite time without overflow", () => {
  const state=battle();
  state.territory.hp=99.9; state.territory.shield=49.9;
  advanceTerritoryRecovery(state,Number.MAX_VALUE);
  assert.equal(state.territory.hp,100);
  assert.equal(state.territory.shield,50);
  const full=structuredClone(state);
  advanceTerritoryRecovery(state,1_000);
  assert.deepEqual(state,full);
  const legacy=battle(); delete legacy.territory.maxShield; delete legacy.territory.shield;
  advanceTerritoryRecovery(legacy,1_000);
  assert.equal(legacy.territory.shield,undefined);
});

test("legacy and malformed recovery levels do not create recovery", () => {
  for (const level of [undefined,0,-1,1.5,Number.NaN,Infinity,Number.MAX_SAFE_INTEGER]) {
    const state=battle();
    state.territory.wallRepairLevel=level; state.territory.shieldRepairLevel=level;
    const before=structuredClone(state);
    advanceTerritoryRecovery(state,1_000);
    // MAX_SAFE is a valid wall rate even though it cannot be upgraded further.
    if (level===Number.MAX_SAFE_INTEGER) assert.equal(state.territory.hp,100);
    else assert.deepEqual(state,before);
    assert.equal(state.territory.shield,10);
  }
});

test("fixed slices agree with elapsed time and speed is applied only by the caller", () => {
  const batched=battle(), sliced=battle();
  advanceTerritoryRecovery(batched,1_000);
  for(let i=0;i<20;i++) advanceTerritoryRecovery(sliced,50);
  assert.ok(Math.abs(batched.territory.hp-sliced.territory.hp)<1e-10);
  assert.ok(Math.abs(batched.territory.shield!-sliced.territory.shield!)<1e-10);
  const fast=battle(), slow=battle(); fast.speed=5; slow.speed=.25;
  advanceTerritoryRecovery(fast,250); advanceTerritoryRecovery(slow,250);
  assert.deepEqual(fast.territory,slow.territory);
});
