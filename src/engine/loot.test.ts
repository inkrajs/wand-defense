import assert from 'node:assert/strict';
import test from 'node:test';
import type { CombatEntity, ContentCatalog, GameState } from '../contracts';
import { createGearFromDefinition } from '../content/gear';
import { demoContent } from '../content/demo';
import { createSupplyFromDefinition } from '../content/supplies';
import { createFixtureState } from '../runtime/mock';
import { collectWaveLoot, pickupGroundLoot, spawnEnemyLoot } from './loot';

function fixture(): GameState {
  const state = createFixtureState();
  state.gear = {};
  state.supplies = {};
  state.knowledge.gearIds = [];
  state.knowledge.itemIds = [];
  return state;
}

function content({ gear = true, supplies = true }: { gear?: boolean; supplies?: boolean } = {}): ContentCatalog {
  return {
    spells: {}, arcana: {}, recipes: [], sequences: {},
    gear: gear ? structuredClone(demoContent.gear) : {},
    items: supplies ? structuredClone(demoContent.items) : {},
  };
}

function enemy(overrides: Partial<CombatEntity> = {}): CombatEntity {
  return {
    id: 'enemy-1', definitionId: 'enemy-basic', kind: 'enemy', faction: 'enemy',
    x: 23, y: 45, hp: 0, maxHp: 10, damage: 1, speed: 1, range: 1,
    cooldownMs: 1_000, attackRemainingMs: 0, ...overrides,
  };
}

function capture(state: GameState, target: CombatEntity, luck = 0, catalog = content()) {
  const events: Array<{ type: string; data: Record<string, unknown> }> = [];
  const emit = (type: string, data: Record<string, unknown>) => events.push({ type, data });
  spawnEnemyLoot(state, target, luck, catalog, emit);
  collectWaveLoot(state, emit);
  return events.filter(event => event.type === "lootGranted");
}

function firstRandom(seed: number): { seed: number; value: number } {
  const next = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
  return { seed: next, value: next / 0x1_0000_0000 };
}

function seedForRoll(predicate: (value: number, nextSeed: number) => boolean): number {
  for (let seed = 0; seed < 100_000; seed++) {
    const roll = firstRandom(seed);
    if (predicate(roll.value, roll.seed)) return seed;
  }
  throw new Error('No matching deterministic seed');
}

test('living, non-enemy, and non-finite-health entities do not roll or grant drops', () => {
  const cases = [
    enemy({ hp: 1 }),
    enemy({ faction: 'player' }),
    enemy({ kind: 'projectile' }),
    enemy({ hp: Number.NaN }),
    enemy({ hp: Number.NEGATIVE_INFINITY }),
  ];
  for (const target of cases) {
    const state = fixture();
    const before = structuredClone(state);
    assert.deepEqual(capture(state, target), []);
    assert.deepEqual(state, before);
  }
});

test('prototype property names do not receive a fake boss guarantee', () => {
  const catalog = content({ supplies: false });
  for (const definitionId of ['constructor', 'toString', '__proto__']) {
    const state = fixture();
    state.gear = { old: createGearFromDefinition(catalog.gear!['apprentice-hat'], 'old') };
    state.rngState = seedForRoll(value => value > 0.3);
    assert.deepEqual(capture(state, enemy({ definitionId }), 0, catalog), []);
    assert.deepEqual(Object.keys(state.gear), ['old']);
  }
});

test('first real kill guarantees one catalog gear and stores it outside spell inventory', () => {
  const state = fixture();
  const catalog = content({ supplies: false });
  const target = enemy({ x: 31, y: 77, hp: -1 });
  const events = capture(state, target, 0, catalog);
  assert.equal(Object.keys(state.gear!).length, 1);
  assert.equal(Object.keys(state.supplies!).length, 0);
  assert.equal(state.backpack.includes(Object.keys(state.gear!)[0]), false);
  assert.equal(state.items[Object.keys(state.gear!)[0]], undefined);
  assert.deepEqual(state.knowledge.gearIds, [(Object.values(state.gear!)[0]).definitionId]);
  assert.deepEqual(events, [{
    type: 'lootGranted',
    data: {
      enemyId: target.id, kind: 'gear', instanceId: Object.keys(state.gear!)[0],
      definitionId: (Object.values(state.gear!)[0]).definitionId,
      grade: (Object.values(state.gear!)[0]).grade, x: 31, y: 77,
    },
  }]);
});

test('gear drops accept only single-cell origin shapes while supplies keep their own shape rules', () => {
  const catalog = content({ supplies: false });
  const valid = structuredClone(demoContent.gear!['apprentice-hat']);
  const multiCell = structuredClone(demoContent.gear!['copper-ring']);
  multiCell.shape = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
  const offsetCell = structuredClone(demoContent.gear!['rune-robe']);
  offsetCell.shape = [{ x: 1, y: 0 }];
  catalog.gear = { 'apprentice-hat': valid, 'copper-ring': multiCell, 'rune-robe': offsetCell };
  const state = fixture();
  const events = capture(state, enemy({ definitionId: 'boss-minor' }), 0, catalog);
  assert.equal(events.length, 1);
  assert.equal(events[0].data.definitionId, 'apprentice-hat');

  const invalidOnly = content({ supplies: false });
  invalidOnly.gear = { 'copper-ring': multiCell, 'rune-robe': offsetCell };
  const empty = fixture();
  const rng = empty.rngState;
  assert.deepEqual(capture(empty, enemy({ definitionId: 'boss-apex' }), 0, invalidOnly), []);
  assert.equal(empty.rngState, rng);

  const supplyContent = content({ gear: false, supplies: false });
  supplyContent.items = { 'shield-potion': demoContent.items!['shield-potion'] };
  const supplyState = fixture();
  supplyState.rngState = seedForRoll(value => value < 0.04);
  const supplyEvents = capture(supplyState, enemy(), 0, supplyContent);
  assert.equal(supplyEvents.length, 1);
  assert.equal(supplyEvents[0].data.definitionId, 'shield-potion');
});

test('gear drops are deterministic for equal saved seeds', () => {
  const left = fixture();
  const right = structuredClone(left);
  left.rngState = right.rngState = 91_337;
  const target = enemy({ hp: 0 });
  const leftEvents = capture(left, target, 4, content({ supplies: false }));
  const rightEvents = capture(right, target, 4, content({ supplies: false }));
  assert.deepEqual(leftEvents, rightEvents);
  assert.deepEqual(left.gear, right.gear);
  assert.equal(left.rngState, right.rngState);
});

test('repeated definitions stay deduplicated in gear and supply knowledge', () => {
  const catalog = content({ supplies: false });
  catalog.gear = { 'apprentice-hat': demoContent.gear!['apprentice-hat'] };
  const gearState = fixture();
  gearState.knowledge.gearIds = ['apprentice-hat'];
  const gearEvents = capture(gearState, enemy({ definitionId: 'boss-minor' }), 0, catalog);
  assert.equal(gearEvents.length, 1);
  assert.deepEqual(gearState.knowledge.gearIds, ['apprentice-hat']);

  const supplyCatalog = content({ gear: false, supplies: false });
  supplyCatalog.items = { 'health-potion': demoContent.items!['health-potion'] };
  const supplyState = fixture();
  supplyState.knowledge.itemIds = ['health-potion'];
  const supplyEvents = capture(supplyState, enemy({ definitionId: 'boss-apex' }), 0, supplyCatalog);
  assert.equal(supplyEvents.length, 1);
  assert.deepEqual(supplyState.knowledge.itemIds, ['health-potion']);
});

test('luck raises the ordinary gear chance while previous discovery prevents repeated first-gear guarantees', () => {
  const seed = seedForRoll(value => value > 0.08 && value < 0.28);
  const catalog = content({ supplies: false });
  const plain = fixture();
  const lucky = fixture();
  for (const state of [plain, lucky]) {
    state.gear = { old: createGearFromDefinition(catalog.gear!['apprentice-hat'], 'old') };
    state.rngState = seed;
  }
  assert.deepEqual(capture(plain, enemy(), 0, catalog), []);
  const luckyEvents = capture(lucky, enemy(), 200, catalog);
  assert.equal(luckyEvents.length, 1);
  assert.equal(luckyEvents[0].data.kind, 'gear');

  const allLost = fixture();
  allLost.knowledge.gearIds = ['apprentice-hat'];
  allLost.rngState = seedForRoll(value => value > 0.08);
  assert.deepEqual(capture(allLost, enemy(), 0, catalog), []);
  assert.deepEqual(allLost.gear, {});
});

test('ordinary supply chance stays independent and uses only own item definitions', () => {
  const catalog = content({ gear: false, supplies: false });
  const definition = demoContent.items!['health-potion'];
  catalog.items = { 'health-potion': definition };
  const state = fixture();
  state.rngState = seedForRoll(value => value < 0.04);
  const events = capture(state, enemy(), 0, catalog);
  assert.equal(events.length, 1);
  assert.equal(events[0].data.kind, 'item');
  assert.equal(events[0].data.definitionId, 'health-potion');
  assert.equal(Object.keys(state.gear!).length, 0);
  assert.equal(Object.keys(state.supplies!).length, 1);
  assert.deepEqual(state.knowledge.itemIds, ['health-potion']);

  const inherited = content({ gear: false, supplies: false });
  inherited.items = Object.create({ hidden: definition }) as NonNullable<ContentCatalog['items']>;
  const empty = fixture();
  const oldRng = empty.rngState;
  assert.deepEqual(capture(empty, enemy({ definitionId: 'boss-apex' }), 0, inherited), []);
  assert.equal(empty.rngState, oldRng);
  assert.deepEqual(empty.supplies, {});
});

test('bosses receive guaranteed loot with rarity floors, preferring available gear', () => {
  for (const [definitionId, floor] of [['boss-minor', 'rare'], ['boss-major', 'epic'], ['boss-apex', 'legendary']] as const) {
    const state = fixture();
    const catalog = content({ gear: false });
    const events = capture(state, enemy({ definitionId, hp: -1 }), 0, catalog);
    assert.equal(events.length, 1);
    assert.equal(events[0].data.kind, 'item');
    const instance = Object.values(state.supplies!)[0];
    assert.ok(gradeOrderIndex(instance.grade) >= gradeOrderIndex(floor));
  }

  const state = fixture();
  const catalog = content();
  state.rngState = seedForRoll(value => value < 0.04);
  const events = capture(state, enemy({ id: 'boss-with-two-drops', definitionId: 'boss-apex' }), 0, catalog);
  assert.ok(events.some(event => event.data.kind === 'gear'));
  assert.ok(events.some(event => event.data.kind === 'item'));
  assert.equal(events.filter(event => event.data.kind === 'gear').length, 1);
  assert.equal(events.filter(event => event.data.kind === 'item').length, 1);
  assert.ok(Object.values(state.gear!).every(instance => gradeOrderIndex(instance.grade) >= gradeOrderIndex('legendary')));
  assert.ok(Object.values(state.supplies!).every(instance => gradeOrderIndex(instance.grade) >= gradeOrderIndex('legendary')));
});

function gradeOrderIndex(grade: string): number {
  return ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].indexOf(grade);
}

test('generated ids avoid keys and actual ids in every registry plus backpack', () => {
  const base = 'loot-gear-0-1';
  const catalog = content({ supplies: false });
  const installers: Array<(state: GameState) => void> = [
    state => { state.items[base] = { ...state.items['spark-1'], id: base }; },
    state => { state.gear = { stale: createGearFromDefinition(catalog.gear!['apprentice-hat'], base) }; },
    state => { state.supplies![base] = createSupplyFromDefinition(demoContent.items!['health-potion'], base); },
    state => { state.wands.push({ ...state.wands[0], id: base, characterId: null }); },
    state => { state.characters.push({ ...state.characters[0], id: base, wandIds: [] }); },
    state => { state.entities.push(enemy({ id: base, hp: 10 })); },
    state => { state.backpack.push(base); },
  ];
  for (const install of installers) {
    const state = fixture();
    install(state);
    const before = structuredClone(state);
    const events = capture(state, enemy({ id: 'collision' , definitionId: 'boss-minor' }), 0, catalog);
    const createdId = events[0].data.instanceId;
    assert.notEqual(createdId, base);
    if (state.gear && before.gear && Object.hasOwn(before.gear, 'stale')) {
      assert.deepEqual(state.gear.stale, before.gear.stale);
    }
  }
});

test('empty or invalid catalogs cannot fabricate drops; registry and knowledge remain untouched', () => {
  const state = fixture();
  state.wave = 20;
  state.rngState = seedForRoll(value => value < .005);
  const emptyContent = content({ gear: false, supplies: false });
  const before = structuredClone(state);
  const rng = state.rngState;
  assert.deepEqual(capture(state, enemy({ definitionId: 'boss-apex' }), 100, emptyContent), []);
  assert.deepEqual(state, before);
  assert.equal(state.rngState, rng);

  const invalid = content({ gear: false, supplies: false });
  invalid.gear = { fake: { ...demoContent.gear!['apprentice-hat'], id: 'different' } };
  invalid.items = { fake: { ...demoContent.items!['health-potion'], id: 'different' } };
  assert.deepEqual(capture(state, enemy(), 0, invalid), []);
  assert.deepEqual(state.gear, {});
  assert.deepEqual(state.supplies, {});
  assert.equal(state.rngState, rng);
});


test('ground gear remains undiscovered, counts toward first-gear guarantee, and is awarded once', () => {
  const state = fixture(), catalog = content({ supplies: false });
  const events: Array<{ type: string; data: Record<string, unknown> }> = [];
  const emit = (type: string, data: Record<string, unknown>) => events.push({type, data});
  spawnEnemyLoot(state, enemy(), 0, catalog, emit);
  assert.deepEqual(Object.keys(state.gear!), []);
  assert.deepEqual(state.knowledge.gearIds, []);
  const [gear] = state.groundLoot!;
  assert.equal(gear.kind, 'gear');
  assert.deepEqual([gear.x, gear.y], [23,45]);
  assert.deepEqual(events.map(event => event.type), ['lootSpawned']);
  state.rngState = seedForRoll(value => value > .3);
  spawnEnemyLoot(state, enemy({id:'enemy-2'}), 0, catalog, emit);
  assert.equal(state.groundLoot!.length, 1);
  assert.equal(pickupGroundLoot(state, gear.id, emit), true);
  assert.equal(pickupGroundLoot(state, gear.id, emit), false);
  assert.deepEqual(state.gear![gear.id], gear.instance);
  assert.deepEqual(state.knowledge.gearIds, [gear.definitionId]);
  assert.deepEqual(events.map(event => event.type), ['lootSpawned','lootCollected','lootGranted']);
  assert.equal(events[1].data.reason, 'pickup');
  assert.deepEqual(events[1].data.instance, gear.instance);
});

test('wand drops are wave gated, do not equip on pickup, and allow the rare larger template later', () => {
  const catalog = content({ gear:false, supplies:true });
  const first = seedForRoll((supply, afterSupply) => supply >= .04 && firstRandom(afterSupply).value < .005);
  const state = fixture();state.wave=7;state.rngState=first;
  spawnEnemyLoot(state,enemy(),0,catalog,()=>{});
  assert.equal(state.groundLoot,undefined);
  state.wave=8;
  state.rngState=first;
  spawnEnemyLoot(state,enemy(),0,catalog,()=>{});
  const wand=state.groundLoot![0];
  assert.equal(wand.kind,'wand');assert.equal(wand.definitionId,'wand-4x4');
  assert.equal(state.wands.length,1);assert.equal(state.knowledge.wandIds,undefined);
  collectWaveLoot(state,()=>{});
  assert.equal(state.wands.length,2);assert.equal(state.wands[1].characterId,null);
  assert.deepEqual(state.knowledge.wandIds,['wand-4x4']);
  const later=fixture();later.wave=20;
  later.rngState = seedForRoll((supply, afterSupply) => {
    const wand = firstRandom(afterSupply);
    const grade = firstRandom(wand.seed);
    const template = firstRandom(grade.seed);
    return supply >= .04 && wand.value < .005 && template.value < .15;
  });
  spawnEnemyLoot(later,enemy(),0,catalog,()=>{});
  assert.equal(later.groundLoot?.[0]?.definitionId,'wand-5x5');
});
