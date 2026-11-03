import { PencilIcon, type PencilIconPath } from "@inkra/react";
import { Progress } from "@inkra/react/display";
import type { GameState } from "../contracts";
import { getWaveProgress } from "../engine/waveProgress";
import { localProgress } from "./progressOptions";
import "./WaveProgress.css";

const minor: PencilIconPath[] = [{ d: "M4 9 6 5l3 3 3-4 3 4 3-3 2 4-2 8H6L4 9Zm3 11h10", mode: "stroke" }];
const major: PencilIconPath[] = [{ d: "M3 8 5 4l4 4 3-5 3 5 4-4 2 4-2 9H5L3 8Zm4 12h10", mode: "stroke" }, { d: "M10 13h4", mode: "stroke" }];

export function WaveProgress({ state }: { state: GameState }) {
  const { wave, preview, total, defeated, progress, markers } = getWaveProgress(state);
  if (wave <= 0) return null;
  return <aside className="wave-progress" aria-label={`${preview ? "即将开始的" : ""}第 ${wave} 波进度：${defeated} / ${total}`}>
    <div className="wave-progress__rail">
      <Progress className="wave-progress__bar" value={progress} max={1} aria-label="本波清理进度" seed={`wave-progress-${wave}`} size="sm" {...(localProgress ? { appearance: "stroke", showTrack: true, thickness: 4 } as const : {})} />
      {markers.map(marker => <span key={marker.id} className={`wave-progress__marker wave-progress__marker--${marker.tier}${marker.cleared ? " is-cleared" : ""}`} style={{ top: `${Math.max(0, Math.min(1, marker.position)) * 100}%` }} role="img" title={`${marker.tier === "minor" ? "小型首领" : marker.tier === "major" ? "大型首领" : "终极首领"}${marker.cleared ? "，已击败" : "，未击败"}`} aria-label={`${marker.tier === "minor" ? "小型首领" : marker.tier === "major" ? "大型首领" : "终极首领"}${marker.cleared ? "，已击败" : "，未击败"}`}>
        <PencilIcon paths={marker.tier === "minor" ? minor : major} sourceSize={24} size={marker.tier === "apex" ? 28 : 22} seed={`wave-marker-${marker.id}`} decorative />
      </span>)}
    </div>
  </aside>;
}
