import { defineConfig, loadEnv } from "vite";
import { lstatSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
export default defineConfig(({mode}) => {
  const previewEnv = loadEnv(mode,process.cwd(),"");
  const requestId = previewEnv.WAND_DEFENSE_PREVIEW_GRANT;
  const onlyMissing = previewEnv.WAND_DEFENSE_PREVIEW_MISSING_ONLY === "1";
  const installed = resolve("node_modules/@inkra/react");
  const localPackage = lstatSync(installed).isSymbolicLink() ? realpathSync(installed) : undefined;
  return {
    define: {"import.meta.env.INKRA_LOCAL":JSON.stringify(Boolean(localPackage))},
    resolve: { dedupe: ["react","react-dom"] },
    optimizeDeps: localPackage ? {exclude:["@inkra/react"]} : undefined,
    server: { port: 5173, strictPort: true,
      ...(localPackage ? {fs:{allow:[process.cwd(),dirname(dirname(localPackage))]}} : {}) },
    build: { target: "es2022" },
    plugins: [{name:"local-preview-request",apply:"serve",configureServer(server) {
      if (!requestId) return;
      let recipient: object | undefined;
      let completed = false;
      server.ws.on("wand-defense:preview-ready",(_data,client) => {
        if (completed || (recipient && recipient !== client)) return;
        recipient = client;
        client.send("wand-defense:grant-preview",{requestId,onlyMissing});
      });
      server.ws.on("wand-defense:preview-result",(result,client) => {
        if (completed || recipient !== client || result?.requestId !== requestId) return;
        completed = true;
        console.info("PREVIEW_GRANT_RESULT",JSON.stringify(result));
      });
    }}],
  };
});

