import assert from "node:assert/strict";
import test from "node:test";
import type { CombatEntity, GameState } from "../contracts";
import { createInitialState } from "../runtime/initial";
import { advanceChains, spawnChains, type ChainCastSpec } from "./chains";

function fixture(): GameState {
  const state = createInitialState();
  state.phase = "battle";
  state.paused = false;
  state.backpackOpen = false;
  return state;
}

function enemy(id: string, x: number, y: number, hp = 100): CombatEntity {
  return {
    id, definitionId: `enemy-${id}`, kind: "enemy", faction: "enemy", x, y,
    hp, maxHp: hp, damage: 0, speed: 0, range: 0, cooldownMs: 0,
    attackRemainingMs: 0,
  };
}

function spec(overrides: Partial<ChainCastSpec> = {}): ChainCastSpec {
  return {
    itemId: "wand-spark", definitionId: "arc-chain", casts: 1, power: 20, range: 50,
    impact: { type: "chain", radius: 8, maxTargets: 4, falloff: 0.5 },
    ...overrides,
  };
}

function eventsCollector() {
  const events: Array<{ type: string; data: Record<string, unknown> }> = [];
  const emit = (type: string, data: Record<string, unknown>) => events.push({ type, data });
  return { events, emit };
}

test("first chain contact is immediate; later jumps use 80ms simulation steps and per-hop falloff", () => {
  const state = fixture();
  const first = enemy("first", 51, 84);
  const second = enemy("second", 54, 84);
  const third = enemy("third", 57, 84);
  state.entities.push(first, second, third);
  const { events, emit } = eventsCollector();

  assert.equal(spawnChains(state, "character-1", spec(), emit), true);
  const chain = state.entities.find(entity => entity.kind === "chain")!;
  assert.equal(first.hp, 80);
  assert.equal(second.hp, 100);
  assert.equal(chain.x, first.x);
  assert.deepEqual(chain.hitIds, [first.id]);
  assert.equal(events.filter(event => event.type === "spellCast").length, 1);
  assert.equal(events.filter(event => event.type === "chainArc").length, 1);

  advanceChains(state, 79, emit);
  assert.equal(second.hp, 100);
  advanceChains(state, 1, emit);
  assert.equal(second.hp, 90);
  assert.equal(chain.damage, 5);
  advanceChains(state, 80, emit);
  assert.equal(third.hp, 95);
  assert.deepEqual(chain.hitIds, [first.id, second.id, third.id]);
  assert.equal(events.filter(event => event.type === "chainArc").length, 3);
});

test("chains expire at their target cap and cannot be revived by later advancement", () => {
  const state = fixture();
  state.entities.push(enemy("first", 51, 84), enemy("second", 54, 84));
  const { emit } = eventsCollector();
  assert.equal(spawnChains(state, "character-1", spec({ impact: {
    type: "chain", radius: 8, maxTargets: 1, falloff: 0.5,
  } }), emit), true);
  const chain = state.entities.find(entity => entity.kind === "chain")!;
  assert.equal(chain.hp, 0);
  assert.equal(chain.remainingMs, 0);
  advanceChains(state, 1_000, emit);
  assert.equal(chain.hp, 0);
  assert.equal(chain.remainingMs, 0);
});

test("branches choose real targets and preserve source ownership through chainArc and contact damage", () => {
  const state = fixture();
  state.entities.push(enemy("a", 51, 84), enemy("b", 55, 84), enemy("c", 58, 84));
  const { events, emit } = eventsCollector();
  assert.equal(spawnChains(state, "character-1", spec({ splitCount: 2, attackRoll: {
    accuracy: 1, critChance: 0, critMultiplier: 2, sourceLuck: 7,
  } }), emit), true);

  const arcs = events.filter(event => event.type === "chainArc");
  assert.equal(arcs.length, 2);
  assert.notEqual(arcs[0].data.targetId, arcs[1].data.targetId);
  assert.ok(arcs.every(event => event.data.sourceCharacterId === "character-1"
    && event.data.sourceItemId === "wand-spark" && event.data.definitionId === "arc-chain"));
  const chains = state.entities.filter(entity => entity.kind === "chain");
  assert.equal(chains.length, 2);
  const damage = events.filter(event => event.type === "damage");
  assert.equal(damage.length, 2);
  assert.ok(damage.every(event => typeof event.data.chainId === "string"
    && event.data.sourceCharacterId === "character-1" && event.data.sourceItemId === "wand-spark"));
});

test("later hops recheck living, unvisited enemies and do not revisit dead targets", () => {
  const state = fixture();
  const first = enemy("first", 51, 84, 5);
  const nearest = enemy("nearest", 52, 84);
  const alternate = enemy("alternate", 55, 84);
  state.entities.push(first, nearest, alternate);
  const { events, emit } = eventsCollector();
  assert.equal(spawnChains(state, "character-1", spec(), emit), true);
  assert.equal(first.hp, 0);
  nearest.hp = 0;
  advanceChains(state, 80, emit);
  assert.equal(alternate.hp, 90);
  assert.deepEqual(state.entities.find(entity => entity.kind === "chain")!.hitIds, [first.id, alternate.id]);
});

test("paused and backpack states freeze active chains; burst branches use simulation delays", () => {
  const state = fixture();
  const first = enemy("first", 51, 84, 20);
  const second = enemy("second", 54, 84);
  state.entities.push(first, second);
  const { events, emit } = eventsCollector();
  assert.equal(spawnChains(state, "character-1", spec({
    burstCount: 2,
    impact: { type: "chain", radius: 8, maxTargets: 1, falloff: 0.5 },
  }), emit), true);
  assert.equal(first.hp, 0);
  state.paused = true;
  advanceChains(state, 1_000, emit);
  assert.equal(second.hp, 100);
  state.paused = false;
  state.backpackOpen = true;
  advanceChains(state, 1_000, emit);
  assert.equal(second.hp, 100);
  state.backpackOpen = false;
  advanceChains(state, 119, emit);
  assert.equal(second.hp, 100);
  advanceChains(state, 1, emit);
  assert.equal(second.hp, 80);
  assert.equal(events.filter(event => event.type === "spellCast").length, 1);
  assert.equal(events.filter(event => event.type === "chainArc").length, 2);
});

test("invalid phase, no initial target, and exhausted cast capacity reject without charging", () => {
  const noTargets = fixture();
  const { events, emit } = eventsCollector();
  assert.equal(spawnChains(noTargets, "character-1", spec(), emit), false);
  assert.equal(events.length, 0);

  const noCaster = fixture();
  noCaster.entities.push(enemy("target", 51, 84));
  assert.equal(spawnChains(noCaster, "missing-character", spec(), emit), false);
  assert.equal(noCaster.entities.some(entity => entity.kind === "chain"), false);

  const inactive = fixture();
  inactive.phase = "reward";
  inactive.entities.push(enemy("target", 51, 84));
  assert.equal(spawnChains(inactive, "character-1", spec(), emit), false);

  const full = fixture();
  full.entities.push(enemy("target", 51, 84));
  for (let index = 0; index < 32; index++) full.entities.push({
    id: `chain-${index}`, definitionId: "arc-chain", kind: "chain", faction: "player",
    x: 50, y: 84, hp: 1, maxHp: 1, damage: 1, speed: 0, range: 8,
    cooldownMs: 80, attackRemainingMs: 80, remainingMs: 2_000,
  });
  assert.equal(spawnChains(full, "character-1", spec(), emit), false);
  assert.equal(events.length, 0);
});
