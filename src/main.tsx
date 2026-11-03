import React from "react";
import { createRoot } from "react-dom/client";
import "@inkra/react/styles.css";
import "./ui/icon-buttons.css";
import { App } from "./ui/App";
import { createGameRuntime } from "./runtime";
import { demoContent } from "./content/demo";
import { AgentConnection } from "./AgentConnection";
import { loadRun, saveRun, type RunStorage } from "./runtime/session";

let storage: RunStorage | undefined;
try { storage = window.sessionStorage; } catch { /* Storage may be unavailable in a restricted browser. */ }
const runtime = createGameRuntime(demoContent, loadRun(storage));
let runtimeActive = true;
let detachPreview = () => {};
let lastSavedAt = 0;
const save = () => {
  saveRun(storage, runtime.checkpoint());
  lastSavedAt = Date.now();
};
const unsubscribeSave = runtime.subscribe((state, events) => {
  if (state.phase !== "battle" || events.length > 0 || Date.now() - lastSavedAt >= 500) save();
});
save();
// Save the exact foreground state before refresh/navigation without destroying a cached page.
window.addEventListener("pagehide", save);
const timer = window.setInterval(() => runtime.tick(50), 50);
const close = () => {
  runtimeActive = false;
  detachPreview();
  save();
  window.removeEventListener("pagehide", save);
  unsubscribeSave();
  window.clearInterval(timer);
  runtime.dispose();
};
if (import.meta.hot) import.meta.hot.dispose(close);
if (import.meta.env.DEV && import.meta.hot) {
  const hot = import.meta.hot;
  const grant = async ({requestId,onlyMissing = false}: {requestId:string;onlyMissing?:boolean}) => {
    const {grantPreviewMagic} = await import("./runtime/preview");
    if (runtimeActive) hot.send("wand-defense:preview-result",grantPreviewMagic(runtime,demoContent,requestId,onlyMissing));
  };
  hot.on("wand-defense:grant-preview",grant);
  detachPreview = () => hot.off("wand-defense:grant-preview",grant);
  hot.send("wand-defense:preview-ready",{});
}
createRoot(document.getElementById("root")!).render(<React.StrictMode>
  <App runtime={runtime} agentPanel={<AgentConnection runtime={runtime} content={demoContent} />} />
</React.StrictMode>);

