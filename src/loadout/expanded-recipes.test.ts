import assert from 'node:assert/strict';
import test from 'node:test';
import { demoContent } from '../content/demo';
import { magicRecipeDefinitions } from '../content/magicRecipes';
import { fieldSpellDefinitions } from '../content/fieldSpells';
import { createFixtureState } from '../runtime/mock';
import { applyLoadoutCommand, compileWand } from './index';

const catalog={...demoContent,spells:{...demoContent.spells,...fieldSpellDefinitions},recipes:magicRecipeDefinitions};
for(const [recipeId,secondY,mode] of [
  ['thunder-strike-recipe',1,'strike'],
  ['earth-spikes-recipe',1,'eruption'],
  ['meteor-recipe',1,'strike'],
] as const) test(`real recipe ${recipeId} consumes different definitions atomically and creates a usable area spell`,()=>{
  const recipe=magicRecipeDefinitions.find(recipe=>recipe.id===recipeId)!;
  assert.ok(recipe);
  const initial=createFixtureState();
  initial.wands[0]={...initial.wands[0],width:6,height:6,placements:[],cooldowns:{}};
  initial.items={kept:{id:'kept',definitionId:'spark',kind:'spell',grade:'common',level:1}};
  initial.backpack=['kept'];initial.knowledge.recipeIds=[recipeId];
  recipe.inputs.forEach((definitionId,index)=>{
    const definition=catalog.spells[definitionId]??catalog.arcana[definitionId];
    assert.ok(definition);
    const id=`ingredient-${index}`;
    initial.items[id]={id,definitionId,kind:catalog.spells[definitionId]?'spell':'arcana',level:definition.level,grade:definition.grade};
    initial.backpack.push(id);
  });
  let state=initial;
  for(let index=0;index<recipe.inputs.length;index++) {
    const placed=applyLoadoutCommand(state,{id:`place-${index}`,type:'placeItem',wandId:'wand-1',itemId:`ingredient-${index}`,x:0,y:index===0?0:secondY,rotation:0},catalog);
    assert.equal(placed.result.status,'executed');state=placed.state;
  }
  const merge={id:'recipe-result',type:'mergeRecipe',wandId:'wand-1',recipeId,itemIds:['ingredient-0','ingredient-1']} as const;
  const unknown=structuredClone(state);unknown.knowledge.recipeIds=[];
  assert.equal(applyLoadoutCommand(unknown,{...merge,itemIds:[...merge.itemIds]},catalog).result.status,'rejected');
  assert.ok(unknown.items['ingredient-0']);
  const distant=structuredClone(state);
  distant.wands[0].placements[1]={...distant.wands[0].placements[1],x:3,y:4};
  const refused=applyLoadoutCommand(distant,{...merge,itemIds:[...merge.itemIds]},catalog);
  assert.equal(refused.result.code,'INPUTS_NOT_ADJACENT');assert.equal(refused.state,distant);assert.deepEqual(refused.events,[]);
  const before=structuredClone(state);
  const merged=applyLoadoutCommand(state,{...merge,itemIds:[...merge.itemIds]},catalog);
  assert.equal(merged.result.status,'executed');assert.deepEqual(state,before);
  assert.equal(merged.events.length,1);assert.equal(merged.events[0].type,'recipeMerged');
  assert.deepEqual(merged.state.backpack,['kept','recipe-result:output']);
  assert.deepEqual(merged.state.wands[0].placements,[]);
  assert.equal(merged.state.items['ingredient-0'],undefined);assert.equal(merged.state.items['ingredient-1'],undefined);
  assert.equal(merged.state.items['recipe-result:output'].definitionId,recipe.output);
  assert.ok(merged.state.knowledge.spellIds.includes(recipe.output));
  assert.deepEqual(merged.state.runStatistics,state.runStatistics);
  const equipped=applyLoadoutCommand(merged.state,{id:'equip-result',type:'placeItem',wandId:'wand-1',itemId:'recipe-result:output',x:0,y:0,rotation:0},catalog);
  assert.equal(equipped.result.status,'executed');
  const spell=compileWand(equipped.state,'wand-1',catalog)!.spells[0];
  assert.equal(spell.id,recipe.output);assert.equal(spell.effect,'area');assert.equal(spell.area!.mode,mode);
  assert.ok(spell.power>0);assert.ok(spell.area!.radius>0);
});

test('thunderstorm three-input recipe commits once, preserves unrelated items and equips its full 3x3 output',()=>{
  const recipe=magicRecipeDefinitions.find(recipe=>recipe.output==='thunderstorm')!;
  assert.ok(recipe);
  assert.deepEqual([...recipe.inputs].sort(),['thunder-field-bolt','area','double'].sort());
  const state=createFixtureState();
  state.wands[0]={...state.wands[0],width:5,height:5,placements:[],cooldowns:{}};
  state.items={kept:{id:'kept',definitionId:'spark',kind:'spell',level:1,grade:'common'}};
  state.backpack=['kept'];state.knowledge.recipeIds=[recipe.id];
  const placements=[{x:0,y:0},{x:2,y:0},{x:0,y:2}];
  const definitionIds=['thunder-field-bolt','area','double'];
  let placed=state;
  for(const [index,definitionId]of definitionIds.entries()) {
    const definition=catalog.spells[definitionId]??catalog.arcana[definitionId];assert.ok(definition);
    const id=`material-${index}`;
    placed={...placed,items:{...placed.items,[id]:{id,definitionId,kind:catalog.spells[definitionId]?'spell':'arcana',level:definition.level,grade:definition.grade}},backpack:[...placed.backpack,id]};
    const result=applyLoadoutCommand(placed,{id:`position-${index}`,type:'placeItem',wandId:'wand-1',itemId:id,...placements[index],rotation:0},catalog);
    assert.equal(result.result.status,'executed');placed=result.state;
  }
  const merge={id:'thunderstorm',type:'mergeRecipe',wandId:'wand-1',recipeId:recipe.id,itemIds:['material-0','material-1','material-2']} as const;
  const separated=structuredClone(placed);
  separated.wands[0].placements[2]={...separated.wands[0].placements[2],x:0,y:4};
  const rejected=applyLoadoutCommand(separated,{...merge,itemIds:[...merge.itemIds]},catalog);
  assert.equal(rejected.result.code,'INPUTS_NOT_ADJACENT');assert.equal(rejected.state,separated);assert.deepEqual(rejected.events,[]);
  assert.ok(merge.itemIds.every(id=>separated.items[id]));
  const before=structuredClone(placed);
  const result=applyLoadoutCommand(placed,{...merge,itemIds:[...merge.itemIds]},catalog);
  assert.equal(result.result.status,'executed');assert.deepEqual(placed,before);
  assert.equal(result.events.length,1);assert.equal(result.state.revision,placed.revision+1);
  assert.deepEqual(result.events[0].data.consumedItemIds,[...merge.itemIds]);
  assert.deepEqual(result.state.backpack,['kept','thunderstorm:output']);
  assert.ok(merge.itemIds.every(id=>!result.state.items[id]));
  assert.deepEqual(result.state.items.kept,placed.items.kept);
  assert.deepEqual(result.state.runStatistics,placed.runStatistics);
  assert.equal(result.state.items['thunderstorm:output'].definitionId,'thunderstorm');
  const output=catalog.spells.thunderstorm;
  assert.equal(output.shape.length,9);
  assert.deepEqual(new Set(output.shape.map(({x,y})=>`${x},${y}`)),new Set(Array.from({length:9},(_,i)=>`${i%3},${Math.floor(i/3)}`)));
  const equipped=applyLoadoutCommand(result.state,{id:'equip-thunderstorm',type:'placeItem',wandId:'wand-1',itemId:'thunderstorm:output',x:0,y:0,rotation:0},catalog);
  assert.equal(equipped.result.status,'executed');
  const compiled=compileWand(equipped.state,'wand-1',catalog)!.spells[0];
  assert.equal(compiled.id,'thunderstorm');assert.equal(compiled.effect,'area');assert.equal(compiled.area?.anchor,'field');
});
