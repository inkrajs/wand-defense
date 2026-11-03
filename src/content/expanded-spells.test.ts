import assert from "node:assert/strict";
import test from "node:test";
import type { CombatEntity } from "../contracts";
import { startBattle, stepBattle } from "../engine";
import { advanceChains, spawnChains } from "../engine/chains";
import { placementCells } from "../loadout/geometry";
import { applyLoadoutCommand, compileWand } from "../loadout";
import { createInitialState } from "../runtime/initial";
import { demoContent } from "./demo";

const expandedSpellIds = [
  "flame-lance", "cinder-burst", "thorn-shot", "renewal", "tidal-orb", "stone-spike",
  "iron-disc", "gale-burst", "arc-chain", "light-arrow", "dark-orb", "ward",
  "solar-ray", "ember-ray", "void-ray", "spark-hop", "thunder-chain", "storm-net",
] as const;

function equip(definitionId: typeof expandedSpellIds[number]) {
  let state = createInitialState();
  state.backpackOpen = true;
  state.paused = true;
  state.items["expanded-spell"] = {
    id: "expanded-spell", definitionId, kind: "spell", level: 1, grade: "common",
  };
  state.backpack.push("expanded-spell");
  state.knowledge.spellIds.push(definitionId);
  const removed = applyLoadoutCommand(state, {
    id: "remove-starter", type: "removeItem", wandId: "wand-1", itemId: "spark-1",
  }, demoContent);
  assert.equal(removed.result.status, "executed");
  const placed = applyLoadoutCommand(removed.state, {
    id: "place-expanded", type: "placeItem", wandId: "wand-1", itemId: "expanded-spell", x: 0, y: 0, rotation: 0,
  }, demoContent);
  assert.equal(placed.result.status, "executed", `${definitionId} must fit the real 3x3 wand`);
  state = placed.state;
  state.backpackOpen = false;
  state.paused = false;
  state.characters[0].manaRegen = 0;
  return state;
}

function enemy(id: string, x: number, y: number): CombatEntity {
  return { id, definitionId: "enemy-basic", kind: "enemy", faction: "enemy", x, y,
    hp: 500, maxHp: 500, damage: 0, speed: 0, range: 1, cooldownMs: 1000, attackRemainingMs: 1000 };
}

test("demo exposes the expanded spell IDs and every footprint fits a 3x3 wand", () => {
  assert.equal(Object.keys(demoContent.spells).length, 33);
  for (const id of expandedSpellIds) {
    const spell = demoContent.spells[id];
    assert.ok(spell, `missing ${id}`);
    assert.equal(spell.id, id);
    assert.ok(spell.shape.length > 0);
    const xs = spell.shape.map(cell => cell.x);
    const ys = spell.shape.map(cell => cell.y);
    assert.ok(Math.max(...xs) - Math.min(...xs) + 1 <= 3, `${id} width exceeds 3`);
    assert.ok(Math.max(...ys) - Math.min(...ys) + 1 <= 3, `${id} height exceeds 3`);

    const state = equip(id);
    const compiled = compileWand(state, "wand-1", demoContent)?.spells;
    assert.equal(compiled?.length, 1);
    assert.equal(compiled?.[0].id, id);
    assert.equal(placementCells(spell.shape, state.wands[0].placements[0]).length, spell.shape.length);
  }
});

function simulateChainSpell(definitionId: "spark-hop" | "thunder-chain" | "storm-net", targets: CombatEntity[]) {
  const state = equip(definitionId);
  state.phase = "battle";
  state.wave = 1;
  state.waveSpawnRemaining = 1;
  state.entities = targets;
  const compiled = compileWand(state, "wand-1", demoContent)?.spells[0];
  assert.ok(compiled, `${definitionId} should compile from the equipped item`);
  assert.ok(compiled.impact?.type === "chain", `${definitionId} should compile its chain impact`);
  const events: { type: string; data: Record<string, unknown> }[] = [];
  const emit = (type: string, data: Record<string, unknown>) => events.push({ type, data });
  assert.equal(spawnChains(state, "character-1", {
    itemId: compiled.itemId, definitionId: compiled.id, power: compiled.power, range: compiled.range,
    casts: compiled.copies, burstCount: compiled.burstCount, splitCount: compiled.splitCount,
    impact: compiled.impact, attackRoll: { ...compiled.attackRoll, accuracy: 1, critChance: 0, critMultiplier: 1 },
  }, emit), true);
  const chain = state.entities.find(entity => entity.kind === "chain");
  assert.ok(chain);
  return { state, events, chain, emit, power: compiled.power };
}

test("lightning chain spells hit immediately, then hop every 80ms with per-hop falloff", () => {
  const specs = [
    { id: "spark-hop", targets: 3, falloff: 0.6, power: 8 },
    { id: "thunder-chain", targets: 4, falloff: 0.85, power: 20 },
    { id: "storm-net", targets: 6, falloff: 0.8, power: 12 },
  ] as const;
  const line = Array.from({ length: 7 }, (_, index) => enemy(`target-${index}`, 50, 70 - index * 4));
  for (const spec of specs) {
    const { state, events, chain, emit, power } = simulateChainSpell(spec.id, structuredClone(line));
    assert.equal(events.filter(event => event.type === "damage").length, 1, `${spec.id} first contact`);
    assert.equal(state.entities.find(entity => entity.id === "target-0")?.hp, 500 - power,
      `${spec.id} immediately hits the first target`);
    assert.equal(state.entities.find(entity => entity.id === "target-1")?.hp, 500,
      `${spec.id} waits before the next hop`);
    advanceChains(state, 79, emit);
    assert.equal(state.entities.find(entity => entity.id === "target-1")?.hp, 500,
      `${spec.id} has not hopped before 80ms`);
    advanceChains(state, 1, emit);
    for (let index = 2; index < spec.targets; index++) advanceChains(state, 80, emit);
    const hits = events.filter(event => event.type === "damage");
    const ids = hits.map(event => event.data.targetId);
    assert.equal(ids.length, spec.targets, `${spec.id} target cap`);
    assert.equal(new Set(ids).size, spec.targets, `${spec.id} must hit each target once`);
    for (const [index, hit] of hits.entries()) {
      assert.ok(Math.abs(Number(hit.data.amount) - power * spec.falloff ** index) < 1e-9,
        `${spec.id} hit ${index + 1} should apply falloff`);
    }
    assert.equal(chain.kind, "chain");
  }
});

test("chain radii produce distinct reach through the real chain path", () => {
  const scenarios = [
    { distance: 10, expected: { "spark-hop": 1, "thunder-chain": 2, "storm-net": 2 } },
    { distance: 20, expected: { "spark-hop": 1, "thunder-chain": 2, "storm-net": 1 } },
  ] as const;
  for (const scenario of scenarios) {
    for (const id of ["spark-hop", "thunder-chain", "storm-net"] as const) {
      const targets = [enemy("first", 50, 70), enemy("hop-target", 50, 70 - scenario.distance)];
      const { state, events, chain, emit } = simulateChainSpell(id, structuredClone(targets));
      advanceChains(state, 80, emit);
      const expectedHits = scenario.expected[id];
      assert.equal(events.filter(event => event.type === "damage").length, expectedHits, `${id} radius at ${scenario.distance}`);
      const falloff = demoContent.spells[id].impact?.type === "chain" ? demoContent.spells[id].impact.falloff : 1;
      const expectedHp = 500 - (expectedHits === 2 ? demoContent.spells[id].power * falloff : 0);
      assert.equal(state.entities.find(entity => entity.id === "hop-target")?.hp, expectedHp);
      assert.equal(chain.kind, "chain");
    }
  }
});

test("each expanded attack spell launches and damages through the battle simulation", () => {
  const attackIds = expandedSpellIds.filter(id =>
    demoContent.spells[id].effect === "projectile" || demoContent.spells[id].effect === "beam");
  for (const id of attackIds) {
    let state = equip(id);
    state = startBattle(state, demoContent).state;
    state.waveSpawnRemaining = 0;
    state.entities = [enemy("contact-target", 50, 68)];
    const firstStep = stepBattle(state, 50, demoContent);
    const launched = firstStep.state.entities.find(entity =>
      entity.sourceItemId === "expanded-spell" && (entity.kind === "projectile" || entity.kind === "beam"));
    assert.ok(launched, `${id} did not launch`);
    assert.equal(firstStep.state.entities.find(entity => entity.id === "contact-target")?.hp, 500,
      `${id} damaged before contact`);

    let after = firstStep.state;
    let damage = after.events.find(event => event.type === "damage" && event.data.sourceItemId === "expanded-spell");
    for (let i = 0; i < 100 && !damage; i++) {
      after = stepBattle(after, 50, demoContent).state;
      damage = after.events.find(event => event.type === "damage" && event.data.sourceItemId === "expanded-spell");
    }
    assert.ok(damage, `${id} did not damage on contact`);
    assert.equal(typeof damage.data.amount, "number");
    assert.ok((damage.data.amount as number) > 0);
    assert.equal(after.entities.find(entity => entity.id === "contact-target")?.hp, 500 - (damage.data.amount as number));
  }
});

test("renewal restores territory HP and ward restores territory shield", () => {
  for (const { id, expected, setup } of [
    { id: "renewal", expected: 80, setup: (state: ReturnType<typeof createInitialState>) => { state.territory.hp = 50; } },
    { id: "ward", expected: 35, setup: (state: ReturnType<typeof createInitialState>) => { state.territory.shield = 10; } },
  ] as const) {
    let state = equip(id);
    setup(state);
    state = startBattle(state, demoContent).state;
    state.waveSpawnRemaining = 0;
    state.entities = [enemy("anchor", 95, 0)];
    state = stepBattle(state, 50, demoContent).state;
    assert.equal(id === "renewal" ? state.territory.hp : state.territory.shield, expected);
    if (id === "renewal") assert.ok(state.events.some(event => event.type === "heal"));
    assert.equal(state.characters[0].mana, 100 - demoContent.spells[id].manaCost);
    assert.equal(state.wands[0].cooldowns["expanded-spell"], demoContent.spells[id].cooldownMs);
  }
});

test("ward at full shield or without shield capacity does not spend mana or start cooldown", () => {
  for (const setup of [
    (state: ReturnType<typeof createInitialState>) => { state.territory.shield = 50; },
    (state: ReturnType<typeof createInitialState>) => { delete state.territory.maxShield; state.territory.shield = 10; },
  ]) {
    let state = equip("ward");
    setup(state);
    state = startBattle(state, demoContent).state;
    state.waveSpawnRemaining = 0;
    state.entities = [enemy("anchor", 95, 0)];
    const mana = state.characters[0].mana;
    state = stepBattle(state, 50, demoContent).state;
    assert.equal(state.characters[0].mana, mana);
    assert.equal(state.wands[0].cooldowns["expanded-spell"] ?? 0, 0);
  }
});
