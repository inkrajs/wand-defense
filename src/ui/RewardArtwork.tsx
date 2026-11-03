import { PencilIcon, type PencilIconPath } from "@inkra/react";
import type { CSSProperties } from "react";
import type { RewardOption } from "../contracts";
import { demoContent } from "../content/demo";
import { AssetImage, resolveAsset } from "./assets";
import { CharacterPresentationIcon } from "./characterPresentationIcons";
import { GearPresentationIcon, getGearPresentationIcon } from "./gearPresentationIcons";
import { getMagicPresentationIcon, MagicPresentationIcon } from "./magicPresentationIcons";
import "./RewardArtwork.css";

export interface RewardArtworkProps {
  reward: RewardOption;
  size?: number;
}

const artwork = {
  wand: [
    { d: "M5 20 17 6m-9 15L20 8", mode: "stroke" },
    { d: "m17 6 1-3 2 3 3 1-3 1-2 3-1-3-3-1 3-1Z", mode: "stroke" },
    { d: "M5 20 3 19l1-3 2 1Z", mode: "stroke" },
  ],
  coins: [
    { d: "M12 3C7 3 4 5 4 8s3 5 8 5 8-2 8-5-3-5-8-5Z", mode: "stroke" },
    { d: "M4 8v7c0 3 3 5 8 5s8-2 8-5V8m-16 3c0 3 3 5 8 5s8-2 8-5", mode: "stroke" },
    { d: "M12 6v6m-2-4c0-2 4-2 4 0s-4 1-4 3 4 2 4 0", mode: "stroke" },
  ],
  heal: [
    { d: "M12 21S3 15.5 3 9a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 21 9c0 6.5-9 12-9 12Z", mode: "stroke" },
    { d: "M12 9v6m-3-3h6", mode: "stroke" },
  ],
  attack: [
    { d: "M5 19 19 5m-6 0h6v6M4 16l4 4m5-9 4 4", mode: "stroke" },
  ],
  gathering: [
    { d: "M8 5h8l-2 4 3 3c2 2 3 5 2 7H5c-1-2 0-5 2-7l3-3-2-4Z M8 9h8 M12 12v5m-2-3c0-1 4-1 4 0s-4 1-4 2 4 1 4 0", mode: "stroke" },
  ],
  luck: [
    { d: "M12 20C6 17 3 13 4 8c.7-3 4-4 6-1l2 3 2-3c2-3 5.3-2 6 1 1 5-2 9-8 12Z", mode: "stroke" },
  ],
  mana: [
    { d: "M12 3c-2.5 4-6 7.5-6 12a6 6 0 0 0 12 0c0-4.5-3.5-8-6-12Z", mode: "stroke" },
    { d: "M9 15h6", mode: "stroke" },
  ],
  manaRegen: [
    { d: "M12 3c-2.5 4-6 7.5-6 12a6 6 0 0 0 12 0c0-4.5-3.5-8-6-12Z", mode: "stroke" },
    { d: "M9 15h6m-3-3v6", mode: "stroke" },
  ],
  range: [
    { d: "M3 12c2.5-4 5.5-6 9-6s6.5 2 9 6c-2.5 4-5.5 6-9 6s-6.5-2-9-6Z", mode: "stroke" },
    { d: "M10 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm2-2V4m0 16v-2m-2-6H5m14 0h-2", mode: "stroke" },
  ],
  cooldown: [
    { d: "M6 4h12M6 20h12M8 4c0 5 8 7 8 8s-8 3-8 8m8-16c0 5-8 7-8 8s8 3 8 8", mode: "stroke" },
    { d: "M10 12h4", mode: "stroke" },
  ],
  buff: [
    { d: "M12 21V8m-5 5 5-5 5 5M5 5h3m8 0h3", mode: "stroke" },
  ],
  scroll: [
    { d: "M7 4h12v15H7a3 3 0 0 1 0-6h12M7 4a3 3 0 0 0 0 6h12M10 7h5m-5 5h5m-5 4h4", mode: "stroke" },
  ],
} satisfies Record<string, readonly PencilIconPath[]>;

const colors = {
  wand: "var(--inkra-accent-strong, #8b6d54)",
  coins: "var(--inkra-warning-pigment, #ad752b)",
  heal: "var(--inkra-success-pigment, #5d9367)",
  attack: "var(--inkra-danger-pigment, #c65345)",
  gathering: "var(--inkra-warning-pigment, #ad752b)",
  luck: "var(--inkra-success-pigment, #5d9367)",
  mana: "var(--inkra-blue, #4f91b9)",
  manaRegen: "var(--inkra-teal, #4d927f)",
  range: "var(--inkra-warning-pigment, #ad752b)",
  cooldown: "var(--inkra-accent-strong, #655b91)",
  buff: "var(--inkra-accent-strong, #655b91)",
  scroll: "var(--inkra-ink-muted, #77746b)",
} as const;

function Glyph({ kind, size, seed }: { kind: keyof typeof artwork; size: number; seed: string }) {
  return <PencilIcon
    paths={artwork[kind]}
    sourceSize={24}
    size={size}
    strokeWidth={0.9}
    seed={seed}
    style={{ color: colors[kind] }}
    decorative
  />;
}

function ItemArtwork({ reward, size }: { reward: RewardOption; size: number }) {
  const id = reward.definitionId;
  if (id && getGearPresentationIcon(id)) {
    return <GearPresentationIcon definitionId={id} size={size} seed={`reward-gear-${reward.id}`} />;
  }
  if (id && getMagicPresentationIcon(id)) {
    return <MagicPresentationIcon definitionId={id} size={size} seed={`reward-magic-${reward.id}`} />;
  }
  const definition = id ? demoContent.spells[id] ?? demoContent.arcana[id] : undefined;
  if (definition) {
    return <AssetImage asset={resolveAsset(definition.asset, { label: definition.name, icon: definition.name.slice(0, 1) || "◇" })} />;
  }
  return <Glyph kind="scroll" size={size} seed={`reward-item-${reward.id}`} />;
}

function artworkFor(reward: RewardOption, size: number) {
  switch (reward.kind) {
    case "item":
      return <ItemArtwork reward={reward} size={size} />;
    case "character": {
      const sequence = reward.definitionId ? demoContent.sequences[reward.definitionId] : undefined;
      return <CharacterPresentationIcon pathwayId={sequence?.pathwayId ?? reward.definitionId} seed={`reward-character-${reward.id}`} size={size} />;
    }
    case "wand":
      return <Glyph kind="wand" size={size} seed={`reward-wand-${reward.id}`} />;
    case "heal":
      return <Glyph kind="heal" size={size} seed={`reward-heal-${reward.id}`} />;
    case "coins":
      return <Glyph kind="coins" size={size} seed={`reward-coins-${reward.id}`} />;
    case "buff": {
      const kind = reward.effect?.type === "gatheringPercent" ? "gathering"
        : reward.effect?.type === "luck" ? "luck"
        : reward.effect?.type === "attackPercent" ? "attack"
        : reward.effect?.type === "maxMana" ? "mana"
          : reward.effect?.type === "manaRegen" ? "manaRegen"
            : reward.effect?.type === "rangePercent" ? "range"
              : reward.effect?.type === "cooldownPercent" ? "cooldown"
                : "buff";
      return <Glyph kind={kind} size={size} seed={`reward-buff-${reward.id}-${kind}`} />;
    }
  }
}

/** Decorative, reward-specific artwork for placement above a reward card. */
export function RewardArtwork({ reward, size = 72 }: RewardArtworkProps) {
  const style = { "--reward-artwork-size": `${size}px` } as CSSProperties;
  return <span className="reward-artwork" style={style} aria-hidden="true">
    {artworkFor(reward, size)}
  </span>;
}
