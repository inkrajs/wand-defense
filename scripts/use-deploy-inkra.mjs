import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const archive = join(root, "vendor/inkra-react-0.15.0-candidate.tgz");
const expected = "de0c8e9c03929bbb49dc267ce5a64e8773a399b27b153fded1724d6033336239";
if (createHash("sha256").update(readFileSync(archive)).digest("hex") !== expected)
  throw new Error("Deployment Inkra snapshot checksum mismatch");
mkdirSync(join(root, ".local"), { recursive: true });
const destination = mkdtempSync(join(root, ".local/deploy-inkra-"));
for (const [command, args] of [
  ["tar", ["-xzf", archive, "-C", destination]],
  [process.execPath, [join(root, "scripts/inkra-local.mjs"), "local", join(destination, "package")]],
]) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
