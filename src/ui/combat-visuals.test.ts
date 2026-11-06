import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState } from "../runtime/initial";
import { stepBattle } from "../engine";
import { demoContent } from "../content/demo";
import { collectCastVisuals, projectileScreenPosition, projectileVisual } from "./combatVisuals";

test("ordinary character projectiles start at the hero and fly forward toward enemies in front of the defenses", () => {
  const projectile = { id:"p", definitionId:"spark", kind:"projectile" as const, faction:"player" as const,
    x:50, y:84, originX:50, originY:84, targetX:52, targetY:80, sourceCharacterId:"hero",
    hp:1, maxHp:1, damage:1, speed:1, range:30, cooldownMs:0, attackRemainingMs:0 };
  const layout = { width:393, height:658, sources:{hero:{x:196.5,y:625}} };
  const points = [84, 83, 82, 81, 80, 79].map(y => {
    const current = {...projectile, x:50 + (84 - y) * 2 / 4, y};
    return projectileScreenPosition(current, projectileVisual(current)!, layout);
  });
  assert.deepEqual(points[0], layout.sources.hero);
  for (let i = 1; i < points.length; i++) assert.ok(points[i].y < points[i - 1].y);
  assert.ok(Math.abs(points[4].y - 80 / 100 * layout.height) < 1e-8);

  const upward = {...projectile, targetX:50, targetY:60};
  assert.equal(projectileScreenPosition(upward, projectileVisual(upward)!, layout).y, 625);
  const triggered = {...upward, fixedOrigin:true};
  assert.equal(projectileScreenPosition(triggered, projectileVisual(triggered)!, layout).y, 84 / 100 * layout.height);
  const summoned = {...upward, sourceEntityId:"summon"};
  assert.equal(projectileScreenPosition(summoned, projectileVisual(summoned)!, layout).y, 84 / 100 * layout.height);
});

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


test("projectiles and impacts retain real coordinates at and beyond the field edge", () => {
  const state = createInitialState();
  const entity = { id: "p", definitionId: "spark", kind: "projectile" as const, faction: "player" as const, x: 101, y: 92, hp: 1, maxHp: 1, damage: 1, speed: 1, range: 1, cooldownMs: 0, attackRemainingMs: 0, targetX: 50, targetY: -2 };
  const visual = projectileVisual(entity)!;
  assert.deepEqual([visual.x, visual.y, visual.targetX, visual.targetY], [101, 92, 50, -2]);
  state.events = [{ seq: 1, type: "damage", gameTimeMs: 0, data: { effect: "spark", sourceCharacterId: state.characters[0].id, amount: 1, x: 101, y: 92 } }];
  const [impact] = collectCastVisuals(state, 0);
  assert.deepEqual([impact.x, impact.y], [101, 92]);
});

test("storm flashes follow each real pulse contact, including moving and killed targets", () => {
  const state = createInitialState();
  state.phase = "battle"; state.wave = 1;
  state.items["spark-1"].definitionId = "thunderstorm";
  state.characters[0].manaRegen = 0;
  state.entities = [{id:"moving",definitionId:"enemy",kind:"enemy",faction:"enemy",x:20,y:30,
    hp:1000,maxHp:1000,damage:0,speed:0,range:0,cooldownMs:1000,attackRemainingMs:1000}];
  const cast = stepBattle(state, 50, demoContent).state;
  assert.deepEqual(collectCastVisuals(cast, state.nextEventSeq - 1), []);
  const first = stepBattle(cast, 400, demoContent).state;
  const [flash] = collectCastVisuals(first, cast.nextEventSeq - 1);
  assert.deepEqual([flash.kind, flash.groundStrike, flash.x, flash.y], ["lightning", true, 20, 30]);
  const moved = structuredClone(first);
  const enemy = moved.entities.find(entity => entity.id === "moving")!;
  enemy.x = 78; enemy.y = 60; enemy.hp = 1;
  const second = stepBattle(moved, 400, demoContent).state;
  assert.equal(second.entities.some(entity => entity.id === "moving"), false);
  const [killingFlash] = collectCastVisuals(second, first.nextEventSeq - 1);
  assert.deepEqual([killingFlash.groundStrike, killingFlash.x, killingFlash.y], [true, 78, 60]);
  assert.deepEqual(collectCastVisuals(second, second.nextEventSeq - 1), []);
});

test("storm contact remains visible when armor absorbs it or accuracy misses", () => {
  const state = createInitialState();
  state.events = ["damage", "attackMiss"].map((type, index) => ({seq:index + 1,type,gameTimeMs:0,
    data:{effect:"thunderstorm",sourceCharacterId:state.characters[0].id,amount:0,x:30 + index,y:40}}));
  assert.deepEqual(collectCastVisuals(state, 0).map(flash => [flash.groundStrike, flash.x]), [[true,30],[true,31]]);
});

test('thunder strike flashes directly at every real area contact and retains its radius and windup', () => {
  const state = createInitialState();
  state.phase='battle';state.wave=1;state.items['spark-1'].definitionId='thunder-strike';
  const enemy=(id:string,x:number)=>({id,definitionId:'enemy-basic',kind:'enemy' as const,faction:'enemy' as const,x,y:72,
    hp:1000,maxHp:1000,damage:0,speed:0,range:0,cooldownMs:1000,attackRemainingMs:1000});
  state.entities=[enemy('primary',50),enemy('near',52),enemy('far',75)];
  const cast=stepBattle(state,50,demoContent).state;
  assert.equal(cast.entities.some(e=>e.kind==='area'&&e.definitionId==='thunder-strike'),true);
  assert.deepEqual(collectCastVisuals(cast,0),[]);
  const result=stepBattle(cast,350,demoContent).state;
  assert.deepEqual(collectCastVisuals(result,0).map(v=>[v.kind,v.groundStrike,v.directStrike,v.x,v.y]),[
    ['lightning',true,true,50,72],['lightning',true,true,52,72],
  ]);
  assert.equal(result.entities.find(e=>e.id==='far')?.hp,1000);
});
