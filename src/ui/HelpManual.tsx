import { PencilIcon, PencilText, Tabs, type PencilIconPath } from "@inkra/react";
import { useState } from "react";
import { demoContent } from "../content/demo";
import { baseMagicDefinitionIds } from "../content/magicRecipes";
import { gradeDefinitions, gradeOrder } from "../content/grades";
import { enrichMagicReward } from "../content/magicDescriptions";
import { compileWand } from "../loadout/compile";
import type { GameState, RecipeDefinition } from "../contracts";
import { GameTabsList } from "./GameTabsList";
import { getMagicPresentationIcon, MagicPresentationIcon } from "./magicPresentationIcons";
import "./HelpManual.css";

const recipeIcon: PencilIconPath[] = [{ d: "M4 5h16v14H4zM8 9h8M8 13h5", mode: "stroke" }];
const gradeIcon: PencilIconPath[] = [{ d: "M12 3 14 9l6 .5-4.5 4 1.5 6L12 16l-5 3.5 1.5-6L4 9.5 10 9l2-6Z", mode: "stroke" }];
const adjacentIcon: PencilIconPath[] = [{ d: "M3 6h8v12H3zM13 6h8v12h-8zM11 12h2", mode: "stroke" }];
const elementLabels: Record<string, string> = { fire: "火", water: "水", wood: "木", metal: "金", earth: "土", lightning: "雷", wind: "风", light: "光", dark: "暗", neutral: "其他" };

function MagicToken({ id, known }: { id: string; known: Set<string> }) {
  const definition = known.has(id) ? demoContent.spells[id] ?? demoContent.arcana[id] : undefined;
  return <span className="help-manual__token">
    {definition && getMagicPresentationIcon(id) && <MagicPresentationIcon definitionId={id} size={32} seed={`manual-${id}`} />}
    <PencilText as="span">{definition?.name ?? "未知"}</PencilText>
  </span>;
}

function RecipeRoute({ recipe, known, knownRecipes, visited = new Set<string>() }: { recipe: RecipeDefinition; known: Set<string>; knownRecipes: Set<string>; visited?: Set<string> }) {
  const [open, setOpen] = useState(false);
  const nextVisited = new Set([...visited, recipe.id]);
  const prerequisites = recipe.inputs.flatMap(id => {
    if (!known.has(id)) return [];
    const previous = demoContent.recipes.find(candidate => candidate.output === id && knownRecipes.has(candidate.id) && !nextVisited.has(candidate.id));
    return previous ? [previous] : [];
  });
  return <details className="help-manual__route" onToggle={event => setOpen(event.currentTarget.open)}><summary><span className="help-manual__formula">
    {recipe.inputs.map((id, index) => <span className="help-manual__term" key={`${id}-${index}`}>{index > 0 && <span className="help-manual__operator" aria-hidden="true">+</span>}<MagicToken id={id} known={known} /></span>)}
    <span className="help-manual__operator" aria-label="合成得到">→</span><MagicToken id={recipe.output} known={known} />
  </span></summary>{open && <div className="help-manual__route-detail"><PencilText as="span">{recipe.requireAdjacency ? "材料相邻后合成" : "合成新物品"}</PencilText>
    {prerequisites.map(previous => <RecipeRoute key={previous.id} recipe={previous} known={known} knownRecipes={knownRecipes} visited={nextVisited} />)}
  </div>}</details>;
}

export function HelpManual({ state }: { state: GameState }) {
  const [tab, setTab] = useState("recipes");
  const known = new Set([...state.knowledge.spellIds, ...state.knowledge.arcanaIds]);
  const knownRecipes = new Set(state.knowledge.recipeIds);
  const examples = tab === "arcana" ? state.wands.flatMap(wand => compileWand(state, wand.id, demoContent)?.spells.flatMap(spell =>
    spell.modifierItemIds.flatMap(id => {
      const item = state.items[id];
      const modifier = item?.kind === "arcana" && known.has(item.definitionId) ? demoContent.arcana[item.definitionId] : undefined;
      return modifier && known.has(spell.id) ? [{ spell, modifier, key: `${wand.id}:${spell.itemId}:${id}` }] : [];
    })) ?? []) : [];
  const roots = baseMagicDefinitionIds.filter(id => known.has(id) && demoContent.spells[id]);
  const groups = new Map<string, RecipeDefinition[]>();
  let unknownCount = 0;
  for (const recipe of demoContent.recipes) {
    if (!knownRecipes.has(recipe.id)) { unknownCount++; continue; }
    const group = known.has(recipe.output) ? demoContent.spells[recipe.output]?.element ?? "neutral" : "neutral";
    const entries = groups.get(group) ?? [];
    entries.push(recipe); groups.set(group, entries);
  }
  return <Tabs.Root value={tab} onValueChange={setTab} className="help-manual">
    <GameTabsList aria-label="手册分类" className="help-manual__tabs">
      <Tabs.Trigger value="recipes" startIcon={<PencilIcon paths={recipeIcon} size={32} sourceSize={24} decorative />}>合成</Tabs.Trigger>
      <Tabs.Trigger value="grades" startIcon={<PencilIcon paths={gradeIcon} size={32} sourceSize={24} decorative />}>品质</Tabs.Trigger>
      <Tabs.Trigger value="arcana" startIcon={<PencilIcon paths={adjacentIcon} size={32} sourceSize={24} decorative />}>搭配</Tabs.Trigger>
    </GameTabsList>
    <Tabs.Content value="recipes" className="help-manual__content">{tab === "recipes" && <>
      {roots.length > 0 && <section><PencilText as="h3">奖励获得</PencilText><div className="help-manual__roots">{roots.map(id => <MagicToken key={id} id={id} known={known} />)}</div></section>}
      <div className="help-manual__groups">{Array.from(groups, ([group, recipes]) => <section key={group}><PencilText as="h3">{elementLabels[group] ?? "其他"}</PencilText><div className="help-manual__routes">{recipes.map(recipe => <RecipeRoute key={recipe.id} recipe={recipe} known={known} knownRecipes={knownRecipes} />)}</div></section>)}</div>
      {unknownCount > 0 && <PencilText as="p" className="help-manual__muted">{`未发现配方 · ${unknownCount}`}</PencilText>}
      {!groups.size && !unknownCount && <PencilText as="p">暂无配方</PencilText>}
    </>}</Tabs.Content>
    <Tabs.Content value="grades" className="help-manual__content">{tab === "grades" && <><p>同名同品质的两个法术或奥术可合成更高一档；神话为最高品质。</p><ol className="help-manual__grades">{gradeOrder.map(grade => <li key={grade}><PencilIcon paths={gradeIcon} size={32} sourceSize={24} decorative style={{ color: gradeDefinitions[grade].color }} /><PencilText as="span">{gradeDefinitions[grade].name}</PencilText></li>)}</ol></>}</Tabs.Content>
    <Tabs.Content value="arcana" className="help-manual__content">{tab === "arcana" && <><p>奥术与法术相邻时修改施法，不消耗奥术。</p>{examples.length ? <div className="help-manual__groups">{examples.map(({ spell, modifier, key }) => {
      const detail = enrichMagicReward({ id: modifier.id, kind: "item", label: modifier.name, definitionId: modifier.id }, demoContent).description;
      return <div className="help-manual__combination" key={key}><span className="help-manual__formula"><MagicToken id={spell.id} known={known} /><span className="help-manual__operator" aria-hidden="true">+</span><MagicToken id={modifier.id} known={known} /></span>{detail && <span className="help-manual__muted">{detail}</span>}</div>;
    })}</div> : <p className="help-manual__muted">将已发现的法术与奥术放在法杖相邻位置，可查看生效的搭配。</p>}</>}</Tabs.Content>
  </Tabs.Root>;
}
