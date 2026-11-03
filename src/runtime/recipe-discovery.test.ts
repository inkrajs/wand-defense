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
