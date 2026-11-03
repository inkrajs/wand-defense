import { Button, PencilIcon } from "@inkra/react";
import type { Command, CommandResult, GameState, WandInstance } from "../contracts";

const clearWandPaths = [{ d: "M6 6 18 18M18 6 6 18", mode: "stroke" as const }];

export type WandClearButtonProps = {
  wand?: Pick<WandInstance, "id" | "placements">;
  state: Pick<GameState, "phase" | "paused">;
  dispatch: (command: Command) => CommandResult;
  commandId?: () => string;
  className?: string;
};

export function WandClearButton({ wand, state, dispatch, commandId, className }: WandClearButtonProps) {
  const disabled = !wand || wand.placements.length === 0 || (state.phase === "battle" && !state.paused);
  return <Button
    type="button"
    size="icon"
    variant="ghost"
    className={className ? `wand-clear-button ${className}` : "wand-clear-button"}
    data-wand-id={wand?.id}
    style={{ width: 44, minWidth: 44, height: 44, minHeight: 44, padding: 0 }}
    aria-label="清空法杖"
    title="清空法杖"
    disabled={disabled}
    onClick={() => {
      if (!wand || disabled) return;
      dispatch({ id: commandId?.() ?? `clear-wand-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: "clearWand", wandId: wand.id });
    }}
  ><PencilIcon paths={clearWandPaths} size={32} sourceSize={24} seed={`clear-wand-${wand?.id ?? "empty"}`} decorative /></Button>;
}
