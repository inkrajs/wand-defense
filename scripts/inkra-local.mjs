import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, renameSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)),"..");
const installed = join(root,"node_modules/@inkra/react");
const local = join(root,".local"), backup = join(local,"inkra-registry-package");
const marker = join(local,"inkra-link.json");
const present = path => { try { lstatSync(path); return true; } catch { return false; } };
const read = path => JSON.parse(readFileSync(path,"utf8"));
const linkTarget = () => resolve(dirname(installed),readlinkSync(installed));
const mode = process.argv[2];

if (mode === "local") {
  if (!process.argv[3]) throw new Error("Usage: npm run inkra:local -- /absolute/path/to/library/packages/inkra");
  const target = realpathSync(resolve(process.argv[3]));
  if ([installed,backup].some(path => target === path || target.startsWith(path + "/")))
    throw new Error("The local package must be outside the managed installation and registry backup.");
  const manifest = read(join(target,"package.json"));
  if (manifest.name !== "@inkra/react" || !existsSync(join(target,"dist/index.js")) || !existsSync(join(target,"dist/index.d.ts")))
    throw new Error("Expected the built public @inkra/react package directory; build the library first.");
  let previousTarget;
  if (present(installed) && lstatSync(installed).isSymbolicLink()) {
    if (!existsSync(marker)) throw new Error("An unmanaged Inkra link already exists; leaving it unchanged.");
    const managed = read(marker);
    if (linkTarget() !== managed.target) throw new Error("The Inkra link changed outside this script; leaving it unchanged.");
    if (managed.target === target) { console.log(`Already using local Inkra: ${target}`); process.exit(0); }
    previousTarget = managed.target;
    unlinkSync(installed);
  } else {
    if (!present(installed)) throw new Error("Run npm ci before linking local Inkra.");
    if (present(backup)) throw new Error("An earlier registry backup exists; restore it before switching again.");
    mkdirSync(local,{recursive:true});
    renameSync(installed,backup);
  }
  try { symlinkSync(target,installed,"dir"); }
  catch (error) {
    if (!present(installed)) {
      if (previousTarget) symlinkSync(previousTarget,installed,"dir");
      else if (present(backup)) renameSync(backup,installed);
    }
    throw error;
  }
  writeFileSync(marker,JSON.stringify({target,version:manifest.version},null,2)+"\n");
  console.log(`Using local Inkra public package: ${target}\nRestart Vite after switching; rebuild the library dist to propagate changes.`);
} else if (mode === "registry") {
  if (!present(backup) || !existsSync(marker)) throw new Error("No managed registry backup found; use npm ci for the locked registry package.");
  const managed = read(marker);
  if (!present(installed) || !lstatSync(installed).isSymbolicLink() || linkTarget() !== managed.target)
    throw new Error("The Inkra installation changed outside this script; leaving it unchanged.");
  unlinkSync(installed);
  renameSync(backup,installed);
  unlinkSync(marker);
  console.log("Restored the registry Inkra package. Restart Vite after switching.");
} else throw new Error("Expected local or registry.");
