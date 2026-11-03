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
  | "gatherer-charm"
  | "ember-circlet" | "frost-lens" | "sage-crown"
  | "windweave-mantle" | "heartwood-vest"
  | "gale-greaves" | "tracker-boots"
  | "fortune-knot" | "starfall-signet";

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
  "ember-circlet": {
    paths: [stroke("M3 17c3-6 15-7 18 0l-2 4H5l-2-4Z"), stroke("M7 14c0-3 2-5 5-6 3 1 5 3 5 6m-9 5h8"), stroke("M12 8c-2-2-1-4 1-6 0 2 3 3 2 6")],
    filledPaths: [wash("M4 17c4-5 12-5 16 0l-2 3H6Z", material("ember-circlet")), wash("M11 8c-2-2-1-4 1-6 0 2 3 3 2 6-1-1-2-1-3 0Z", metalPigment)],
  },
  "frost-lens": {
    paths: [stroke("M3 8h18l-2 8c-.5 2-2 3-4 3-2 0-3-1-3-3 0 2-1 3-3 3s-3.5-1-4-3L3 8Z"), stroke("M12 12v4m-6-5 3 1m9-1-3 1m-4-5 2 2-2 2-2-2Z")],
    filledPaths: [wash("M5 10h5l1 6c0 1-1 2-2 2s-2-.5-2.5-2L5 10Zm9 0h5l-1.5 6c-.5 1.5-1.5 2-2.5 2s-2-1-2-2Z", material("frost-lens")), wash("M11 7l1-2 2 2-2 2Z", runePigment)],
  },
  "sage-crown": {
    paths: [stroke("M3 18 5 7l5 5 2-8 3 8 5-5 1 11H3Z"), stroke("M5 21h14M8 17c0-2 1-3 3-4m5 4c0-2-1-3-3-4m-1-6c-2-1-2-3 0-5 2 2 2 4 0 5Z")],
    filledPaths: [wash("M4 17 6 9l4 4 2-7 3 7 4-4 1 8Z", material("sage-crown")), wash("M11 7c-2-2-1-4 1-5 2 2 3 4 1 5Z", runePigment)],
  },
  "windweave-mantle": {
    paths: [stroke("M8 4c1 3 2 4 4 4s3-1 4-4l5 4-3 5 2 8H4l2-8-3-5 5-4Z"), stroke("M8 5c1 3 2 4 4 4s3-1 4-4m-7 8 3 3 3-3m-3 3v5M2 12l2-1m16 1 2-1")],
    filledPaths: [wash("M8 6c1 2 2 3 4 3s3-1 4-3l4 3-3 5 2 6H5l2-6-3-5Z", material("windweave-mantle")), wash("M8 13l4 4 4-4-1 5H9Z", runePigment)],
  },
  "heartwood-vest": {
    paths: [stroke("M7 3h4l1 3 1-3h4l4 5-3 3 1 10H5l1-10-3-3 4-5Z"), stroke("M8 5 7 9l3 3-1 7h6l-1-7 3-3-1-4m-5 0v6m-3 2 3-2 3 2")],
    filledPaths: [wash("M7 5h3l2 4 2-4h3l3 4-3 3 1 7H6l1-7-3-3Z", material("heartwood-vest")), wash("M12 10 9 13l3 2 3-2Z", runePigment)],
  },
  "gale-greaves": {
    paths: [stroke("M6 3h5l1 9-2 3-1 6H3v-3l3-4V3Zm7 0h5l1 11 3 4v3h-6l-1-6-2-3 0-9Z"), stroke("M5 7h5m3 0h5M2 10l2-1m15 2 3-1m-18 5 3-1")],
    filledPaths: [wash("M7 4h3l1 8-2 4-1 4H4v-2l3-4Zm7 0h3l1 10 3 4v2h-4l-1-5-2-4Z", material("gale-greaves")), wash("M2 10l3-1-2 3Zm17 2 3-2-1 4Z", runePigment)],
  },
  "tracker-boots": {
    paths: [stroke("M7 3h6v8l2 4 6 2v4H4v-3l3-4V3Z"), stroke("M9 6h3m-3 3h3m-3 3 4 4-5 1 4 1"), stroke("M3 8 1 10m3 2-2 2m3 2-2 2")],
    filledPaths: [wash("M8 4h4v7l3 5 5 2v2H5v-1l3-4Z", material("tracker-boots")), wash("M2 9l3 2-3 2Zm2 6 3 2-3 2Z", runePigment)],
  },
  "fortune-knot": {
    paths: [stroke("M12 4c-6 0-8 5-4 8-4 3-2 8 4 8m0-16c6 0 8 5 4 8 4 3 2 8-4 8Z"), stroke("M8 12h8m-4-4v8m-8-7 3 3-3 3m16-6-3 3 3 3")],
    filledPaths: [wash("M12 5c-5 0-6 4-2 7-4 3-3 7 2 7-3-3-3-4 0-7-3-3-3-4 0-7Z", material("fortune-knot")), wash("M12 5c5 0 6 4 2 7 4 3 3 7-2 7 3-3 3-4 0-7 3-3 3-4 0-7Z", metalPigment)],
  },
  "starfall-signet": {
    paths: [stroke("M5 14c0-4 3-7 7-7s7 3 7 7-3 7-7 7-7-3-7-7Z"), stroke("M12 2 14 7l5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1Z"), stroke("M8 14c0-2 2-4 4-4s4 2 4 4-2 4-4 4-4-2-4-4Z")],
    filledPaths: [wash("M7 14c0-3 2-5 5-5s5 2 5 5-2 5-5 5-5-2-5-5Z", material("starfall-signet")), wash("M12 3 14 8l5 1-4 3 1 4-4-2-4 2 1-4-4-3 5-1Z", metalPigment)],
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
  "ember-circlet": makeDefinition("ember-circlet"),
  "frost-lens": makeDefinition("frost-lens"),
  "sage-crown": makeDefinition("sage-crown"),
  "windweave-mantle": makeDefinition("windweave-mantle"),
  "heartwood-vest": makeDefinition("heartwood-vest"),
  "gale-greaves": makeDefinition("gale-greaves"),
  "tracker-boots": makeDefinition("tracker-boots"),
  "fortune-knot": makeDefinition("fortune-knot"),
  "starfall-signet": makeDefinition("starfall-signet"),
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
