import type { ReactNode } from "react";
import { GamePencilShape } from "./GamePencilShape";

export function PanelBackdrop({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <div className={`panel-backdrop${wide ? " panel-backdrop--wide" : ""}`}>
    <div className="panel-backdrop__wash"><GamePencilShape geometry={{ type: "rect", width: 1, height: 1 }} width="100%" height="100%" fit="stretch" color="var(--inkra-paper)" inkDensity={1.6} outlineWidth={0} seed="panel-paper" decorative /></div>
    <div className="panel-backdrop__content">{children}</div>
  </div>;
}
