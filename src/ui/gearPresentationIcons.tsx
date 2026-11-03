import { PencilIcon as InkraPencilIcon, type PencilIconPath } from "@inkra/react";
import { memo } from "react";
import { gearDefinitions } from "../content/gear";

export { InkraPencilIcon as PencilIcon };

export type GearPresentationId =
  | "apprentice-hat"
  | "astrologer-hood"
  | "rune-robe"
  | "heartguard-armor"
  | "swift-boots"
  | "farwatch-boots"
  | "copper-ring"
  | "spring-pendant"
  | "gatherer-charm";

export type GearPresentationVariant = "outline" | "filled";

export interface GearPresentationIconDefinition {
  id: GearPresentationId;
  label: string;
  materialColor: string;
  paths: readonly PencilIconPath[];
  filledPaths: readonly PencilIconPath[];
}

export interface GearPresentationIconProps {
  definitionId: string;
  size?: number;
  seed?: string;
  variant?: GearPresentationVariant;
}

const ink = "var(--inkra-ink, #29271f)";
const runePigment = "var(--inkra-accent-strong, #5b7187)";
const metalPigment = "var(--inkra-warning-pigment, #ad752b)";
const stroke = (d: string): PencilIconPath => ({ d, mode: "stroke" });
const wash = (d: string, color: string): PencilIconPath => ({ d, mode: "wash", color });
const material = (id: GearPresentationId) => gearDefinitions[id].asset.color ?? "var(--inkra-ink-muted)";

const paths = {
  "gatherer-charm": {
    paths: [stroke("M12 3c-3 0-5 2-5 5v3l-2 3c-1 3 2 7 7 7s8-4 7-7l-2-3V8c0-3-2-5-5-5Z M8 10h8 M12 12v6 M10 14c0-1 4-1 4 0s-4 1-4 2 4 1 4 0" )],
    filledPaths: [wash("M8 11h8l2 3c0 3-2 5-6 5s-6-2-6-5Z", material("gatherer-charm"))],
  },
  "apprentice-hat": {
    paths: [
      stroke("M4 17c4-1 12-1 16 0l-1 3H5l-1-3Z"),
      stroke("M6 16 8 9l4-5 4 5 2 7"),
      stroke("M12 5v4m-2 3h4m-6 4c3 1 7 1 10 0"),
    ],
    filledPaths: [wash("M7 16 9 9l3-4 3 4 2 7c-3 1-7 1-10 0Z", material("apprentice-hat"))],
  },
  "astrologer-hood": {
    paths: [
      stroke("M4 20c0-3 1-5 3-7L6 8l5-4 2 3 5-2 1 7c1 2 2 5 1 8-4 2-12 2-16 0Z"),
      stroke("M8 14c1-3 3-4 5-4s4 1 5 4m-8 2h2m2 0h2"),
      stroke("M9 6 8 3m6 3 2-3m1 7 3-1"),
    ],
    filledPaths: [
      wash("M6 19c0-5 3-9 7-9s7 4 7 9c-4 2-10 2-14 0Z", material("astrologer-hood")),
      wash("M11 4l1 2 2 .4-1.5 1.4.4 2-1.9-1-1.8 1 .4-2L9 6.4l2-.4Z", runePigment),
    ],
  },
  "rune-robe": {
    paths: [
      stroke("M8 3h8l3 4 3 3-3 3-2-2 2 10H5l2-10-2 2-3-3 3-3 3-4Z"),
      stroke("M9 4 12 8l3-4m-3 4v6m-2-3 2-2 2 2-2 2-2-2Zm-1 8h6"),
    ],
    filledPaths: [
      wash("M8 5h3l1 4 1-4h3l3 4-2 3 1 7H6l1-7-2-3Z", material("rune-robe")),
      wash("M11 10l1-1 1 1-1 1Z", runePigment),
    ],
  },
  "heartguard-armor": {
    paths: [
      stroke("M7 4 3 8l3 3-1 9 7 2 7-2-1-9 3-3-4-4-3 3h-4L7 4Z"),
      stroke("M8 5 6 9l3 3-2 7 5 1 5-1-2-7 3-3-2-4"),
      stroke("M12 9c-1-2-4-1-3 1l3 3 3-3c1-2-2-3-3-1Z"),
      stroke("M7 16h2m8 0h-2"),
    ],
    filledPaths: [
      wash("M7 6 5 9l3 3-1 6 5 1 5-1-1-6 3-3-2-3-3 3h-4Z", material("heartguard-armor")),
      wash("M12 10c-.8-1.5-2.5-.5-2 0l2 2 2-2c.5-.5-1.2-1.5-2 0Z", "var(--inkra-danger-pigment, #ad4848)"),
    ],
  },
  "swift-boots": {
    paths: [
      stroke("M8 3h6v8l2 3 5 2v4H4v-3l4-3V3Z"),
      stroke("M8 7h6m-6 3h6m-2 3 3 3-5 1 4 1"),
      stroke("M3 8 1 10m3 1-2 2m2 2-2 2"),
    ],
    filledPaths: [
      wash("M9 4h4v7l3 4 4 2v2H5v-1l4-3Z", material("swift-boots")),
      wash("M2 9l2 1-2 2Z", runePigment),
    ],
  },
  "farwatch-boots": {
    paths: [
      stroke("M6 3h7v8l3 3 5 2v4H3v-3l3-3V3Z"),
      stroke("M8 6h4m-4 3h4m-1 4 4 3-6 1"),
      stroke("M17 7c2 1 3 2 4 4m-3-6c3 1 4 3 5 5"),
    ],
    filledPaths: [
      wash("M7 4h5v7l3 4 5 2v2H4v-1l3-3Z", material("farwatch-boots")),
      wash("M18 7c1 1 2 2 2 3l-2 1-2-2Z", runePigment),
    ],
  },
  "copper-ring": {
    paths: [
      stroke("M5 15c0-4 3-7 7-7s7 3 7 7-3 6-7 6-7-2-7-6Z"),
      stroke("M7 15c0-3 2-5 5-5s5 2 5 5-2 4-5 4-5-1-5-4Z"),
      stroke("M9 7 7 5m8 2 2-2m-5 2V3m-8 11H2m20 0h-2"),
    ],
    filledPaths: [
      wash("M6 15c0-3.5 2.5-6 6-6s6 2.5 6 6-2.5 5-6 5-6-1.5-6-5Z", material("copper-ring")),
      wash("M10 5h4l-1 4h-2Z", metalPigment),
    ],
  },
  "spring-pendant": {
    paths: [
      stroke("M8 3c0 4 1 5 4 7 3-2 4-3 4-7m-8 0c0 4-1 6-4 8m12-8c0 4 1 6 4 8"),
      stroke("M12 10c-1 3-4 5-4 8a4 4 0 0 0 8 0c0-3-3-5-4-8Z"),
      stroke("M10 17c.5 1 1 1.5 2 1.5m-1-5c1-1 2-1 3 0"),
    ],
    filledPaths: [
      wash("M12 12c-1 2-3 4-3 6a3 3 0 0 0 6 0c0-2-2-4-3-6Z", material("spring-pendant")),
      wash("M10 8c1-1 3-1 4 0l-2 2Z", runePigment),
    ],
  },
} as const satisfies Record<GearPresentationId, { paths: readonly PencilIconPath[]; filledPaths: readonly PencilIconPath[] }>;

function makeDefinition(id: GearPresentationId): GearPresentationIconDefinition {
  return Object.freeze({ id, label: gearDefinitions[id].name, materialColor: material(id), ...paths[id] });
}

const presentationDefinitions: Readonly<Record<GearPresentationId, GearPresentationIconDefinition>> = Object.freeze({
  "apprentice-hat": makeDefinition("apprentice-hat"),
  "astrologer-hood": makeDefinition("astrologer-hood"),
  "rune-robe": makeDefinition("rune-robe"),
  "heartguard-armor": makeDefinition("heartguard-armor"),
  "swift-boots": makeDefinition("swift-boots"),
  "farwatch-boots": makeDefinition("farwatch-boots"),
  "copper-ring": makeDefinition("copper-ring"),
  "spring-pendant": makeDefinition("spring-pendant"),
  "gatherer-charm": makeDefinition("gatherer-charm"),
});

export function getGearPresentationIcon(definitionId: string): GearPresentationIconDefinition | undefined {
  return Object.hasOwn(presentationDefinitions, definitionId)
    ? presentationDefinitions[definitionId as GearPresentationId]
    : undefined;
}

export const GearPresentationIcon = memo(function GearPresentationIcon({ definitionId, size = 32, seed, variant = "outline" }: GearPresentationIconProps) {
  const icon = getGearPresentationIcon(definitionId);
  if (!icon) return null;
  return <InkraPencilIcon
    paths={icon.paths}
    filledPaths={icon.filledPaths}
    variant={variant}
    sourceSize={24}
    size={size}
    strokeWidth={0.8}
    seed={`${seed ?? "gear-presentation"}-${icon.id}`}
    style={{ color: ink }}
    role="img"
    aria-label={icon.label}
  />;
});
