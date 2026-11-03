import assert from 'node:assert/strict';
import test from 'node:test';
import { createWandFromTemplate } from './wands';
import { placementCells, validatePlacement } from '../loadout/geometry';

test('large wand templates provide complete independent 4x4 and 5x5 rectangular grids', () => {
  for (const size of [4,5]) {
    const wand = createWandFromTemplate(`wand-${size}x${size}`, `instance-${size}`)!;
    assert.equal(wand.characterId, null);
    assert.equal(wand.level,1); assert.equal(wand.grade,'common');
    assert.equal(wand.width,size); assert.equal(wand.height,size);
    const cells = Array.from({length:size * size},(_,index)=>({x:index % size,y:Math.floor(index/size)}));
    assert.equal(validatePlacement(wand.width,wand.height,placementCells(cells,{itemId:'x',x:0,y:0,rotation:0}),[]).valid,true);
    wand.placements.push({itemId:'x',x:0,y:0,rotation:0});
    assert.deepEqual(createWandFromTemplate(`wand-${size}x${size}`,'new')!.placements,[]);
  }
  assert.equal(createWandFromTemplate('unknown','id'),undefined);
  assert.equal(createWandFromTemplate('__proto__','id'),undefined);
});
