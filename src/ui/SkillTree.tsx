import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  const root = useRef<HTMLDivElement>(null);
  const graphRef = useRef<DependencyGraphRef>(null);
  const [viewport, setViewport] = useState<"pending" | "narrow" | "wide">("pending");
  const narrow = viewport !== "wide";
  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const measure = () => {
      if (node.clientWidth > 0) setViewport(node.clientWidth < 600 ? "narrow" : "wide");
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
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
  // Avoid mounting the whole graph for the initial fit. Its built-in culling
  // can stay active from the first render with an explicit focus target.
  const focusedElement = useRef<Element | "arcana" | null>(null);
  useEffect(() => {
    if (focusedElement.current === element || viewport === "pending" || !model.nodes.length) return;
    const origin = model.nodes.find(node => node.atomic && node.known && !node.boundary)
      ?? model.nodes.find(node => node.known && !node.boundary) ?? model.nodes[0];
    const progression = element === "arcana" && !narrow
      ? ["arcana:double", "arcana:quadruple", "arcana:sextuple"].filter(id => model.nodes.some(node => node.id === id && node.known))
      : [];
    const nodes = (progression.length ? progression : [origin.id]).map(id => ({id}));
    let cancelled = false, frame = 0, attempts = 0;
    const fit = () => {
      void graphRef.current?.fitView({nodes, minZoom: narrow ? .85 : .65, maxZoom: 1, padding: .2}).then(success => {
        if (cancelled) return;
        if (success) focusedElement.current = element;
        else if (++attempts < 12) frame = requestAnimationFrame(fit);
      });
    };
    frame = requestAnimationFrame(fit);
    return () => {cancelled=true;cancelAnimationFrame(frame);};
  }, [model, element, viewport, narrow]);
  const selectNode = useCallback((id: string | null) => {
    setSelectedId(id);
    setDetailPath(path => path.length ? [] : path);
  }, []);
  const selected = useMemo(() => model.nodes.find(node => node.id === selectedId), [model, selectedId]);
  const definitionId = selected?.known ? detailPath.at(-1) ?? selected.definitionId : undefined;
  const definition = definitionId && (demoContent.spells[definitionId] ?? demoContent.arcana[definitionId]);
  const recipes = useMemo(() => definitionId
    ? getKnownRecipesForDefinition(demoContent, knowledge, definitionId) : [], [definitionId, knowledge]);
  const spell = definitionId && Object.hasOwn(demoContent.spells, definitionId) ? demoContent.spells[definitionId] : undefined;
  const description = useMemo(() => {
    if (!definitionId || !definition) return undefined;
    return enrichMagicReward({ id: definitionId, kind: "item", definitionId, label: definition.name }, demoContent).description;
  }, [definitionId, definition]);

  return <Tabs.Root ref={root} className="skill-tree" value={element} onValueChange={value => {
    if (value === "arcana" || elements.includes(value as Element)) { focusedElement.current = null; setElement(value as Element | "arcana"); setSelectedId(null); setDetailPath([]); }
  }}>
    <GameTabsList className="skill-tree__tabs" aria-label="技能树分类" overflow="scroll" labelVisibility="hidden">
      <Tabs.Trigger value="arcana" aria-label="奥术" startIcon={<span style={{color:"var(--inkra-selection-pigment)"}}><SkillTreeElementIcon element="arcana" /></span>} />
      {elements.map(entry => <Tabs.Trigger key={entry} value={entry} aria-label={`${elementAppearances[entry].name}系`} startIcon={<span style={{ color: elementAppearances[entry].pigment }}><SkillTreeElementIcon element={entry} /></span>} />)}
    </GameTabsList>
    <Tabs.Content value={element} className="skill-tree__content" onKeyDown={event => {
      if (event.key === "Escape" && selectedId !== null && !event.defaultPrevented) {
        event.preventDefault();
        selectNode(null);
      }
    }}>
      <DependencyGraph.Root ref={graphRef} className="skill-tree__graph" aria-label={element === "arcana" ? "奥术技能树" : `${elementAppearances[element].name}系技能树`}
        nodes={nodes} edges={model.edges} direction="LR" nodeWidth={80} nodeHeight={80} rankGap={52} nodeGap={12} nodeVariant="icon"
        selectedId={selectedId} onSelectedIdChange={selectNode} highlight="both"
        onClick={event => { if (event.target instanceof Element && event.target.classList.contains("react-flow__pane")) {setSelectedId(null); setDetailPath([]);} }}
        style={graphStyle}
        fitView={false} hideAttribution minZoom={0.06} maxZoom={1.5} panOnDrag zoomOnPinch onlyRenderVisibleElements emptyState={<PencilText as="p">尚未发现</PencilText>}
        controls={graphControls} />
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
