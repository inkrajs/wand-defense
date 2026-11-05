import { approvedSpells } from "../../content/approved-3";
import type { MagicArtworkCatalog } from "./types";

const paths: Record<string, string> = {
  "wind-swirl": "M3 13C3 6 12 4 17 7c5 4 0 10-5 8-3-1-2-5 1-5M6 17l-3-4 5-1",
  tornado: "M2 5q9-5 20 0-3 4-17 3 5 4 14 3-2 4-10 3 3 3 7 3l-3 5",
  hurricane: "M3 16q0-12 12-12 7 0 7 7M22 8l-1 4-4-2M21 17q-7 7-16 2M8 14q0-5 5-5 4 0 3 4-1 4-5 2",
  "wind-wall": "M5 20Q2 11 6 4m3 16Q6 11 10 4m3 16q-3-9 1-16m3 16q-3-9 1-16M15 9l5-3m-5 9 5 3",
  "storm-bulwark": "M4 17Q1 12 4 7l8-4 8 4q3 5 0 10l-8 4-8-4ZM6 13q4-4 8 0t6 0M8 17q3-3 6 0",
  "wind-circulation": "M2 12c-4-5 3-10 7-6 4 4 1 9 0 11l1-4m-1 4-4-1m17-4c4 5-3 10-7 6-4-4-1-9 0-11l-1 4m1-4 4 1",
  "atmospheric-circulation": "M3 12c1-6 6-8 10-1s7 5 8 0c1-5-4-7-7-4M21 12c-1 6-6 8-10 1s-7-5-8 0c-1 5 4 7 7 4M2 5l3-2m14 18 3-2",
  "light-convergence": "M3 5l8 7-8 7m8-7h10m-6-7-4 7 4 7",
  laser: "M2 12h20m-18-3h9m-9 6h9M16 5v3m0 8v3m-3-7 3-3 3 3-3 3Z",
  "high-energy-laser": "M1 8h22M1 16h22M2 12h20M12 3l3 4m-6 10 3 4m-9-1 3-2m12-12 3-2",
  "light-bulwark": "M12 3l7 3v6q-1 5-7 9-6-4-7-9V6ZM12 8v8m-4-4h8",
  "prism-barrier": "M5 20h14M8 19l1-5h6l1 5M12 3l5 5-5 6-5-6Zm-8 5h3m10 0h3M12 3v11",
  sanctuary: "M3 21h18M5 20V9l7-6 7 6v11M8 20v-8l4-3 4 3v8M10 15h4m-2-2v4",
  "eclipse-mark": "M17 4C5-1-3 14 6 19q9 4 14-3C13 18 10 8 17 4ZM5 19l14-14",
  "annihilation-mark": "M12 3l9 9-9 9-9-9ZM8 8l8 8m0-8-8 8M12 2v4m0 12v4M2 12h4m12 0h4",
  "void-rift": "M6 3l6 4-3 4 6 1-4 4 7 5M15 4l4 3-2 5 4 5M3 9l2 5 3 3",
  "void-tempest": "M3 16C0 7 9 2 17 5s7 12-1 14c-7 2-13-4-10-9m5-5-1 5 4-1-3 4 4 2-2 6",
  "event-horizon": "M4 8C8-1 22 2 22 12S8 25 4 16m1-8-2 4 2 4m3-7C12 3 20 7 20 12s-8 9-12 3M2 12h7m13-2h-5",
  "dark-star": "M12 3l2 6 7 3-7 2-2 7-2-7-7-2 7-3ZM4 5l2 2m12 10 2 2",
  "dark-star-burst": "M12 2v4m0 12v4M2 12h4m12 0h4M3 3l5 5m8 8 5 5M21 3l-5 5m-8 8-5 5M12 7l5 5-5 5-5-5Z",
  "bone-siege": "M3 20V9h4v4h3V8h4v5h3V9h4v11ZM9 20v-3q3-3 6 0v3M4 5l3 2m10 0 3-2",
  "undead-army": "M3 19V7l2-3 2 3-2 3m13 9V7l2-3 2 3-2 3M8 10q0-8 8 0l-2 3v4h-4v-4Zm2 0h1m2 0h1",
  "undead-scourge": "M6 14q0-14 12 0l-3 2v4H9v-4ZM8 12h2m4 0h2M4 5l3 2m10 0 3-2M12 2v4m-7 12-3 2m17-2 3 2",
  "bone-sorcerer": "M4 20V8l-2-2 2-3 2 3-2 2m4 5q0-14 12 0l-3 3v3h-6v-3Zm3-1h2m2 0h2",
  lich: "M4 18L6 8l6-5 6 5 2 10-4 3H8Zm4-6 2 1m6-1-2 1m-4 4h4M20 2l-2 4h4l-2 4",
  "bone-dragon": "M4 17l3-8 6-4-2 5 7-2-1 4 4 2-5 4-7-1-4 4m7-8 2-1m2 5 2-2",
  "ancient-bone-dragon": "M3 19l4-9 6-4 5-4-1 7 5 3-4 3-3-1-5 4-4 3m5-10 3-1m-7 7-4-3 2-5m12 7 2 3 3-2",
};

export const approvedArtwork: MagicArtworkCatalog = Object.fromEntries(Object.entries(paths).map(([id, path]) => {
  const shape = approvedSpells[id].shape;
  const width = Math.max(...shape.map(cell => cell.x)) + 1;
  const height = Math.max(...shape.map(cell => cell.y)) + 1;
  const scale = Math.min(width, height);
  // Keep the mark centered without stretching it on wider spell tiles.
  const offsetX = 12 * (width - scale);
  const d = path.replace(/([A-Za-z])([^A-Za-z]*)/g, (_, command: string, args: string) => {
    let index = 0;
    return command + args.replace(/-?\d+(?:\.\d+)?/g, number => {
      const x = command === "H" || (command !== "V" && index % 2 === 0);
      index++;
      const offset = x && command === command.toUpperCase() ? offsetX : 0;
      return ` ${Number(number) * scale + offset} `;
    });
  });
  return [id, { paths: [{ d, mode: "stroke" }], filledPaths: [] }];
}));
