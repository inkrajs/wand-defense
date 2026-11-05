import { approvedSpells } from "../../content/approved-5";
import type { MagicArtworkCatalog } from "./types";

// Every drawing starts with an absolute move, then uses relative strokes in a 24-unit sketch box.
const glyphs: Record<string, string> = {
  "scorched-earth": "M2 18l5-2 4 2 4-2 7 2m-16 3 3-2 3 2 4-2m-9-7q-2-3 1-6 0 3 2 4m3 2q-2-3 1-8 0 4 3 6",
  "molten-hell": "M2 19l4-3 3 2 3-2 3 3 3-2 4 2m-18-9 4 1 2-5 3 3 1-6 3 6 4 1m-16 3 3 1 2-3 3 2 3-2 4 2m-15 8 4-2 3 1 4-1",
  "flame-lash": "M3 20q12-1 13-8 0-4-5-4-2 0-4 2 2-5 6-6 8-2 8 4 0 6-10 9m-8 3 3-4m12-8 2-1",
  "fire-serpent": "M2 18q6 4 10-2 3-4-2-7-3-2 2-4l7-2 2 4-4 1 1 3-3-1q4 5-3 10-6 4-10-2m14-12 1 0",
  "ice-mist": "M3 11q1-4 5-3 3-6 8-3 2 0 3 3 4 0 3 4m-20 2h6m3 0h10m-16 4h9m2 0h5m-10 1 2 3 2-3",
  blizzard: "M2 6q8-3 17-2l-2-2m2 2-2 3m-13 4 5-2m3 3 8-3m-15 7v5m-2-3h4m5-3v5m-2-3h4m5-4v5m-2-3h4",
  "water-spiral": "M3 13q-2-8 8-9 10-1 10 6 0 6-8 7-6 0-5-5 1-3 4-2m-8 7q4 5 12 3m-13-7 3-1m-3 1-1-3",
  "deep-sea-vortex": "M1 10q1-6 7-6 5 0 5 5 0 3-4 3-2 0-2-2m16 4q-1 6-7 6-5 0-5-5 0-3 4-3 2 0 2 2m-15 5 4-2-3-1m19-11-4 2 3 1",
  "gear-disc": "M10 3h4l1 3 3-1 2 3-2 2 3 1v3l-3 1 1 3-3 2-2-2-1 3h-3l-1-3-3 1-2-3 2-2-3-1v-3l3-1-1-3 3-2 2 2zm2 5q4 0 4 4t-4 4-4-4 4-4z",
  "blade-wheel": "M12 3q7 0 9 7l-6-3 2 5 4 4q-4 6-10 4l4-5-5 1-5 3q-5-5-2-11l4 5 2-4-2-5zm0 6 3 3-3 3-3-3z",
  "cutting-storm": "M4 4l6 4-4 1 5 3-7 6m16 2-6-4 4-1-5-3 7-6m-16 13 2 3 4-2m10-15-2-3-4 2m-1 9 3 3-3 3-3-3z",
  "magnetic-needle": "M3 17l14-12 4 1-1 4-14 10zm10-13q-4 0-6 4m13 7q0 4-4 6m-8-2-3 2",
  "magnetic-storm": "M4 5v9q0 7 8 7t8-7v-9h-4v8q0 4-4 4t-4-4v-8zm0 4h4m8 0h4m-8-6-2 5h4l-2 5",
  spore: "M12 4q7 4 7 10 0 5-7 5t-7-5q0-6 7-10zm-1 7h1m3 3h1m-7 1h1",
  "spore-cloud": "M3 15q-2-4 3-5 0-4 5-3 3-5 6-1 4 0 4 4 3 2 0 5zm3 4h1m3 2h1m3-3h1m4 3h1",
  "fungal-spread": "M12 21v-9m0 5-6-5m6 5 6-5m-12 0-4-1q1-4 4-4t4 4zm12 0-4-1q1-4 4-4t4 4zm-6 0-5-1q1-6 5-6t5 6zm-9 10 3-2m12 0 3 2",
  "sand-dust": "M3 9h7m4 0h2m4 0h1m-18 4h2m4 0h6m3 0h3m-17 5h6m3 0h1m4 0h2",
  quicksand: "M2 11q5-3 10-3t10 3q-2 7-10 8-8-1-10-8zm4 1q6 2 12 0m-9 3h6m-3-12v6m-2-2 2 2 2-2",
  sandstorm: "M2 9q5-6 14-4 5 1 5 4 0 4-6 4-4 0-4-2 0-2 3-2m-12 4q5-1 8 3 3 3 11 1m-16 2 3 2m10 0 3-1",
  "electric-charge": "M12 3q8 0 8 9t-8 9-8-9 8-9zm1 3-5 7h4l-1 5 6-8h-5z",
  "electrostatic-shield": "M12 3l7 3v6q0 5-7 9-7-4-7-9v-6zm1 3-4 6h3l-1 5 5-7h-3z",
  "ion-shield": "M4 20h16m-12 0 1-5h6l1 5m-4-15 4 4-4 4-4-4zm-8 6q1-6 4-8m12 8q-1-6-4-8m-13 12h3m12 0h3",
  "wind-pressure": "M3 8h9m-10 4h14m-13 4h9m4-12q7 8 0 16m-1-11 4 3-4 3",
  "vacuum-blade": "M2 14q9-2 20-9-4 8-11 11-6 2-9-2zm4 5 4-1m3-13 6-2m-17 8 4-1",
  "vacuum-storm": "M3 10q5-8 13-6 7 2 5 8-2 6-9 6-7 0-6-5 1-4 5-4 4 0 4 3m-12 6 4 2m10 1 4-3m-3-10 4-1",
  starlight: "M12 3l2 6 6 3-6 2-2 7-2-7-6-2 6-3zm-8 2 2 2m12 11 2 2",
  "stellar-glow": "M12 5l2 5 5 2-5 2-2 5-2-5-5-2 5-2zm-10 6q2-7 10-8m10 10q-2 7-10 8m-7-2 2 1m10-16 2 1",
  aurora: "M2 10q4-7 8-2t7 1q3-5 5-5m-20 9q4-7 8-2t7 1q3-5 5-5m-20 9q4-7 8-2t7 1q3-5 5-5m-10 7v4m-2-2h4",
  "living-shadow": "M3 15q3-10 11-10-3 4 1 6 3 1 6-1-3 9-11 9-5 0-7-4zm5-2h2m3 2h2",
  "shadow-double": "M3 19q0-5 4-7-3-4 0-7 3-3 6 0 3 3 0 7 4 2 4 7zm14-7q4 2 4 6h-2m-1-13q3 2 1 5m-11-2h1m2 0h1",
  "shadow-legion": "M2 19v-4l3-3 3 3v4zm6 0v-7l4-4 4 4v7zm8 0v-4l3-3 3 3v4zm-6-6h1m2 0h1m-2-11v3",
  "bone-armor": "M12 3l7 3v6q0 5-7 9-7-4-7-9v-6zm-4 6 8 7m-8 0 8-7m-8 0-1 1m9 6 1-1m-9 1 1 1m7-8-1-1",
  "bone-wall": "M3 20v-10h4v3h3v-6h4v6h3v-3h4v10zm5 0v-3m4 3v-4m4 4v-3m-11-9 2-2m10 0 2 2",
  "bone-prison": "M4 20v-13l2-3 2 3v13m2 0v-13l2-3 2 3v13m2 0v-13l2-3 2 3v13m-18 0h20m-20-8h20",
  ghost: "M5 19v-8q0-7 7-7t7 7v8l-4-2-3 3-3-3zm4-8h1m4 0h1m-4 3h2",
  revenant: "M4 21l2-10q0-7 6-8 6 1 6 8l2 10-5-4-3 2-3-2zm4-11 2 1m6-1-2 1m-4 3h4",
  "ghost-legion": "M2 19v-5q0-4 4-4 3 0 3 4v5l-3-1zm7-1v-8q0-5 4-5t4 5v8l-4-2zm8 1v-5q0-4 3-4 2 0 2 4v5l-2-1zm-5-8h2",
};

export const approvedArtwork: MagicArtworkCatalog = Object.fromEntries(Object.entries(glyphs).map(([id, glyph]) => {
  const width = approvedSpells[id].shape.length / 2;
  let coordinateIndex = 0;
  const d = glyph.replace(/-?\d+/g, value => {
    const offset = coordinateIndex++ === 0 ? (width - 2) * 12 : 0;
    return ` ${Number(value) * 2 + offset} `;
  });
  return [id, { paths: [{ d, mode: "stroke" }], filledPaths: [] }];
}));
