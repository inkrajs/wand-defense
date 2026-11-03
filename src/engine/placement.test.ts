import test from 'node:test';
import assert from 'node:assert/strict';
import type { ContentCatalog, GameState } from '../contracts';
import { createFixtureState } from '../runtime/mock';
import { previewDeployment, validateBattlePosition, type DeploymentRequest } from './placement';

const content: ContentCatalog = {
  spells: { wolf: {
    id: 'wolf', name: 'Wolf', level: 1, grade: 'common', element: 'wood', shape: [{ x: 0, y: 0 }],
    asset: { key: 'wolf', label: 'Wolf' }, effect: 'summon', power: 8, manaCost: 5,
    cooldownMs: 1000, range: 12, hp: 30, durationMs: 5000,
  } },
  arcana: { amplify: {
    id: 'amplify', name: 'Double', level: 1, grade: 'common', shape: [{ x: 0, y: 0 }],
    asset: { key: 'amplify', label: 'Double' }, modifier: 'amplify', value: 2,
  } },
  recipes: [], sequences: { 'fire-9': {
    id: 'fire-9', pathwayId: 'fire', number: 9, name: 'Fire', bonuses: {}, requirements: [],
  } },
};

function setup(): { state: GameState; request: DeploymentRequest } {
  const state = createFixtureState();
  state.phase = 'battle';
  state.items['wolf-1'] = { id: 'wolf-1', definitionId: 'wolf', kind: 'spell', level: 1, grade: 'common' };
  state.wands[0].placements = [{ itemId: 'wolf-1', x: 0, y: 0, rotation: 0 }];
  state.knowledge.spellIds.push('wolf');
  return { state, request: { wandId: 'wand-1', itemId: 'wolf-1', position: { x: 100, y: 0 } } };
}

test('battle positions accept both inclusive edges and reject malformed/non-finite coordinates', () => {
  assert.equal(validateBattlePosition({ x: 0, y: 100 }), true);
  assert.equal(validateBattlePosition({ x: 100, y: 0 }), true);
  const arrayPosition = Object.assign([], { x: 1, y: 2 });
  for (const position of [null, {}, arrayPosition, { x: -0.01, y: 50 }, { x: 50, y: 100.01 }, { x: NaN, y: 5 }, { x: 1, y: Infinity }, { x: '1', y: 2 }]) {
    assert.equal(validateBattlePosition(position), false);
  }
});

test('a known summon previews at a legal point far from the defense line', () => {
  const { state, request } = setup();
  const result = previewDeployment(state, request, content);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.characterId, 'character-1');
    assert.equal(result.spell.id, 'wolf');
    assert.equal(result.spell.copies, 1);
  }
});

test('inactive battle states and invalid positions are rejected', () => {
  const { state, request } = setup();
  state.paused = true;
  assert.deepEqual(previewDeployment(state, request, content), { ok: false, code: 'BATTLE_NOT_ACTIVE' });
  state.paused = false;
  request.position.x = Number.NaN;
  assert.deepEqual(previewDeployment(state, request, content), { ok: false, code: 'INVALID_POSITION' });
  request.position.x = 10;
  state.territory.hp = 0;
  assert.deepEqual(previewDeployment(state, request, content), { ok: false, code: 'BATTLE_NOT_ACTIVE' });
  state.territory.hp = Number.NaN;
  assert.deepEqual(previewDeployment(state, request, content), { ok: false, code: 'BATTLE_NOT_ACTIVE' });
});

test('unknown, unlearned, or one-way-owned sources share the unavailable result', () => {
  const { state, request } = setup();
  assert.deepEqual(previewDeployment(state, { ...request, wandId: 'missing' }, content), { ok: false, code: 'DEPLOYMENT_UNAVAILABLE' });
  state.knowledge.spellIds = state.knowledge.spellIds.filter(id => id !== 'wolf');
  assert.deepEqual(previewDeployment(state, request, content), { ok: false, code: 'DEPLOYMENT_UNAVAILABLE' });
  state.knowledge.spellIds.push('wolf');
  state.characters[0].wandIds = [];
  assert.deepEqual(previewDeployment(state, request, content), { ok: false, code: 'DEPLOYMENT_UNAVAILABLE' });
});

test('copies are capacity-checked as one unit and expired/dead entities do not consume capacity', () => {
  const { state, request } = setup();
  state.wands[0].placements.push({ itemId: 'amplify-1', x: 1, y: 0, rotation: 0 });
  const doubled = structuredClone(content);
  doubled.arcana.amplify.modifier = 'double';
  state.entities.push({
    id: 'existing', definitionId: 'wolf', kind: 'summon', faction: 'player', x: 50, y: 80,
    hp: 10, maxHp: 10, damage: 1, speed: 0, range: 1, cooldownMs: 1000,
    attackRemainingMs: 0, remainingMs: 500, sourceCharacterId: 'character-1', sourceItemId: 'wolf-1',
  });
  const before = structuredClone(state);
  const result = previewDeployment(state, request, doubled);
  assert.deepEqual(result, { ok: false, code: 'CAPACITY' });
  assert.deepEqual(state, before);

  state.entities[0].remainingMs = 0;
  const allowed = previewDeployment(state, request, doubled);
  assert.equal(allowed.ok, true);
  state.entities[0].hp = 0;
  state.entities[0].remainingMs = 500;
  assert.equal(previewDeployment(state, request, doubled).ok, true);
});

test('preview leaves state and content unchanged on success', () => {
  const { state, request } = setup();
  const stateBefore = structuredClone(state);
  const contentBefore = structuredClone(content);
  const result = previewDeployment(state, request, content);
  assert.equal(result.ok, true);
  assert.deepEqual(state, stateBefore);
  assert.deepEqual(content, contentBefore);
});

test('negative configured mana cost cannot bypass resource checks', () => {
  const { state, request } = setup();
  const invalidContent = structuredClone(content);
  invalidContent.spells.wolf.manaCost = -1;
  assert.deepEqual(previewDeployment(state, request, invalidContent), { ok: false, code: 'INSUFFICIENT_MANA' });
});
