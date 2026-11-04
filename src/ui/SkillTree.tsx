import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DependencyGraph, PencilIcon, PencilText, Tabs, type DependencyGraphRef, type DependencyGraphNode, type DependencyGraphNodeRenderState, type PencilIconPath } from "@inkra/react";
import type { Element, GameState } from "../contracts";
import { demoContent } from "../content/demo";
import { elementAppearances } from "../content/elements";
import { enrichMagicReward } from "../content/magicDescriptions";
import { GameTabsList } from "./GameTabsList";
import { getMagicPresentationIcon, MagicPresentationIcon } from "./magicPresentationIcons";
import { buildSkillTree, type SkillTreeNode } from "./skillTreeModel";
import "./SkillTree.css";

const elements: readonly Element[] = ["fire", "water", "wood", "metal", "earth", "lightning", "wind", "light", "dark"];
const representatives: Record<Element, string> = { fire: "spark", water: "water-bolt", wood: "regrowth", metal: "metal-needle", earth: "rock-shot", lightning: "lightning-bolt", wind: "wind-blade", light: "light-arrow", dark: "dark-orb" };
const unknownPaths: PencilIconPath[] = [{ d: "M8 8a4 4 0 1 1 6 3.5c-1.5.9-2 1.5-2 3M12 18v1", mode: "stroke" }];
const joinPaths: PencilIconPath[] = [{ d: "M12 5v14M5 12h14", mode: "stroke" }];
const elementFallback: PencilIconPath[] = [{ d: "M12 3c-2 4-6 7-6 11a6 6 0 0 0 12 0c0-4-4-7-6-11Z", mode: "stroke" }];

type GraphNode = DependencyGraphNode<SkillTreeNode>;
function MagicIcon({ definitionId, size = 32 }: { definitionId: string; size?: number }) {
  return getMagicPresentationIcon(definitionId)
    ? <MagicPresentationIcon definitionId={definitionId} size={size} seed={`skill-tree-${definitionId}`} />
    : <PencilIcon paths={elementFallback} sourceSize={24} size={size} seed={`skill-tree-fallback-${definitionId}`} decorative />;
}
function NodeContent({ node, surface }: { node: SkillTreeNode; surface: DependencyGraphNodeRenderState["renderSurface"] }) {
  const known = node.known;
  return surface(<div className="skill-tree__node">
    {known && node.kind === "recipe" ? <PencilIcon paths={joinPaths} sourceSize={24} size={30} seed={`skill-tree-join-${node.id}`} decorative />
      : known && node.definitionId ? <MagicIcon definitionId={node.definitionId} size={34} />
      : <PencilIcon paths={unknownPaths} sourceSize={24} size={30} seed="skill-tree-unknown" decorative />}
    <PencilText as="span" className="skill-tree__node-name">{known ? node.kind === "recipe" ? "合成" : node.name : "未知"}</PencilText>
  </div>);
}

export function SkillTree({ state }: { state: GameState }) {
  const [element, setElement] = useState<Element>("fire");
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
    id: node.id, label: node.known ? node.kind === "recipe" ? "合成" : node.name : "未知", data: node,
  })), [model]);
  // A phone opens on a readable atomic root, rather than the clipped middle of a huge tree.
  useEffect(() => {
    if (!narrow || !workspace.width || !model.nodes.length) return;
    const origin = model.nodes.find(node => node.atomic && node.known && node.definitionId && demoContent.spells[node.definitionId]?.element === element) ?? model.nodes[0];
    const ids = [origin.id];
    let cancelled = false, frame = 0, attempts = 0;
    const fit = () => {
      void graphRef.current?.fitView({nodes: ids.map(id=>({id})), minZoom: .85, maxZoom: 1, padding: .15}).then(success => {
        if (!cancelled && !success && ++attempts < 12) frame = requestAnimationFrame(fit);
      });
    };
    frame = requestAnimationFrame(fit);
    return () => {cancelled=true;cancelAnimationFrame(frame);};
  }, [model, narrow, element, workspace.width, workspace.height]);
  const selected = useMemo(() => model.nodes.find(node => node.id === selectedId), [model, selectedId]);
  const renderNode = useCallback((node: GraphNode, renderState: DependencyGraphNodeRenderState) => node.data
    ? <NodeContent node={node.data} surface={renderState.renderSurface} /> : null, []);
  const description = useMemo(() => {
    if (!selected?.known || !selected.definitionId || selected.kind === "recipe") return undefined;
    return enrichMagicReward({ id: selected.id, kind: "item", definitionId: selected.definitionId, label: selected.name }, demoContent).description;
  }, [selected]);
  const nodesById = useMemo(() => new Map(model.nodes.map(node => [node.id, node])), [model]);
  const recipe = useMemo(() => selected?.known ? selected.kind === "recipe" ? selected : model.nodes.find(node => node.kind === "recipe" && node.known && node.output === selected.id) : undefined, [model, selected]);

  return <Tabs.Root ref={root} className="skill-tree" value={element} onValueChange={value => {
    if (elements.includes(value as Element)) { setElement(value as Element); setSelectedId(null); }
  }}>
    <GameTabsList className="skill-tree__tabs" aria-label="元素分类" overflow="scroll" labelVisibility="hidden">
      {elements.map(entry => <Tabs.Trigger key={entry} value={entry} aria-label={`${elementAppearances[entry].name}系`} startIcon={<span style={{ color: elementAppearances[entry].pigment }}><MagicIcon definitionId={representatives[entry]} size={32} /></span>} />)}
    </GameTabsList>
    <Tabs.Content value={element} className="skill-tree__content">
      <DependencyGraph.Root ref={graphRef} className="skill-tree__graph" aria-label={`${elementAppearances[element].name}系技能树`}
        nodes={nodes} edges={model.edges} direction={narrow ? "TB" : "LR"} nodeWidth={112} nodeHeight={72} rankGap={72} nodeGap={24}
        selectedId={selectedId} onSelectedIdChange={setSelectedId} highlight="both" renderNode={renderNode}
        fitView={!narrow} hideAttribution={false} minZoom={0.85} maxZoom={1.5} panOnDrag zoomOnPinch onlyRenderVisibleElements emptyState={<PencilText as="p">尚未发现</PencilText>}
        controls={{ zoomIn: true, zoomOut: true, fitView: true, position: "bottom-right" }} />
      {selected && <div className="skill-tree__detail" aria-live="polite">
        {!selected.known ? <PencilText as="p">未知</PencilText> : <>
          {selected.kind === "spell" && selected.atomic && <PencilText as="p">原子法术</PencilText>}
          {description && <PencilText as="p">{description}</PencilText>}
          {recipe?.inputs && <div className="skill-tree__inputs" aria-label="合成所需材料">{recipe.inputs.map((id, index) => {
            const ingredient = nodesById.get(id);
            return <span key={`${id}-${index}`} className="skill-tree__input">
              {index > 0 && <PencilIcon paths={joinPaths} sourceSize={24} size={18} decorative />}
              {ingredient?.known && ingredient.definitionId && ingredient.kind !== "recipe" ? <MagicIcon definitionId={ingredient.definitionId} size={24} /> : <PencilIcon paths={unknownPaths} sourceSize={24} size={24} decorative />}
            </span>;
          })}</div>}
        </>}
      </div>}
    </Tabs.Content>
  </Tabs.Root>;
}
