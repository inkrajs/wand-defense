import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialState } from '../runtime/initial';
import { applyGearCommand } from '../loadout/gear';
import { demoContent } from './demo';
import { getCharacterStats, normalizeCharacterStats } from './characters';
import { createGearFromDefinition, gearDefinitions } from './gear';
import { getGatheringStats, grantCoinIncome } from './economy';

test('team gathering sums deployed personal sources and real equipment while the run bonus counts only once',()=>{
  const state=createInitialState();
  state.characters[0].baseStats!.gatheringPercent=15;
  state.wands[0].statBonuses={gatheringPercent:20};
  state.characters.push({...structuredClone(state.characters[0]),id:'second',wandIds:[],baseStats:{...state.characters[0].baseStats!,gatheringPercent:5}});
  state.gear={charm:createGearFromDefinition(gearDefinitions['gatherer-charm'],'charm','rare'),unowned:createGearFromDefinition(gearDefinitions['gatherer-charm'],'unowned','mythic')};
  state.gear.charm.characterId='character-1';state.characters[0].gearIds={accessory:'charm'};
  state.wands.push({...structuredClone(state.wands[0]),id:'bag-wand',characterId:null,statBonuses:{gatheringPercent:999}});
  state.runBonuses={attackPercent:0,gatheringPercent:10};
  assert.deepEqual(getGatheringStats(state,demoContent),{base:20,equipment:35,run:10,total:65,multiplier:1.65});
  assert.equal(getCharacterStats(state,'character-1',demoContent)!.equipment.gatheringPercent,35);
  assert.equal(getCharacterStats(state,'second',demoContent)!.equipment.gatheringPercent,0);
});

test('gatherer charm scales through the gear factory and changes income only while actually equipped',()=>{
  const state=createInitialState();
  const definition=gearDefinitions['gatherer-charm'];
  assert.equal(definition.slot,'accessory');assert.deepEqual(definition.shape,[{x:0,y:0}]);
  assert.equal(createGearFromDefinition(definition,'rare','rare').statBonuses!.gatheringPercent,15);
  state.gear={charm:createGearFromDefinition(definition,'charm')};
  assert.equal(getGatheringStats(state).equipment,0);
  const equipped=applyGearCommand(state,{id:'equip',type:'equipGear',gearId:'charm',characterId:'character-1'},demoContent);
  assert.equal(equipped.result.status,'executed');assert.equal(getGatheringStats(equipped.state).equipment,10);
  const unequipped=applyGearCommand(equipped.state,{id:'unequip',type:'unequipGear',gearId:'charm'},demoContent);
  assert.equal(unequipped.result.status,'executed');assert.equal(getGatheringStats(unequipped.state).equipment,0);
  const invalid=structuredClone(equipped.state);invalid.gear!.charm.characterId='not-the-owner';
  assert.equal(getGatheringStats(invalid).equipment,0);
});

test('ten one-coin incomes with ten percent gathering credit eleven coins and saved carry survives refresh',()=>{
  const state=createInitialState();state.runBonuses={attackPercent:0,gatheringPercent:10};
  const before={stats:structuredClone(state.runStatistics),events:structuredClone(state.events),rng:state.rngState};
  let credited=0;
  for(let i=0;i<4;i++) credited+=grantCoinIncome(state,1).amount;
  const restored=JSON.parse(JSON.stringify(state)) as typeof state;
  for(let i=4;i<10;i++) {credited+=grantCoinIncome(state,1).amount;grantCoinIncome(restored,1);}
  assert.equal(credited,11);assert.equal(state.coins,11);assert.equal(state.coinIncomeRemainder,0);
  assert.equal(restored.coins,11);assert.equal(restored.coinIncomeRemainder,0);
  assert.deepEqual(state.runStatistics,before.stats);assert.deepEqual(state.events,before.events);assert.equal(state.rngState,before.rng);
  const batch=createInitialState();batch.runBonuses={attackPercent:0,gatheringPercent:10};
  assert.equal(grantCoinIncome(batch,10).amount,11);
});

test('legacy missing gathering defaults to zero; ordinary income preserves existing fractional balance',()=>{
  const state=createInitialState();delete state.characters[0].baseStats!.gatheringPercent;
  normalizeCharacterStats(state);
  assert.equal(getCharacterStats(state,'character-1')!.base.gatheringPercent,0);
  assert.deepEqual(getGatheringStats(state),{base:0,equipment:0,run:0,total:0,multiplier:1});
  state.coins=12.5;
  assert.deepEqual(grantCoinIncome(state,7),{baseAmount:7,amount:7,bonusAmount:0,gatheringPercent:0,remainder:0});
  assert.equal(state.coins,19.5);
  state.characters[0].baseStats!.gatheringPercent=NaN;
  state.runBonuses={attackPercent:0,gatheringPercent:Infinity};
  assert.equal(getGatheringStats(state).total,0);
});

test('non-income and unsafe balances or overflowing credits do not mutate coins or saved carry',()=>{
  for(const value of [0,-1,NaN,Infinity,-Infinity,Number.MAX_VALUE]) {
    const state=createInitialState();state.coins=17;state.coinIncomeRemainder=0.6;
    const before=structuredClone(state);
    assert.equal(grantCoinIncome(state,value).amount,0);assert.deepEqual(state,before);
  }
  for(const balance of [Number.MAX_SAFE_INTEGER,NaN,-1,Infinity]) {
    const state=createInitialState();state.coins=balance;state.coinIncomeRemainder=0.4;
    const before=structuredClone(state);
    assert.equal(grantCoinIncome(state,1).amount,0);assert.deepEqual(state,before);
  }
  const state=createInitialState();state.runBonuses={attackPercent:0,gatheringPercent:100};
  const before=structuredClone(state);
  assert.equal(grantCoinIncome(state,Number.MAX_SAFE_INTEGER).amount,0);assert.deepEqual(state,before);
});
