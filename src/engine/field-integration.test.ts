import assert from "node:assert/strict";
import test from "node:test";
import type { CombatEntity, GameState } from "../contracts";
import { demoContent } from "../content/demo";
import { createInitialState } from "../runtime/initial";
import { stepBattle } from "./index";

function enemy(id: string, x: number, y: number): CombatEntity {
  return { id, definitionId: "enemy-basic", kind: "enemy", faction: "enemy", x, y,
    hp: 1000, maxHp: 1000, damage: 0, speed: 0, range: 0, cooldownMs: 1000, attackRemainingMs: 1000 };
}

function battle(definitionId: string, targets: CombatEntity[]): GameState {
  const state = createInitialState();
  state.phase = "battle";
  state.wave = 1;
  state.entities = targets;
  state.items["spark-1"].definitionId = definitionId;
  state.characters[0].manaRegen = 0;
  return state;
}

test("both field bolts travel through the real cast loop and damage repeatedly only through an area", () => {
  for (const id of ["fire-field-bolt", "thunder-field-bolt"]) {
    let state = battle(id, [enemy("target", 50, 70)]);
    const cast = stepBattle(state, 50, demoContent);
    state = cast.state;
    assert.ok(state.entities.some(entity => entity.kind === "projectile"));
    assert.equal(state.entities.find(entity => entity.id === "target")!.hp, 1000);
    const paidMana = state.characters[0].mana;
    assert.ok(paidMana < 100);
    for (let index = 0; index < 30 && !state.entities.some(entity => entity.kind === "area"); index++) {
      const next = stepBattle(state, 50, demoContent);
      assert.equal(next.events.some(event => event.type === "damage"), false);
      state = next.state;
    }
    const area = state.entities.find(entity => entity.kind === "area");
    assert.ok(area, id);
    assert.equal(area.sourceCharacterId, "character-1");
    assert.equal(area.sourceItemId, "spark-1");
    const beforePulse = stepBattle(state, 399, demoContent);
    assert.equal(beforePulse.events.some(event => event.type === "damage"), false);
    const firstPulse = stepBattle(beforePulse.state, 1, demoContent);
    assert.equal(firstPulse.events.filter(event => event.type === "damage").length, 1);
    const pulse = stepBattle(firstPulse.state, 400, demoContent);
    const damage = [...firstPulse.events, ...pulse.events].filter(event => event.type === "damage");
    assert.equal(damage.length, 2, id);
    assert.ok(damage.every(event => event.data.areaId === area.id && event.data.sourceCharacterId === "character-1"));
    assert.equal(pulse.state.characters[0].mana, paidMana);
  }
});

test("thunderstorm reaches screen corners while leaving prespawn enemy centers untouched", () => {
  const source = battle("thunderstorm", [enemy("corner", 0, 0), enemy("other-corner", 100, 100),
    enemy("prespawn", 50, -0.01)]);
  const cast = stepBattle(source, 50, demoContent);
  const area = cast.state.entities.find(entity => entity.kind === "area")!;
  assert.deepEqual([area.x, area.y], [50, 50]);
  assert.equal(cast.events.some(event => event.type === "damage"), false);
  const result = stepBattle(cast.state, 400, demoContent);
  assert.ok(result.state.entities.find(entity => entity.id === "corner")!.hp < 1000);
  assert.ok(result.state.entities.find(entity => entity.id === "other-corner")!.hp < 1000);
  assert.equal(result.state.entities.find(entity => entity.id === "prespawn")!.hp, 1000);
});

test("vortex movement, pull and pulse clocks survive saves and fixed-step batching", () => {
  const cast = stepBattle(battle("moving-storm", [enemy("near", 54, 84)]), 50, demoContent);
  const original = cast.state.entities.find(entity => entity.kind === "area")!;
  assert.ok(original);
  const saved = JSON.parse(JSON.stringify(cast.state)) as GameState;
  const once = stepBattle(saved, 800, demoContent).state;
  let many = structuredClone(saved);
  for (let index = 0; index < 16; index++) many = stepBattle(many, 50, demoContent).state;
  assert.deepEqual({ ...once, revision: 0 }, { ...many, revision: 0 });
  const moved = once.entities.find(entity => entity.id === original.id)!;
  assert.ok(Math.hypot(moved.x - original.x, moved.y - original.y) > 0);
  assert.notDeepEqual([once.entities[0].x, once.entities[0].y], [54, 84]);
  assert.ok(once.entities[0].hp < 1000);
  for (const flag of ["paused", "backpackOpen"] as const) {
    const frozen = structuredClone(once);
    frozen[flag] = true;
    assert.equal(stepBattle(frozen, 800, demoContent).state, frozen);
  }
});

test("all four lightning chains hit immediately and propagate without projectile travel", () => {
  for (const id of ["arc-chain", "spark-hop", "thunder-chain", "storm-net"]) {
    const cast = stepBattle(battle(id, [enemy("first", 50, 70), enemy("second", 50, 66)]), 50, demoContent);
    const damage = cast.events.filter(event => event.type === "damage");
    assert.equal(damage.length, 1, `${id} instant first strike`);
    assert.equal(damage[0].data.targetId, "first");
    assert.equal(typeof damage[0].data.chainId, "string");
    assert.equal(cast.state.entities.some(entity => entity.kind === "projectile"), false);
    assert.equal(cast.state.entities.find(entity => entity.id === "second")!.hp, 1000);
    const paidMana = cast.state.characters[0].mana;
    const later = stepBattle(cast.state, 200, demoContent);
    const hops = later.events.filter(event => event.type === "damage");
    assert.equal(hops.length, 1, id);
    assert.equal(hops[0].data.targetId, "second");
    assert.equal(hops[0].data.sourceCharacterId, "character-1");
    assert.equal(hops[0].data.sourceItemId, "spark-1");
    assert.equal(later.state.characters[0].mana, paidMana);
  }
});
