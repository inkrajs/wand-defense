import assert from 'node:assert/strict';
import test from 'node:test';
import type { Command, GameState } from '../contracts';
import { demoContent } from '../content/demo';
import { createInitialState } from '../runtime/initial';
import { createGameRuntime } from '../runtime';
import { dispatchRemote } from '../agent/protocol';
import { projectFrame } from '../agent/projection';
import { deploySpell, startBattle, stepBattle } from './index';

function battle(definitionId = 'arrow-tower'): GameState {
  const state = startBattle(createInitialState(), demoContent).state;
  state.items.unit = { id: 'unit', definitionId, kind: 'spell', level: 1, grade: 'common' };
  state.wands[0].placements = [{ itemId: 'unit', x: 0, y: 0, rotation: 0 }];
  state.knowledge.spellIds.push(definitionId);
  return state;
}
const command = (id = 'deploy'): Extract<Command, {type:'deploySpell'}> => ({ id, type:'deploySpell', wandId:'wand-1', itemId:'unit', position:{x:3,y:7} });

test('point deployment works far from territory, stays fixed and participates in battle', () => {
  const source = battle(); const original = structuredClone(source);
  const result = deploySpell(source, command(), demoContent);
  assert.equal(result.result.status, 'executed'); assert.deepEqual(source, original);
  const tower = result.state.entities.find(e => e.kind === 'building')!;
  assert.deepEqual([tower.x,tower.y], [3,7]);
  assert.equal(result.state.characters[0].mana, 80);
  assert.equal(result.state.wands[0].cooldowns.unit, 6500);
  result.state.waveSpawnRemaining = 0;
  result.state.entities.push({id:'enemy',definitionId:'enemy-basic',kind:'enemy',faction:'enemy',x:3,y:8,hp:100,maxHp:100,damage:0,speed:0,range:1,cooldownMs:1000,attackRemainingMs:0});
  const advanced = stepBattle(result.state, 50, demoContent).state;
  assert.ok(advanced.entities.find(e => e.id==='enemy')!.hp < 100);
  assert.deepEqual([advanced.entities.find(e => e.id===tower.id)!.x,advanced.entities.find(e => e.id===tower.id)!.y],[3,7]);
});
test('summons wait for position; paused deployment rejects atomically', () => {
  const state = battle('wolf');
  const tick = stepBattle(state, 50, demoContent).state;
  assert.ok(!tick.entities.some(e=>e.kind==='summon'));
  assert.equal(tick.characters[0].mana, 100);
  state.paused = true;
  const rejected = deploySpell(state, command(), demoContent);
  assert.equal(rejected.result.status,'rejected'); assert.equal(rejected.state,state); assert.deepEqual(rejected.events,[]);
});
test('double creates two entities atomically, caps capacity and expiry frees space', () => {
  let state = battle('wolf');
  state.items.double = {id:'double',definitionId:'double',kind:'arcana',level:1,grade:'common'};
  state.wands[0].placements.push({itemId:'double',x:0,y:1,rotation:0});
  state = deploySpell(state, command(), demoContent).state;
  const wolves = state.entities.filter(e=>e.kind==='summon');
  assert.equal(wolves.length,2); assert.equal(new Set(wolves.map(e=>e.id)).size,2);
  assert.equal(state.characters[0].mana,86);
  state.wands[0].cooldowns.unit=0;
  const reject=deploySpell(state,command('full'),demoContent);
  assert.equal(reject.result.code,'CAPACITY'); assert.equal(reject.state,state);
  for(const wolf of wolves) wolf.remainingMs=1;
  state=stepBattle(state,50,demoContent).state;
  assert.ok(!state.entities.some(e=>e.kind==='summon'));
  assert.equal(deploySpell(state,command('replace'),demoContent).result.status,'executed');
});
test('configured healing summon keeps compiled sequence hp/power and frozen lifespan', () => {
  let state=battle('wood-spirit');state.characters[0].sequenceId='wood-9';
  state=deploySpell(state,command(),demoContent).state;
  const spirit=state.entities.find(e=>e.kind==='summon')!;
  assert.ok(Math.abs(spirit.maxHp-48.4)<1e-8);
  state.entities.push({...structuredClone(spirit),id:'patient',definitionId:'arrow-tower',kind:'building',x:4,y:7,hp:10,maxHp:100,damage:0});
  state=stepBattle(state,50,demoContent).state;
  assert.ok(Math.abs(state.entities.find(e=>e.id==='patient')!.hp-10.44)<1e-8);
  state.backpackOpen=true;
  assert.equal(stepBattle(state,5000,demoContent).state,state);
});
test('semantic runtime accepts remote deployment with idempotency and public capability', () => {
  const runtime=createGameRuntime();
  try {
    for(const c of [
      {id:'unlock',type:'unlockCheats'}, {id:'enable',type:'setCheats',enabled:true},
      {id:'grant',type:'cheat',action:'grantSpell',definitionId:'arrow-tower'},
      {id:'bag',type:'setBackpack',open:true},
    ] as Command[]) assert.equal(runtime.dispatch(c).status,'executed');
    let state=runtime.getState(); const tower=Object.values(state.items).find(i=>i.definitionId==='arrow-tower')!;
    assert.equal(runtime.dispatch({id:'place',type:'placeItem',wandId:'wand-1',itemId:tower.id,x:1,y:0,rotation:0}).status,'executed');
    runtime.dispatch({id:'close',type:'setBackpack',open:false});runtime.dispatch({id:'start',type:'startWave'});
    const c={...command('remote'),itemId:tower.id,position:{x:99.5,y:0}};
    assert.equal(dispatchRemote(runtime,c).status,'executed');
    state=runtime.getState();assert.equal(state.entities.filter(e=>e.kind==='building').length,1);
    assert.equal(dispatchRemote(runtime,c).status,'executed');assert.deepEqual(runtime.getState(),state);
    const frame=projectFrame(state,state.events,[],demoContent);
    assert.ok(frame.capabilities.commands.includes('deploySpell'));
    assert.ok(frame.events.some(e=>e.type==='spell.deployed'&&e.data.x===99.5));
    assert.equal(dispatchRemote(runtime,{...c,id:'bad',position:{x:Infinity,y:0}}).status,'rejected');
  } finally {runtime.dispose();}
});
