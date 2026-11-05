import type { MagicArtwork, MagicArtworkCatalog } from "./types";

function strokes(...paths: string[]): MagicArtwork {
  return { paths: paths.map(d => ({ d, mode: "stroke" })), filledPaths: [] };
}

const trail = "M5 17Q14 17 15 9T19 5M14 5L19 5L19 10";
const rebound = "M4 16L10 8L15 15L21 7M16 8L21 7L21 12";
const drop = "M12 4C10 8 7 11 7 15A5 5 0 0 0 17 15C17 11 14 8 12 4Z";
const wave = "M3 13Q6 6 9 13T15 13T21 13";
const fracture = "M3 13L7 13L10 8L13 18L16 11L21 11";

export const approvedArtwork: MagicArtworkCatalog = {
  tracking: strokes(trail, "M18 2V3M22 6H23"),
  pursuit: strokes("M15 17Q34 18 48 6M42 7L48 6L47 12", "M48 3H54M51 1V5", "M27 19L32 17"),
  ricochet: strokes(rebound, "M8 7L12 7M13 17L17 17"),
  "chain-ricochet": strokes("M8 17L18 6L29 17L40 6L51 17L62 6M56 7L62 6V12", "M15 4H21M26 20H32M37 4H43M48 20H54"),
  "mana-reclaim": strokes(drop, "M4 9C1 13 2 18 5 20M1 19L5 20L5 16"),
  "greater-reclaim": strokes("M36 3C33 8 29 12 29 15A7 7 0 0 0 43 15C43 12 39 8 36 3Z", "M24 7C18 9 19 17 25 19M21 20L25 19L24 15", "M48 18C54 16 53 8 47 6M51 5L47 6L48 10"),
  resonance: strokes(wave, "M4 6H20M4 20H20"),
  "elemental-resonance": strokes("M8 12Q15 2 22 12T36 12T50 12T64 12", "M8 12Q15 22 22 12T36 12T50 12T64 12", "M36 4V20"),
  aftershock: strokes(fracture, "M4 19H8M16 19H20"),
  "chain-aftershock": strokes("M8 12H16L22 5L28 19L34 9L40 15L46 7L52 16L57 12H64", "M16 21H28M32 21H44M48 21H60"),
  martyrdom: strokes("M24 3L26 9L33 7L29 12L33 17L26 15L24 22L22 15L15 17L19 12L15 7L22 9Z", "M7 12H12M36 12H41"),
  "chain-martyrdom": strokes("M36 4L38 9L44 7L41 12L44 17L38 15L36 21L34 15L28 17L31 12L28 7L34 9Z", "M8 12L20 6M8 12L20 18M64 12L52 6M64 12L52 18"),
  "domain-expansion": strokes("M10 15C10 9 38 9 38 15S10 22 10 15Z", "M24 14V4M21 7L24 4L27 7", "M6 11L3 15L6 19M42 11L45 15L42 19"),
  "total-domain": strokes("M9 15C9 8 63 8 63 15S9 22 9 15Z", "M9 15H63M36 10V20M22 11V19M50 11V19", "M36 8V2M33 5L36 2L39 5"),
  "linked-cast": strokes("M7 12H39M34 7L39 12L34 17", "M14 8L19 12L14 16M23 8L28 12L23 16"),
  "multi-linked-cast": strokes("M8 12H28L44 5H64M28 12L44 19H64", "M60 2L64 5L60 8M60 16L64 19L60 22"),
};
