import assert from 'node:assert/strict';
import test from 'node:test';
import type { ContentCatalog, Grade, SpellDefinition } from '../contracts';
import { demoContent } from '../content/demo';
import { expandedArcana, expandedArcanaDescriptions } from '../content/expandedArcana';
import { createFixtureState } from '../runtime/mock';
import { compileWand } from './compile';
import { stepBattle } from '../engine';
import { fillUniqueRewardOffers } from '../content/randomRewards';
import { createGameRuntime } from '../runtime';

const positions: Record<string, [number, number]> = {
  pierce: [0, 2], slow: [1, 1], burn: [2, 1], knockback: [4, 1], duration: [5, 1], capacity: [8, 2], precision: [6, 3],
};
const base: SpellDefinition = { ...demoContent.spells.spark, id: 'test',
  shape: Array.from({length: 7}, (_, x) => ({x, y: 0})), range: 100, speed: 100, onHit: undefined, impact: undefined };
function setup(ids: string[], spell = base, grade: Grade = 'common') {
  const state = createFixtureState();
  state.items = { spell: { id: 'spell', definitionId: 'test', kind: 'spell', grade: 'common', level: 1 } };
  state.backpack = [];
  state.wands[0] = { ...state.wands[0], width: 12, height: 6, placements: [{itemId: 'spell', x: 1, y: 2, rotation: 0}] };
  for (const id of ids) {
    state.items[id] = {id, definitionId: id, kind: 'arcana', grade, level: 1};
    const [x, y] = positions[id];
    state.wands[0].placements.push({itemId: id, x, y, rotation: 0});
  }
  state.characters[0].baseStats = { ...state.characters[0].baseStats!, accuracy: 0.7 };
  const content: ContentCatalog = { spells: {test: structuredClone(spell)}, arcana: expandedArcana, sequences: {}, recipes: [] };
  return {state, content, compile: () => compileWand(state, 'wand-1', content)!.spells[0]};
}
const near = (a: number, b: number) => assert.ok(Math.abs(a-b) < 1e-8, `${a} != ${b}`);

test('seven distinct arcana compile real structures without mutating catalog, with deterministic combinations', () => {
  const ids = Object.keys(positions);
  for (const id of ids) { assert.ok(expandedArcana[id]); assert.ok(expandedArcanaDescriptions[id]); }
  const {state, content, compile} = setup(ids);
  const before = structuredClone({state, content});
  const spell = compile();
  assert.deepEqual(spell.impact, {type: 'pierce', maxTargets: 4});
  assert.deepEqual(spell.onHit, {slow: {multiplier: 0.75, durationMs: 1500}, burn: {powerRatio: 0.2, durationMs: 3000, tickMs: 500}, knockback: 3});
  near(spell.attackRoll.accuracy, 0.8);
  assert.deepEqual(spell.modifierItemIds, ids.filter(id => id !== 'duration'));
  assert.deepEqual({state, content}, before);
  state.wands[0].placements.reverse();
  assert.deepEqual(compile(), spell);
  const high = setup(ids, base, 'mythic').compile();
  assert.equal(high.impact?.maxTargets, 8);
  near(high.onHit!.slow!.multiplier, 0.15);
  near(high.onHit!.burn!.powerRatio, 0.68);
  near(high.onHit!.knockback!, 10.2);
  assert.equal(high.attackRoll.accuracy, 1);
});

test('inapplicable arcana preserve incompatible impact and support spells, and adjacency stays mandatory', () => {
  const splash: SpellDefinition = {...base, impact: {type: 'splash', radius: 3, maxTargets: 2}};
  const compiled = setup(['pierce', 'capacity'], splash).compile();
  assert.deepEqual(compiled.impact, {type: 'splash', radius: 3, maxTargets: 4});
  assert.deepEqual(compiled.modifierItemIds, ['capacity']);
  const support = setup(Object.keys(positions), {...base, effect: 'heal'}).compile();
  assert.deepEqual(support.modifierItemIds, []);
  assert.equal(support.onHit, undefined);
  const remote = setup(['burn']);
  remote.state.wands[0].placements[1].y = 5;
  assert.deepEqual(remote.compile().modifierItemIds, []);
});

test('duration and capacity reuse beam, impact-field and field/vortex specs with engine budgets', () => {
  const specs: SpellDefinition[] = [
    {...base, effect: 'beam', beam: {width: 2, durationMs: 1000, tickMs: 200, maxTargets: 2}},
    {...base, impact: {type: 'field', radius: 4, durationMs: 1000, tickMs: 200, maxTargets: 2, trigger: 'contact'}},
    {...base, effect: 'area', area: {mode: 'field', anchor: 'field', radius: 10, durationMs: 1000, tickMs: 200, maxTargets: 8, delayMs: 0}},
    {...base, effect: 'area', area: {mode: 'vortex', radius: 4, durationMs: 1000, tickMs: 200, maxTargets: 2, delayMs: 0, moveSpeed: 4, pullStrength: 0.3}},
  ];
  for (const spec of specs) {
    const c = setup(['duration', 'capacity'], spec).compile();
    const geometry = c.beam ?? c.area ?? c.impact;
    assert.ok(geometry && 'durationMs' in geometry);
    near(geometry.durationMs, 1300);
    assert.equal(geometry.maxTargets, spec.area?.anchor === 'field' ? 10 : 4);
    if (c.area?.mode === 'vortex') {assert.equal(c.area.moveSpeed, 4); assert.equal(c.area.pullStrength, 0.3);}
    const capped = setup(['duration', 'capacity'], {...spec,
      ...(spec.beam ? {beam: {...spec.beam, durationMs: 4900, maxTargets: 8}} : {}),
      ...(spec.area ? {area: {...spec.area, durationMs: 4900, maxTargets: spec.area.anchor === 'field' ? 64 : 8}} : {}),
      ...(spec.impact?.type === 'field' ? {impact: {...spec.impact, durationMs: 4900, maxTargets: 8}} : {}),
    }, 'mythic').compile();
    const cappedGeometry = capped.beam ?? capped.area ?? capped.impact!;
    assert.ok('durationMs' in cappedGeometry); assert.equal(cappedGeometry.durationMs, 5000);
    assert.equal(capped.modifierItemIds.includes('capacity'), false);
  }
  const strike = setup(['duration'], {...base, effect: 'area', area: {mode: 'strike', radius: 4, durationMs: 400, maxTargets: 2, delayMs: 100}}).compile();
  assert.equal(strike.area!.durationMs, 400); assert.deepEqual(strike.modifierItemIds, []);
});

test('adjacent duration and capacity modifiers also affect a multi-stage spell without changing its catalog', () => {
  const spec: SpellDefinition = {...base, effect: 'area', area: {
    mode: 'strike', radius: 4, durationMs: 300, maxTargets: 2, delayMs: 100,
    finish: {mode: 'strike', radius: 8, durationMs: 300, maxTargets: 3, powerMultiplier: 2,
      next: {mode: 'field', radius: 8, durationMs: 1000, maxTargets: 2, powerMultiplier: .2}},
  }};
  const {content, compile} = setup(['duration', 'capacity'], spec);
  const before = structuredClone(content.spells.test.area);
  const area = compile().area!;
  assert.equal(area.durationMs, 300);
  assert.equal(area.maxTargets, 4);
  assert.equal(area.finish!.maxTargets, 5);
  assert.equal(area.finish!.next!.maxTargets, 4);
  near(area.finish!.next!.durationMs, 1300);
  assert.deepEqual(content.spells.test.area, before);
});

test('compiled on-hit arcana reach real contacts and periodic burn; precision changes the emitted attack roll', () => {
  let {state, content} = setup(['slow', 'burn', 'knockback', 'precision']);
  state.characters[0].baseStats!.accuracy = 0.9;
  state.phase = 'battle'; state.wave = 1;
  state.entities = [{id: 'target', definitionId: 'enemy-basic', kind: 'enemy', faction: 'enemy',
    x: 50, y: 75, hp: 1000, maxHp: 1000, damage: 0, speed: 0, range: 0, cooldownMs: 1000, attackRemainingMs: 1000}];
  state = stepBattle(state, 1, content).state;
  assert.equal(state.entities.find(entity => entity.kind === 'projectile')!.attackRoll!.accuracy, 1);
  for (let i = 0; i < 30 && !state.entities[0].status?.burns?.length; i++) state = stepBattle(state, 50, content).state;
  assert.equal(state.entities[0].status!.slow!.multiplier, 0.75);
  assert.equal(state.entities[0].status!.burns!.length, 1);
  assert.ok(state.events.some(event => event.type === 'knockback'));
  assert.ok(state.entities[0].y < 75);
  state.wands[0].placements = [];
  const hp = state.entities[0].hp;
  const pulse = stepBattle(state, 500, content);
  assert.ok(pulse.state.entities[0].hp < hp);
  assert.ok(pulse.events.some(event => event.type === 'damage' && event.data.statusType === 'burn'));
});

test('pierce plus capacity hits four real targets and duration extends the spawned beam', () => {
  let {state, content} = setup(['pierce', 'capacity'], {...base, cooldownMs: 10000});
  state.phase = 'battle'; state.wave = 1; state.characters[0].baseStats!.accuracy = 1;
  state.entities = Array.from({length: 4}, (_, index) => ({id: `target-${index}`, definitionId: 'enemy-basic',
    kind: 'enemy' as const, faction: 'enemy' as const, x: 50, y: 76-index*6, hp: 1000, maxHp: 1000,
    damage: 0, speed: 0, range: 0, cooldownMs: 1000, attackRemainingMs: 1000}));
  for (let i = 0; i < 25; i++) state = stepBattle(state, 50, content).state;
  assert.equal(state.entities.filter(entity => entity.kind === 'enemy' && entity.hp < 1000).length, 4);
  const beam = setup(['duration', 'capacity'], {...base, effect: 'beam', beam: {width: 2, durationMs: 1000, tickMs: 200, maxTargets: 2}});
  beam.state.phase = 'battle'; beam.state.wave = 1;
  beam.state.entities = [{id: 'target', definitionId: 'enemy-basic', kind: 'enemy', faction: 'enemy',
    x: 50, y: 75, hp: 1000, maxHp: 1000, damage: 0, speed: 0, range: 0, cooldownMs: 1000, attackRemainingMs: 1000}];
  const emitted = stepBattle(beam.state, 1, beam.content).state.entities.find(entity => entity.kind === 'beam');
  assert.ok(emitted); assert.equal(emitted.maxTargets, 4); near(emitted.remainingMs!, 1300);
});

test('construct snapshots grow HP uniformly and distinguish attack from support while extending lifetime and capacity', () => {
  for (const behavior of ['attack', 'heal', 'shield'] as const) {
    const definition: SpellDefinition = {...base, effect: 'summon', power: 10, hp: 100,
      construct: {behavior, hp: 100, durationMs: 10000, attackIntervalMs: 1000, maxAlive: 2, attackMode: 'projectile'}};
    const fixture = setup(Object.keys(positions), definition);
    fixture.state.items.spell.grade = 'rare';
    fixture.state.characters[0].baseStats!.attack = 10;
    fixture.state.characters[0].baseStats!.elementBonuses = {fire: 0.2};
    fixture.state.runBonuses = {attackPercent: 20};
    const before = structuredClone(fixture.content);
    const spell = fixture.compile();
    near(spell.construct!.hp, 180); near(spell.hp!, 180);
    assert.equal(spell.construct!.durationMs, 13000);
    assert.equal(spell.construct!.maxAlive, 4);
    assert.equal(spell.construct!.attackIntervalMs, 1000);
    near(spell.power, behavior === 'attack' ? 36 : 18);
    assert.equal(Boolean(spell.onHit), behavior === 'attack');
    near(spell.attackRoll.accuracy, behavior === 'attack' ? 0.8 : 0.7);
    assert.equal(spell.impact, undefined);
    assert.deepEqual(fixture.content, before);
    spell.construct!.hp = 1;
    assert.equal(fixture.content.spells.test.construct!.hp, 100);
    fixture.content.spells.test.construct!.durationMs = 1;
    assert.equal(spell.construct!.durationMs, 13000);
  }
});

test('each new arcana is selectable from the ordinary reward pool and claimable into the real inventory', () => {
  const content: ContentCatalog = {...demoContent, arcana: {...demoContent.arcana, ...expandedArcana}};
  const offers = fillUniqueRewardOffers([], {content, wave: 3, characterCount: 3, wandCount: 6, random: () => 0.5}, 1000);
  for (const id of Object.keys(positions)) {
    const offer = offers.find(candidate => candidate.kind === 'item' && candidate.definitionId === id);
    assert.ok(offer, id);
    assert.ok(offer.description, id);
    const seed = createGameRuntime(content).checkpoint();
    seed.state.phase = 'reward'; seed.state.rewards = [offer];
    const runtime = createGameRuntime(content, seed);
    assert.equal(runtime.dispatch({id: `claim-${id}`, type: 'claimReward', rewardId: offer.id}).status, 'executed');
    const after = runtime.getState();
    assert.ok(after.backpack.some(itemId => after.items[itemId].definitionId === id));
  }
});
