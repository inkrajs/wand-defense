import { PencilIcon, type PencilIconPath } from "@inkra/react";
import { memo } from "react";

export interface CharacterPresentationIconDefinition {
  pathwayId: string;
  label: string;
  color: string;
  paths: readonly PencilIconPath[];
}

export interface CharacterPresentationIconProps {
  pathwayId?: string;
  seed: string;
  size?: number;
  characterName?: string;
}

const fireHat: readonly PencilIconPath[] = [
  { d: "M4 17c3-1 5-1 8-1s5 0 8 1l-1 2H5l-1-2Z", mode: "stroke" },
  { d: "M6 16c1-4 3-8 6-12 3 4 5 8 6 12", mode: "stroke" },
  { d: "M12 4c-.1 2.5.7 4 3 5m-5 4h4M5 17c4 1 10 1 14 0", mode: "stroke" },
];

const woodHat: readonly PencilIconPath[] = [
  { d: "M2 16c5-2 15-2 20 0l-1 2H3l-1-2Z", mode: "stroke" },
  { d: "M7 15c.5-4 2-7 5-10 3 3 4.5 6 5 10", mode: "stroke" },
  { d: "M10 12c1-2 3-3 6-3-.5 3-2 5-5 6m-1-3 5-3M8 14h8M3 16c5 .8 13 .8 18 0", mode: "stroke" },
];

const metalHat: readonly PencilIconPath[] = [
  { d: "M3 17c4-1 14-1 18 0l-1 2H4l-1-2Z", mode: "stroke" },
  { d: "M7 16 9 8l3-4 3 4 2 8", mode: "stroke" },
  { d: "M9 8h6m-3-3v7m-2 1h4M8 10h8M4 17c4 .7 12 .7 16 0", mode: "stroke" },
];

const balanceHat: readonly PencilIconPath[] = [
  { d: "M2 16c4-2 16-2 20 0l-1 2H3l-1-2Z", mode: "stroke" },
  { d: "M7 15 8 8l4-4 4 4 1 7", mode: "stroke" },
  { d: "M4 10h4m8 0h4M6 8v4m12-4v4m-2 3h-8M12 5v5m-1-1h2M3 16c5 1 13 1 18 0", mode: "stroke" },
];

const classicHat: readonly PencilIconPath[] = [
  { d: "M3 17c4-1 14-1 18 0l-1 2H4l-1-2Z", mode: "stroke" },
  { d: "M7 16c1-4 2-8 5-12 3 4 4 8 5 12", mode: "stroke" },
  { d: "M12 4c0 3 1 4 3 6m-5 3h4M4 17c4 1 12 1 16 0", mode: "stroke" },
];

const definitions: Record<string, CharacterPresentationIconDefinition> = {
  fire: { pathwayId: "fire", label: "火系折尖巫师帽", color: "#c65d38", paths: fireHat },
  wood: { pathwayId: "wood", label: "木系绿叶宽檐巫师帽", color: "#4f8056", paths: woodHat },
  metal: { pathwayId: "metal", label: "金系金色巫师帽", color: "#b18a35", paths: metalHat },
  balance: { pathwayId: "balance", label: "平衡系双衡巫师帽", color: "#655b91", paths: balanceHat },
  equilibrium: { pathwayId: "equilibrium", label: "平衡系双衡巫师帽", color: "#655b91", paths: balanceHat },
  balanced: { pathwayId: "balanced", label: "平衡系双衡巫师帽", color: "#655b91", paths: balanceHat },
  default: { pathwayId: "default", label: "巫师帽", color: "var(--inkra-ink-muted)", paths: classicHat },
};

export function getCharacterPresentationIcon(pathwayId?: string): CharacterPresentationIconDefinition {
  if (!pathwayId) return definitions.default;
  return definitions[pathwayId] ?? { ...definitions.default, pathwayId };
}

export const CharacterPresentationIcon = memo(function CharacterPresentationIcon({ pathwayId, seed, size = 88, characterName }: CharacterPresentationIconProps) {
  const icon = getCharacterPresentationIcon(pathwayId);
  return <PencilIcon
    paths={icon.paths}
    sourceSize={24}
    size={size}
    strokeWidth={0.8}
    seed={`${seed}-${icon.pathwayId}`}
    className="character-presentation-icon"
    style={{ color: icon.color }}
    role="img"
    aria-label={characterName ? `${characterName}：${icon.label}` : icon.label}
  />;
});
