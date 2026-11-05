import type { MagicArtwork, MagicArtworkCatalog } from "./types";

const glyph = (design: string, tier: 1 | 2): MagicArtwork => ({
  paths: [
    { d: design, mode: "stroke" },
    { d: tier === 1 ? "M28 12h13m-4-4 4 4-4 4" : "M28 8h13m-4-4 4 4-4 4m-9 6h13m-4-4 4 4-4 4M36 27v13m-4-4 4 4 4-4", mode: "stroke" },
  ],
  filledPaths: [{ d: "M32 10h5v4h-5Z", mode: "wash" }],
});

const branches = [
  ["charge-up", "overload", "M3 19h4v-5h4V9h4V4h5M4 5l4 3-4 3"],
  ["compression", "compression-burst", "M2 12h7m-3-3 3 3-3 3m16-3h-7m3-3-3 3 3 3m-6-8v16"],
  ["diffusion", "proliferation", "M11 12h-8m4-4-4 4 4 4m6-4h8m-4-4 4 4-4 4M12 4v4m0 8v4"],
  ["brand", "detonation", "M6 17c-3-4 2-7 2-11 3 2 5 5 5 7 2-2 3-4 3-6 6 5 4 13-3 13-3 0-5-1-7-3Z"],
  ["freeze", "ice-shatter", "M12 3v18M4 7l16 10M4 17 20 7M9 4l3 3 3-3m-6 16 3-3 3 3"],
  ["electrify", "superconduct", "M14 2 5 13h6l-1 9 9-13h-6Z"],
  ["armor-break", "weak-point", "M12 3 4 6v7c1 4 4 6 8 8 4-2 7-4 8-8V6ZM13 4l-4 7 6 2-3 7"],
  ["return-flight", "circling-pursuit", "M4 7h11a6 6 0 0 1 0 12H5m4-4-4 4 4 3"],
  ["fan-shot", "rotating-volley", "M3 12l18-8m-18 8h18m-18 0 18 8"],
  ["second-split", "continuous-split", "M3 12h7m0 0 6-6m-6 6 6 6m0-12h5m-5 12h5"],
  ["spell-mount", "cooperative-casting", "M6 18h12l-1-7H7Zm2-7-2-5h12l-2 5M12 3v4m-3-2h6"],
  ["reinforcement", "rally", "M5 19V5h13l-3 4 3 4H5m4 4h9m-4-4v8"],
  ["symbiosis", "soul-link", "M12 20 4 12c-5-6 4-11 8-5 4-6 13-1 8 5Zm-7-8h5l2-3 2 5 2-2h3"],
  ["sacrifice", "soul-sacrifice", "M4 17h16m-14 0 2 4h8l2-4m-6-3c-3-1-3-4 0-8 3 4 3 7 0 8Z"],
] as const;

export const approvedArtwork: MagicArtworkCatalog = Object.fromEntries(
  branches.flatMap(([base, advanced, design]) => [[base, glyph(design, 1)], [advanced, glyph(design, 2)]]),
);
