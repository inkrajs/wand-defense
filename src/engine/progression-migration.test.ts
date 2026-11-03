import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState } from "../runtime/initial";
import { normalizeCharacterProgression } from "../content/progression";

test("legacy shared XP migrates once to the first character; other missing pools inherit only their own level floor", () => {
  const state=createInitialState();delete state.characters[0].xp;
  state.xp=200;state.playerLevel=5;
  state.characters.push({...structuredClone(state.characters[0]),id:"second",level:3},
    {...structuredClone(state.characters[0]),id:"new",level:1},
    {...structuredClone(state.characters[0]),id:"already",xp:6,level:1});
  const events=structuredClone(state.events), rewards=structuredClone(state.rewards);
  normalizeCharacterProgression(state);
  assert.deepEqual(state.characters.map(c=>[c.xp,c.level]),[[200,5],[60,3],[0,1],[6,1]]);
  assert.equal(state.playerLevel,5);assert.equal(state.xp,200);
  assert.deepEqual(state.events,events);assert.deepEqual(state.rewards,rewards);
  state.xp=99999;
  const current=structuredClone(state);normalizeCharacterProgression(state);
  assert.deepEqual(state,current);
});

test("legacy levels keep their cumulative floor and migration honors curve boundaries", () => {
  const state=createInitialState();delete state.characters[0].xp;
  state.xp=0;state.characters[0].level=4;
  normalizeCharacterProgression(state);
  assert.equal(state.characters[0].xp,120);assert.equal(state.characters[0].level,4);
  for(const [xp,level] of [[0,1],[19,1],[20,2],[59,2],[60,3],[120,4]] as const) {
    const saved=createInitialState();delete saved.characters[0].xp;saved.xp=xp;
    normalizeCharacterProgression(saved);
    assert.equal(saved.characters[0].level,level);assert.equal(saved.characters[0].xp,xp);
  }
});

test("already-personal pools are preserved rather than replaced by the compatibility team pool", () => {
  const state=createInitialState();state.xp=2000;state.characters[0].xp=20;state.characters[0].level=2;
  state.characters.push({...structuredClone(state.characters[0]),id:"second",xp:0,level:1});
  normalizeCharacterProgression(state);
  assert.deepEqual(state.characters.map(c=>[c.xp,c.level]),[[20,2],[0,1]]);
  assert.equal(state.playerLevel,2);
});
