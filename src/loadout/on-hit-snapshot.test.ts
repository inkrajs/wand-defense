import assert from 'node:assert/strict';
import test from 'node:test';
import { demoContent } from '../content/demo';
import { createFixtureState } from '../runtime/mock';
import { compileWand } from './compile';

test('compiled onHit snapshots deeply detach from catalog while retaining raw ratios and durations',()=>{
  const content=structuredClone(demoContent),state=createFixtureState();
  content.spells.spark.onHit={knockback:3,slow:{multiplier:0.6,durationMs:1200},burn:{powerRatio:0.25,durationMs:3000,tickMs:500}};
  state.items['spark-1'].grade='uncommon';
  const template=content.spells.spark.onHit;
  const compiled=compileWand(state,'wand-1',content)!.spells[0];
  assert.notEqual(compiled.onHit,template);
  assert.notEqual(compiled.onHit!.slow,template.slow);
  assert.notEqual(compiled.onHit!.burn,template.burn);
  assert.deepEqual(compiled.onHit,template);
  assert.ok(Math.abs(compiled.power-13.75)<1e-9);
  assert.equal(compiled.onHit!.burn!.powerRatio,0.25);
  template.knockback=10;template.slow!.multiplier=0.9;template.burn!.powerRatio=0.99;
  assert.equal(compiled.onHit!.knockback,3);
  assert.equal(compiled.onHit!.slow!.multiplier,0.6);
  assert.equal(compiled.onHit!.burn!.powerRatio,0.25);
  compiled.onHit!.slow!.durationMs=5;compiled.onHit!.burn!.durationMs=7;
  assert.equal(template.slow!.durationMs,1200);
  assert.equal(template.burn!.durationMs,3000);
  assert.equal(compiled.onHit!.burn!.tickMs,500);
});
