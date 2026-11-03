import React from "react";
import { createRoot } from "react-dom/client";
import "@inkra/react/styles.css";
import { App } from "./ui/App";
import { createGameRuntime } from "./runtime";
import { demoContent } from "./content/demo";
import { AgentConnection } from "./AgentConnection";

const runtime = createGameRuntime(demoContent);
const timer = window.setInterval(() => runtime.tick(50), 50);
const close = () => { window.clearInterval(timer); runtime.dispose(); };
if (import.meta.hot) import.meta.hot.dispose(close);
createRoot(document.getElementById("root")!).render(<React.StrictMode>
  <App runtime={runtime} agentPanel={<AgentConnection runtime={runtime} content={demoContent} />} />
</React.StrictMode>);

