import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState } from "../runtime/initial";
import { stepBattle } from "../engine";
import { demoContent } from "../content/demo";
import { collectCastVisuals, projectileVisual } from "./combatVisuals";

test("a killing hit retains its position for presentation after the target is removed", () => {
  const state = createInitialState();
  state.phase="battle";state.wave=1;
  state.entities=[{id:"target",definitionId:"enemy",kind:"enemy",faction:"enemy",x:50,y:72,
    hp:1,maxHp:1,damage:0,speed:0,range:0,cooldownMs:1000,attackRemainingMs:1000}];
  let next = stepBattle(state,50,demoContent).state;
  assert.equal(next.entities.some(entity => entity.id === "target"),true);
  assert.deepEqual(collectCastVisuals(next,state.nextEventSeq - 1),[]);
  for(let i=0;i<40 && next.phase === "battle";i++) next=stepBattle(next,50,demoContent).state;
  assert.equal(next.entities.some(entity => entity.id === "target"),false);
  const visuals = collectCastVisuals(next,state.nextEventSeq - 1);
  assert.equal(visuals.length,1);assert.equal(visuals[0].kind,"ember");
  assert.equal(visuals[0].x,50);assert.equal(visuals[0].y,72);
  assert.deepEqual(collectCastVisuals(next,next.nextEventSeq - 1),[]);
});

test("projectile presentation never puts non-finite legacy coordinates into CSS", () => {
  const state=createInitialState();state.phase="battle";
  state.entities=[{id:"target",definitionId:"enemy",kind:"enemy",faction:"enemy",x:50,y:72,
    hp:100,maxHp:100,damage:0,speed:0,range:0,cooldownMs:1000,attackRemainingMs:1000}];
  const projectile=stepBattle(state,50,demoContent).state.entities.find(entity => entity.kind === "projectile")!;
  for(const value of [NaN,Infinity,-Infinity,1e308]) {
    const visual=projectileVisual({...projectile,targetX:value,targetY:value,originX:value,originY:value})!;
    for(const number of [visual.x,visual.y,visual.targetX,visual.targetY,visual.originWeight]) assert.ok(Number.isFinite(number));
    assert.ok(visual.originWeight>=0 && visual.originWeight<=1);
  }
});

test("new elemental attacks show their own projectile and impact only on actual contact", () => {
  for (const [definitionId, kind] of [["water-bolt", "water"], ["lightning-bolt", "lightning"], ["wind-blade", "wind"], ["rock-shot", "rock"]] as const) {
    const state = createInitialState();
    const character = state.characters[0];
    const item = Object.values(state.items).find(item => item.definitionId === "spark")!;
    item.definitionId = definitionId;
    state.phase = "battle"; state.wave = 1;
    state.waveSpawnRemaining = 0;
    state.entities = [{id:"target", definitionId:"enemy", kind:"enemy", faction:"enemy", x:50, y:72,
      hp:1, maxHp:1, damage:0, speed:0, range:0, cooldownMs:1000, attackRemainingMs:1000}];
    let next = stepBattle(state, 50, demoContent).state;
    const projectile = next.entities.find(entity => entity.kind === "projectile");
    assert.ok(projectile, `${definitionId} launches a real projectile`);
    assert.equal(projectileVisual(projectile)?.kind, kind);
    assert.ok(next.characters[0].mana < character.mana);
    assert.equal(next.entities.find(entity => entity.id === "target")?.hp, 1);
    assert.deepEqual(collectCastVisuals(next, state.nextEventSeq - 1), []);
    for (let i = 0; i < 100 && next.phase === "battle"; i++) next = stepBattle(next, 50, demoContent).state;
    const impacts = collectCastVisuals(next, state.nextEventSeq - 1);
    assert.equal(impacts.length, 1);
    assert.equal(impacts[0].kind, kind);
    assert.equal(impacts[0].fizzled, false);
  }
});
