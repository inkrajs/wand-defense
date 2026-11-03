import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
async function findTests(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
  const nested = await Promise.all(entries.map(entry => {
    const path = dir + "/" + entry.name;
    return entry.isDirectory() ? findTests(path) : entry.name.endsWith(".test.ts") ? [path] : [];
  }));
  return nested.flat();
}
const files = (await Promise.all(["src", "server", "cli"].map(findTests))).flat();
if (!files.length) { console.error("No tests found"); process.exit(1); }
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...process.argv.slice(2), ...files], { stdio: "inherit" });
process.exit(result.status ?? 1);
