import { PencilIcon, type PencilIconPath } from "@inkra/react";
import { memo } from "react";
import { monsterDefinitions } from "../content/monsters";

export type MonsterPresentationTier = "basic" | "minor" | "major" | "apex";

export interface MonsterPresentationIconDefinition {
  definitionId: string;
  tier: MonsterPresentationTier;
  label: string;
  paths: readonly PencilIconPath[];
  /** A complete filled variant: outline/detail strokes plus colored body washes. */
  filledPaths: readonly PencilIconPath[];
  color: string;
  accentColor: string;
}

export interface MonsterPresentationIconProps {
  definitionId: string;
  entityId: string;
  size?: number;
}

const ink = "var(--inkra-ink, #29271f)";
const stroke = (d: string): PencilIconPath => ({ d, mode: "stroke" });
const wash = (d: string, color: string): PencilIconPath => ({ d, mode: "wash", color });
const accentFill = (d: string, color: string): PencilIconPath => ({ d, mode: "fill", color });

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function creature(
  definitionId: string,
  tier: MonsterPresentationTier,
  label: string,
  color: string,
  accentColor: string,
  paths: readonly PencilIconPath[],
  body: string,
  accents: readonly string[],
): MonsterPresentationIconDefinition {
  // PencilIcon's filled variant renders filledPaths in place of paths. Keep the
  // complete line drawing here so changing variants never drops the silhouette.
  return {
    definitionId,
    tier,
    label,
    color,
    accentColor,
    paths,
    filledPaths: [...paths, wash(body, color), ...accents.map(path => accentFill(path, accentColor))],
  };
}

const basicDefinitions: Readonly<Record<string, MonsterPresentationIconDefinition>> = {
  "enemy-moss": creature(
    "enemy-moss", "basic", "苔团", "#65a85b", "#b8d86c",
    [
      stroke("M3 18c-1-3 1-6 4-8 0-4 3-7 6-7 4 0 6 3 7 7 3 2 4 5 2 8-1 2-4 3-8 3s-8-1-11-3Z"),
      stroke("M7 11 5 7l4 2m6-1 2-4 2 5M8 14h2m4 0h2m-5 3h2"),
      stroke("M6 19c3 1 8 1 12 0"),
    ],
    "M4 17c0-3 2-6 5-7 0-3 2-5 4-5 3 0 5 2 5 6 3 1 4 4 3 6-3 3-13 3-17 0Z",
    ["M5 14c2-2 4-2 6 0-1 3-4 4-6 3Z", "M14 10c2-2 4-1 5 1-1 2-3 3-5 2Z"],
  ),
  "enemy-ember": creature(
    "enemy-ember", "basic", "焰灵", "#ef6b45", "#ffd166",
    [
      stroke("M5 20c-2-3-1-6 1-8 0 2 1 3 2 3-1-5 2-10 6-13 0 4 2 6 4 8 3 3 3 7 1 10-3 3-10 3-14 0Z"),
      stroke("M9 14h2m4 0h2m-5 3h2M7 20l-2 2m12-2 2 2"),
      stroke("M12 3c-1 3 0 5 2 7"),
    ],
    "M6 19c-1-3 0-5 2-7 0 2 1 3 2 3-1-4 1-8 4-11 0 4 2 6 4 9 2 2 2 5 0 7-3 2-9 2-12-1Z",
    ["M10 18c0-3 1-5 3-7 2 2 3 4 2 7-1 2-4 2-5 0Z", "M6 11c1-2 2-4 3-6m9 6 2 3"],
  ),
  "enemy-frost-moth": creature(
    "enemy-frost-moth", "basic", "霜蛾", "#79cde8", "#d5f5ff",
    [
      stroke("M12 10c-2-4-6-7-9-6 0 4 1 7 5 9-3 1-5 4-5 7 4 0 7-2 9-5m0-5c2-4 6-7 9-6 0 4-1 7-5 9 3 1 5 4 5 7-4 0-7-2-9-5m0-7v13"),
      stroke("M11 8 8 4m5 4 3-4m-6 10h4m-4 3h4"),
    ],
    "M11 11C8 7 5 5 4 6c0 3 2 5 5 7-3 1-4 3-4 5 3 0 5-2 7-4 2 2 4 4 7 4 0-2-1-4-4-5 3-2 5-4 5-7-2-1-5 1-8 5Z",
    ["M5 7c2 0 4 2 5 4-2 1-4 1-6 0Z", "M19 7c-2 0-4 2-5 4 2 1 4 1 6 0Z", "M11 12h2v6h-2Z"],
  ),
  "enemy-shadow-bat": creature(
    "enemy-shadow-bat", "basic", "影蝠", "#a784d9", "#e3ccff",
    [
      stroke("M12 8c-2-3-4-4-6-3l1 5-5-3 2 9 5-2 3 5 3-5 5 2 2-9-5 3 1-5c-2-1-4 0-6 3Z"),
      stroke("M9 12h1m4 0h1m-3 2 1 1m-4 3-2 3m8-3 2 3"),
    ],
    "M11 9C8 5 6 5 5 6l1 5-4-2 2 8 5-2 3 4 3-4 5 2 2-8-4 2 1-5c-2-1-4 0-7 3Z",
    ["M5 9 8 11l-3 3-2-1Zm14 0-3 2 3 3 2-1Z", "M10 12h1m2 0h1m-3 2 1 1"],
  ),
  "enemy-sand-beetle": creature(
    "enemy-sand-beetle", "basic", "砂甲虫", "#c5a05d", "#f2d58f",
    [
      stroke("M5 17c0-6 3-10 7-10s7 4 7 10l-2 3H7Zm7-10V4m-6 8L3 9m14 3 4-3M7 17l-4 2m14-2 4 2M8 13h8m-7 3h6"),
      stroke("M9 8 8 5m7 3 1-3"),
    ],
    "M6 17c0-5 3-9 6-9s6 4 6 9l-2 2H8Z",
    ["M7 13c1-3 3-4 5-4v7H7Zm10 0c-1-3-3-4-5-4v7h5Z", "M11 4h2v4h-2Z"],
  ),
  "enemy-crystal-crab": creature(
    "enemy-crystal-crab", "basic", "晶蟹", "#8e9fe8", "#a9ece5",
    [
      stroke("M7 11 4 8l-2 2 2 5m13-4 3-3 2 2-2 5M8 10l-2-4-3 1 1 5m12-2 2-4 3 1-1 5M7 17l-3 3m13-3 3 3m-12-7c0-3 2-5 6-5s6 2 6 5v5c-4 3-8 3-12 0Z"),
      stroke("M10 13h1m3 0h1m-4 3h3M12 8V5l2-2 2 2-2 2"),
    ],
    "M8 11c0-2 2-4 5-4s5 2 5 4v6c-3 2-7 2-10 0Zm-3 0L3 9l-1 2 2 4 3-1Zm15 0 2-2 1 2-2 4-3-1Z",
    ["M9 11h4v4H9Zm5-1 3 2-2 3h-3Z", "M2 11l2 3 3-1-2-3Zm19 0-2 3-3-1 2-3Z"],
  ),

  "enemy-iron-guard": creature("enemy-iron-guard", "basic", "铸铁卫", "#647D91", "#C7D3DA",
    [stroke("M5 8 8 4h8l3 4v9l-7 4-7-4ZM8 8h8m-7 4h2m3 0h2m-5 4h2M4 10l-2 5m18-5 2 5"), stroke("M8 4 6 2m10 2 2-2")], "M6 8 9 5h6l3 3v8l-6 4-6-4Z", ["M8 8h8v2H8Z", "M9 15h6v2H9Z"]),
  "enemy-mire-regenerator": creature("enemy-mire-regenerator", "basic", "沼泽再生体", "#4E8061", "#A8D397",
    [stroke("M3 18c0-4 2-6 5-8-1-4 2-6 5-6 4 0 5 3 5 6 3 2 4 5 3 8-4 4-14 4-18 0ZM8 13h2m4 0h2m-5 3h2M12 5V2m-2 2h4"), stroke("M5 20l-2 2m15-2 2 2")], "M4 17c0-3 3-5 5-7 0-3 2-5 4-5 3 0 4 2 4 5 3 2 4 4 3 7-3 3-12 3-16 0Z", ["M11 6h3v5h-3Zm-1 1h5v2h-5Z"]),
  "enemy-ember-brute": creature("enemy-ember-brute", "basic", "熔火蛮兽", "#C65C3D", "#F6B35D",
    [stroke("M3 20 5 11l4-3-1-5 4 3 4-3-1 5 4 3 2 9-5 2H8ZM8 13h3m3 0h3m-6 4h3M5 11 2 13m17-2 3 2"), stroke("M8 19l2-3m6 3-2-3")], "M5 19 6 12l4-3h5l4 3 1 7-4 2H9Z", ["M11 10 9 15h3l-1 5 5-7h-3l1-3Z"]),
  "enemy-clockwork-scout": creature("enemy-clockwork-scout", "basic", "机巧斥候", "#D5B34A", "#FFF1A3",
    [stroke("M7 8 9 5h6l2 3 3 2-2 2 1 4-3 1-1 3H9l-1-3-3-1 1-4-2-2ZM9 11h6m-4 3h2M12 5V2m-2 1h4"), stroke("M7 18 4 21m13-3 3 3")], "M8 9 10 6h4l2 3 2 2-1 5-3 3h-4l-3-3-1-5Z", ["M9 10h6v3H9Z", "M11 15h2v3h-2Z"]),
  "enemy-glacier-shell": creature("enemy-glacier-shell", "basic", "冰川重甲", "#78B9D4", "#DDF6FF",
    [stroke("M3 18 5 9l4-5 3 2 3-4 4 7 2 9-4 3H7ZM6 10l6 4 6-4M12 14v7m-4-3h2m4 0h2"), stroke("M9 4 7 2m8 0 2 4")], "M4 17 6 9l3-4 3 2 3-3 3 6 2 7-4 3H8Z", ["M6 9 9 5l3 3v5Zm12 1-3-6-3 4v5Z"]),
  "enemy-void-wisp": creature("enemy-void-wisp", "basic", "虚空游魂", "#583F78", "#C6A6E6",
    [stroke("M12 2c4 3 7 5 7 10 0 3-2 4-1 8l-3-2-3 4-3-4-3 2c1-4-1-5-1-8 0-5 3-7 7-10ZM9 11h2m3 0h2m-5 4h3"), stroke("M3 8 2 6m19 2 1-2")], "M12 4c3 2 6 5 6 8 0 3-2 5-2 6l-2-2-2 4-2-4-2 2c0-2-2-3-2-6 0-3 3-6 6-8Z", ["M10 8c1-2 3-2 4 0l-2 2Z"]),
  "enemy-ancient-ent": creature("enemy-ancient-ent", "basic", "古树巨像", "#587454", "#B0CA80",
    [stroke("M8 21 7 15 4 13l1-4-3-2 4 1 1-5 3 3 2-4 3 4 3-3 1 5 4-1-3 3 1 3-3 2-1 6ZM9 11h2m3 0h2m-5 3h3M12 15v6"), stroke("M7 19 4 22m13-3 3 3")], "M7 10 8 5l3 2 1-3 2 3 3-2 1 5 2 3-3 2-1 5H8l-1-5-3-2Z", ["M5 9 8 6l3 3-2 2Zm8 0 3-3 3 3-4 2Z"]),
  "enemy-storm-mantis": creature("enemy-storm-mantis", "basic", "雷螳", "#948A55", "#F6DE78",
    [stroke("M9 8 7 4l5 2 5-2-2 4 3 3-2 6-4 3-4-3-2-6ZM7 10 3 6l1 6 3 2m10-4 4-4-1 6-3 2M9 18l-3 4m9-4 3 4M9 12h2m3 0h2"), stroke("M12 7v3")], "M9 9 12 7l3 2 2 3-2 5-3 2-3-2-2-5Z", ["M12 9 10 13h2l-1 4 4-6h-2l1-2Z"]),

};

const legacyBasic: MonsterPresentationIconDefinition = creature(
  "enemy-basic", "basic", "灰泥怪", "#8b8178", "#a8c17b",
  [
    stroke("M4 18c0-2 1-4 2-6 1-4 4-7 7-7s6 3 7 7c1 2 2 4 1 6-2 2-5 3-9 3s-7-1-8-3Z"),
    stroke("M8 13h2m4 0h2m-5 3h2"),
    stroke("M6 18c3 1 9 1 12 0"),
  ],
  "M5 17c1-3 2-5 3-7 1-2 3-4 5-4s4 2 5 4c1 2 2 4 2 7-3 3-12 3-15 0Z",
  ["M6 16c2-2 4-2 6-1l-1 3H6Zm8-7c2-1 4 0 5 2l-3 2-2-4Z"],
);

const bossDefinitions: Readonly<Record<Exclude<MonsterPresentationTier, "basic">, MonsterPresentationIconDefinition>> = {
  minor: creature(
    "boss-minor", "minor", "小型首领", "#c77d53", "#f2c36e",
    [
      stroke("M4 20c0-4 2-7 5-9L7 4l6 4 5-5 1 8c2 2 3 5 2 9-4 3-13 3-17 0Z"),
      stroke("M8 14h3m3 0h3m-5 3h2M8 19h9m-7-4-1 4m7-4 1 4"),
    ],
    "M6 19c0-5 3-9 7-9s7 4 7 9c-3 2-11 2-14 0Z",
    ["M7 10 6 5l5 3m4-1 4-4v7m-8 6h4v3h-4Z"],
  ),
  major: creature(
    "boss-major", "major", "大型首领", "#a57ad2", "#f08069",
    [
      stroke("M3 20c1-5 3-8 7-10L7 3l6 4 5-5 1 8c4 2 6 5 6 10-5 3-17 3-22 0Z"),
      stroke("M8 13h3m3 0h3M10 16h1m3 0h1M6 19h12m-9-3v5m6-5v5"),
      stroke("M5 11 3 8m15 1 3-4"),
    ],
    "M5 19c0-5 3-9 8-9s8 4 8 9c-4 2-12 2-16 0Z",
    ["M8 12h4v5H7Zm5 0h4l3 5h-7Z", "M10 17h4v3h-4Z"],
  ),
  apex: creature(
    "boss-apex", "apex", "顶级首领", "#e3a743", "#76cbd2",
    [
      stroke("M4 20c-1-5 1-9 5-11L5 3l8 4 5-5 1 8c4 2 6 6 5 10-5 3-15 3-20 0Z"),
      stroke("M7 12 2 8l2 8m13-5 5-5v9M8 14h3m3 0h3m-8 4 3-2 3 2m-9 2h12M13 3v4m-2-2h4"),
    ],
    "M6 19c0-5 3-8 7-8s7 3 7 8c-4 2-10 2-14 0Z",
    ["M10 14h5v3h-5Z", "M3 9l4 3-2 4Zm18-2-5 4 3 5Z"],
  ),
};

export function getMonsterPresentationIcon(definitionId: string, _entityId: string): MonsterPresentationIconDefinition | undefined {
  const definitionExists = Object.hasOwn(monsterDefinitions, definitionId);
  const basicDefinition = Object.hasOwn(basicDefinitions, definitionId)
    ? basicDefinitions[definitionId]
    : undefined;
  if (!definitionExists && !basicDefinition) return undefined;
  if (definitionId === "enemy-basic") return legacyBasic;
  if (definitionId === "boss-minor") return bossDefinitions.minor;
  if (definitionId === "boss-major") return bossDefinitions.major;
  if (definitionId === "boss-apex") return bossDefinitions.apex;
  return basicDefinition;
}

export const MonsterPresentationIcon = memo(function MonsterPresentationIcon({ definitionId, entityId, size = 32 }: MonsterPresentationIconProps) {
  const icon = getMonsterPresentationIcon(definitionId, entityId);
  if (!icon) return null;
  const patternSlot = stableHash(entityId) % 4;
  return <PencilIcon
    paths={icon.paths}
    filledPaths={icon.filledPaths}
    variant="filled"
    fillColor={icon.color}
    sourceSize={24}
    size={size}
    strokeWidth={0.9}
    seed={`monster-${icon.definitionId}-${patternSlot}`}
    style={{ color: ink }}
    role="img"
    aria-label={icon.label}
  />;
});
