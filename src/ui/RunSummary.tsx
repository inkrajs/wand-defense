import { Button, PencilIcon, PencilSurface, PencilText, type PencilIconPath } from "@inkra/react";
import type { GameState, RunStatistics } from "../contracts";
import "./RunSummary.css";

const stats: { key: keyof Omit<RunStatistics, "version" | "complete">; label: string; icon: PencilIconPath[] }[] = [
  { key: "spellsAcquired", label: "法术", icon: [{ d: "M4 20 18 6M15 4l1-2 1 2 2 1-2 1-1 2-1-2-2-1 2-1ZM5 9l1-2 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z", mode: "stroke" }] },
  { key: "levelsGained", label: "升级", icon: [{ d: "M12 21V4M6 10l6-6 6 6M5 21h14", mode: "stroke" }] },
  { key: "charactersAcquired", label: "角色", icon: [{ d: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21c0-5 3-8 8-8s8 3 8 8", mode: "stroke" }] },
  { key: "arcanaAcquired", label: "奥术", icon: [{ d: "M12 3 15 9l6 .5-4.5 4 1.5 6.5-6-3.5L6 20l1.5-6.5L3 9.5 9 9l3-6Z", mode: "stroke" }] },
  { key: "enemiesDefeated", label: "击杀", icon: [{ d: "M5 4 19 20M19 4 5 20M3 8l5-5M16 3l5 5", mode: "stroke" }] },
  { key: "bossesDefeated", label: "首领", icon: [{ d: "M3 8 5 4l4 4 3-5 3 5 4-4 2 4-2 9H5L3 8ZM6 20h12", mode: "stroke" }] },
  { key: "coinsEarned", label: "金币", icon: [{ d: "M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM12 7v10M9 9c0-2 6-2 6 0s-6 2-6 4 6 2 6 0", mode: "stroke" }] },
  { key: "wavesCleared", label: "通关", icon: [{ d: "M5 21V4m0 1h13l-3 4 3 4H5", mode: "stroke" }] },
];

function duration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function RunSummary({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const totals = state.runStatistics;
  return <PencilSurface as="section" className="run-summary" variant="paper" seed="run-summary" radius={8} aria-labelledby="run-summary-title">
    <header className="run-summary__header">
      <PencilText as="h2" id="run-summary-title" seed="run-summary-title">领地失守</PencilText>
      <div className="run-summary__meta"><PencilText seed="run-summary-wave">{`第 ${state.wave} 波`}</PencilText><span aria-hidden="true">·</span><PencilText seed="run-summary-time">{duration(state.gameTimeMs)}</PencilText></div>
    </header>
    <div className="run-summary__stats">
      {stats.map(({ key, label, icon }) => <div className="run-summary__stat" key={key}>
        <PencilIcon paths={icon} sourceSize={24} size={28} seed={`summary-${key}`} decorative />
        <div><PencilText as="span" className="run-summary__label" seed={`summary-label-${key}`}>{label}</PencilText><PencilText as="strong" className="run-summary__value" seed={`summary-value-${key}`}>{totals ? `${totals.complete ? "" : "≥"}${totals[key]}` : "—"}</PencilText></div>
      </div>)}
    </div>
    <Button className="run-summary__restart" onClick={onRestart}>重来</Button>
  </PencilSurface>;
}
