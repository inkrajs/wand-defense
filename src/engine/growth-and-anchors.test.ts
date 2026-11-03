import assert from "node:assert/strict";
import test from "node:test";
import type { CombatEntity, GameState } from "../contracts";
import { createInitialState } from "../runtime/initial";
import { demoContent } from "../content/demo";
import { getCharacterStats } from "../content/characters";
import { getCharacterAnchors } from "../content/characterAnchors";
import { spawnProjectiles } from "./projectiles";
import { advanceBeams, spawnBeams } from "./beams";
import { stepBattle } from "./index";
import { compileWand } from "../loadout";

function enemy(id: string, x: number, y: number, hp = 100): CombatEntity {
  return {id, definitionId:"enemy-basic", kind:"enemy", faction:"enemy", x, y, hp, maxHp:hp,
    damage:0, speed:0, range:0, cooldownMs:1000, attackRemainingMs:1000};
}
function battle(count = 2): GameState {
  const state = createInitialState();
  state.phase="battle"; state.wave=1; state.waveSpawnRemaining=0;
  state.wands[0].placements=[];
  for (let i=1;i<count;i++) state.characters.push({...structuredClone(state.characters[0]),
    id:`character-${i+1}`, sequenceId:"wood-9", growthProfileId:"wood", wandIds:[]});
  return state;
}

test("historical levels immediately improve compiled combat without mutating permanent stats or mana", () => {
  const state=createInitialState(), character=state.characters[0];
  character.mana=7;
  const originalBase=structuredClone(character.baseStats);
  const before=compileWand(state,"wand-1",demoContent)!.spells[0];
  character.level=3;
  const after=compileWand(state,"wand-1",demoContent)!.spells[0];
  assert.ok(after.power>before.power);
  assert.ok(after.cooldownMs<before.cooldownMs);
  assert.ok(after.range>before.range);
  assert.ok(after.speed!>before.speed!);
  assert.equal(getCharacterStats(state,character.id)?.final.maxMana,110);
  assert.equal(character.mana,7);
  assert.equal(character.maxMana,100);
  assert.deepEqual(character.baseStats,originalBase);
  assert.deepEqual(compileWand(state,"wand-1",demoContent)!.spells[0],after);
});

test("actual multi-level gain refills the new final cap with growth, run and equipment once", () => {
  const state = battle();
  const character = state.characters[1];
  character.mana=1; character.maxMana=107; character.manaRegen=14;
  state.characters[0].mana=3; state.characters[0].manaRegen=0;
  state.runBonuses={attackPercent:0,maxMana:7,manaRegen:2};
  state.gear={hat:{id:"hat",name:"hat",slot:"head",characterId:character.id,
    level:1,grade:"common",statBonuses:{maxMana:13}}};
  character.gearIds={head:"hat"};
  const anchor=getCharacterAnchors(state.characters)[1];
  state.entities=[{...enemy("victim",anchor.x,80,480),hp:1},enemy("survivor",0,0)];
  spawnProjectiles(state,character.id,{itemId:"test",definitionId:"spark",power:2,range:10,casts:1,speed:1000},()=>{});
  const result=stepBattle(state,50,demoContent);
  const grown=result.state.characters[1];
  assert.equal(grown.level,3);
  assert.equal(grown.mana,140); // 107 persisted cap + 20 growth + 13 equipment, no second run bonus.
  assert.equal(getCharacterStats(result.state,grown.id)?.final.maxMana,140);
  assert.equal(grown.maxMana,107);
  assert.equal(result.state.characters[0].mana,3);
  assert.equal(result.events.filter(event=>event.type==="characterLevelUp").length,2);
  const next=structuredClone(result.state); next.characters[1].mana=10;
  const repeated=stepBattle(next,50,demoContent);
  assert.ok(repeated.state.characters[1].mana<11);
  assert.equal(repeated.events.some(event=>event.type==="characterLevelUp"),false);
});

test("projectile acquisition and flight start at each character's shared anchor", () => {
  const state=battle(3), anchors=getCharacterAnchors(state.characters);
  assert.deepEqual(anchors.map(anchor=>anchor.x),[26,50,74]);
  state.entities=[enemy("left",26,74),enemy("center",50,84)];
  assert.equal(spawnProjectiles(state,anchors[0].characterId,
    {itemId:"test",definitionId:"spark",power:2,range:12,casts:1,speed:100},()=>{}),true);
  const projectile=state.entities.find(entity=>entity.kind==="projectile")!;
  assert.deepEqual([projectile.x,projectile.y,projectile.originX,projectile.originY,projectile.targetId],
    [26,84,26,84,"left"]);
  assert.equal(spawnProjectiles(state,anchors[2].characterId,
    {itemId:"test",definitionId:"spark",power:2,range:12,casts:1,speed:100},()=>{}),false);
});

test("beam range, segment and real pulse use its firing character's shared anchor", () => {
  const state=battle(3);
  state.entities=[enemy("left",26,74),enemy("center",50,84)];
  assert.equal(spawnBeams(state,state.characters[0].id,{itemId:"test",definitionId:"solar-ray",
    power:7,range:12,casts:1,beam:{durationMs:200,tickMs:100,width:1,maxTargets:2}},()=>{}),true);
  const beam=state.entities.find(entity=>entity.kind==="beam")!;
  assert.deepEqual([beam.x,beam.y,beam.targetX,beam.targetY],[26,84,26,72]);
  advanceBeams(state,100,()=>{});
  assert.equal(state.entities.find(entity=>entity.id==="left")!.hp,93);
  assert.equal(state.entities.find(entity=>entity.id==="center")!.hp,100);
});
