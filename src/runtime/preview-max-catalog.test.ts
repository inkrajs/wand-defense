import assert from 'node:assert/strict';
import test from 'node:test';
import type { Command } from '../contracts';
import { demoContent } from '../content/demo';
import { createGameRuntime, type GameRuntime } from './index';
import { createGearFromDefinition, gearDefinitions } from '../content/gear';
import { applyAuthorizedPreviewGrants, MAX_CATALOG_PREVIEW_REQUEST, MAX_CATALOG_TARGET_RUN_ID } from './preview';

function authorized(phase:'ready'|'reward'|'battle'='ready',enabled=false) {
  const seed=createGameRuntime();
  seed.dispatch({id:'preview:user-all-magic-20261104-03:unlock',type:'unlockCheats'});
  const checkpoint=seed.checkpoint();
  checkpoint.state.id=MAX_CATALOG_TARGET_RUN_ID;
  checkpoint.state.phase=phase;checkpoint.state.wave=28;checkpoint.state.gameTimeMs=12345;
  checkpoint.state.coins=123.5;checkpoint.state.coinIncomeRemainder=0.4;
  checkpoint.state.characters[0].level=3;checkpoint.state.characters[0].xp=75;
  checkpoint.state.characters[0].mana=41;checkpoint.state.cheats.enabled=enabled;
  checkpoint.state.wands[0].cooldowns={'spark-1':345};
  checkpoint.state.gear={old:createGearFromDefinition(gearDefinitions['copper-ring'],'old')};
  checkpoint.state.gear.old.characterId='character-1';checkpoint.state.characters[0].gearIds={accessory:'old'};
  checkpoint.state.supplies={old:{id:'old',definitionId:'health-potion',level:1,grade:'common'}};
  return createGameRuntime(demoContent,checkpoint);
}
function activate(runtime:GameRuntime) {return applyAuthorizedPreviewGrants(runtime,demoContent,MAX_CATALOG_PREVIEW_REQUEST);}
const kinds={magic:Object.keys(demoContent.spells).length+Object.keys(demoContent.arcana).length,gear:Object.keys(demoContent.gear??{}).length,supplies:Object.keys(demoContent.items??{}).length};

test('explicit scoped catalog grant adds one mythic Lv50 of each definition and exactly two 5x5 wands while preserving the run',()=>{
  for(const enabled of [false,true]) {
    const runtime=authorized('reward',enabled),before=runtime.getState();
    const result=activate(runtime),report=result.reports[0]!;
    assert.equal(result.pending,false);assert.equal(report.status,'executed');
    assert.equal('noHardLevelCap' in report && report.noHardLevelCap,true);
    assert.equal('consumableLevelIsMetadata' in report && report.consumableLevelIsMetadata,true);
    const after=runtime.getState();
    const items=Object.values(after.items).filter(item=>!Object.hasOwn(before.items,item.id));
    const gear=Object.values(after.gear??{}).filter(item=>!Object.hasOwn(before.gear??{},item.id));
    const supplies=Object.values(after.supplies??{}).filter(item=>!Object.hasOwn(before.supplies??{},item.id));
    const wands=after.wands.filter(wand=>!before.wands.some(old=>old.id===wand.id));
    assert.equal(items.length,kinds.magic);assert.equal(gear.length,kinds.gear);assert.equal(supplies.length,kinds.supplies);assert.equal(wands.length,2);
    assert.equal(gear.find(item=>item.definitionId==='gatherer-charm')!.statBonuses!.gatheringPercent,34);
    for(const gift of [...items,...gear,...supplies,...wands]) {assert.equal(gift.grade,'mythic');assert.equal(gift.level,50);}
    for(const wand of wands) {assert.equal(wand.width,5);assert.equal(wand.height,5);assert.equal(wand.characterId,null);assert.deepEqual(wand.placements,[]);}
    assert.deepEqual(new Set(items.map(item=>item.definitionId)),new Set([...Object.keys(demoContent.spells),...Object.keys(demoContent.arcana)]));
    assert.deepEqual(after.wands.slice(0,before.wands.length),before.wands);
    assert.deepEqual(after.characters,before.characters);
    assert.deepEqual(after.gear!.old,before.gear!.old);assert.deepEqual(after.supplies!.old,before.supplies!.old);
    for(const [id,item]of Object.entries(before.items))assert.deepEqual(after.items[id],item);
    assert.deepEqual(after.backpack.slice(0,before.backpack.length),before.backpack);
    for(const field of ['id','phase','wave','gameTimeMs','rngState','coins','xp','playerLevel','coinIncomeRemainder','paused','backpackOpen'] as const)assert.equal(after[field],before[field],field);
    assert.deepEqual(after.territory,before.territory);assert.deepEqual(after.runBonuses,before.runBonuses);
    assert.equal(after.cheats.enabled,enabled);
    const snapshot=runtime.checkpoint();
    assert.deepEqual(activate(runtime),{reports:[],pending:false});assert.deepEqual(runtime.checkpoint(),snapshot);
    const restored=createGameRuntime(demoContent,snapshot);
    assert.deepEqual(activate(restored),{reports:[],pending:false});assert.deepEqual(restored.checkpoint(),snapshot);
  }
});

test('unknown activation, unauthorized saves, restarted runs and active battles never receive this batch',()=>{
  const fresh=createGameRuntime(),before=fresh.checkpoint();
  assert.equal(activate(fresh).reports[0]?.status,'blocked');assert.deepEqual(fresh.checkpoint(),before);
  const runtime=authorized(),valid=runtime.checkpoint();
  assert.deepEqual(applyAuthorizedPreviewGrants(runtime,demoContent,'not-authorized'),{reports:[],pending:false});assert.deepEqual(runtime.checkpoint(),valid);
  const other=structuredClone(valid);other.state.id='different-current-run';
  const unrelated=createGameRuntime(demoContent,other),unrelatedBefore=unrelated.checkpoint();
  assert.equal(activate(unrelated).reports[0]?.status,'blocked');assert.deepEqual(unrelated.checkpoint(),unrelatedBefore);
  runtime.dispatch({id:'restart',type:'restart'});runtime.dispatch({id:'new-local-unlock',type:'unlockCheats'});
  const restarted=runtime.checkpoint();assert.equal(activate(runtime).reports[0]?.status,'blocked');assert.deepEqual(runtime.checkpoint(),restarted);
  const battle=authorized('battle'),battleBefore=battle.checkpoint();
  assert.deepEqual(activate(battle),{reports:[],pending:true});assert.deepEqual(battle.checkpoint(),battleBefore);
});

test('partial grant retries only failed gifts after refresh and restores the original disabled toggle',()=>{
  const runtime=authorized();let failOnce=true;
  const interrupted:GameRuntime={...runtime,dispatch(command:Command){
    if(command.type==='cheat' && command.action==='grantGear' && failOnce) {failOnce=false;return runtime.dispatch({...command,definitionId:'missing-definition'});}
    return runtime.dispatch(command);
  }};
  assert.equal(activate(interrupted).reports[0]?.status,'partial');
  assert.equal(runtime.getState().cheats.enabled,false);
  const saved=runtime.checkpoint();
  const countBefore={magic:Object.keys(saved.state.items).length,gear:Object.keys(saved.state.gear??{}).length,supplies:Object.keys(saved.state.supplies??{}).length,wands:saved.state.wands.length};
  const restored=createGameRuntime(demoContent,saved);
  assert.equal(activate(restored).reports[0]?.status,'executed');
  const after=restored.getState();
  assert.equal(Object.keys(after.items).length,countBefore.magic);assert.equal(Object.keys(after.supplies??{}).length,countBefore.supplies);assert.equal(after.wands.length,countBefore.wands);
  assert.equal(Object.keys(after.gear??{}).length,countBefore.gear+1);
  assert.equal(after.cheats.enabled,false);
  assert.deepEqual(activate(restored),{reports:[],pending:false});
});


test('gifted consumable level stays metadata while its mythic grade supplies the real effect',()=>{
  const runtime=authorized();activate(runtime);
  const checkpoint=runtime.checkpoint();
  const potion=Object.values(checkpoint.state.supplies??{}).find(item=>item.definitionId==='health-potion'&&item.grade==='mythic')!;
  assert.equal(potion.level,50);
  checkpoint.state.territory.maxHp=500;checkpoint.state.territory.hp=1;
  const isolated=createGameRuntime(demoContent,checkpoint);
  assert.equal(isolated.dispatch({id:'use-granted-potion',type:'useItem',itemId:potion.id}).status,'executed');
  assert.equal(isolated.getState().territory.hp,137); // 40 × mythic 3.4, with no invented level multiplier.
  const consumed=isolated.checkpoint();
  assert.deepEqual(activate(isolated),{reports:[],pending:false});
  assert.deepEqual(isolated.checkpoint(),consumed); // A consumed gift is never refilled by the completed request.
});

test('this batch explicit unlock authorizes the inspected fresh demo without authorizing legacy batches or another run',()=>{
  const runtime=createGameRuntime();
  assert.equal(runtime.getState().id,MAX_CATALOG_TARGET_RUN_ID);
  runtime.dispatch({id:`preview:${MAX_CATALOG_PREVIEW_REQUEST}:unlock`,type:'unlockCheats'});
  assert.equal(runtime.checkpoint().results.some(([id])=>id==='preview:user-all-magic-20261104-03:unlock'),false);
  const scoped=runtime.checkpoint();
  assert.deepEqual(applyAuthorizedPreviewGrants(runtime,demoContent),{reports:[],pending:false});
  assert.deepEqual(runtime.checkpoint(),scoped);
  const result=activate(runtime);
  assert.equal(result.reports[0]?.status,'executed');
  assert.equal(runtime.getState().wands.length,scoped.state.wands.length+2);
  const beforeLegacy=runtime.checkpoint();
  assert.deepEqual(applyAuthorizedPreviewGrants(runtime,demoContent),{reports:[],pending:false});
  assert.deepEqual(runtime.checkpoint(),beforeLegacy);
  const other=structuredClone(scoped);other.state.id='not-the-inspected-demo';
  const unrelated=createGameRuntime(demoContent,other),before=unrelated.checkpoint();
  assert.equal(activate(unrelated).reports[0]?.status,'blocked');
  assert.deepEqual(unrelated.checkpoint(),before);
});
