import assert from "node:assert/strict";
import test from "node:test";
import { createGameRuntime } from "./index";
import { demoContent } from "../content/demo";
import { projectContent } from "../agent/projection";

test("discovering all recipe inputs reveals the route while an unknown output stays private", () => {
  const runtime=createGameRuntime();
  runtime.dispatch({id:"unlock",type:"unlockCheats"}); runtime.dispatch({id:"enable",type:"setCheats",enabled:true});
  const recipe=demoContent.recipes.find(recipe=>recipe.output === "thunder-strike")!;
  assert.ok(recipe);
  assert.equal(runtime.getState().knowledge.recipeIds.includes(recipe.id),false);
  runtime.dispatch({id:"lightning",type:"cheat",action:"grantSpell",definitionId:"lightning-bolt"});
  assert.equal(runtime.getState().knowledge.recipeIds.includes(recipe.id),false);
  runtime.dispatch({id:"focus",type:"cheat",action:"grantItem",definitionId:"focus"});
  const known=runtime.getState(); assert.equal(known.knowledge.recipeIds.includes(recipe.id),true);
  assert.equal(known.knowledge.spellIds.includes(recipe.output),false);
  const projected=projectContent(known,demoContent);
  assert.equal(projected.spells.some(spell=>spell.id===recipe.output),false);
  assert.equal(Object.hasOwn(projected.recipes.find(item=>item.id===recipe.id)!,"output"),false);
  const restored=createGameRuntime(demoContent,runtime.checkpoint());
  assert.deepEqual(restored.getState().knowledge,known.knowledge);
});


test("revealing the tree is cheat-gated, persists, and does not grant inventory or change the run", () => {
  const runtime = createGameRuntime();
  const command = {id:"reveal",type:"cheat",action:"revealMagic"} as const;
  const before = runtime.getState();
  assert.equal(runtime.dispatch(command).status, "rejected");
  assert.deepEqual(runtime.getState(), before);
  runtime.dispatch({id:"unlock",type:"unlockCheats"});
  runtime.dispatch({id:"enable",type:"setCheats",enabled:true});
  const original = runtime.getState();
  assert.equal(runtime.dispatch({...command,id:"reveal-allowed"}).status,"executed");
  const after = runtime.getState();
  assert.deepEqual(new Set(after.knowledge.spellIds),new Set(Object.keys(demoContent.spells)));
  assert.deepEqual(new Set(after.knowledge.arcanaIds),new Set(Object.keys(demoContent.arcana)));
  assert.ok(after.knowledge.recipeIds.includes("meteor-recipe"));
  assert.deepEqual(after.items,original.items);
  assert.deepEqual(after.backpack,original.backpack);
  assert.deepEqual(after.wands,original.wands);
  assert.deepEqual(after.characters,original.characters);
  assert.equal(after.wave,original.wave);
  assert.equal(after.coins,original.coins);
  const restored = createGameRuntime(demoContent,runtime.checkpoint());
  assert.deepEqual(restored.getState().knowledge,after.knowledge);
  runtime.dispose();restored.dispose();
});
