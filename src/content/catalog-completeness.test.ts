import assert from "node:assert/strict";
import test from "node:test";
import { demoContent } from "./demo";
import { monsterDefinitions } from "./monsters";
import { wandTemplates } from "./wands";

test("playable catalog contains over 100 definitions across distinct gameplay categories", () => {
  const counts={spells:Object.keys(demoContent.spells).length,arcana:Object.keys(demoContent.arcana).length,
    gear:Object.keys(demoContent.gear??{}).length,items:Object.keys(demoContent.items??{}).length,
    monsters:Object.keys(monsterDefinitions).length,wands:Object.keys(wandTemplates).length};
  assert.ok(Object.values(counts).reduce((a,b)=>a+b,0)>=100,JSON.stringify(counts));
  assert.ok(counts.spells>=48&&counts.arcana>=18&&counts.gear>=18&&counts.items>=8&&counts.monsters>=18);
  const effects=new Set<string>(Object.values(demoContent.spells).map(spell=>spell.effect));
  for(const effect of ["projectile","beam","chain","area","heal","shield","summon","building"])assert.ok(effects.has(effect),effect);
  for(const [id,definition] of Object.entries(demoContent.spells)) {
    assert.equal(definition.id,id);
    assert.ok(definition.shape.length>0&&definition.manaCost>=0&&definition.cooldownMs>0,id);
    if(definition.effect==="summon"||definition.effect==="building")assert.ok(definition.construct?.hp&&definition.construct.durationMs>0,id);
  }
  for(const recipe of demoContent.recipes) {
    for(const id of [...recipe.inputs,recipe.output])assert.ok(demoContent.spells[id]||demoContent.arcana[id],`${recipe.id}: ${id}`);
  }
});
