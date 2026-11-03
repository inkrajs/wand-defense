import type { ComponentProps } from "react";
import { PencilLine, Tabs } from "@inkra/react";
import "./GameTabsList.css";

type Orientation = "horizontal" | "vertical";
type Props = Omit<ComponentProps<typeof Tabs.List>, "orientation"> & { orientation?: Orientation };
/** Shared tab list with the library's dividers and matching end strokes. */
export function GameTabsList({ className, children, orientation = "horizontal", ...props }: Props) {
  const edgeOrientation = orientation === "vertical" ? "horizontal" : "vertical";
  return <div className={`game-tabs-list game-tabs-list--${orientation}${className ? ` ${className}` : ""}`}>
    <PencilLine className="game-tabs-list__edge" orientation={edgeOrientation} seed="tabs-start" />
    <Tabs.List {...props} divided>{children}</Tabs.List>
    <PencilLine className="game-tabs-list__edge" orientation={edgeOrientation} seed="tabs-end" />
  </div>;
}
