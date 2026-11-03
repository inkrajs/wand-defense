import React from "react";
import { createRoot } from "react-dom/client";
import "@inkra/react/styles.css";
import { App } from "./ui/App";
import { createMockRuntime } from "./runtime/mock";
createRoot(document.getElementById("root")!).render(<React.StrictMode><App runtime={createMockRuntime()} /></React.StrictMode>);

