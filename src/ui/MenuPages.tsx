import { Fragment, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, PencilIcon, PencilLine, PencilText, Select, Slider, Switch, type PencilIconPath } from "@inkra/react";
import { CheatActions } from "./CheatActions";
import { PwaActions } from "./PwaActions";
import { useGraphicsSettings } from "./graphicsSettings";
import type { Command, CommandResult, GameState } from "../contracts";
import "./MenuPages.css";
import "./Preferences.css";
import "./MenuSettings.css";

const HelpManual = lazy(() => import("./HelpManual").then(module => ({ default: module.HelpManual })));

export type MenuPage = "menu" | "settings" | "agent" | "accessibility" | "character" | "help" | "graphics" | "music" | "controls" | "debug" | "pwa";
type Props = {
  dispatch: (command: Command) => CommandResult;
  page: MenuPage | null;
  navigate: (page: MenuPage) => void;
  close: () => void;
  restart: () => void;
  agentPanel?: ReactNode;
  state: GameState;
  unlock: () => void;
  toggleCheats: () => void;
  heal: () => void;
};

const bookPaths: PencilIconPath[] = [{ d: "M3 5c4-1 7 0 9 2 2-2 5-3 9-2v14c-4-1-7 0-9 2-2-2-5-3-9-2V5Zm9 2v14", mode: "stroke" }];
const agentPaths: PencilIconPath[] = [{ d: "M12 3v4m0 10v4M3 12h4m10 0h4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8m0-12.8-2.8 2.8m-7.2 7.2-2.8 2.8", mode: "stroke" }, { d: "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z", mode: "stroke" }];
const settingsPaths: PencilIconPath[] = [{ d: "M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4", mode: "stroke" }, { d: "M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z", mode: "stroke" }];
const restartPaths: PencilIconPath[] = [{ d: "M20 7v5h-5M19 12a7 7 0 1 1-2-5", mode: "stroke" }];
const backPaths: PencilIconPath[] = [{ d: "M19 12H5m7 7-7-7 7-7", mode: "stroke" }];
const healPaths: PencilIconPath[] = [{ d: "M12 4v16M4 12h16", mode: "stroke" }];

function MenuItem({ icon, children, onClick, className = "" }: { icon: readonly PencilIconPath[]; children: string; onClick: () => void; className?: string }) {
  return <Button variant="ghost" fullWidth align="start" className={`menu-page__item ${className}`} onClick={onClick}>
    <span className="menu-page__row"><PencilIcon paths={icon} sourceSize={24} size={32} decorative /><PencilText as="span">{children}</PencilText></span>
  </Button>;
}

function MenuLinks({ label, items }: { label: string; items: readonly { label: string; icon: readonly PencilIconPath[]; onClick: () => void }[] }) {
  return <nav className="menu-page__items" aria-label={label}>
    {items.map((item, index) => <Fragment key={item.label}>
      {index > 0 && <PencilLine className="menu-page__separator" seed={`menu-divider-${label}-${index}`} aria-hidden="true" />}
      <MenuItem icon={item.icon} onClick={item.onClick}>{item.label}</MenuItem>
    </Fragment>)}
  </nav>;
}

type SettingsPage = "graphics" | "music" | "controls" | "debug" | "pwa";
const graphicsPaths: readonly PencilIconPath[] = [{ d: "M3 4h18v13H3zM8 21h8m-4-4v4M6 13l4-4 3 3 3-5 3 6", mode: "stroke" }];
const musicPaths: readonly PencilIconPath[] = [{ d: "M9 17V5l11-2v12M9 8l11-2M9 17c0 2-2 4-4 4s-3-2-2-3c1-2 4-2 6-1Zm11-2c0 2-2 4-4 4s-3-2-2-3c1-2 4-2 6-1Z", mode: "stroke" }];
const controlsPaths: readonly PencilIconPath[] = [{ d: "M3 6h18v13H3zM6 10h1m3 0h1m3 0h1m3 0h1M6 14h1m3 0h1m3 0h4M7 17h10", mode: "stroke" }];
const debugPaths: readonly PencilIconPath[] = [{ d: "M8 8h8v10H8zM10 8V5h4v3M4 9h4m8 0h4M4 14h4m8 0h4M6 21l3-3m6 0 3 3M9 3l2 2m4-2-2 2", mode: "stroke" }];
const pwaPaths: readonly PencilIconPath[] = [{ d: "M4 3h16v13H4zM8 21h8m-4-5v5M9 8l3 3 3-3m-3-3v6", mode: "stroke" }];
const settingsEntries: readonly { page: SettingsPage; label: string; icon: readonly PencilIconPath[] }[] = [
  { page: "graphics", label: "画面", icon: graphicsPaths },
  { page: "music", label: "音乐", icon: musicPaths },
  { page: "controls", label: "控制", icon: controlsPaths },
  { page: "debug", label: "调试", icon: debugPaths },
  { page: "pwa", label: "安装与更新", icon: pwaPaths },
];
const titles: Record<MenuPage, string> = { menu: "菜单", settings: "设置", agent: "Agent", accessibility: "控制", character: "角色", help: "帮助手册", graphics: "画面", music: "音乐", controls: "控制", debug: "调试", pwa: "安装与更新" };
const isSettingsPage = (page: MenuPage | null): page is SettingsPage => settingsEntries.some(entry => entry.page === page);

type PreferencesValue = { reduceMotion: boolean; textEffects: boolean; musicEnabled: boolean; musicVolume: number };
const PREFERENCES_KEY = "wand-defense.preferences.v1";
const DEFAULT_PREFERENCES: PreferencesValue = { reduceMotion: false, textEffects: true, musicEnabled: true, musicVolume: 0.55 };
function readPreferences(): PreferencesValue {
  try {
    const value = JSON.parse(window.localStorage.getItem(PREFERENCES_KEY) ?? "null") as Partial<PreferencesValue> | null;
    return {
      reduceMotion: typeof value?.reduceMotion === "boolean" ? value.reduceMotion : false,
      textEffects: typeof value?.textEffects === "boolean" ? value.textEffects : true,
      musicEnabled: typeof value?.musicEnabled === "boolean" ? value.musicEnabled : true,
      musicVolume: typeof value?.musicVolume === "number" && Number.isFinite(value.musicVolume) ? Math.min(1, Math.max(0, value.musicVolume)) : 0.55,
    };
  } catch { return DEFAULT_PREFERENCES; }
}

type PreferenceProps = { preferences: PreferencesValue; updatePreference: (patch: Partial<PreferencesValue>) => void };
function GraphicsSettings({ preferences, updatePreference }: PreferenceProps) {
  const { settings, setPreset, update } = useGraphicsSettings();
  return <div className="menu-settings__fields">
    <div className="menu-settings__select-row">
      <PencilText as="label" htmlFor="graphics-preset">画面预设</PencilText>
      <Select.Root value={settings.preset} onValueChange={value => { if (value === "custom") update({}); else if (value === "low" || value === "medium" || value === "high") setPreset(value); }}>
        <Select.Trigger id="graphics-preset" aria-label="画面预设"><Select.Value /></Select.Trigger>
        <Select.Portal><Select.Content className="menu-settings__select-options"><Select.Viewport>
          <Select.Item value="low"><Select.ItemText>低</Select.ItemText><Select.ItemIndicator /></Select.Item>
          <Select.Item value="medium"><Select.ItemText>中</Select.ItemText><Select.ItemIndicator /></Select.Item>
          <Select.Item value="high"><Select.ItemText>高</Select.ItemText><Select.ItemIndicator /></Select.Item>
          <Select.Item value="custom"><Select.ItemText>自定义</Select.ItemText><Select.ItemIndicator /></Select.Item>
        </Select.Viewport></Select.Content></Select.Portal>
      </Select.Root>
    </div>
    {([
      ["blood", "地面血迹"], ["deathEffects", "死亡残影"], ["projectileTrails", "弹体尾迹"], ["impactSparks", "命中效果"], ["areaDetails", "区域细节"],
    ] as const).map(([key, label]) => <Switch key={key} label={label} checked={settings[key]} onCheckedChange={checked => update({ [key]: checked })} seed={`graphics-${key}`} />)}
    <div className="menu-settings__slider-row">
      <label htmlFor="graphics-blood-budget"><PencilText as="span">血迹数量上限</PencilText><span>{settings.bloodBudget}</span></label>
      <Slider id="graphics-blood-budget" aria-label="血迹数量上限" min={0} max={96} step={1} value={[settings.bloodBudget]} onValueChange={([bloodBudget]) => { if (bloodBudget !== undefined) update({ bloodBudget }); }} disabled={!settings.blood} getValueLabel={value => `${value} 处`} />
    </div>
    <div className="menu-settings__select-row">
      <PencilText as="label" htmlFor="graphics-resolution">特效分辨率</PencilText>
      <Select.Root value={String(settings.effectResolution)} onValueChange={value => { if (value === "0.5" || value === "0.75" || value === "1") update({ effectResolution: value === "0.5" ? 0.5 : value === "0.75" ? 0.75 : 1 }); }}>
        <Select.Trigger id="graphics-resolution" aria-label="特效分辨率"><Select.Value /></Select.Trigger>
        <Select.Portal><Select.Content className="menu-settings__select-options"><Select.Viewport>
          <Select.Item value="0.5"><Select.ItemText>50%</Select.ItemText><Select.ItemIndicator /></Select.Item>
          <Select.Item value="0.75"><Select.ItemText>75%</Select.ItemText><Select.ItemIndicator /></Select.Item>
          <Select.Item value="1"><Select.ItemText>100%</Select.ItemText><Select.ItemIndicator /></Select.Item>
        </Select.Viewport></Select.Content></Select.Portal>
      </Select.Root>
    </div>
    <Switch label="手绘文字效果" checked={preferences.textEffects} onCheckedChange={textEffects => updatePreference({ textEffects })} seed="text-effects" />
  </div>;
}
function MusicSettings({ preferences, updatePreference }: PreferenceProps) {
  return <div className="menu-settings__fields">
    <PencilText as="p" className="menu-settings__note">音乐音源尚未接入，以下偏好会保存。</PencilText>
    <Switch label="静音" checked={!preferences.musicEnabled} onCheckedChange={muted => updatePreference({ musicEnabled: !muted })} seed="music-muted" />
    <div className="menu-settings__slider-row">
      <label htmlFor="menu-music-volume"><PencilText as="span">音乐音量</PencilText><span>{Math.round(preferences.musicVolume * 100)}%</span></label>
      <Slider id="menu-music-volume" aria-label="音乐音量" min={0} max={1} step={0.01} value={[preferences.musicVolume]} onValueChange={([musicVolume]) => { if (musicVolume !== undefined) updatePreference({ musicVolume }); }} disabled={!preferences.musicEnabled} getValueLabel={value => `${Math.round(value * 100)}%`} />
    </div>
  </div>;
}
function ControlSettings({ preferences, updatePreference }: PreferenceProps) {
  return <div className="menu-settings__fields">
    <Switch label="减少动态效果" description="减少动画、过渡和额外尾迹。" checked={preferences.reduceMotion} onCheckedChange={reduceMotion => updatePreference({ reduceMotion })} seed="reduce-motion" />
    <dl className="menu-settings__shortcuts" aria-label="键盘操作">
      <div><dt><kbd>Tab</kbd> / <kbd>Shift + Tab</kbd></dt><dd>切换焦点</dd></div>
      <div><dt><kbd>Enter</kbd> / <kbd>空格</kbd></dt><dd>操作当前按钮</dd></div>
      <div><dt><kbd>Esc</kbd></dt><dd>返回上一级菜单</dd></div>
      <div><dt><kbd>空格</kbd> / <kbd>Enter</kbd>，方向键</dt><dd>拿起背包物品并移动，再次按键放下</dd></div>
      <div><dt><kbd>Esc</kbd>（拖放中）</dt><dd>取消拖放</dd></div>
    </dl>
  </div>;
}

export function MenuPages({ page, navigate, close, restart, agentPanel, state, dispatch, toggleCheats, heal }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const [displayPage, setDisplayPage] = useState<MenuPage | null>(page);
  const [closing, setClosing] = useState(false);
  const [preferences, setPreferences] = useState<PreferencesValue>(readPreferences);
  const [storageError, setStorageError] = useState(false);
  function updatePreference(patch: Partial<PreferencesValue>) { setPreferences(current => ({ ...current, ...patch })); }
  useEffect(() => {
    document.documentElement.dataset.gameReduceMotion = String(preferences.reduceMotion);
    document.documentElement.dataset.gameTextEffects = String(preferences.textEffects);
    try { window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); setStorageError(false); }
    catch { setStorageError(true); }
  }, [preferences]);
  useEffect(() => {
    if (closeTimer.current !== undefined) { window.clearTimeout(closeTimer.current); closeTimer.current = undefined; }
    if (page !== null) { setDisplayPage(page); setClosing(false); }
    else if (displayPage !== null) {
      setClosing(true);
      const reduced = document.documentElement.dataset.gameReduceMotion === "true" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      closeTimer.current = window.setTimeout(() => { setClosing(false); closeTimer.current = undefined; }, reduced ? 0 : 280);
    }
    return () => { if (closeTimer.current !== undefined) { window.clearTimeout(closeTimer.current); closeTimer.current = undefined; } };
  }, [page]);
  useEffect(() => {
    if (page) heading.current?.focus();
  }, [displayPage, page]);
  function goBack() {
    if (page === "menu" || page === "character" || page === null) close();
    else navigate(isSettingsPage(page) || page === "accessibility" ? "settings" : "menu");
  }
  useEffect(() => {
    if (page === "debug" && !state.cheats.unlocked) navigate("settings");
  }, [page, state.cheats.unlocked, navigate]);
  const visiblePage = displayPage === "debug" && !state.cheats.unlocked ? "settings" : displayPage;
  const preferenceProps = { preferences, updatePreference };
  const backLabel = visiblePage === "menu" || visiblePage === "character" || visiblePage === null ? "返回游戏" : isSettingsPage(visiblePage) || visiblePage === "accessibility" ? "返回设置" : "返回菜单";

  return <section className="menu-page" data-open={page !== null} data-closing={closing} aria-hidden={page === null} inert={page === null} aria-label="游戏菜单" onKeyDown={event => { if (event.key === "Escape" && page && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); goBack(); } }}>
    <header className="menu-page__header">
      <Button size="icon" variant="ghost" className="menu-page__back" aria-label={backLabel} onClick={goBack}><PencilIcon paths={backPaths} sourceSize={24} size={32} decorative /></Button>
      <PencilText as="h2" ref={heading} tabIndex={-1} seed="menu-heading">{titles[visiblePage ?? "menu"]}</PencilText>
      <span className="menu-page__header-slot" aria-hidden="true" />
    </header>
    <div className={`menu-page__content${visiblePage === "help" ? " menu-page__content--wide" : ""}`}>
      <div className="menu-page__view" data-page={visiblePage} hidden={visiblePage === "agent"} key={isSettingsPage(visiblePage) || visiblePage === "accessibility" ? "settings-detail" : visiblePage ?? "closed"}>
        {visiblePage === "menu" && <MenuLinks label="菜单选项" items={[
          { label: "重新开始", icon: restartPaths, onClick: restart },
          { label: "设置", icon: settingsPaths, onClick: () => navigate("settings") },
          { label: "帮助手册", icon: bookPaths, onClick: () => navigate("help") },
          { label: "Agent", icon: agentPaths, onClick: () => navigate("agent") },
        ]} />}
        {visiblePage === "settings" && <MenuLinks label="设置分类" items={settingsEntries.filter(entry => entry.page !== "debug" || state.cheats.unlocked).map(entry => ({ ...entry, onClick: () => navigate(entry.page) }))} />}
        {(isSettingsPage(visiblePage) || visiblePage === "accessibility") && <div className="menu-settings">
          {visiblePage === "graphics" && <GraphicsSettings {...preferenceProps} />}
          {visiblePage === "music" && <MusicSettings {...preferenceProps} />}
          {(visiblePage === "controls" || visiblePage === "accessibility") && <ControlSettings {...preferenceProps} />}
          {visiblePage === "pwa" && <PwaActions />}
          {visiblePage === "debug" && <div className="menu-settings__fields">
            <Switch label="启用作弊" checked={state.cheats.enabled} onCheckedChange={enabled => { if (enabled !== state.cheats.enabled) toggleCheats(); }} seed="debug-cheats" />
            {state.cheats.enabled && <><MenuItem icon={healPaths} onClick={heal}>恢复领地</MenuItem><CheatActions state={state} dispatch={dispatch} /></>}
          </div>}
        </div>}
        {visiblePage === "help" && page !== null && <div className="menu-page__detail menu-page__help"><Suspense fallback={<span role="status">正在加载手册…</span>}><HelpManual state={state} /></Suspense></div>}
      </div>
      <div className="menu-page__detail menu-page__agent" data-active={visiblePage === "agent"} aria-hidden={visiblePage !== "agent"} inert={visiblePage !== "agent"}>
        {agentPanel ?? <PencilText as="p" seed="agent-unavailable">Agent 连接不可用。</PencilText>}
      </div>
      {storageError && <span className="menu-settings__announcement" role="status">无法保存到此设备；当前页面的偏好仍会生效。</span>}
    </div>
  </section>;
}
