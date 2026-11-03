import { PanelBackdrop } from "./PanelBackdrop";
import { getCharacterPresentationIcon } from "./characterPresentationIcons";
import { RunSummary } from "./RunSummary";
import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { Button, PencilIcon, PencilLine, PencilSurface, PencilText, type PencilIconPath } from "@inkra/react";
import { GAME_SPEEDS, type Command, type CommandResult, type GameState, type RuntimePort } from "../contracts";
import { Battlefield } from "./Battlefield";
import { CharacterPage } from "./CharacterPage";
import { readUiSession, writeUiSession, type CharacterTab, type InventoryCategory } from "./uiSession";
import { InventoryDock } from "./InventoryDock";
import { WandBoard } from "./WandBoard";
import { MotionPresence } from "./MotionPresence";
import { useBattleSettlement } from "./useBattleSettlement";
import { WaveProgress } from "./WaveProgress";
import { useCastFlashes } from "./wandMiniatureEvents";
import { localProgress } from "./progressOptions";
import { RewardChoices } from "./RewardChoices";
import { getRewardRefreshQuote } from "../runtime/rewardRefresh";
import { MenuPages, type MenuPage } from "./MenuPages";
import { TerritoryPanel } from "./TerritoryPanel";
import { TalentPanel } from "./TalentPanel";
import type { TerritoryUpgradeTrack } from "../content/territory";
import "./App.css";

function HudToggle({ className, open, children }: { className: string; open: boolean; children: ReactNode }) {
  return <span className={`game-hud-toggle ${className}`} data-open={open}><PencilSurface as="span" className="game-hud-toggle__wash" variant="selection" seed={`${className}-selection`} aria-hidden="true" />{children}</span>;
}

const characterPaths = getCharacterPresentationIcon().paths;
const coinPaths: PencilIconPath[] = [{ d: "M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z", mode: "stroke" }, { d: "M12 7v10M9 9c0-2 6-2 6 0s-6 2-6 4 6 2 6 0", mode: "stroke" }];
const backpackPaths: PencilIconPath[] = [{ d: "M8 7V5a4 4 0 0 1 8 0v2", mode: "stroke" }, { d: "M6 8h12a2 2 0 0 1 2 2v10H4V10a2 2 0 0 1 2-2Z", mode: "stroke" }, { d: "M8 15h8v5H8Z", mode: "stroke" }];
const minusPaths: PencilIconPath[] = [{ d: "M5 12h14", mode: "stroke" }];
const plusPaths: PencilIconPath[] = [{ d: "M5 12h14M12 5v14", mode: "stroke" }];
const pausePaths: PencilIconPath[] = [{ d: "M8 5v14M16 5v14", mode: "stroke" }];
const playPaths: PencilIconPath[] = [{ d: "M8 5l11 7-11 7V5Z", mode: "stroke" }];
const settingsPaths: PencilIconPath[] = [{ d: "M4 6h16M4 12h16M4 18h16", mode: "stroke" }];
const talentPaths: PencilIconPath[] = [{ d: "M12 3 14.5 9l6.5.5-5 4.2L17.5 20 12 16.7 6.5 20 8 13.7 3 9.5 9.5 9 12 3Z", mode: "stroke" }];
const territoryPaths: PencilIconPath[] = [
  { d: "M3 21V9l4-3 5 3 5-3 4 3v12M3 13h18", mode: "stroke" },
  { d: "M7 13v4m5-4v4m5-4v4M12 21v-4", mode: "stroke" },
];

function commandId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `ui-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function App({ runtime, agentPanel }: { runtime: RuntimePort; agentPanel?: ReactNode }) {
  const [state, setState] = useState<GameState>(() => runtime.getState());
  const [initialUi] = useState(() => readUiSession(state.id, state.characters));
  const [uiRunId, setUiRunId] = useState(state.id);
  const rewardReady = useBattleSettlement(state);
  const castFlashes = useCastFlashes(state);
  const [wandBoardHeight, setWandBoardHeight] = useState(0);
  const [inventoryWandAreaHeight, setInventoryWandAreaHeight] = useState(0);
  const [inventoryCategory, setInventoryCategory] = useState<InventoryCategory>(initialUi?.inventoryCategory ?? "spells");
  const [message, setMessage] = useState("");
  const [characterOpen, setCharacterOpen] = useState(initialUi?.characterOpen ?? false);
  const [territoryOpen, setTerritoryOpen] = useState(initialUi?.territoryOpen ?? false);
  const [talentOpen, setTalentOpen] = useState(initialUi?.talentOpen ?? false);
  const [activeCharacterId, setActiveCharacterId] = useState(() => initialUi?.activeCharacterId ?? state.characters[0]?.id ?? "");
  const [characterTab, setCharacterTab] = useState<CharacterTab>(initialUi?.characterTab ?? "overview");
  const [menuPage, setMenuPage] = useState<MenuPage | null>(null);
  const pausedBeforeMenu = useRef(false);
  const pendingPauseRestore = useRef<boolean | null>(null);
  const runId = useRef(state.id);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const characterButtonRef = useRef<HTMLButtonElement>(null);
  const menuEntry = useRef<"menu" | "character">("menu");
  const loadoutRef = useRef<HTMLDivElement>(null);
  const backpackButtonRef = useRef<HTMLButtonElement>(null);

  const wasOpen = useRef(false);
  useEffect(() => {
    if (state.backpackOpen) loadoutRef.current?.focus();
    else if (wasOpen.current) { backpackButtonRef.current?.focus(); }
    wasOpen.current = state.backpackOpen;
  }, [state.backpackOpen]);
  useEffect(() => {
    if (runId.current === state.id && menuPage === null && !state.backpackOpen && pendingPauseRestore.current !== null) {
      const paused = pendingPauseRestore.current;
      pendingPauseRestore.current = null;
      const current = runtime.getState();
      if (current.paused !== paused) {
        const result = runtime.dispatch({ id: commandId(), type: "setPaused", paused });
        if (result.status === "rejected") setMessage(result.message || result.code || "无法恢复暂停状态");
      }
    }
  }, [menuPage, state.backpackOpen, runtime]);
  useEffect(() => {
    setState(runtime.getState());
    return runtime.subscribe((next) => setState(next));
  }, [runtime]);
  useEffect(() => {
    if (runId.current !== state.id) {
      runId.current = state.id;
      pendingPauseRestore.current = null;
      pausedBeforeMenu.current = false;
      wasOpen.current = false;
      setMenuPage(null);
      setCharacterOpen(false);
      setTerritoryOpen(false);
      setTalentOpen(false);
      setInventoryCategory("spells");
      setCharacterTab("overview");
      setActiveCharacterId(state.characters[0]?.id ?? "");
      setUiRunId(state.id);
      setMessage("");
    }
  }, [state.id]);
  const characterIds = state.characters.map(character => character.id).join("\0");
  useEffect(() => {
    if (uiRunId !== state.id) return;
    if (!state.characters.some(character => character.id === activeCharacterId)) {
      setActiveCharacterId(state.characters[0]?.id ?? "");
      return;
    }
    writeUiSession(state.id, { activeCharacterId, characterOpen, territoryOpen, talentOpen, inventoryCategory, characterTab }, state.characters);
  }, [uiRunId, state.id, characterIds, activeCharacterId, characterOpen, territoryOpen, talentOpen, inventoryCategory, characterTab]);
  function dispatch(command: Command): CommandResult {
    const result = runtime.dispatch(command);
    setMessage(result.status === "rejected" ? (result.message || result.code || "操作未能执行") : "");
    return result;
  }
  const send = (command: Omit<Extract<Command, { type: "startWave" }>, "id"> | Omit<Extract<Command, { type: "setPaused" }>, "id"> | Omit<Extract<Command, { type: "setBackpack" }>, "id"> | Omit<Extract<Command, { type: "claimReward" }>, "id"> | Omit<Extract<Command, { type: "refreshRewards" }>, "id"> | Omit<Extract<Command, { type: "unlockCheats" }>, "id"> | Omit<Extract<Command, { type: "setCheats" }>, "id"> | Omit<Extract<Command, { type: "cheat" }>, "id"> | Omit<Extract<Command, { type: "setSpeed" }>, "id">) => dispatch({ ...command, id: commandId() } as Command);
  function openMenu(page: MenuPage = "menu") {
    setTerritoryOpen(false);
    setTalentOpen(false);
    const current = runtime.getState();
    menuEntry.current = page === "character" ? "character" : "menu";
    pausedBeforeMenu.current = current.paused;
    if (!current.paused && send({ type: "setPaused", paused: true }).status === "rejected") return;
    setMenuPage(page);
  }
  function closeMenu() {
    const current = runtime.getState();
    if (!current.backpackOpen && current.paused !== pausedBeforeMenu.current) {
      if (send({ type: "setPaused", paused: pausedBeforeMenu.current }).status === "rejected") return;
    }
    if (current.backpackOpen && current.paused !== pausedBeforeMenu.current) pendingPauseRestore.current = pausedBeforeMenu.current;
    setMenuPage(null);
    requestAnimationFrame(() => current.backpackOpen ? loadoutRef.current?.focus() : (menuEntry.current === "character" ? characterButtonRef : menuButtonRef).current?.focus());
  }
  function restart() {
    const result = dispatch({ id: commandId(), type: "restart" });
    if (result.status === "executed") { pendingPauseRestore.current = null; pausedBeforeMenu.current = false; setMenuPage(null); setTerritoryOpen(false); }
  }
  const activeCharacter = state.characters.find(c => c.id === activeCharacterId) ?? state.characters[0];
  const loadoutVisible = state.backpackOpen && characterOpen && (inventoryCategory === "equipment" || inventoryCategory === "items") && !territoryOpen && !talentOpen;
  const readyWandHeight = state.backpackOpen ? inventoryWandAreaHeight : wandBoardHeight;
  const speedIndex = Math.max(0, GAME_SPEEDS.indexOf(state.speed));
  const phaseLabel = { ready: "准备中", battle: "战斗中", reward: "选择奖励", defeat: "领地失守" }[state.phase];
  return <main className={`game-shell game-shell--${state.phase}`} style={{ "--game-vitals-height": localProgress ? "20px" : "28px", "--game-hero-mini-space": "0px", "--game-board-space": state.phase === "battle" ? `${wandBoardHeight * .2}px` : "0px", "--wand-height": `${wandBoardHeight}px`, "--ready-wand-height": `${readyWandHeight}px` } as CSSProperties} aria-label="无尽巫师游戏画面">
    <div className={`game-scene${state.backpackOpen ? " game-scene--inventory" : ""}`} inert={menuPage !== null}><Battlefield state={state} flashes={castFlashes} activeCharacterId={territoryOpen || talentOpen ? "" : activeCharacter?.id ?? ""} hideActiveMini={state.phase === "ready" && !territoryOpen && !talentOpen} onCharacterSelect={characterId => { setActiveCharacterId(characterId); setTerritoryOpen(false); setTalentOpen(false); }} />
    {!characterOpen && !territoryOpen && !talentOpen && menuPage === null && <WaveProgress state={state} />}
    <header className="game-header" aria-label="游戏状态">
      <div className="game-coins" aria-label={`金币 ${state.coins}`}><PencilIcon paths={coinPaths} sourceSize={24} size={32} seed="coin" decorative /><PencilText seed="coin-count">{String(state.coins)}</PencilText></div><div className="game-meta"><PencilText seed="wave-status">{`第 ${state.wave} 波 · ${phaseLabel}`}</PencilText></div>
    </header>
    <div className="game-actions">
      {state.phase !== "defeat" && <HudToggle className="game-backpack" open={state.backpackOpen}><Button ref={backpackButtonRef} size="icon" variant="ghost" aria-label={state.backpackOpen ? "收起背包" : "打开背包"} aria-expanded={state.backpackOpen} aria-controls="game-inventory-panel" onClick={() => { send({type:"setBackpack", open:!state.backpackOpen}); }}><PencilIcon paths={backpackPaths} sourceSize={24} size={32} seed="backpack" decorative /></Button></HudToggle>}
      <HudToggle className="game-talent" open={talentOpen}><Button size="icon" variant="ghost" aria-label="天赋" aria-pressed={talentOpen} aria-expanded={talentOpen} aria-controls="talent-panel" onClick={() => { const next = !talentOpen; setTalentOpen(next); if (next) { setCharacterOpen(false); setTerritoryOpen(false); } }}><PencilIcon paths={talentPaths} sourceSize={24} size={32} seed="talent-entry" decorative /></Button></HudToggle>
      <HudToggle className="game-territory" open={territoryOpen}><Button size="icon" variant="ghost" aria-label="领地" aria-pressed={territoryOpen} aria-expanded={territoryOpen} aria-controls="territory-panel" onClick={() => { const next = !territoryOpen; setTerritoryOpen(next); if (next) { setCharacterOpen(false); setTalentOpen(false); } }}><PencilIcon paths={territoryPaths} sourceSize={24} size={32} seed="territory-entry" decorative /></Button></HudToggle>
      <HudToggle className="game-character" open={characterOpen}><Button ref={characterButtonRef} size="icon" variant="ghost" aria-label="角色" aria-pressed={characterOpen} aria-expanded={characterOpen} aria-controls="character-panel" onClick={() => { setTerritoryOpen(false); setTalentOpen(false); setCharacterOpen(open => !open); }}><PencilIcon paths={characterPaths} sourceSize={24} size={32} strokeWidth={0.8} seed="character" decorative /></Button></HudToggle>
      <div className="game-controls" aria-label="战斗控制">
        <Button size="icon" variant="ghost" aria-label="减速" disabled={speedIndex === 0} onClick={() => send({type:"setSpeed", speed: GAME_SPEEDS[speedIndex - 1]})}><PencilIcon paths={minusPaths} size={32} sourceSize={24} seed="speed-down" decorative /></Button>
        <PencilText className="game-controls__speed" seed="speed-value">{`${state.speed}×`}</PencilText>
        <Button size="icon" variant="ghost" aria-label="加速" disabled={speedIndex === GAME_SPEEDS.length - 1} onClick={() => send({type:"setSpeed", speed: GAME_SPEEDS[speedIndex + 1]})}><PencilIcon paths={plusPaths} size={32} sourceSize={24} seed="speed-up" decorative /></Button>
        <Button size="icon" variant="ghost" aria-label={state.paused ? "继续战斗" : "暂停战斗"} disabled={state.phase !== "battle" || state.backpackOpen} onClick={() => send({type:"setPaused", paused: !state.paused})}><PencilIcon paths={state.paused ? playPaths : pausePaths} size={32} sourceSize={24} seed={state.paused ? "play" : "pause"} decorative /></Button>
        <Button ref={menuButtonRef} size="icon" variant="ghost" aria-label="打开菜单" aria-expanded={menuPage !== null} onClick={() => openMenu()}><PencilIcon paths={settingsPaths} sourceSize={24} size={32} seed="menu" decorative /></Button>
      </div>
    </div>
    {message && <p className="game-message" role="alert">{message}</p>}

    <div className={`game-workbench game-workbench--${state.phase}${state.backpackOpen || characterOpen || territoryOpen || talentOpen || state.phase === "reward" || state.phase === "battle" ? " is-obscured" : ""}`} style={state.phase === "ready" ? { top: wandBoardHeight > 0 ? "calc(var(--ready-center) - 28px)" : "var(--ready-center)" } : undefined} inert={state.phase === "battle" || state.phase === "reward" || state.backpackOpen || characterOpen || territoryOpen || talentOpen}><WandBoard state={state} flashes={castFlashes} dispatch={dispatch} activeCharacterId={activeCharacter?.id ?? ""} onHeightChange={setWandBoardHeight} /></div>
    {characterOpen && !territoryOpen && <section id="character-panel" className="game-character-stage" aria-label="角色详情"><div className="game-character-stage__content"><PanelBackdrop wide><CharacterPage state={state} dispatch={dispatch} activeCharacterId={activeCharacter?.id ?? ""} showLoadout={loadoutVisible} loadoutCategory={inventoryCategory === "items" || inventoryCategory === "equipment" ? inventoryCategory : undefined} tab={characterTab} onTabChange={setCharacterTab} /></PanelBackdrop></div></section>}
    {talentOpen && menuPage === null && <section id="talent-panel" className="game-territory-stage" aria-label="天赋"><PanelBackdrop><TalentPanel state={state} /></PanelBackdrop></section>}
    {territoryOpen && menuPage === null && <section className="game-territory-stage" aria-label="领地管理"><PanelBackdrop><TerritoryPanel state={state} onUpgrade={(track: TerritoryUpgradeTrack) => dispatch({ id: commandId(), type: "upgradeTerritory", track })} onRepair={(track: TerritoryUpgradeTrack) => dispatch({ id: commandId(), type: "repairTerritory", track })} onUpgradeRecovery={(track: TerritoryUpgradeTrack) => dispatch({ id: commandId(), type: "upgradeTerritoryRecovery", track })} /></PanelBackdrop></section>}
    {state.phase === "ready" && !characterOpen && !territoryOpen && !talentOpen && <div className="game-center-stage" style={state.phase === "ready" ? { top: readyWandHeight > 0 ? "min(calc(var(--ready-center) + var(--ready-wand-height) / 2 - 16px), calc(100% - var(--game-hud-inset) - 48px))" : "min(calc(var(--ready-center) - 22px), calc(100% - var(--game-hud-inset) - 48px))" } : undefined}><div className="game-center-stage__content">
      {state.phase === "ready" && <Button style={{ minHeight: 44 }} onClick={() => send({type:"startWave"})}>{state.wave === 0 ? "开始游戏" : "开始下一波"}</Button>}

    </div></div>}
    {state.phase === "defeat" && !characterOpen && !territoryOpen && !talentOpen && menuPage === null && <div className="game-overlay game-overlay--center"><RunSummary state={state} onRestart={restart} /></div>}
    <MotionPresence active={rewardReady && !state.backpackOpen && !characterOpen && !territoryOpen && !talentOpen} className="game-reward-stage"><RewardChoices key={`${state.id}:${state.wave}`} rewards={state.rewards} onClaim={rewardId => send({type:"claimReward", rewardId})} refreshQuote={getRewardRefreshQuote(state)} onRefresh={offerId => send({type:"refreshRewards", offerId})} /></MotionPresence>
    </div>
    <div id="game-inventory-panel" ref={loadoutRef} className="game-inventory" data-open={state.backpackOpen && menuPage === null} inert={!state.backpackOpen || menuPage !== null} aria-hidden={!state.backpackOpen || menuPage !== null} aria-label="背包" role="region" tabIndex={-1}>
      <PencilLine className="game-inventory__separator" seed="inventory-separator" aria-hidden="true" />
      <div className="game-inventory__content"><InventoryDock key={state.id} category={inventoryCategory} activeCharacterId={activeCharacter?.id ?? ""} state={state} dispatch={dispatch} showWands={!characterOpen && !territoryOpen && !talentOpen} showLoadout={loadoutVisible} onCategoryChange={category => { setInventoryCategory(category); if (category === "equipment" || category === "items") { setTerritoryOpen(false); setTalentOpen(false); setCharacterOpen(true); } else if (category === "spells") { setCharacterOpen(false); setTalentOpen(false); } }} onWandAreaHeightChange={setInventoryWandAreaHeight} /></div>
    </div>
    <MenuPages restart={restart} dispatch={dispatch} page={menuPage} navigate={setMenuPage} close={closeMenu} agentPanel={agentPanel} state={state} unlock={() => send({type:"unlockCheats"})} toggleCheats={() => send({type:"setCheats", enabled:!state.cheats.enabled})} heal={() => send({type:"cheat", action:"heal"})} />
  </main>;
}
