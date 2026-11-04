import assert from 'node:assert/strict';
import test from 'node:test';
import type { Command, GameState } from '../contracts';
import { demoContent } from '../content/demo';
import { createGearFromDefinition } from '../content/gear';
import { createSupplyFromDefinition } from '../content/supplies';
import { createWandFromTemplate } from '../content/wands';
import { getCharacterStats } from '../content/characters';
import { experienceThreshold } from '../content/progression';
import { compileWand } from '../loadout';
import { createGameRuntime } from './index';
import { CHEAT_TARGET_LEVEL } from './cheatCatalog';
import { spawnProjectiles } from '../engine/projectiles';
import { dispatchRemote } from '../agent/protocol';

const grants = ['grantAllMagic', 'grantAllWands', 'grantAllGear', 'grantAllSupplies'] as const;
const maxima = ['maxMagic', 'maxWands', 'maxGear', 'maxSupplies'] as const;
function seed() {
  const checkpoint = createGameRuntime().checkpoint();
  const state = checkpoint.state;
  state.cheats = {unlocked: true, enabled: true};
  state.coins = 123; state.gameTimeMs = 456; state.wave = 7;
  state.territory.hp = 61; state.territory.shield = 17;
  state.characters[0].mana = 12;
  state.wands[0].cooldowns = {'spark-1': 321};
  const wand = createWandFromTemplate('wand-5x5', 'existing-5x5')!;
  wand.characterId = state.characters[0].id;
  state.wands.push(wand); state.characters[0].wandIds.push(wand.id);
  const gear = createGearFromDefinition(demoContent.gear!['apprentice-hat'], 'existing-hat', 'rare');
  gear.characterId = state.characters[0].id;
  state.gear = {[gear.id]: gear}; state.characters[0].gearIds = {head: gear.id};
  const supply = createSupplyFromDefinition(demoContent.items!['health-potion'], 'existing-potion', 'epic');
  state.supplies = {[supply.id]: supply};
  return checkpoint;
}
function preservation(state: GameState) {
  return {coins: state.coins, wave: state.wave, phase: state.phase, rngState: state.rngState, gameTimeMs: state.gameTimeMs,
    paused: state.paused, backpackOpen: state.backpackOpen, territory: state.territory, characters: state.characters,
    xp: state.xp, playerLevel: state.playerLevel, rewardHistory: state.rewardHistory, rewards: state.rewards};
}

test('all new actions keep locked and disabled runtime states unchanged', () => {
  for (const cheats of [{unlocked: false, enabled: false}, {unlocked: true, enabled: false}]) {
    const checkpoint = seed(); checkpoint.state.cheats = cheats;
    const runtime = createGameRuntime(demoContent, checkpoint);
    for (const action of [...grants, ...maxima, 'levelCharacter'] as const) {
      const before = runtime.getState();
      const command: Command = action === 'levelCharacter'
        ? {id: action, type: 'cheat', action, characterId: 'character-1'}
        : {id: action, type: 'cheat', action};
      assert.equal(runtime.dispatch(command).status, 'rejected');
      assert.deepEqual(runtime.getState(), before);
    }
  }
});

test('catalog grants fill only missing definitions, preserve equipped instances and survive receipt replay and refresh', () => {
  const runtime = createGameRuntime(demoContent, seed());
  const before = runtime.getState();
  for (const action of grants) assert.equal(runtime.dispatch({id: action, type: 'cheat', action}).status, 'executed');
  const after = runtime.getState();
  assert.deepEqual(preservation(after), preservation(before));
  for (const [id, item] of Object.entries(before.items)) assert.deepEqual(after.items[id], item);
  for (const wand of before.wands) assert.deepEqual(after.wands.find(value => value.id === wand.id), wand);
  assert.deepEqual(after.gear!['existing-hat'], before.gear!['existing-hat']);
  assert.deepEqual(after.supplies!['existing-potion'], before.supplies!['existing-potion']);
  for (const id of Object.keys(demoContent.spells)) assert.equal(Object.values(after.items).filter(item => item.kind === 'spell' && item.definitionId === id).length, 1, id);
  for (const id of Object.keys(demoContent.arcana)) assert.equal(Object.values(after.items).filter(item => item.kind === 'arcana' && item.definitionId === id).length, 1, id);
  for (const id of Object.keys(demoContent.gear!)) assert.equal(Object.values(after.gear!).filter(item => item.definitionId === id).length, 1, id);
  for (const id of Object.keys(demoContent.items!)) assert.equal(Object.values(after.supplies!).filter(item => item.definitionId === id).length, 1, id);
  assert.equal(after.wands.length, 3);
  assert.equal(after.wands.filter(wand => wand.width === 5 && wand.height === 5).length, 1);
  assert.equal(after.wands.filter(wand => wand.width === 4 && wand.height === 4).length, 1);
  assert.equal(new Set([...Object.keys(after.items), ...Object.keys(after.gear!), ...Object.keys(after.supplies!), ...after.wands.map(wand => wand.id)]).size,
    Object.keys(after.items).length + Object.keys(after.gear!).length + Object.keys(after.supplies!).length + after.wands.length);
  assert.equal(after.runStatistics!.spellsAcquired - before.runStatistics!.spellsAcquired, Object.keys(demoContent.spells).length - 1);
  assert.equal(after.runStatistics!.arcanaAcquired - before.runStatistics!.arcanaAcquired, Object.keys(demoContent.arcana).length - 1);
  for (const recipe of demoContent.recipes) assert.ok(after.knowledge.recipeIds.includes(recipe.id));
  const refresh = createGameRuntime(demoContent, runtime.checkpoint());
  for (const action of grants) {
    const preReplay = refresh.checkpoint();
    assert.equal(refresh.dispatch({id: action, type: 'cheat', action}).status, 'executed');
    assert.deepEqual(refresh.checkpoint(), preReplay);
    assert.equal(refresh.dispatch({id: `${action}-again`, type: 'cheat', action}).status, 'executed');
  }
  const repeated = refresh.getState();
  assert.deepEqual(repeated.items, after.items); assert.deepEqual(repeated.backpack, after.backpack);
  assert.deepEqual(repeated.wands, after.wands); assert.deepEqual(repeated.gear, after.gear); assert.deepEqual(repeated.supplies, after.supplies);
  assert.deepEqual(repeated.runStatistics, after.runStatistics);
});

test('max actions set the preview target without downgrading, changing grade or manufacturing combat multipliers', () => {
  const checkpoint = seed();
  checkpoint.state.items['spark-1'].level = 75;
  checkpoint.state.items['amplify-1'].grade = 'mythic';
  checkpoint.state.wands[0].level = 75;
  checkpoint.state.gear!['existing-hat'].level = 75;
  checkpoint.state.supplies!['existing-potion'].level = 75;
  checkpoint.state.gear!['low-gear'] = createGearFromDefinition(demoContent.gear!['copper-ring'], 'low-gear');
  checkpoint.state.supplies!['low-supply'] = createSupplyFromDefinition(demoContent.items!['mana-potion'], 'low-supply');
  const runtime = createGameRuntime(demoContent, checkpoint), before = runtime.getState();
  const spellBefore = compileWand(before, 'wand-1', demoContent)!.spells;
  for (const action of maxima) assert.equal(runtime.dispatch({id: action, type: 'cheat', action}).status, 'executed');
  const after = runtime.getState();
  assert.equal(CHEAT_TARGET_LEVEL, 50);
  assert.deepEqual(preservation(after), preservation(before));
  for (const [id, item] of Object.entries(before.items)) assert.deepEqual(after.items[id], {...item, level: Math.max(item.level, CHEAT_TARGET_LEVEL)});
  for (const wand of before.wands) assert.deepEqual(after.wands.find(value => value.id === wand.id), {...wand, level: Math.max(wand.level, CHEAT_TARGET_LEVEL)});
  assert.deepEqual(after.gear!['existing-hat'], before.gear!['existing-hat']);
  assert.deepEqual(after.supplies!['existing-potion'], before.supplies!['existing-potion']);
  assert.deepEqual(after.gear!['low-gear'], {...before.gear!['low-gear'], level: CHEAT_TARGET_LEVEL});
  assert.deepEqual(after.supplies!['low-supply'], {...before.supplies!['low-supply'], level: CHEAT_TARGET_LEVEL});
  const spellAfter = compileWand(after, 'wand-1', demoContent)!.spells;
  assert.deepEqual(spellAfter.map(({level: _level, ...rest}) => rest), spellBefore.map(({level: _level, ...rest}) => rest));
  assert.deepEqual(createGameRuntime(demoContent, runtime.checkpoint()).getState(), after);
});

test('character upgrade changes only its growth, aligns cumulative XP, refills final mana and emits no historical gifts', () => {
  const checkpoint = seed();
  checkpoint.state.characters.push({...structuredClone(checkpoint.state.characters[0]), id: 'other', wandIds: [], gearIds: {}, mana: 7});
  checkpoint.state.characters[0].xp = 10;
  const runtime = createGameRuntime(demoContent, checkpoint), before = runtime.getState();
  const statsBefore = getCharacterStats(before, 'character-1', demoContent)!;
  assert.equal(runtime.dispatch({id: 'level-two', type: 'cheat', action: 'levelCharacter', characterId: 'character-1', levels: 2}).status, 'executed');
  const after = runtime.getState(), character = after.characters[0], statsAfter = getCharacterStats(after, character.id, demoContent)!;
  assert.equal(character.level, 3); assert.equal(character.xp, experienceThreshold(2));
  assert.equal(character.mana, statsAfter.final.maxMana); assert.ok(statsAfter.final.maxMana > statsBefore.final.maxMana);
  assert.ok(statsAfter.final.attack > statsBefore.final.attack);
  assert.equal(after.playerLevel, 3); assert.equal(after.xp, before.xp);
  assert.deepEqual(after.characters[1], before.characters[1]);
  assert.deepEqual(after.items, before.items); assert.deepEqual(after.backpack, before.backpack);
  assert.deepEqual(after.runStatistics, {...before.runStatistics!, levelsGained: before.runStatistics!.levelsGained + 2});
  assert.deepEqual(after.wands, before.wands);
  assert.deepEqual(after.events.filter(event => event.type === 'characterLevelUp').map(event => event.data), [
    {characterId: character.id, previousLevel: 1, level: 2}, {characterId: character.id, previousLevel: 2, level: 3},
  ]);
  assert.equal(after.events.some(event => event.type === 'character.levelReward'), false);
  const restored = createGameRuntime(demoContent, runtime.checkpoint());
  assert.deepEqual(restored.getState(), after);
  const replay = restored.checkpoint();
  restored.dispatch({id: 'level-two', type: 'cheat', action: 'levelCharacter', characterId: 'character-1', levels: 2});
  assert.deepEqual(restored.checkpoint(), replay);
  assert.equal(restored.dispatch({id: 'other-default', type: 'cheat', action: 'levelCharacter', characterId: 'other'}).status, 'executed');
  assert.equal(restored.getState().characters[1].level, 2); assert.equal(restored.getState().playerLevel, 3);
  // A real subsequent kill uses the new cumulative threshold, without replaying cheated levels.
  function subsequentKill(checkpoint: ReturnType<typeof runtime.checkpoint>, maxHp: number) {
    const state = checkpoint.state;
    state.phase = 'battle'; state.paused = false; state.backpackOpen = false; state.waveSpawnRemaining = 0;
    state.wands.forEach(wand => {wand.placements = [];});
    state.entities = [{id: 'xp-target', definitionId: 'enemy-basic', kind: 'enemy', faction: 'enemy',
      x: 50, y: 75, hp: 1, maxHp, damage: 0, speed: 0, range: 0, cooldownMs: 1000, attackRemainingMs: 1000}];
    assert.equal(spawnProjectiles(state, character.id, {itemId: 'spark-1', definitionId: 'spark', power: 2, range: 100, casts: 1, speed: 1000}, () => {}), true);
    const next = createGameRuntime(demoContent, checkpoint); next.tick(50); return next;
  }
  const firstKill = subsequentKill(restored.checkpoint(), 80);
  assert.equal(firstKill.getState().characters[0].xp, experienceThreshold(2) + 10);
  assert.equal(firstKill.getState().characters[0].level, 3);
  assert.deepEqual(firstKill.getState().items, after.items);
  const nextKill = subsequentKill(firstKill.checkpoint(), 400), nextState = nextKill.getState();
  assert.equal(nextState.characters[0].level, 4); assert.equal(nextState.characters[0].xp, experienceThreshold(3));
  assert.equal(Object.keys(nextState.items).length, Object.keys(after.items).length + 1);
  assert.equal(nextState.events.filter(event => event.type === 'character.levelReward').length, 1);
});

test('invalid character requests and malformed catalogs reject with no partial grants', () => {
  const runtime = createGameRuntime(demoContent, seed());
  for (const levels of [0, -1, 1.5, 101, NaN, Infinity]) {
    const before = runtime.getState();
    assert.equal(runtime.dispatch({id: `invalid-${levels}`, type: 'cheat', action: 'levelCharacter', characterId: 'character-1', levels}).status, 'rejected');
    assert.deepEqual(runtime.getState(), before);
  }
  const before = runtime.getState();
  assert.equal(runtime.dispatch({id: 'missing', type: 'cheat', action: 'levelCharacter', characterId: 'absent'}).status, 'rejected');
  assert.deepEqual(runtime.getState(), before);
  const catalog = structuredClone(demoContent);
  const last = Object.keys(catalog.spells).at(-1)!;
  catalog.spells[last].level = 0;
  const broken = createGameRuntime(catalog, seed()), preGrant = broken.getState();
  assert.equal(broken.dispatch({id: 'bad-catalog', type: 'cheat', action: 'grantAllMagic'}).status, 'rejected');
  assert.deepEqual(broken.getState(), preGrant);
});

test('real remote dispatch cannot unlock cheats and respects local permission changes', () => {
  const runtime = createGameRuntime();
  const locked = runtime.checkpoint();
  assert.equal(dispatchRemote(runtime, {id: 'remote-unlock', type: 'unlockCheats'}).status, 'rejected');
  assert.equal(dispatchRemote(runtime, {id: 'remote-batch-locked', type: 'cheat', action: 'grantAllMagic'}).code, 'FORBIDDEN');
  assert.deepEqual(runtime.checkpoint(), locked);
  runtime.dispatch({id: 'local-unlock', type: 'unlockCheats'});
  assert.equal(dispatchRemote(runtime, {id: 'remote-batch-disabled', type: 'cheat', action: 'grantAllMagic'}).code, 'FORBIDDEN');
  assert.equal(dispatchRemote(runtime, {id: 'enable', type: 'setCheats', enabled: true}).status, 'executed');
  assert.equal(dispatchRemote(runtime, {id: 'remote-batch', type: 'cheat', action: 'grantAllMagic'}).status, 'executed');
  assert.equal(Object.keys(runtime.getState().items).length, Object.keys(demoContent.spells).length + Object.keys(demoContent.arcana).length);
  assert.equal(dispatchRemote(runtime, {id: 'remote-level', type: 'cheat', action: 'levelCharacter', characterId: 'character-1'}).status, 'executed');
  assert.equal(runtime.getState().characters[0].level, 2);
  const beforeInvalid = runtime.getState();
  assert.deepEqual(dispatchRemote(runtime, {id: 'remote-missing', type: 'cheat', action: 'levelCharacter', characterId: 'missing'}), {
    commandId: 'remote-missing', status: 'rejected', revision: beforeInvalid.revision, code: 'COMMAND_REJECTED',
  });
  assert.deepEqual(runtime.getState(), beforeInvalid);
  runtime.dispatch({id: 'disable', type: 'setCheats', enabled: false});
  const disabled = runtime.checkpoint();
  assert.equal(dispatchRemote(runtime, {id: 'remote-max-disabled', type: 'cheat', action: 'maxMagic'}).code, 'FORBIDDEN');
  assert.deepEqual(runtime.checkpoint(), disabled);
});

test('a maximum-length remote command grants instances with usable remote identifiers', () => {
  const runtime = createGameRuntime(demoContent, seed());
  assert.equal(dispatchRemote(runtime, {id: 'g'.repeat(160), type: 'cheat', action: 'grantAllGear'}).status, 'executed');
  const state = runtime.getState();
  const added = Object.values(state.gear!).filter(gear => gear.id !== 'existing-hat');
  assert.ok(added.length > 0);
  assert.ok(added.every(gear => gear.id.length <= 160));
  const accessory = added.find(gear => gear.slot === 'accessory')!;
  assert.equal(dispatchRemote(runtime, {id: 'equip-bounded-id', type: 'equipGear', gearId: accessory.id, characterId: 'character-1'}).status, 'executed');
  assert.equal(runtime.getState().characters[0].gearIds!.accessory, accessory.id);
});
