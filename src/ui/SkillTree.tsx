import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as Inkra from "@inkra/react";
import { Button, DependencyGraph, PencilIcon, PencilLine, PencilSurface, PencilText, Tabs, Tooltip, type DependencyGraphRef, type DependencyGraphNode, type PencilIconPath } from "@inkra/react";
import type { Element, GameState, RecipeDefinition } from "../contracts";
import { findRecipeExample } from "../loadout/recipe-layout";
import { rotateShape } from "../loadout/geometry";
import { demoContent } from "../content/demo";
import { baseMagicDefinitionIds } from "../content/magicRecipes";
import { elementAppearances } from "../content/elements";
import { enrichMagicReward } from "../content/magicDescriptions";
import { GameTabsList } from "./GameTabsList";
import { GamePencilShape } from "./GamePencilShape";
import { getMagicPresentationIcon, MagicPresentationIcon } from "./magicPresentationIcons";
import { SkillTreeElementIcon } from "./SkillTreeElementIcon";
import { buildSkillTree, getKnownRecipesForDefinition, type SkillTreeNode } from "./skillTreeModel";
import "./SkillTree.css";

const elements: readonly Element[] = ["fire", "water", "wood", "metal", "earth", "lightning", "wind", "light", "dark", "undead"];
const unknownPaths: PencilIconPath[] = [{ d: "M8 8a4 4 0 1 1 6 3.5c-1.5.9-2 1.5-2 3M12 18v1", mode: "stroke" }];
const closePaths: PencilIconPath[] = [{ d: "M6 6l12 12M18 6 6 18", mode: "stroke" }];
const backPaths: PencilIconPath[] = [{ d: "M19 12H5m0 0 6-6m-6 6 6 6", mode: "stroke" }];
const elementFallback: PencilIconPath[] = [{ d: "M12 3c-2 4-6 7-6 11a6 6 0 0 0 12 0c0-4-4-7-6-11Z", mode: "stroke" }];
const prismGlyph: PencilIconPath[] = [
  {d:"M3 12h5m8 0h5M12 4l5 8-5 8-5-8 5-8Z",mode:"stroke"},
  {d:"m17 10 4-3m-4 7 4 3M4 8h2m-2 8h2",mode:"stroke"},
];

type GraphNode = DependencyGraphNode<SkillTreeNode>;
function MagicIcon({ definitionId, size = 32 }: { definitionId: string; size?: number }) {
  if (definitionId === "prism-ray") return <PencilIcon paths={prismGlyph} sourceSize={24} size={size}
    seed="skill-tree-prism-ray" style={{color:demoContent.spells[definitionId].asset.color}} decorative />;
  return getMagicPresentationIcon(definitionId)
    ? <MagicPresentationIcon definitionId={definitionId} size={size} seed={`skill-tree-${definitionId}`} />
    : <PencilIcon paths={elementFallback} sourceSize={24} size={size} seed={`skill-tree-fallback-${definitionId}`} decorative />;
}
function nodeIcon(node: SkillTreeNode) {
  return node.known && node.definitionId ? <MagicIcon definitionId={node.definitionId} size={34} />
    : <PencilIcon paths={unknownPaths} sourceSize={24} size={30} seed="skill-tree-unknown" decorative />;
}

function RecipePreview({ recipe, onSelect }: { recipe: RecipeDefinition; onSelect: (definitionId: string) => void }) {
  const placements = useMemo(() => findRecipeExample(recipe, demoContent), [recipe]);
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(180);
  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const measure = () => {
      const width = board.getBoundingClientRect().width;
      if (width > 0) setBoardSize(previous => Math.abs(previous - width) < 0.5 ? previous : width);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    return () => observer.disconnect();
  }, [recipe]);
  if (!placements) return null;
  const cellSize = boardSize / 5;
  return <Tooltip.Provider delayDuration={250}><div ref={boardRef} className="skill-tree__recipe-board" role="group" aria-label={`法杖配方：${placements.map(item => (demoContent.spells[item.definitionId] ?? demoContent.arcana[item.definitionId]).name).join("、")}`}>
    {Array.from({length:6}, (_, index) => <span key={index} aria-hidden="true">
      <PencilLine className="skill-tree__recipe-line skill-tree__recipe-line--horizontal" orientation="horizontal" seed={`recipe-row-${recipe.id}-${index}`} style={{top:`${index * 20}%`}} />
      <PencilLine className="skill-tree__recipe-line skill-tree__recipe-line--vertical" orientation="vertical" seed={`recipe-column-${recipe.id}-${index}`} style={{left:`${index * 20}%`}} />
    </span>)}
    {placements.map(({definitionId, placement}, index) => {
      const definition = demoContent.spells[definitionId] ?? demoContent.arcana[definitionId];
      const cells = rotateShape(definition.shape, placement.rotation);
      const width = (Math.max(...cells.map(cell => cell.x)) + 1) * cellSize;
      const height = (Math.max(...cells.map(cell => cell.y)) + 1) * cellSize;
      const description = enrichMagicReward({id:`recipe-material-${index}`,kind:"item",definitionId,label:definition.name},demoContent).description;
      return <span className="skill-tree__recipe-item" key={index} style={{left:placement.x * cellSize, top:placement.y * cellSize, width, height}}>
        <GamePencilShape geometry={{type:"cells",cells,cellSize:1}} width={width} height={height} fit="stretch"
          color={definition.asset.color} opacity={0.25} outlineColor={definition.asset.color} outlineWidth={0.7} seed={`recipe-${recipe.id}-${index}`} decorative />
        <span className="skill-tree__recipe-icon"><MagicPresentationIcon definitionId={definitionId} size={Math.max(1, Math.max(width,height) - 8)} rotation={(placement.rotation * 90) as 0|90|180|270} seed={`recipe-icon-${recipe.id}-${index}`} /></span>
        {cells.map((cell, cellIndex) => <Tooltip.Root key={`${cell.x},${cell.y}`}>
          <Tooltip.Trigger asChild><button type="button" className="skill-tree__recipe-hit"
            style={{left:cell.x * cellSize,top:cell.y * cellSize,width:cellSize,height:cellSize}}
            aria-label={`${definition.name}${description ? `：${description}` : ""}`} tabIndex={cellIndex === 0 ? 0 : -1} aria-hidden={cellIndex === 0 ? undefined : true}
            onClick={() => onSelect(definitionId)} /></Tooltip.Trigger>
          <Tooltip.Portal><Tooltip.Content className="skill-tree__recipe-tooltip" side="left" collisionPadding={12}>
            <strong>{definition.name}</strong>{description && <span>{description}</span>}
          </Tooltip.Content></Tooltip.Portal>
        </Tooltip.Root>)}
      </span>;
    })}
  </div></Tooltip.Provider>;
}

type SkillTreeProps = { knowledge: GameState["knowledge"] };
const knowledgeLists = ["spellIds", "arcanaIds", "recipeIds"] as const;
const graphControls = { zoomIn: true, zoomOut: true, fitView: true, position: "bottom-left" } as const;
const graphStyle = { minHeight: 0 };
const graphLayout = { direction: "LR", nodeWidth: 80, nodeHeight: 80, rankGap: 52, nodeGap: 12 } as const;
type LayoutNode = { position: { x: number; y: number }; width: number; height: number };
// The registry build has DependencyGraph but does not export its layout helper.
const layoutDependencyGraph = Reflect.get(Inkra, "layoutDependencyGraph") as
  | ((nodes: GraphNode[], edges: ReturnType<typeof buildSkillTree>["edges"], options: typeof graphLayout) => { nodes: LayoutNode[] })
  | undefined;

function sameKnowledge(previous: SkillTreeProps, next: SkillTreeProps) {
  return knowledgeLists.every(key => {
    const a = previous.knowledge[key], b = next.knowledge[key];
    return a === b || (a.length === b.length && a.every((id, index) => id === b[index]));
  });
}

export const SkillTree = memo(function SkillTree({ knowledge }: SkillTreeProps) {
  const [element, setElement] = useState<Element | "arcana">("fire");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailPath, setDetailPath] = useState<string[]>([]);
  const graphArea = useRef<HTMLDivElement>(null);
  const graphRef = useRef<DependencyGraphRef>(null);
  const lastFocus = useRef<{ element: Element | "arcana"; detailId: string | null; id: string;
    width: number; height: number; viewport: ReturnType<DependencyGraphRef["getViewport"]> } | null>(null);
  const models = useMemo(() => new Map<Element | "arcana", ReturnType<typeof buildSkillTree>>(), [
    knowledge.spellIds, knowledge.arcanaIds, knowledge.recipeIds,
  ]);
  const model = useMemo(() => {
    const existing = models.get(element);
    if (existing) return existing;
    const next = buildSkillTree(demoContent, knowledge, element);
    models.set(element, next);
    return next;
  }, [knowledge, element, models]);
  const nodes = useMemo<GraphNode[]>(() => model.nodes.map(node => ({
    id: node.id, label: node.known ? node.name : "未知", icon: nodeIcon(node), data: node,
  })), [model]);
  const graphBounds = useMemo(() => {
    if (!nodes.length) return null;
    const layout = layoutDependencyGraph?.(nodes, model.edges, graphLayout).nodes;
    if (!layout) {
      // Even the widest chain and tallest rank of this size must fit.
      const gaps = nodes.length - 1;
      return {
        width: nodes.length * graphLayout.nodeWidth + gaps * graphLayout.rankGap,
        height: nodes.length * graphLayout.nodeHeight + gaps * graphLayout.nodeGap,
      };
    }
    if (!layout.length) return null;
    const left = Math.min(...layout.map(node => node.position.x));
    const top = Math.min(...layout.map(node => node.position.y));
    return {
      width: Math.max(...layout.map(node => node.position.x + node.width)) - left,
      height: Math.max(...layout.map(node => node.position.y + node.height)) - top,
    };
  }, [nodes, model.edges]);
  const selectNode = useCallback((id: string | null) => {
    setSelectedId(id);
    setDetailPath(path => path.length ? [] : path);
  }, []);
  const selected = useMemo(() => model.nodes.find(node => node.id === selectedId), [model, selectedId]);
  const definitionId = selected?.known ? detailPath.at(-1) ?? selected.definitionId : undefined;
  const definition = definitionId && (demoContent.spells[definitionId] ?? demoContent.arcana[definitionId]);
  const detailId = definition ? selectedId : null;
  const originId = (model.nodes.find(node => node.atomic && node.known && !node.boundary)
    ?? model.nodes.find(node => node.known && !node.boundary) ?? model.nodes[0])?.id;
  useLayoutEffect(() => {
    const area = graphArea.current;
    if (!area || !originId || !graphBounds) return;
    let disposed = false, frame = 0, attempts = 0;
    const fit = async () => {
      frame = 0;
      const graph = graphRef.current;
      const { clientWidth: width, clientHeight: height } = area;
      if (!graph || !width || !height) return;
      const previous = lastFocus.current;
      const initial = previous?.element !== element;
      const changedSize = previous?.width !== width || previous.height !== height;
      const current = graph.getViewport();
      const manuallyMoved = previous && (Math.abs(previous.viewport.x - current.x) > .5
        || Math.abs(previous.viewport.y - current.y) > .5 || Math.abs(previous.viewport.zoom - current.zoom) > .001);
      const docked = area.parentElement!.clientWidth >= 600;
      const changedDetail = docked && previous?.detailId !== detailId;
      if (!initial && !changedDetail && (!changedSize || manuallyMoved)) return;
      const id = docked && detailId ? detailId : (!initial && model.nodes.some(node => node.id === previous.id) ? previous.id : originId);
      const zoom = initial ? 1 : current.zoom;
      const fitsWholeTree = graphBounds.width * zoom <= width && graphBounds.height * zoom <= height;
      const success = await graph.fitView({nodes: fitsWholeTree ? undefined : [{id}], minZoom: zoom, maxZoom: zoom});
      if (disposed) return;
      if (success) lastFocus.current = {element, detailId, id, width, height, viewport: graph.getViewport()};
      else if (++attempts < 12) schedule();
    };
    // React Flow observes the same resize. Fit after its dimensions have updated.
    const schedule = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { frame = requestAnimationFrame(fit); });
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(area);
    schedule();
    return () => { disposed = true; observer.disconnect(); cancelAnimationFrame(frame); };
  }, [element, originId, detailId, model, graphBounds]);
  const recipes = useMemo(() => definitionId
    ? getKnownRecipesForDefinition(demoContent, knowledge, definitionId) : [], [definitionId, knowledge]);
  const spell = definitionId && Object.hasOwn(demoContent.spells, definitionId) ? demoContent.spells[definitionId] : undefined;
  const description = useMemo(() => {
    if (!definitionId || !definition) return undefined;
    return enrichMagicReward({ id: definitionId, kind: "item", definitionId, label: definition.name }, demoContent).description;
  }, [definitionId, definition]);

  return <Tabs.Root className="skill-tree" value={element} onValueChange={value => {
    if (value === "arcana" || elements.includes(value as Element)) { lastFocus.current = null; setElement(value as Element | "arcana"); setSelectedId(null); setDetailPath([]); }
  }}>
    <GameTabsList className="skill-tree__tabs" aria-label="技能树分类" overflow="scroll" labelVisibility="hidden">
      <Tabs.Trigger value="arcana" aria-label="奥术" startIcon={<span style={{color:"var(--inkra-selection-pigment)"}}><SkillTreeElementIcon element="arcana" /></span>} />
      {elements.map(entry => <Tabs.Trigger key={entry} value={entry} aria-label={`${elementAppearances[entry].name}系`} startIcon={<span style={{ color: elementAppearances[entry].pigment }}><SkillTreeElementIcon element={entry} /></span>} />)}
    </GameTabsList>
    <Tabs.Content value={element} className="skill-tree__content" data-detail-open={Boolean(detailId) || undefined} onKeyDown={event => {
      if (event.key === "Escape" && selectedId !== null && !event.defaultPrevented) {
        event.preventDefault();
        selectNode(null);
      }
    }}>
      <div className="skill-tree__graph-area" ref={graphArea}><DependencyGraph.Root ref={graphRef} className="skill-tree__graph" aria-label={element === "arcana" ? "奥术技能树" : `${elementAppearances[element].name}系技能树`}
        nodes={nodes} edges={model.edges} {...graphLayout} nodeVariant="icon"
        selectedId={selectedId} onSelectedIdChange={selectNode} highlight="both"
        onClick={event => { if (event.target instanceof Element && event.target.classList.contains("react-flow__pane")) {setSelectedId(null); setDetailPath([]);} }}
        style={graphStyle}
        fitView={false} hideAttribution minZoom={0.06} maxZoom={1.5} panOnDrag zoomOnPinch onlyRenderVisibleElements emptyState={<PencilText as="p">尚未发现</PencilText>}
        controls={graphControls} /></div>
      {definitionId && definition && <PencilSurface as="aside" className="skill-tree__detail" variant="outline" seed={`skill-tree-detail-${definitionId}`} aria-label={`${definition.name}详情`}>
        <Button className="skill-tree__detail-close" type="button" size="icon" variant="ghost" aria-label="关闭详情" onClick={() => {setSelectedId(null); setDetailPath([]);}}><PencilIcon paths={closePaths} sourceSize={24} size={24} decorative /></Button>
        {detailPath.length > 0 && <Button className="skill-tree__detail-back" type="button" size="icon" variant="ghost" aria-label="返回上一层法术详情" onClick={() => setDetailPath(path => path.slice(0,-1))}><PencilIcon paths={backPaths} sourceSize={24} size={24} decorative /></Button>}
        <div className={`skill-tree__detail-heading${detailPath.length ? " skill-tree__detail-heading--nested" : ""}`}><span className="skill-tree__detail-icon"><MagicIcon definitionId={definitionId} size={40} /></span><PencilText as="h3">{definition.name}</PencilText></div>
        {spell && baseMagicDefinitionIds.includes(definitionId) && <PencilText as="p">原子法术</PencilText>}
        {description && <PencilText as="p">{description}</PencilText>}
        {recipes.length > 0 && <div className="skill-tree__recipes" aria-label="已知法杖配方">
          {recipes.map(recipe => <RecipePreview key={recipe.id} recipe={recipe} onSelect={id => setDetailPath(path => [...path,id])} />)}
        </div>}
        {spell && <dl className="skill-tree__detail-stats">
          {[["法力", spell.manaCost], ["冷却", `${spell.cooldownMs / 1000} 秒`], ["射程", spell.range], ["威力", spell.power]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>}
      </PencilSurface>}
    </Tabs.Content>
  </Tabs.Root>;
}, sameKnowledge);
