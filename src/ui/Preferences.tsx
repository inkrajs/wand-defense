import { useEffect, useState } from "react";
import { PencilText, Slider, Switch } from "@inkra/react";
import "./Preferences.css";

type PreferencesValue = { reduceMotion: boolean; textEffects: boolean; musicEnabled: boolean; musicVolume: number };
const STORAGE_KEY = "wand-defense.preferences.v1";
const DEFAULTS: PreferencesValue = { reduceMotion: false, textEffects: true, musicEnabled: true, musicVolume: 0.55 };

function readPreferences(): PreferencesValue {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULTS;
    const value = JSON.parse(stored) as Partial<PreferencesValue>;
    return {
      reduceMotion: typeof value.reduceMotion === "boolean" ? value.reduceMotion : DEFAULTS.reduceMotion,
      textEffects: typeof value.textEffects === "boolean" ? value.textEffects : DEFAULTS.textEffects,
      musicEnabled: typeof value.musicEnabled === "boolean" ? value.musicEnabled : DEFAULTS.musicEnabled,
      musicVolume: typeof value.musicVolume === "number" && Number.isFinite(value.musicVolume) ? Math.min(1, Math.max(0, value.musicVolume)) : DEFAULTS.musicVolume,
    };
  } catch { return DEFAULTS; }
}

export function Preferences() {
  const [preferences, setPreferences] = useState<PreferencesValue>(readPreferences);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.gameReduceMotion = String(preferences.reduceMotion);
    root.dataset.gameTextEffects = String(preferences.textEffects);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      setStorageError(false);
    } catch { setStorageError(true); }
  }, [preferences]);

  return <div className="preferences" aria-label="游戏偏好设置">
    <PencilText as="h3" seed="preferences-heading">游戏设置</PencilText>
    <div className="preferences__controls">
      <Switch label="减少动态效果" description="减少界面动画与过渡。" checked={preferences.reduceMotion} onCheckedChange={(reduceMotion) => setPreferences((current) => ({ ...current, reduceMotion }))} seed="reduce-motion" />
      <Switch label="文字效果" description="显示 Inkra 手绘文字效果。" checked={preferences.textEffects} onCheckedChange={(textEffects) => setPreferences((current) => ({ ...current, textEffects }))} seed="text-effects" />
      <Switch label="音乐" description="音源尚未接入；此偏好会保存。" checked={preferences.musicEnabled} onCheckedChange={(musicEnabled) => setPreferences((current) => ({ ...current, musicEnabled }))} seed="music" />
      <div className="preferences__volume">
        <label htmlFor="preferences-volume">音乐音量 <span>{Math.round(preferences.musicVolume * 100)}%</span></label>
        <Slider id="preferences-volume" aria-label="音乐音量" min={0} max={1} step={0.01} value={[preferences.musicVolume]} onValueChange={([musicVolume]) => setPreferences((current) => ({ ...current, musicVolume }))} getValueLabel={(value) => `${Math.round(value * 100)}%`} />
      </div>
    </div>
    <PencilText as="p" className="preferences__music-note" seed="preferences-music-note">音乐音源尚未接入。</PencilText>
    {storageError && <p className="preferences__storage-error" role="status">无法保存到此设备；当前页面的设置仍会生效。</p>}
  </div>;
}
