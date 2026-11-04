import { useMemo, type CSSProperties } from "react";
import { PencilText, Tooltip } from "@inkra/react";
import { rotateInventoryCells } from "@inkra/react/inventory-grid";
import type { CharacterInstance, GameState, ItemInstance, WandInstance } from "../contracts";
import { demoContent } from "../content/demo";
import { elementAppearances } from "../content/elements";
import { gradeDefinitions } from "../content/grades";
import { getGameItemAppearance } from "./itemAppearance";
import { enrichMagicReward } from "../content/magicDescriptions";
import { AssetImage, resolveAsset } from "./assets";
import { GamePencilShape, type GamePencilShapeGeometry } from "./GamePencilShape";
import { getMagicPresentationIcon, MagicPresentationIcon } from "./magicPresentationIcons";
import type { CastFlashLookup } from "./wandMiniatureEvents";
import "./WandMiniatures.css";

const MAX_MINI_WANDS = 2;
const MAX_MINI_SIDE_PX = 36;

type MiniPlacement = {
  item: ItemInstance;
  label: string;
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
  cells: ReturnType<typeof rotateInventoryCells>;
  geometry: Extract<GamePencilShapeGeometry, { type: "cells" }>;
  elementName: string;
  gradeName: string;
  effectDescription: string;
  icon: ReturnType<typeof resolveAsset>;
  fillColor: string;
  outlineColor: string;
};

type Props = {
  state: GameState;
  characterId: string;
  activeCharacterId: string;
  flashes: CastFlashLookup;
  hideActive?: boolean;
};

export type WandPreviewProps = {
  state: GameState;
  wand: WandInstance;
  flashes?: CastFlashLookup;
  /** Maximum rendered side in CSS pixels; the wand keeps its actual aspect ratio. */
  size?: number;
  /** Adds item names and focusable effect tooltips for the large backpack preview only. */
  detailMode?: boolean;
};

function equippedWands(state: GameState, character: CharacterInstance): WandInstance[] {
  const seen = new Set<string>();
  return character.wandIds.flatMap(id => {
    if (seen.has(id)) return [];
    seen.add(id);
    const wand = state.wands.find(entry => entry.id === id && entry.characterId === character.id);
    return wand ? [wand] : [];
  }).slice(0, MAX_MINI_WANDS);
}

function miniPlacements(state: GameState, wand: WandInstance, detailMode = false): MiniPlacement[] {
  return wand.placements.flatMap(placement => {
    const item = state.items[placement.itemId];
    if (!item) return [];
    const definition = item.kind === "spell" ? demoContent.spells[item.definitionId] : demoContent.arcana[item.definitionId];
    const rotation = (placement.rotation * 90) as 0 | 90 | 180 | 270;
    const cells = rotateInventoryCells(definition?.shape?.length ? definition.shape : [{ x: 0, y: 0 }], rotation);
    if (!cells.length) return [];
    const appearance = getGameItemAppearance({
      kind: item.kind,
      definitionId: item.definitionId,
      element: item.kind === "spell" ? demoContent.spells[item.definitionId]?.element : undefined,
      grade: item.grade,
    });
    const spellElement = item.kind === "spell" ? demoContent.spells[item.definitionId]?.element : undefined;
    const elementName = spellElement ? elementAppearances[spellElement].name : item.kind === "arcana" ? "奥术" : "未知元素";
    const label = definition?.name ?? item.definitionId;
    const effectDescription = detailMode ? enrichMagicReward({ id: item.id, kind: "item", label, definitionId: item.definitionId }, demoContent).description ?? "暂无效果说明。" : "";
    return [{
      item,
      label,
      x: placement.x,
      y: placement.y,
      rotation,
      cells,
      elementName,
      gradeName: gradeDefinitions[item.grade].name,
      effectDescription,
      icon: resolveAsset(definition?.asset, { label, icon: item.kind === "spell" ? "✦" : "◇" }),
      fillColor: appearance.fillColor ?? "var(--inkra-selection-pigment)",
      outlineColor: appearance.outlineColor ?? "var(--inkra-ink)",
      geometry: { type: "cells", cells, cellSize: 1 },
    }];
  });
}

function wandLabel(wand: WandInstance, placements: MiniPlacement[], includeEffects = false): string {
  const details = placements.map(({ label, elementName, gradeName, effectDescription }) => {
    const summary = `${label}：${elementName}，${gradeName}`;
    return includeEffects && effectDescription ? `${summary}。${effectDescription}` : summary;
  });
  return [`${wand.name}，${gradeDefinitions[wand.grade].name}`, ...details].join("；");
}

/** Full actual spell/arcana summary for the public InventoryGrid host's label/title. */
export function getWandDetailLabel(state: GameState, wand: WandInstance): string {
  return wandLabel(wand, miniPlacements(state, wand, true), true);
}

/** Read-only library-shape projection of one wand's actual placements. */
export function WandPreview({ state, wand, flashes, size = MAX_MINI_SIDE_PX, detailMode = false }: WandPreviewProps) {
  const placements = useMemo(() => miniPlacements(state, wand, detailMode), [state, wand, detailMode]);
  const cellSize = Math.max(1, size) / Math.max(wand.width, wand.height, 1);
  const width = wand.width * cellSize;
  const height = wand.height * cellSize;
  const preview = <div className={`wand-preview${detailMode ? " wand-preview--details" : ""}`} style={{ width: `${width}px`, height: `${height}px`, "--wand-mini-cell-size": `${cellSize}px` } as CSSProperties} role={detailMode ? "group" : "img"} aria-label={wandLabel(wand, placements, detailMode)}>
    {placements.map(({ item, label, x, y, rotation, cells, geometry, fillColor, outlineColor, effectDescription, icon }) => {
      const shapeWidth = (Math.max(...cells.map(cell => cell.x)) + 1) * cellSize;
      const shapeHeight = (Math.max(...cells.map(cell => cell.y)) + 1) * cellSize;
      const hasFullPresentation = Boolean(getMagicPresentationIcon(item.definitionId));
      return <span
      key={`${wand.id}:${item.id}`}
      className={`wand-preview__item${detailMode ? " wand-preview__item--details" : ""}`}
      data-cast-flashing={flashes?.has(wand.id, item.id) ? "true" : undefined}
      style={{ left: `${x * cellSize}px`, top: `${y * cellSize}px`, width: `${shapeWidth}px`, height: `${shapeHeight}px` }}
      aria-hidden={!detailMode || undefined}
    >
        <GamePencilShape
          className="wand-preview__shape"
          geometry={geometry}
          width={shapeWidth}
          height={shapeHeight}
          fit="stretch"
          color={fillColor}
          outlineColor={outlineColor}
          outlineWidth={0.7}
          seed={`mini-item-${item.id}`}
          decorative
        />
        {detailMode && <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <span className="wand-preview__detail">
              <span className="wand-preview__detail-icon" aria-hidden="true">
                {hasFullPresentation
                  ? <MagicPresentationIcon definitionId={item.definitionId} size={20} rotation={rotation} seed={`wand-detail-icon-${item.definitionId}`} />
                  : <AssetImage asset={icon} />}
              </span>
              {!hasFullPresentation && <PencilText as="span" className="wand-preview__detail-name" seed={`wand-detail-name-${item.id}`}>{label}</PencilText>}
            </span>
          </Tooltip.Trigger>
          <Tooltip.Portal><Tooltip.Content side="top" align="center" seed={`wand-effect-${wand.id}-${item.id}`}>
            <PencilText as="span" seed={`wand-effect-text-${item.id}`}>{effectDescription}</PencilText>
          </Tooltip.Content></Tooltip.Portal>
        </Tooltip.Root>}
      </span>;
    })}
    </div>;
  return detailMode ? <Tooltip.Provider delayDuration={250}>{preview}</Tooltip.Provider> : preview;
}

export function WandMiniatures({ state, characterId, activeCharacterId, flashes, hideActive = false }: Props) {
  const character = state.characters.find(entry => entry.id === characterId);
  const isHiddenActive = hideActive && character?.id === activeCharacterId;
  const wands = useMemo(() => character ? equippedWands(state, character) : [], [state, character]);
  if (!character || wands.length === 0) return null;

  return <div className="wand-miniatures" data-character-id={character.id} data-active={isHiddenActive ? "true" : undefined} aria-hidden={isHiddenActive || undefined} aria-label={`${character.name} 的法杖缩略图`}>
    {wands.map(wand => <WandPreview key={wand.id} state={state} wand={wand} flashes={flashes} size={MAX_MINI_SIDE_PX} />)}
  </div>;
}
