import type { MagicArtworkCatalog } from "./types";

const stroke = (d: string) => ({ d, mode: "stroke" as const });
const wash = (d: string) => ({ d, mode: "wash" as const });

/** Original content art authored in the same 24-unit-per-cell grid as each definition. */
export const contentExpansionArtwork: MagicArtworkCatalog = {
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
