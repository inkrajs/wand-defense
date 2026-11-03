import test from 'node:test';
import assert from 'node:assert/strict';
import type { ContentCatalog } from '../contracts';
import { createFixtureState } from '../runtime/mock';
import { compileWand } from './compile';

const content: ContentCatalog = {
  spells: { spark: {
    id: 'spark', name: 'Spark', level: 1, grade: 'common', element: 'fire',
    shape: [{ x: 0, y: 0 }], asset: { key: 'spark', label: 'Spark' },
    effect: 'projectile', power: 10, manaCost: 4, cooldownMs: 1000, range: 10,
  } },
  arcana: {
    amplify: {
      id: 'amplify', name: 'Amplify', level: 1, grade: 'common',
      shape: [{ x: 0, y: 0 }], asset: { key: 'amplify', label: 'Amplify' }, modifier: 'amplify', value: 2,
    },
    focus: {
      id: 'focus', name: 'Focus', level: 1, grade: 'common',
      shape: [{ x: 0, y: 0 }], asset: { key: 'focus', label: 'Focus' }, modifier: 'focus', value: 1.5,
    },
  },
  recipes: [],
  sequences: { 'fire-9': {
    id: 'fire-9', pathwayId: 'fire', number: 9, name: 'Fire', bonuses: { fire: 0.1 }, requirements: [],
  } },
};

test('neutral actor stats preserve the prior compiled spell values', () => {
  const state = createFixtureState();
  const spell = compileWand(state, 'wand-1', content)!.spells[0];
  assert.equal(spell.power, 11);
  assert.equal(spell.speed, 72);
  assert.equal(spell.range, 10);
  assert.equal(spell.cooldownMs, 1000);
  assert.deepEqual(spell.attackRoll, { accuracy: 1, critChance: 0, critMultiplier: 1.5, sourceLuck: 0 });
});

test('actor, gear, arcana, grade, sequence, and run stats each affect the compiled attack once', () => {
  const state = createFixtureState();
  state.characters[0].baseStats = {
    attack: 2, castSpeedPercent: 0, range: 1, accuracy: 0.8, critChance: 0.25,
    critMultiplier: 2, luck: 3, elementBonuses: { fire: 0.05 },
  };
  state.characters[0].gearIds = { accessory: 'gear-1' };
  state.items['spark-1'].grade = 'uncommon';
  state.gear = { 'gear-1': {
    id: 'gear-1', name: 'Charm', slot: 'accessory', characterId: 'character-1', level: 1, grade: 'common',
    statBonuses: { attack: 2, range: 2, accuracy: 0.05, critChance: 0.05, critMultiplier: 0.5, luck: 1, elementBonuses: { fire: 0.05 } },
  } };
  state.runBonuses = { attackPercent: 50, rangePercent: 50, cooldownPercent: 20 };
  state.wands[0].placements.push({ itemId: 'amplify-1', x: 1, y: 0, rotation: 0 });
  state.items['focus-1'] = { id: 'focus-1', definitionId: 'focus', kind: 'arcana', level: 1, grade: 'common' };
  state.wands[0].placements.push({ itemId: 'focus-1', x: 0, y: 1, rotation: 0 });
  state.items['spark-2'] = { ...state.items['spark-1'], id: 'spark-2' };
  state.wands[0].placements.push({ itemId: 'spark-2', x: 0, y: 2, rotation: 0 });
  const before = structuredClone({ state, catalog: content });

  const compiled = compileWand(state, 'wand-1', content)!;
  const spell = compiled.spells[0];

  // (10 base * 1.25 grade * 1.5 attack multiplier + 6 flat attack) * amplify 2 * focus 1.5 * (1 + .21 combined element bonus)
  assert.ok(Math.abs(spell.power - 89.8425) < 1e-9);
  assert.equal(spell.range, 29.25); // (10 * 1.5 range multiplier + 4.5 flat range) * focus 1.5
  assert.equal(spell.cooldownMs, 800);
  assert.ok(Math.abs(spell.attackRoll.accuracy - 0.85) < 1e-12);
  assert.equal(spell.attackRoll.critChance, 0.3);
  assert.equal(spell.attackRoll.critMultiplier, 2.5);
  assert.equal(spell.attackRoll.sourceLuck, 4);
  assert.notStrictEqual(spell.attackRoll, compiled.spells[1].attackRoll);
  spell.attackRoll.accuracy = 0;
  assert.ok(compiled.spells[1].attackRoll.accuracy > 0);
  assert.deepEqual({ state, catalog: content }, before);
});

test('beam receives actor attack while healing and shielding retain grade and element scaling only', () => {
  const state = createFixtureState();
  state.characters[0].baseStats = {
    attack: 5, castSpeedPercent: 0, range: 0, accuracy: 0.7, critChance: 0.1,
    critMultiplier: 1.5, luck: 2, elementBonuses: {},
  };
  state.runBonuses = { attackPercent: 100 };
  const catalog = structuredClone(content);
  catalog.spells.spark.effect = 'beam';
  catalog.spells.spark.beam = { width: 2, durationMs: 500, tickMs: 100, maxTargets: 3 };
  const before = structuredClone(content);
  const beam = compileWand(state, 'wand-1', catalog)!.spells[0];
  assert.equal(beam.power, 33); // (10 * 2 + 10) * 1.1 sequence

  for (const effect of ['heal', 'shield'] as const) {
    catalog.spells.spark.effect = effect;
    delete catalog.spells.spark.beam;
    assert.equal(compileWand(state, 'wand-1', catalog)!.spells[0].power, 11);
  }
  assert.deepEqual(content, before);
});

test('projectile travel speed uses actor and gear bonuses independently of cast speed', () => {
  const state = createFixtureState();
  state.characters[0].baseStats = {
    attack: 0, castSpeedPercent: 0, range: 0, projectileSpeedPercent: 25,
    accuracy: 1, critChance: 0, critMultiplier: 1.5, luck: 0, elementBonuses: {},
  };
  state.characters[0].gearIds = { accessory: 'speed-gear' };
  state.gear = { 'speed-gear': {
    id: 'speed-gear', name: 'Wind Charm', slot: 'accessory', characterId: 'character-1', level: 1, grade: 'common',
    statBonuses: { projectileSpeedPercent: 50 },
  } };
  const catalog = structuredClone(content);
  catalog.spells.spark.speed = 80;

  const ordinaryCasting = compileWand(state, 'wand-1', catalog)!.spells[0];
  assert.equal(ordinaryCasting.speed, 140); // 80 * (1 + (25 + 50) / 100)
  assert.equal(ordinaryCasting.cooldownMs, 1000);

  delete catalog.spells.spark.speed;
  assert.equal(compileWand(state, 'wand-1', catalog)!.spells[0].speed, 126); // fallback 72 gets the same actor multiplier
  catalog.spells.spark.speed = 80;

  const fasterCastingState = structuredClone(state);
  fasterCastingState.characters[0].baseStats!.castSpeedPercent = 25;
  const fasterCasting = compileWand(fasterCastingState, 'wand-1', catalog)!.spells[0];
  assert.equal(fasterCasting.speed, ordinaryCasting.speed);
  assert.equal(fasterCasting.cooldownMs, 800);
});

test('projectile speed bonuses do not modify beam, heal, or shield speed', () => {
  const state = createFixtureState();
  state.characters[0].baseStats = {
    attack: 0, castSpeedPercent: 0, range: 0, projectileSpeedPercent: 100,
    accuracy: 1, critChance: 0, critMultiplier: 1.5, luck: 0, elementBonuses: {},
  };
  const catalog = structuredClone(content);
  catalog.spells.spark.speed = 80;
  for (const effect of ['beam', 'heal', 'shield'] as const) {
    catalog.spells.spark.effect = effect;
    const compiled = compileWand(state, 'wand-1', catalog)!.spells[0];
    assert.equal(compiled.speed, 80);
  }
});

test('compiled spell clones impact and beam data and gives each spell an independent attack roll', () => {
  const state = createFixtureState();
  state.items['spark-2'] = { ...state.items['spark-1'], id: 'spark-2' };
  state.wands[0].placements.push({ itemId: 'spark-2', x: 1, y: 0, rotation: 0 });
  const catalog = structuredClone(content);
  catalog.spells.spark.impact = { type: 'pierce', maxTargets: 2, falloff: 0.5 };
  catalog.spells.spark.beam = { width: 2, durationMs: 500, tickMs: 100, maxTargets: 3 };
  const before = structuredClone(catalog);
  const spells = compileWand(state, 'wand-1', catalog)!.spells;
  assert.notStrictEqual(spells[0].attackRoll, spells[1].attackRoll);
  spells[0].attackRoll.accuracy = 0;
  spells[0].impact!.maxTargets = 9;
  spells[0].beam!.width = 9;
  assert.equal(spells[1].attackRoll.accuracy, 1);
  assert.deepEqual(catalog, before);
});
