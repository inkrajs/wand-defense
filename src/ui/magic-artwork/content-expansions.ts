import type { MagicArtworkCatalog } from "./types";

const stroke = (d: string) => ({ d, mode: "stroke" as const });
const wash = (d: string) => ({ d, mode: "wash" as const });

/** Original content art authored in the same 24-unit-per-cell grid as each definition. */
export const contentExpansionArtwork: MagicArtworkCatalog = {
  "steam-cloud": {
    paths: [stroke("M9 33c-4 0-6-3-6-7 0-4 3-7 7-7 1-6 6-10 12-9 5-5 13-3 15 3 5 0 8 4 8 8 0 5-4 8-9 8H9Z"), stroke("M10 36c4-3 7-3 11 0s7 3 11 0m-16 6c3-2 6-2 9 0m9-7 4-4M20 22c1-3 4-5 7-4")],
    filledPaths: [wash("M10 31c-3 0-5-2-5-5s2-5 6-5c1-6 6-9 11-8 5-4 11-2 13 3 4 0 7 3 7 6s-3 6-7 6H10Z")],
  },
  "conductive-tide": {
    paths: [stroke("M4 27c6-6 12-6 18 0s12 6 18 0m-36 8c6-6 12-6 18 0s12 6 18 0M6 42c5-4 10-4 15 0s10 4 15 0"), stroke("M27 4 17 19h7l-2 10 10-16h-7l2-9Zm8 9 5-3m-2 9 5 1")],
    filledPaths: [wash("M26 7 20 18h7l-2 7 6-10h-7Z"), wash("M5 30c6-4 11-4 17 1s12 5 18-1v3c-6 5-12 5-18 0s-11-5-17 0Z")],
  },
  "magma-lance": {
    paths: [stroke("M4 12 52 5l15 7-15 7L4 12Z"), stroke("m13 10 9-5 5 6 9-4 5 6 10-3m-33 5 8 4 6-4 7 4 7-5m8-4 7 2-7 2"), stroke("M5 5l5 2M4 19l6-2")],
    filledPaths: [wash("M7 12 52 7l11 5-11 5Z"), wash("M19 11l5-3 3 4-3 3Zm18 1 4-3 3 4-4 3Z")],
  },
  "twilight-field": {
    paths: [stroke("M24 5c11 0 19 8 19 19s-8 19-19 19S5 35 5 24 13 5 24 5Z"), stroke("M24 9v30M24 13a11 11 0 0 0 0 22M24 13a11 11 0 0 1 0 22"), stroke("M15 21v6m-3-3h6m13-7a6 6 0 0 0 6 10 6 6 0 0 1-6-10ZM24 1v5m0 36v5M1 24h5m36 0h5")],
    filledPaths: [wash("M24 8c9 0 16 7 16 16s-7 16-16 16V8Z"), wash("M15 19v10m-5-5h10")],
  },
  "hit-trigger": {
    paths: [stroke("M3 12h8m-3-3 3 3-3 3M15 5v14m-3-7h7"), stroke("m17 7 3-3m-3 13 3 3")],
    filledPaths: [wash("M3 11h8v2H3Z"), stroke("M15 5v14m-3-7h7")],
  },
  "timer-trigger": {
    paths: [stroke("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z"), stroke("M12 6v6l4 2M9 2h6m-3 0v1")],
    filledPaths: [wash("M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z"), stroke("M12 6v6l4 2")],
  },
  "short-reach": {
    paths: [stroke("M4 12h14m-5-5 5 5-5 5M4 8v8"), stroke("M7 10v4")],
    filledPaths: [wash("M5 11h12v2H5Z"), stroke("m13 7 5 5-5 5M4 8v8")],
  },
  "light-flight": {
    paths: [stroke("M5 19C5 11 10 5 20 4c-1 9-6 14-15 15Z"), stroke("M5 19 17 7M9 15l-2-3m5 0-1-3m3 1 3 1M3 21l3-3")],
    filledPaths: [wash("M7 17c1-6 5-10 11-11-1 6-5 10-11 11Z"), stroke("M5 19 17 7")],
  },
  "tiny-area": {
    paths: [stroke("M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z"), stroke("M12 3v3m0 12v3M3 12h3m12 0h3M10 12h4")],
    filledPaths: [wash("M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"), stroke("M12 3v3m0 12v3M3 12h3m12 0h3")],
  },
  "ember-core": {
    paths: [stroke("M12 3c0 4-4 6-4 10a4 4 0 0 0 8 0c0-2-1-4-2-5 0 2-1 3-2 3 1-3 1-5 0-8Z"), stroke("M10 16c0-2 1-3 2-4 1 1 2 2 2 4a2 2 0 0 1-4 0ZM5 20h14")],
    filledPaths: [wash("M12 6c-1 3-3 5-3 8a3 3 0 0 0 6 0c0-2-1-3-1-4l-2 3c0-2 1-4 0-7Z")],
  },
  triple: {
    paths: [stroke("M4 12h54m-7-6 8 6-8 6M14 6l6 6-6 6m13-12 6 6-6 6m13-12 6 6-6 6"), stroke("M4 8h5M4 16h5")],
    filledPaths: [wash("M5 11h50v2H5Z"), stroke("m14 6 6 6-6 6m13-12 6 6-6 6m13-12 6 6-6 6m5-12 8 6-8 6")],
  },
  octuple: {
    paths: [stroke("M7 65c0-9 10-9 20-9s13-4 13-10-5-8-16-8S7 35 7 29s8-9 19-9h31"), stroke("m50 14 8 6-8 6M8 56l5-5m11 5 5-5M9 37l5-5m11 6 5-5m13 4 5-5M10 20l5-5m13 5 5-5m9 5 5-5")],
    filledPaths: [stroke("M7 65c0-9 10-9 20-9s13-4 13-10-5-8-16-8S7 35 7 29s8-9 19-9h31m-7-6 8 6-8 6"), wash("M8 56h5v2H8Zm16 0h5v2h-5ZM9 37h5v2H9Zm16 0h5v2h-5Zm18 0h5v2h-5ZM10 19h5v2h-5Zm18 0h5v2h-5Zm14 0h5v2h-5Z")],
  },
  "greater-area": {
    paths: [stroke("M24 4a20 20 0 1 0 0 40 20 20 0 0 0 0-40Zm0 7a13 13 0 1 0 0 26 13 13 0 0 0 0-26Z"), stroke("M24 1v9m0 28v9M1 24h9m28 0h9M17 24h14m-7-7v14")],
    filledPaths: [wash("M24 6a18 18 0 1 0 0 36 18 18 0 0 0 0-36Z"), stroke("M24 1v9m0 28v9M1 24h9m28 0h9M17 24h14m-7-7v14")],
  },
  "greater-burn": {
    paths: [stroke("M11 44C3 39 3 31 8 24c2-3 3-6 3-10 3 2 4 5 4 8 3-5 5-12 5-19 5 5 6 11 5 16 5-5 11-7 19-8-2 8-8 13-16 13H20c2 6 2 13-2 18l-3 3Z"), stroke("M10 37c-2-4 0-8 3-11 0 4 4 5 4 9 0 3-1 5-4 6M29 17l9-3")],
    filledPaths: [wash("M11 42C5 38 5 32 9 26c2-3 3-5 4-8 1 3 2 5 2 8 4-5 6-11 7-18 3 5 3 10 2 14 4-4 10-7 17-9-3 5-7 8-14 9H18c2 6 3 12 0 17l-4 3Z")],
  },
  "greater-reach": {
    paths: [stroke("M4 12h59m-11-8 12 8-12 8M17 7l6 5-6 5m14-10 6 5-6 5m14-10 6 5-6 5"), stroke("M4 7v10m5-8v6")],
    filledPaths: [wash("M5 11h57v2H5Z"), stroke("m17 7 6 5-6 5m14-10 6 5-6 5m14-10 6 5-6 5m1-13 12 8-12 8")],
  },
  "ember-seed": {
    paths: [stroke("M12 3c-1 4-5 6-5 10a5 5 0 0 0 10 0c0-3-2-5-3-7 0 2-1 3-2 4 0-3 1-5 0-7Z"), stroke("M10 15c0-2 1-3 2-4 1 1 2 2 2 4a2 2 0 0 1-4 0ZM5 19l-2 2m16-2 2 2")],
    filledPaths: [wash("M12 6c-1 3-4 5-4 8a4 4 0 0 0 8 0c0-2-1-4-2-5-1 2-2 3-3 3 0-2 1-4 1-6Z")],
  },
  "frost-drop": {
    paths: [stroke("M12 3C9 8 6 11 6 15a6 6 0 0 0 12 0c0-4-3-7-6-12Z"), stroke("M12 11v7m-3.5-5.5 7 4m0-4-7 4M4 6l2 2m12 0 2-2")],
    filledPaths: [wash("M12 5C10 9 7 12 7 15a5 5 0 0 0 10 0c0-3-3-6-5-10Z")],
  },
  "thorn-seed": {
    paths: [stroke("M12 6c4 0 6 3 6 7s-2 7-6 7-6-3-6-7 2-7 6-7Z"), stroke("M12 6V3m-6 7L3 9m4 8-3 2m14-9 3-1m-4 8 3 2M9 15l3-5 3 5")],
    filledPaths: [wash("M12 8c3 0 4 2 4 5s-1 5-4 5-4-2-4-5 1-5 4-5Z")],
  },
  "iron-spark": {
    paths: [stroke("M5 8 9 4l5 2 1 5-4 4-5-2-1-5Zm10 7 3-3 3 2-1 4-3 2-3-2Z"), stroke("M9 5v5l5 1m-5-1-3 3m11 2 3 1M3 17l2-1m12-11 2-2")],
    filledPaths: [wash("M6 8 9 5l4 2 1 4-3 3-4-2Z"), wash("m16 15 2-2 2 1-1 3-2 1-2-1Z")],
  },
  "static-spark": {
    paths: [stroke("M13 2 6 13h5l-1 9 8-12h-5l1-8Z"), stroke("M4 5 2 7m18-3 2 2M4 18l-2 2m18-5 2 2")],
    filledPaths: [wash("M13 5 8 12h5l-1 6 5-7h-5Z")],
  },
  gust: {
    paths: [stroke("M3 8h12c4 0 4-5 1-5-2 0-3 1-3 2M2 13h17c4 0 4 5 1 5-2 0-3-1-3-2M4 19h8"), stroke("M4 10h6m0 5H4")],
    filledPaths: [stroke("M3 8h12c4 0 4-5 1-5-2 0-3 1-3 2M2 13h17c4 0 4 5 1 5-2 0-3-1-3-2M4 19h8")],
  },
  pebble: {
    paths: [stroke("M7 5 15 4l5 5-1 7-5 4-8-2-3-6 4-7Z"), stroke("M7 5 9 11l-6 1m6-1 6-7m-6 7 5 9m-5-9 10 5")],
    filledPaths: [wash("M8 6 15 5l4 5-1 5-4 4-7-2-2-5Z")],
  },
  glimmer: {
    paths: [stroke("M12 3l2 6 6 3-6 2-2 6-2-6-6-2 6-3 2-6Z"), stroke("M4 4l1 2m14-2-1 2M4 20l1-2m14 2-1-2")],
    filledPaths: [wash("M12 6l1.5 4.5L18 12l-4.5 1.5L12 18l-1.5-4.5L6 12l4.5-1.5Z")],
  },
  "night-mote": {
    paths: [stroke("M12 4l1.5 5 5 3-5 2-1.5 6-1.5-6-5-2 5-3L12 4Z"), stroke("M19 3a3 3 0 0 0 3 5 3 3 0 1 1-3-5ZM4 18l-2 1m18-5 2 1")],
    filledPaths: [wash("M12 7l1 3 3 2-3 1-1 4-1-4-3-1 3-2Z")],
  },
  "meteor-shower-small": {
    paths: [
      stroke("M5 5l10 9M13 3l8 7M25 5l8 7M4 18l7 6"),
      stroke("M18 16c4-2 8 1 8 5s-3 7-7 7-7-3-7-6c0-3 2-5 6-6Zm17 1c3-1 6 1 6 4s-2 5-5 5-5-2-5-5c0-2 1-3 4-4Z"),
      stroke("M6 39c5-5 9-7 13-7s8 2 13 7M15 39h8m-4-7v-3m14 11 5-5m-1-3 5 1"),
    ],
    filledPaths: [wash("M18 18c3-1 6 1 6 4s-2 5-5 5-5-2-5-5c0-2 1-3 4-4Zm17 1c2-1 4 1 4 3s-1 3-3 3-3-1-3-3c0-1 1-2 2-3Z"), wash("M8 39c4-3 7-5 11-5s7 2 11 5Z")],
  },
  "meteor-shower-large": {
    paths: [
      stroke("M5 5l16 14M18 3l15 13M36 4l15 13M52 6l13 11M3 22l12 10M28 20l10 9"),
      stroke("M25 21c5-2 10 1 10 6s-4 9-9 9-9-4-9-8c0-3 3-6 8-7Zm30-1c5-2 9 1 9 5s-3 7-7 7-7-3-7-6c0-3 2-5 5-6ZM43 37c5-2 9 1 9 5s-3 7-7 7-7-3-7-6c0-3 2-5 5-6Z"),
      stroke("M5 61c7-8 15-12 23-12 9 0 17 4 24 12m-29 0h11m-6-12v-5M47 62l7-9 4 6 7-6M8 48l5-4m45-6 6-3"),
    ],
    filledPaths: [wash("M25 23c4-1 7 1 7 5s-3 6-6 6-6-3-6-6c0-2 2-4 5-5Zm30-1c3-1 6 1 6 4s-2 4-4 4-4-2-4-4c0-2 1-3 2-4ZM43 39c3-1 6 1 6 4s-2 4-4 4-4-2-4-4c0-2 1-3 2-4Z"), wash("M8 61c6-6 13-9 20-9s14 3 21 9Z")],
  },
  worldfall: {
    paths: [
      stroke("M5 5 30 25M18 3l21 17M35 4l17 14M3 19l20 17M55 6l10 10"),
      stroke("M43 20c12-4 22 4 21 15-1 12-10 19-21 18-11-1-18-9-17-18 1-7 7-13 17-15Z"),
      stroke("m40 27-6 7 4 6-2 7m13-20-3 7 6 4-4 8m-17-7 7 1m10-8 7 2"),
      stroke("M4 62c8-5 15-5 22-2l7-7 5 8 7-5 7 6c5-3 10-3 16 0M8 67l11-2 8 3 9-2 10 2 10-3 9 2M21 52l-5-5m39 9 6-5m-2-12 7 1"),
    ],
    filledPaths: [wash("M43 23c10-3 18 3 18 12-1 10-8 16-18 15-9-1-15-7-14-15 1-6 6-10 14-12Z"), wash("M7 62c7-3 13-3 19 0l7-7 5 8 7-5 7 6c4-2 9-2 13 0v3H7Z")],
  },
  meteor: {
    paths: [stroke("M29 20c9-2 15 5 13 13-2 9-10 12-17 8-8-4-7-15 4-21Z"), stroke("M5 5 24 22M14 4l19 15M4 15l15 17M27 25l7 1 3 7-6 5-6-5Z")],
    filledPaths: [wash("M29 22c7-2 13 4 11 11-2 7-9 10-14 6-6-3-6-11 3-17Z"), wash("M7 7l17 13-4 5Z")],
  },
  "piercing-gale": {
    paths: [stroke("M4 12c15-2 28-2 39 0-11 2-24 2-39 0Zm25-5 7 5-7 5m-20-9 9 4-9 4")],
    filledPaths: [wash("M5 12c13-2 27-2 40 0-13 2-27 2-40 0Z"), wash("M29 7l9 5-9 5 3-5Z")],
  },
  "glacial-lance": {
    paths: [stroke("M5 12 39 5 30 12 39 19 5 12Z"), stroke("M14 12 20 8m-6 4 6 4m7-4 5-3m-5 3 5 3m7-3 4-2m-4 2 4 2")],
    filledPaths: [wash("M6 12 38 6l-9 6 9 6Z")],
  },
  "ember-comet": {
    paths: [stroke("M24 4c8 4 14 10 15 18-1 10-7 17-16 18C13 39 7 32 8 23c1-8 8-15 16-19Z"), stroke("M14 30c-4 3-6 7-7 13m5-8-5 1m9 2-3 5M24 16c-4 4-5 8-3 12 2 4 7 4 9 1 3-4 1-8-6-13Z")],
    filledPaths: [wash("M24 7c8 5 12 10 13 16 0 8-5 14-14 15-8-1-13-7-12-14 1-6 6-12 13-17Z"), wash("M24 17c-4 4-5 7-3 10s6 3 8 0c2-3 0-6-5-10Z")],
  },
  "solar-storm": {
    paths: [stroke("M36 7c-8-5-20-4-27 3-7 8-5 20 3 27 8 7 20 5 27-3 6-7 5-18-1-24"), stroke("M24 11v6m0 14v6m-13-13h6m14 0h6M15 15l5 5m8 8 5 5m0-18-5 5m-8 8-5 5M24 16c-5 0-8 4-8 8s3 8 8 8 8-3 8-8-3-8-8-8Z"), stroke("M40 11l5-4m-4 17 5 1M8 38l-4 4")],
    filledPaths: [wash("M36 9c-7-5-18-3-24 4-6 7-4 17 3 23 7 6 17 4 23-3 5-6 5-16-2-24Z"), wash("M24 17c-4 0-7 3-7 7s3 7 7 7 7-3 7-7-3-7-7-7Z")],
  },
  "tidal-prison": {
    paths: [stroke("M8 7c10-4 22-4 32 0v30c-10 4-22 4-32 0V7Z"), stroke("M14 10v23m10-25v27m10-25v23M8 15c8 5 24 5 32 0M8 29c8-5 24-5 32 0"), stroke("M17 19l7-5 7 5-7 5Z")],
    filledPaths: [wash("M10 9c9-3 19-3 28 0v7c-9 4-19 4-28 0Zm0 18c9 4 19 4 28 0v7c-9 3-19 3-28 0Z"), wash("M24 17l5 3-5 3-5-3Z")],
  },
  "cinder-ring": {
    paths: [stroke("M24 5c11 0 19 8 19 19s-8 19-19 19S5 35 5 24 13 5 24 5Z"), stroke("M24 12c7 0 12 5 12 12s-5 12-12 12-12-5-12-12 5-12 12-12Z"), stroke("M24 5V1m0 46v-4M5 24H1m46 0h-4M10 10 7 7m34 34-3-3m0-28 3-3M7 41l3-3")],
    filledPaths: [wash("M24 7c10 0 17 7 17 17s-7 17-17 17S7 34 7 24 14 7 24 7Z"), wash("M24 16c5 0 8 3 8 8s-3 8-8 8-8-3-8-8 3-8 8-8Z")],
  },
  "repulse-wave": {
    paths: [stroke("M24 5c11 0 19 8 19 19s-8 19-19 19S5 35 5 24 13 5 24 5Z"), stroke("M24 13c6 0 11 5 11 11M35 24l-4-1m4 1-2 4M24 35c-6 0-11-5-11-11m0 0 4 1m-4-1 2-4M24 18v12m-6-6h12"), stroke("M24 1v5m0 36v5M1 24h5m36 0h5")],
    filledPaths: [wash("M24 7c10 0 17 7 17 17s-7 17-17 17S7 34 7 24 14 7 24 7Z"), wash("M21 18h6v12h-6Zm-3 3h12v6H18Z")],
  },
  "prism-ray": {
    paths: [stroke("M4 12h17m14 0h12M21 5l7 7-7 7-7-7 7-7Zm7 7 7-7v14l-7-7Z"), stroke("M4 7h9m-9 10h9m25-9 7-3m-7 14 7 3")],
    filledPaths: [wash("M4 11h15v2H4Z"), wash("M21 6l6 6-6 6-6-6Z"), wash("M28 6 35 2v20l-7-4Z")],
  },
  "storm-spear": {
    paths: [stroke("M7 12 39 5 30 12 39 19 7 12Z"), stroke("M15 12c4-9 10-9 14 0s10 9 15 0m-5-3 5 3-5 3"), stroke("M9 8l-3-3m2 12-4 3m27-12 2-5")],
    filledPaths: [wash("M8 12 37 6l-8 6 8 6Z"), wash("M16 12c4-7 8-7 12 0-4 7-8 7-12 0Z")],
  },
  pierce: {
    paths: [
      stroke("M12 3 7 13h10L12 3Zm0 10v31m-6-9 6 8 6-8m-10-6 4 4 4-4"),
      stroke("M5 22h14M5 25h14"),
    ],
    filledPaths: [wash("M12 5 9 12h6Zm-2 12h4v22l-2 4-2-4Z")],
  },
  slow: {
    paths: [
      stroke("M12 3c5 0 9 4 9 9 0 7-9 9-9 9s-9-2-9-9c0-5 4-9 9-9Z"),
      stroke("M12 7v5l-3 3m3-12V2m0 20v-2M4 12H2m20 0h-2"),
    ],
    filledPaths: [wash("M12 5c4 0 7 3 7 7 0 5-7 7-7 7s-7-2-7-7c0-4 3-7 7-7Z")],
  },
  burn: {
    paths: [
      stroke("M24 21C20 16 18 12 20 5c3 5 6 6 7 11 2-3 4-5 8-7 0 6 5 9 5 16a14 14 0 0 1-28 0c0-5 3-9 7-12-1 4 1 6 5 8Z"),
      stroke("M24 39c-4-4-3-8 1-12 0 4 5 5 5 9a5 5 0 0 1-10 0"),
    ],
    filledPaths: [wash("M24 24c-4-4-5-8-3-13 2 4 5 5 7 10 2-3 4-5 7-7 0 6 4 9 4 14a13 13 0 0 1-26 0c0-4 2-7 4-9 0 3 3 5 7 5Z"), wash("M24 34c-3 3-3 6-1 8a4 4 0 0 0 7-3c0-3-3-4-4-7Z")],
  },
  knockback: {
    paths: [
      stroke("M5 12h12m-5-5 5 5-5 5M19 5v14M8 19c2 2 4 3 7 3m-9-4 2 1m10-12-2 2"),
    ],
    filledPaths: [wash("M6 11h10v2H6Z"), wash("M13 7 18 12l-5 5v-3l2-2-2-2Z")],
  },
  duration: {
    paths: [
      stroke("M9 4h30M9 44h30M13 5c0 10 11 12 11 19S13 33 13 43m22-38c0 10-11 12-11 19s11 9 11 19"),
      stroke("M21 22h6m-6 4h6"),
    ],
    filledPaths: [wash("M16 8h16c-1 5-5 8-8 11-3-3-7-6-8-11Zm0 32h16c-1-5-5-8-8-11-3 3-7 6-8 11Z")],
  },
  capacity: {
    paths: [
      stroke("M11 4h19v19H11zM4 13v18h19M15 10h11m-6-5v11m-10 3v14m-5-7h11"),
      stroke("M29 28h12m-6-6v12m-15 4h12m-6-6v12"),
    ],
    filledPaths: [wash("M13 6h15v15H13Z"), wash("M7 16h14v14H7Z")],
  },
  precision: {
    paths: [
      stroke("M12 3v6m0 6v6M3 12h6m6 0h6M5.5 5.5l4 4m5 5 4 4m0-13-4 4m-5 5-4 4"),
      stroke("M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"),
    ],
    filledPaths: [wash("M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z")],
  },
  "ember-familiar": {
    paths: [
      stroke("M24 4c-8 8-14 14-13 25 1 9 7 15 14 15s13-6 14-15C40 19 32 12 24 4Z"),
      stroke("M18 24c2-2 4-2 6 0m5 0c2-2 4-2 6 0m-14 8c4 3 8 3 12 0m-9-13 2-4 2 4"),
    ],
    filledPaths: [wash("M24 8c-6 7-11 13-10 21 1 8 5 12 11 12s10-4 11-12c1-8-5-14-12-21Z"), wash("M18 29c2-2 4-2 6 0m5 0c2-2 4-2 6 0m-13 6c3 2 7 2 10 0")],
  },
  "frost-wisp": {
    paths: [
      stroke("M12 4C7 12 3 18 4 27c1 10 5 17 8 17s7-7 8-17C21 18 17 12 12 4Z"),
      stroke("M7 25c2-2 4-2 5 0m2 0c2-2 4-2 5 0m-10 7c2 2 4 2 6 0m-3-12v-5m-3 2 3 3 3-3"),
    ],
    filledPaths: [wash("M12 8C8 15 5 20 6 28c1 8 4 13 6 13s5-5 6-13c1-8-2-13-6-20Z")],
  },
  "thorn-guardian": {
    paths: [
      stroke("M24 4 29 12 40 9 35 19 43 26 33 29 34 41 24 35 14 41 15 29 5 26 13 19 8 9 19 12 24 4Z"),
      stroke("M17 22c2-2 4-2 6 0m3 0c2-2 4-2 6 0m-12 7c3 3 7 3 10 0M24 13v5m-5 17-4 7m18-7 4 7"),
    ],
    filledPaths: [wash("M24 8 29 16 37 13 33 21 39 26 31 29 32 37 24 32 16 37 17 29 9 26 15 21 11 13 19 16Z")],
  },
  "ember-turret": {
    paths: [
      stroke("M8 40h32M12 35h24l-3-12H15l-3 12ZM18 23V15h12v8m-6-8V5m0 0-4 5m4-5 4 5"),
      stroke("M24 27c-3-4-2-7 1-10 0 3 4 4 4 8a4 4 0 0 1-8 0"),
    ],
    filledPaths: [wash("M14 33h20l-2-8H16Z"), wash("M24 30c-2-3-1-5 1-7 0 2 3 3 3 5a3 3 0 0 1-6 0Z")],
  },
  "frost-pylon": {
    paths: [
      stroke("M24 4 39 18 24 43 9 18 24 4Z"),
      stroke("M24 4v39m-15-25h30M15 25l9-7 9 7-9 7-9-7Z"),
    ],
    filledPaths: [wash("M24 7 35 18 24 35 13 18Z"), wash("M18 25l6-5 6 5-6 5Z")],
  },
  "restorative-totem": {
    paths: [
      stroke("M24 5v37M16 42h16M13 14h22M16 8l8 6 8-6M17 21l7 6 7-6M17 31l7 6 7-6"),
      stroke("M24 18v6m-3-3h6m-3 7v6m-3-3h6"),
      stroke("M9 11 5 7m34 4 4-4M7 29l-5 2m39-2 5 2"),
    ],
    filledPaths: [wash("M22 8h4v33h-4Z"), wash("M14 13h20v3H14Zm3 9 7 5 7-5v4l-7 5-7-5Zm0 10 7 5 7-5v4l-7 5-7-5Z")],
  },
};
