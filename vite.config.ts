import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { lstatSync, realpathSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
export default defineConfig(({mode}) => {
  const previewEnv = loadEnv(mode,process.cwd(),"");
  const requestId = previewEnv.WAND_DEFENSE_PREVIEW_GRANT;
  const onlyMissing = previewEnv.WAND_DEFENSE_PREVIEW_MISSING_ONLY === "1";
  const inspectId = previewEnv.WAND_DEFENSE_PREVIEW_INSPECT;
  const installed = resolve("node_modules/@inkra/react");
  const localPackage = lstatSync(installed).isSymbolicLink() ? realpathSync(installed) : undefined;
  return {
    base: mode === "production" ? "/wand-defense/" : "/",
    define: {"import.meta.env.INKRA_LOCAL":JSON.stringify(Boolean(localPackage))},
    resolve: { dedupe: ["react","react-dom"] },
    optimizeDeps: localPackage ? {exclude:["@inkra/react"]} : undefined,
    server: { port: 5173, strictPort: true, watch:{ignored:["**/.local/**","**/vendor/**"]},
      ...(localPackage ? {fs:{allow:[process.cwd(),dirname(dirname(localPackage))]}} : {}) },
    build: { target: "es2022" },
    plugins: [react(),{name:"pwa-resource-manifest",apply:"build",generateBundle(_options,bundle) {
      const files=Object.keys(bundle).filter(file=>/^assets\//.test(file)&&/\.(?:js|css|woff2?|png|webp|svg)$/.test(file));
      const optional=files.filter(file=>/ui-hand-xiaolai-extended-/.test(file));
      this.emitFile({type:"asset",fileName:"pwa-assets.json",source:JSON.stringify({assets:files.filter(file=>!optional.includes(file)),optional})});
    },writeBundle(options) {
      // Content-hashed resource names also change the worker bytes on each release.
      const output=resolve(options.dir ?? "dist");
      const workerPath=resolve(output,"sw.js");
      const template=readFileSync(workerPath,"utf8");
      const hash=createHash("sha256");
      for (const file of ["pwa-assets.json","manifest.webmanifest","index.html","icons/wizard-rounded.svg","icons/wizard-rounded-192.png","icons/wizard-rounded-512.png","icons/wizard-maskable-512.png"]) hash.update(readFileSync(resolve(output,file)));
      hash.update(template);
      writeFileSync(workerPath,template.replaceAll("__PWA_BUILD_ID__",hash.digest("hex").slice(0,16)));
    }},{name:"local-preview-request",apply:"serve",configureServer(server) {
      server.ws.on("wand-defense:targeted-result",result=>{
        if(["user-revive-20261104-01","user-chain-magic-20261104-01","user-large-wands-20261104-01","user-mythic-wands-20261104-01","user-area-arcana-20261104-01","user-fields-multicast-20261104-01","user-all-items-20261104-01","user-all-items-20261104-02","user-max-catalog-20261104-01"].includes(result?.requestId)) {
          console.info("TARGETED_PREVIEW_RESULT",JSON.stringify(result));
          const serialized=JSON.stringify(result);
          if(serialized.length<4096) {
            mkdirSync(resolve(".local"),{recursive:true});
            writeFileSync(resolve(".local/targeted-preview-result.json"),serialized);
          }
        }
      });
      if (!requestId && !inspectId) return;
      let recipient: object | undefined;
      let completed = false;
      const inspectedClients = new WeakSet<object>();
      let inspectedCount = 0;
      server.ws.on("wand-defense:preview-ready",(_data,client) => {
        if (inspectId) {
          if (inspectedCount < 8 && !inspectedClients.has(client)) client.send("wand-defense:inspect-preview",{requestId:inspectId});
          return;
        }
        if (completed || (recipient && recipient !== client)) return;
        recipient = client;
        client.send("wand-defense:grant-preview",{requestId,onlyMissing});
      });
      server.ws.on("wand-defense:preview-result",(result,client) => {
        if (completed || recipient !== client || result?.requestId !== requestId) return;
        completed = true;
        console.info("PREVIEW_GRANT_RESULT",JSON.stringify(result));
      });
      server.ws.on("wand-defense:inspect-result",(result,client) => {
        if (!inspectId || inspectedCount >= 8 || inspectedClients.has(client) || result?.requestId !== inspectId) return;
        inspectedClients.add(client);
        inspectedCount++;
        console.info("PREVIEW_INSPECT_RESULT",JSON.stringify(result));
        const serialized=JSON.stringify(result);
        if(serialized.length<12_000) {
          mkdirSync(resolve(".local"),{recursive:true});
          writeFileSync(resolve(`.local/preview-inspect-${inspectedCount}.json`),serialized);
        }
      });
    }}],
  };
});

