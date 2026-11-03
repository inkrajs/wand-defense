import React from "react";
import { createRoot } from "react-dom/client";
import "@inkra/react/styles.css";
import "./ui/fonts.css";
import "./ui/icon-buttons.css";
import { App } from "./ui/App";
import { createGameRuntime } from "./runtime";
import { demoContent } from "./content/demo";
import { AgentConnection } from "./AgentConnection";
import { readPersistentRun, saveRun, shouldPersistRunChange, type RunStorage } from "./runtime/session";
import { registerPwa } from "./pwa";

let storage: RunStorage | undefined;
let legacyTabStorage: RunStorage | undefined;
try { storage = window.localStorage; } catch { /* Storage may be unavailable in a restricted browser. */ }
try { legacyTabStorage = window.sessionStorage; } catch { /* Legacy migration is optional. */ }
const storedRun = readPersistentRun(storage, legacyTabStorage);
const runtime = createGameRuntime(demoContent, storedRun.status === "loaded" ? storedRun.checkpoint : undefined, {
  seedSource: () => globalThis.crypto.getRandomValues(new Uint32Array(1))[0],
});
let runtimeActive = true;
let detachPreview = () => {};
// A transient read failure must not let an automatically created fresh run
// overwrite a valid checkpoint when storage becomes readable again.
let persistenceEnabled = storedRun.status !== "unavailable";
let onDurablePhase = () => {};
const save = () => {
  if (persistenceEnabled) saveRun(storage, runtime.checkpoint());
};
const saveOutsideBattle = () => {
  if (shouldPersistRunChange(runtime.getState(), [])) save();
};
const unsubscribeSave = runtime.subscribeEvents((state, events) => {
  if (events.some(event=>event.type === "game.restarted")) persistenceEnabled = true;
  if (shouldPersistRunChange(state, events)) save();
  if (state.phase !== "battle") onDurablePhase();
});
saveOutsideBattle();
// Keep the saved wave entry during combat, including refresh/navigation and HMR.
window.addEventListener("pagehide", saveOutsideBattle);
const timer = window.setInterval(() => runtime.tick(50), 50);
const close = () => {
  runtimeActive = false;
  onDurablePhase = () => {};
  detachPreview();
  saveOutsideBattle();
  window.removeEventListener("pagehide", saveOutsideBattle);
  unsubscribeSave();
  window.clearInterval(timer);
  runtime.dispose();
};
if (import.meta.hot) import.meta.hot.dispose(close);
if (import.meta.env.DEV && import.meta.hot) {
  const hot = import.meta.hot;
  const maxCatalogRequest = import.meta.env.VITE_WAND_DEFENSE_MAX_CATALOG_REQUEST === "user-max-catalog-20261104-01"
    ? "user-max-catalog-20261104-01" : undefined;
  void import("./runtime/preview").then(({updateAuthorizedPreview,reviveAuthorizedPreview,fillAuthorizedInventory,applyAuthorizedPreviewGrants})=>{
    if (!runtimeActive) return;
    const revival=reviveAuthorizedPreview(runtime);
    if(revival)hot.send("wand-defense:targeted-result",revival);
    const report=updateAuthorizedPreview(runtime,demoContent);
    if (report)hot.send("wand-defense:targeted-result",report);
    const inventory=fillAuthorizedInventory(runtime,demoContent);
    if(inventory)hot.send("wand-defense:targeted-result",inventory);
    let grantingWands=false;
    const grantWands=()=>{
      if(grantingWands)return;
      grantingWands=true;
      try {
        if(maxCatalogRequest) {
          const current=runtime.getState();
          if(current.id === "demo" && (current.phase === "ready" || current.phase === "reward"))
            runtime.dispatch({id:`preview:${maxCatalogRequest}:unlock`,type:"unlockCheats"});
        }
        const {reports,pending}=applyAuthorizedPreviewGrants(runtime,demoContent,maxCatalogRequest);
        for(const report of reports)hot.send("wand-defense:targeted-result",report);
        if(!pending)onDurablePhase=()=>{};
      } finally {grantingWands=false;}
    };
    onDurablePhase=grantWands;
    grantWands();
  });
  const grant = async ({requestId,onlyMissing = false}: {requestId:string;onlyMissing?:boolean}) => {
    const {grantPreviewMagic} = await import("./runtime/preview");
    if (runtimeActive) hot.send("wand-defense:preview-result",grantPreviewMagic(runtime,demoContent,requestId,onlyMissing));
  };
  hot.on("wand-defense:grant-preview",grant);
  const inspect = async ({requestId}: {requestId:string}) => {
    const {inspectPreviewInventory} = await import("./runtime/preview");
    if (runtimeActive) hot.send("wand-defense:inspect-result",{
      ...inspectPreviewInventory(runtime,requestId),
      storageStatus:storedRun.status,
      viewport:{width:innerWidth,height:innerHeight,visible:document.visibilityState},
    });
  };
  hot.on("wand-defense:inspect-preview",inspect);
  const detachPrevious = detachPreview;
  detachPreview = () => {
    detachPrevious();
    hot.off("wand-defense:grant-preview",grant);
    hot.off("wand-defense:inspect-preview",inspect);
  };
  hot.send("wand-defense:preview-ready",{});
}
createRoot(document.getElementById("root")!).render(<React.StrictMode>
  <App runtime={runtime} agentPanel={<AgentConnection runtime={runtime} content={demoContent} />} />
</React.StrictMode>);
registerPwa();

