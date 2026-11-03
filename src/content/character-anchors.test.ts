import test from 'node:test';
import assert from 'node:assert/strict';
import { getCharacterAnchor, getCharacterAnchors } from './characterAnchors';

test('anchors have no targets for an empty team and center a single character', () => {
  assert.deepEqual(getCharacterAnchors([]), []);
  assert.deepEqual(getCharacterAnchors([{ id: 'one' }]), [{ characterId: 'one', x: 50, y: 84 }]);
});

test('anchors keep character order and use the shared capped spacing formula', () => {
  assert.deepEqual(getCharacterAnchors([{ id: 'a' }, { id: 'b' }, { id: 'c' }]), [
    { characterId: 'a', x: 26, y: 84 },
    { characterId: 'b', x: 50, y: 84 },
    { characterId: 'c', x: 74, y: 84 },
  ]);
  const five = getCharacterAnchors(['a', 'b', 'c', 'd', 'e'].map(id => ({ id })));
  assert.deepEqual(five.map(anchor => anchor.x), [10, 30, 50, 70, 90]);
});

test('single-anchor lookup returns the matching detached point or undefined', () => {
  const characters = [{ id: 'a' }, { id: 'b' }];
  assert.deepEqual(getCharacterAnchor(characters, 'b'), { characterId: 'b', x: 62, y: 84 });
  assert.equal(getCharacterAnchor(characters, 'missing'), undefined);
  assert.deepEqual(characters, [{ id: 'a' }, { id: 'b' }]);
});
