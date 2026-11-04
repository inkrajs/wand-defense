import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button, DependencyGraph, PencilIcon, PencilSurface, PencilText, Tabs, type DependencyGraphRef, type DependencyGraphNode, type PencilIconPath } from "@inkra/react";
import type { Element, GameState } from "../contracts";
import { demoContent } from "../content/demo";
import { elementAppearances } from "../content/elements";
import { enrichMagicReward } from "../content/magicDescriptions";
import { GameTabsList } from "./GameTabsList";
import { getMagicPresentationIcon, MagicPresentationIcon } from "./magicPresentationIcons";
import { SkillTreeElementIcon } from "./SkillTreeElementIcon";
import { buildSkillTree, type SkillTreeFilter, type SkillTreeNode } from "./skillTreeModel";
import "./SkillTree.css";

const elements: readonly Element[] = ["fire", "water", "wood", "metal", "earth", "lightning", "wind", "light", "dark"];
const categories: readonly SkillTreeFilter[] = ["all", ...elements];
const unknownPaths: PencilIconPath[] = [{ d: "M8 8a4 4 0 1 1 6 3.5c-1.5.9-2 1.5-2 3M12 18v1", mode: "stroke" }];
const closePaths: PencilIconPath[] = [{ d: "M6 6l12 12M18 6 6 18", mode: "stroke" }];
const elementFallback: PencilIconPath[] = [{ d: "M12 3c-2 4-6 7-6 11a6 6 0 0 0 12 0c0-4-4-7-6-11Z", mode: "stroke" }];

type GraphNode = DependencyGraphNode<SkillTreeNode>;
function MagicIcon({ definitionId, size = 32 }: { definitionId: string; size?: number }) {
  return getMagicPresentationIcon(definitionId)
    ? <MagicPresentationIcon definitionId={definitionId} size={size} seed={`skill-tree-${definitionId}`} />
    : <PencilIcon paths={elementFallback} sourceSize={24} size={size} seed={`skill-tree-fallback-${definitionId}`} decorative />;
}
function nodeIcon(node: SkillTreeNode) {
  return node.known && node.definitionId ? <MagicIcon definitionId={node.definitionId} size={34} />
    : <PencilIcon paths={unknownPaths} sourceSize={24} size={30} seed="skill-tree-unknown" decorative />;
}

export function SkillTree({ state }: { state: GameState }) {
  const [element, setElement] = useState<SkillTreeFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const graphRef = useRef<DependencyGraphRef>(null);
  const [workspace, setWorkspace] = useState({width:0,height:0});
  const narrow = workspace.width < 600;
  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const measure = () => setWorkspace(previous => previous.width === node.clientWidth && previous.height === node.clientHeight ? previous : {width:node.clientWidth,height:node.clientHeight});
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  // A runtime tick can replace state objects without changing discovered knowledge.
  const knowledgeKey = JSON.stringify([state.knowledge.spellIds, state.knowledge.arcanaIds, state.knowledge.recipeIds]);
  const knowledge = useMemo(() => state.knowledge, [knowledgeKey]);
  const model = useMemo(() => buildSkillTree(demoContent, knowledge, element), [knowledge, element]);
  const nodes = useMemo<GraphNode[]>(() => model.nodes.map(node => ({
    id: node.id, label: node.known ? node.name : "未知", icon: nodeIcon(node), data: node,
  })), [model]);
  // Focus a readable root on phones and in large all-element graphs; fit-all remains available in controls.
  const focusInitial = narrow || (element === "all" && model.nodes.length > 24);
  useEffect(() => {
    if (!focusInitial || !workspace.width || !model.nodes.length) return;
    const origin = model.nodes.find(node => node.atomic && node.known && node.definitionId && (element === "all" || demoContent.spells[node.definitionId]?.element === element)) ?? model.nodes[0];
    const ids = [origin.id];
    let cancelled = false, frame = 0, attempts = 0;
    const fit = () => {
      void graphRef.current?.fitView({nodes: ids.map(id=>({id})), minZoom: .85, maxZoom: 1, padding: .15}).then(success => {
        if (!cancelled && !success && ++attempts < 12) frame = requestAnimationFrame(fit);
      });
    };
    frame = requestAnimationFrame(fit);
    return () => {cancelled=true;cancelAnimationFrame(frame);};
  }, [model, focusInitial, element, workspace.width, workspace.height]);
  const selected = useMemo(() => model.nodes.find(node => node.id === selectedId), [model, selectedId]);
  const nodesById = useMemo(() => new Map(model.nodes.map(node => [node.id, node])), [model]);
  const recipes = useMemo(() => selected?.known ? (selected.recipes ?? []).map(recipe => {
    const counts = new Map<string, number>();
    for (const id of recipe.inputs) counts.set(id, (counts.get(id) ?? 0) + 1);
    return [...counts].map(([id, count]) => ({ id, count, node: nodesById.get(id) }));
  }) : [], [selected, nodesById]);
  const spell = selected?.known && selected.kind === "spell" && selected.definitionId && Object.hasOwn(demoContent.spells, selected.definitionId) ? demoContent.spells[selected.definitionId] : undefined;
  const description = useMemo(() => {
    if (!selected?.known || !selected.definitionId) return undefined;
    return enrichMagicReward({ id: selected.id, kind: "item", definitionId: selected.definitionId, label: selected.name }, demoContent).description;
  }, [selected]);

  return <Tabs.Root ref={root} className="skill-tree" value={element} onValueChange={value => {
    if (categories.includes(value as SkillTreeFilter)) { setElement(value as SkillTreeFilter); setSelectedId(null); }
  }}>
    <GameTabsList className="skill-tree__tabs" aria-label="元素分类" overflow="scroll" labelVisibility="hidden">
      {categories.map(entry => <Tabs.Trigger key={entry} value={entry} aria-label={entry === "all" ? "全部" : `${elementAppearances[entry].name}系`} startIcon={<span style={{ color: entry === "all" ? "currentColor" : elementAppearances[entry].pigment }}><SkillTreeElementIcon element={entry} /></span>} />)}
    </GameTabsList>
    <Tabs.Content value={element} className="skill-tree__content">
      <DependencyGraph.Root ref={graphRef} className="skill-tree__graph" aria-label={element === "all" ? "全部技能树" : `${elementAppearances[element].name}系技能树`}
        nodes={nodes} edges={model.edges} direction={element === "all" ? narrow ? "TB" : "LR" : "RL"} nodeWidth={80} nodeHeight={80} rankGap={52} nodeGap={12} nodeVariant="icon"
        selectedId={selectedId} onSelectedIdChange={setSelectedId} highlight="both"
        onClick={event => { if (event.target instanceof Element && event.target.classList.contains("react-flow__pane")) setSelectedId(null); }}
        style={{ minHeight: 0 }}
        fitView={!focusInitial} hideAttribution minZoom={0.18} maxZoom={1.5} panOnDrag zoomOnPinch onlyRenderVisibleElements emptyState={<PencilText as="p">尚未发现</PencilText>}
        controls={{ zoomIn: true, zoomOut: true, fitView: true, position: "bottom-right" }} />
      {selected?.known && selected.definitionId && <PencilSurface as="aside" className="skill-tree__detail" variant="outline" seed={`skill-tree-detail-${selected.id}`} aria-label={`${selected.name}详情`}>
        <Button className="skill-tree__detail-close" type="button" size="icon" variant="ghost" aria-label="关闭详情" onClick={() => setSelectedId(null)}><PencilIcon paths={closePaths} sourceSize={24} size={24} decorative /></Button>
        <div className="skill-tree__detail-heading"><MagicIcon definitionId={selected.definitionId} size={40} /><PencilText as="h3">{selected.name}</PencilText></div>
        {selected.kind === "spell" && selected.atomic && <PencilText as="p">原子法术</PencilText>}
        {description && <PencilText as="p">{description}</PencilText>}
        {recipes.length > 0 && <div className="skill-tree__recipes" aria-label="已知配方">{recipes.map((ingredients, recipeIndex) => <div className="skill-tree__recipe" key={recipeIndex} role="group" aria-label={`配方 ${recipeIndex + 1}`}>
          {ingredients.map(({ id, count, node }, index) => {
            const name = node?.known ? node.name : "未知";
            return <span className="skill-tree__ingredient" key={id} aria-label={`${name}，${count} 份`}>
              {index > 0 && <span className="skill-tree__ingredient-plus" aria-hidden="true">+</span>}
              {node?.known && node.definitionId ? <MagicIcon definitionId={node.definitionId} size={24} /> : <PencilIcon paths={unknownPaths} sourceSize={24} size={24} seed="skill-tree-ingredient-unknown" decorative />}
              <PencilText as="span">{`${name}${count > 1 ? ` ×${count}` : ""}`}</PencilText>
            </span>;
          })}
        </div>)}</div>}
        {spell && <dl className="skill-tree__detail-stats">
          {[["法力", spell.manaCost], ["冷却", `${spell.cooldownMs / 1000} 秒`], ["射程", spell.range], ["威力", spell.power]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>}
      </PencilSurface>}
    </Tabs.Content>
  </Tabs.Root>;
}
