import type { MagicArtworkCatalog, MagicArtwork } from "./types";

const ink = (...paths: string[]): MagicArtwork => ({ paths: paths.map(d => ({ d, mode: "stroke" })), filledPaths: [] });
const flame = "M12 34 Q6 24 18 16 L20 25 Q28 16 27 6 Q45 23 35 35 Q24 43 12 34Z";
const bolt = "M27 8 L13 27 H24 L20 40 L36 20 H25Z";

export const approvedArtwork: MagicArtworkCatalog = {
  "fire-curtain": ink(flame, "M6 42 Q23 38 42 42"),
  "flame-wall": ink("M5 39 V20 L11 25 L16 13 L22 23 L28 9 L35 24 L42 16 V39Z", "M8 33 H40"),
  "inferno-bastion": ink("M12 37 V15 H20 V22 H29 V13 H39 V22 H48 V15 H59 V37Z", "M25 36 Q19 29 31 23 Q28 30 36 34 Q40 27 44 24 Q51 34 45 37"),
  "fire-rain": ink("M12 9 L6 26 M26 7 L18 29 M41 11 L33 32", "M7 38 H13 M19 41 H29 M34 37 H41"),
  heavenfire: ink("M20 8 L9 31 M34 6 L23 30 M49 8 L38 32 M62 13 L52 34", "M8 41 L15 36 L22 41 L32 35 L43 42 L50 36 L62 41"),
  "lava-geyser": ink("M7 38 L16 33 L19 25 H29 L33 33 L41 38Z", "M23 26 Q24 14 18 10 M25 26 Q32 14 35 12 M24 21 L24 6"),
  "volcanic-eruption": ink("M8 41 L22 32 L30 24 H43 L50 33 L65 41Z", "M32 25 L22 15 L12 18 M37 23 L35 5 M42 24 L53 13 L62 15", "M20 38 Q29 33 35 38 T51 38"),
  "fire-tornado": ink("M7 14 Q25 5 42 13 Q45 19 18 22 Q6 24 32 28 Q40 32 24 34 L24 41", "M15 13 L18 7 M31 15 L35 8"),
  "blazing-tempest": ink("M7 12 Q23 6 32 13 Q39 18 12 22 Q5 24 26 28 L18 37 M40 16 Q53 9 66 16 Q71 20 46 25 Q41 28 58 32 L51 40", "M11 41 H27 M43 43 H61"),
  riptide: ink("M38 14 Q24 4 12 15 Q2 29 18 38 Q34 43 38 30 Q40 21 28 19 Q18 17 18 26 L23 30", "M32 9 L39 14 L33 17"),
  tsunami: ink("M6 36 Q12 13 32 11 Q43 12 43 22 Q33 16 29 25 Q29 32 42 33 M6 40 H42"),
  "great-flood": ink("M8 30 Q21 9 35 22 Q45 27 55 15 L64 12 M8 37 Q19 26 30 35 T52 35 T64 32", "M11 42 H60"),
  icicle: ink("M13 11 L29 5 L39 15 L20 42Z", "M29 5 L24 21 L20 42 M13 11 L24 21 L39 15"),
  "frost-nova": ink("M24 5 V43 M7 14 L41 34 M7 34 L41 14", "M19 10 L24 15 L29 10 M19 38 L24 33 L29 38", "M9 21 L16 19 L14 12 M34 36 L32 29 L39 27"),
  "absolute-zero": ink("M16 24 L26 8 H47 L57 24 L47 40 H26Z", "M36 11 V37 M24 17 L48 31 M24 31 L48 17", "M9 20 V28 M64 20 V28"),
  "water-blade": ink("M6 29 Q21 10 42 14 Q29 19 21 32 Q13 38 6 29Z", "M11 29 Q20 23 29 20"),
  "pressure-jet": ink("M6 20 L16 20 L21 16 V32 L16 28 H6Z", "M24 21 L43 16 M24 24 H45 M24 27 L43 32"),
  "abyssal-pressure": ink("M9 17 L25 24 L9 31 M63 17 L47 24 L63 31", "M36 12 Q27 23 29 29 Q35 38 43 29 Q45 22 36 12Z"),
  "thunder-cloud": ink("M8 24 Q5 16 15 14 Q19 5 28 11 Q36 8 39 16 Q46 18 40 25Z", "M26 24 L18 34 H25 L21 42"),
  "lightning-storm": ink("M7 21 Q9 10 20 12 Q26 4 35 10 Q44 5 51 12 Q61 11 65 21Z", "M21 24 L15 33 H21 L16 41 M38 24 L32 33 H38 L33 41 M55 24 L49 33 H55 L50 41"),
  "ball-lightning": ink(bolt, "M25 4 Q45 8 44 25 Q42 44 22 44 Q4 41 4 23 Q6 6 25 4Z"),
  "ball-lightning-storm": ink("M20 8 Q32 7 32 20 Q32 32 20 32 Q8 32 8 20 Q8 9 20 8Z", "M53 17 Q65 16 65 29 Q65 41 53 41 Q41 41 41 29 Q41 18 53 17Z", "M20 12 L15 22 H23 L19 28 M53 21 L48 31 H56 L52 37 M31 16 L42 13 M34 35 L41 31"),
  emp: ink("M24 6 Q42 6 42 24 Q42 42 24 42 Q6 42 6 24 Q6 6 24 6Z", "M8 25 H17 L20 16 L24 32 L29 19 L33 25 H40"),
  "electromagnetic-storm": ink("M8 24 Q14 11 35 11 T64 24 Q59 37 35 37 T8 24Z", "M8 24 Q23 35 35 24 T64 24", "M40 6 L30 25 H38 L33 42 L47 20 H39"),
};
