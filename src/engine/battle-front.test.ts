import assert from 'node:assert/strict';
import test from 'node:test';
import type { CombatEntity } from '../contracts';
import { TERRITORY_FRONT_Y } from '../content/battlefieldCoordinates';
import { demoContent } from '../content/demo';
import { createInitialState } from '../runtime/initial';
import { spawnAreaEffects } from './areaEffects';
import { spawnProjectiles } from './projectiles';
import { stepBattle } from './index';

function fixture(y: number) {
  const state = createInitialState();
  state.phase = 'battle';
  state.wave = 1;
  state.wands[0].placements = [];
  const enemy: CombatEntity = {id:'target',definitionId:'enemy-basic',kind:'enemy',faction:'enemy',x:50,y,
    hp:100,maxHp:100,damage:0,speed:0,range:1,cooldownMs:1000,attackRemainingMs:1000};
  state.entities = [enemy];
  return state;
}

test('downward knockback reports the actual displacement and stops the enemy at the territory front', () => {
  const state = fixture(TERRITORY_FRONT_Y - 1);
  assert.equal(spawnProjectiles(state, 'character-1', {
    itemId:'test-item',definitionId:'wind-blade',power:8,range:20,casts:1,speed:1000,
    origin:{x:50,y:70},fixedOrigin:true,onHit:{knockback:10},
  }, () => {}),true);
  const result = stepBattle(state, 50, demoContent);
  assert.equal(result.state.entities[0].y, TERRITORY_FRONT_Y);
  const knockback = result.events.find(event => event.type === 'knockback');
  assert.equal(knockback?.data.y, TERRITORY_FRONT_Y);
  assert.equal(knockback?.data.distance, 1);
});

test('a vortex on the player side pulls to the front but never across it', () => {
  const state = fixture(TERRITORY_FRONT_Y - 1);
  assert.equal(spawnAreaEffects(state, 'character-1', {
    itemId:'test-item',definitionId:'moving-storm',power:1,range:24,casts:1,position:{x:50,y:88},
    area:{mode:'vortex',radius:8,delayMs:0,durationMs:1000,maxTargets:1,moveSpeed:0,pullRadius:15,pullStrength:30},
  }, () => {}),true);
  const first = stepBattle(state, 50, demoContent).state;
  assert.equal(first.entities.find(entity => entity.id === 'target')?.y, TERRITORY_FRONT_Y);
  const later = stepBattle(first, 300, demoContent).state;
  assert.equal(later.entities.find(entity => entity.id === 'target')?.y, TERRITORY_FRONT_Y);
});
