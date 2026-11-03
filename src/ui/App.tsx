import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { Button, PencilIcon, PencilLine, PencilSurface, PencilText, type PencilIconPath } from "@inkra/react";
import { GAME_SPEEDS, type Command, type CommandResult, type GameState, type RuntimePort } from "../contracts";
import { Battlefield } from "./Battlefield";
import { CharacterPage } from "./CharacterPage";
import { InventoryDock } from "./InventoryDock";
import { WandBoard } from "./WandBoard";
import { MotionPresence } from "./MotionPresence";
import { localProgress } from "./progressOptions";
import { RewardChoices } from "./RewardChoices";
import { MenuPages, type MenuPage } from "./MenuPages";
import { TerritoryPanel } from "./TerritoryPanel";
import type { TerritoryUpgradeTrack } from "../content/territory";
import "./App.css";

const characterPaths: PencilIconPath[] = [{ d: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z", mode: "stroke" }, { d: "M4 21c0-5 3-8 8-8s8 3 8 8", mode: "stroke" }];
const coinPaths: PencilIconPath[] = [{ d: "M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z", mode: "stroke" }, { d: "M12 7v10M9 9c0-2 6-2 6 0s-6 2-6 4 6 2 6 0", mode: "stroke" }];
const backpackPaths: PencilIconPath[] = [{ d: "M8 7V5a4 4 0 0 1 8 0v2", mode: "stroke" }, { d: "M6 8h12a2 2 0 0 1 2 2v10H4V10a2 2 0 0 1 2-2Z", mode: "stroke" }, { d: "M8 15h8v5H8Z", mode: "stroke" }];
const minusPaths: PencilIconPath[] = [{ d: "M5 12h14", mode: "stroke" }];
const plusPaths: PencilIconPath[] = [{ d: "M5 12h14M12 5v14", mode: "stroke" }];
const pausePaths: PencilIconPath[] = [{ d: "M8 5v14M16 5v14", mode: "stroke" }];
const playPaths: PencilIconPath[] = [{ d: "M8 5l11 7-11 7V5Z", mode: "stroke" }];
const settingsPaths: PencilIconPath[] = [{ d: "M4 6h16M4 12h16M4 18h16", mode: "stroke" }];
const territoryPaths: PencilIconPath[] = [
  { d: "M3 21V9l4-3 5 3 5-3 4 3v12M3 13h18", mode: "stroke" },
  { d: "M7 13v4m5-4v4m5-4v4M12 21v-4", mode: "stroke" },
];

function commandId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `ui-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function App({ runtime, agentPanel }: { runtime: RuntimePort; agentPanel?: ReactNode }) {
  const [state, setState] = useState<GameState>(() => runtime.getState());
  const [wandBoardHeight, setWandBoardHeight] = useState(0);
  const [inventoryWandAreaHeight, setInventoryWandAreaHeight] = useState(0);
  const [inventoryCategory, setInventoryCategory] = useState<"items" | "spells" | "equipment">("spells");
  const [message, setMessage] = useState("");
  const [characterOpen, setCharacterOpen] = useState(false);
  const [territoryOpen, setTerritoryOpen] = useState(false);
  const [activeCharacterId, setActiveCharacterId] = useState(() => runtime.getState().characters[0]?.id ?? "");
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
      setInventoryCategory("spells");
      setActiveCharacterId(state.characters[0]?.id ?? "");
      setMessage("");
    }
  }, [state.id]);
  function dispatch(command: Command): CommandResult {
    const result = runtime.dispatch(command);
    setMessage(result.status === "rejected" ? (result.message || result.code || "操作未能执行") : "");
    return result;
  }
  const send = (command: Omit<Extract<Command, { type: "startWave" }>, "id"> | Omit<Extract<Command, { type: "setPaused" }>, "id"> | Omit<Extract<Command, { type: "setBackpack" }>, "id"> | Omit<Extract<Command, { type: "claimReward" }>, "id"> | Omit<Extract<Command, { type: "unlockCheats" }>, "id"> | Omit<Extract<Command, { type: "setCheats" }>, "id"> | Omit<Extract<Command, { type: "cheat" }>, "id"> | Omit<Extract<Command, { type: "setSpeed" }>, "id">) => dispatch({ ...command, id: commandId() } as Command);
  function openMenu(page: MenuPage = "menu") {
    setTerritoryOpen(false);
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
  const loadoutVisible = state.backpackOpen && characterOpen && inventoryCategory === "equipment" && !territoryOpen;
  const readyWandHeight = state.backpackOpen ? inventoryWandAreaHeight : wandBoardHeight;
  const speedIndex = Math.max(0, GAME_SPEEDS.indexOf(state.speed));
  const phaseLabel = { ready: "准备中", battle: "战斗中", reward: "选择奖励", defeat: "领地失守" }[state.phase];
  return <main className={`game-shell game-shell--${state.phase}`} style={{ "--game-vitals-height": localProgress ? "20px" : "28px", "--game-board-space": state.phase === "battle" ? `${wandBoardHeight * .2}px` : "0px", "--wand-height": `${wandBoardHeight}px`, "--ready-wand-height": `${readyWandHeight}px` } as CSSProperties} aria-label="无尽巫师游戏画面">
    <div className={`game-scene${state.backpackOpen ? " game-scene--inventory" : ""}`} inert={menuPage !== null}><Battlefield state={state} activeCharacterId={activeCharacter?.id ?? ""} onCharacterSelect={setActiveCharacterId} />
    <header className="game-header" aria-label="游戏状态">
      <div className="game-coins" aria-label={`金币 ${state.coins}`}><PencilIcon paths={coinPaths} sourceSize={24} size={32} seed="coin" decorative /><PencilText seed="coin-count">{String(state.coins)}</PencilText></div><div className="game-meta"><PencilText seed="wave-status">{`第 ${state.wave} 波 · ${phaseLabel}`}</PencilText></div>
    </header>
    <div className="game-actions">
      {state.phase !== "defeat" && <span className="game-backpack" data-open={state.backpackOpen}><PencilSurface as="span" className="game-backpack__wash" variant="selection" seed="backpack-selection" aria-hidden="true" /><Button ref={backpackButtonRef} size="icon" variant="ghost" aria-label={state.backpackOpen ? "收起背包" : "打开背包"} aria-expanded={state.backpackOpen} aria-controls="game-inventory-panel" onClick={() => { send({type:"setBackpack", open:!state.backpackOpen}); }}><PencilIcon paths={backpackPaths} sourceSize={24} size={32} seed="backpack" decorative /></Button></span>}
      <span className="game-territory"><Button size="icon" variant="ghost" aria-label="领地" aria-pressed={territoryOpen} aria-expanded={territoryOpen} aria-controls="territory-panel" onClick={() => { const next = !territoryOpen; setTerritoryOpen(next); if (next) setCharacterOpen(false); }}><PencilIcon paths={territoryPaths} sourceSize={24} size={32} seed="territory-entry" decorative /></Button></span>
      <Button className="game-character" ref={characterButtonRef} size="icon" variant="ghost" aria-label="角色" aria-pressed={characterOpen} onClick={() => { setTerritoryOpen(false); setCharacterOpen(open => !open); }}><PencilIcon paths={characterPaths} sourceSize={24} size={32} seed="character" decorative /></Button>
      <div className="game-controls" aria-label="战斗控制">
        <Button size="icon" variant="ghost" aria-label="减速" disabled={speedIndex === 0} onClick={() => send({type:"setSpeed", speed: GAME_SPEEDS[speedIndex - 1]})}><PencilIcon paths={minusPaths} size={32} sourceSize={24} seed="speed-down" decorative /></Button>
        <PencilText className="game-controls__speed" seed="speed-value">{`${state.speed}×`}</PencilText>
        <Button size="icon" variant="ghost" aria-label="加速" disabled={speedIndex === GAME_SPEEDS.length - 1} onClick={() => send({type:"setSpeed", speed: GAME_SPEEDS[speedIndex + 1]})}><PencilIcon paths={plusPaths} size={32} sourceSize={24} seed="speed-up" decorative /></Button>
        <Button size="icon" variant="ghost" aria-label={state.paused ? "继续战斗" : "暂停战斗"} disabled={state.phase !== "battle" || state.backpackOpen} onClick={() => send({type:"setPaused", paused: !state.paused})}><PencilIcon paths={state.paused ? playPaths : pausePaths} size={32} sourceSize={24} seed={state.paused ? "play" : "pause"} decorative /></Button>
        <Button ref={menuButtonRef} size="icon" variant="ghost" aria-label="打开菜单" aria-expanded={menuPage !== null} onClick={() => openMenu()}><PencilIcon paths={settingsPaths} sourceSize={24} size={32} seed="menu" decorative /></Button>
      </div>
    </div>
    {message && <p className="game-message" role="alert">{message}</p>}

    <div className={`game-workbench game-workbench--${state.phase}${state.backpackOpen || characterOpen || territoryOpen || state.phase === "reward" ? " is-obscured" : ""}`} style={state.phase === "ready" ? { top: wandBoardHeight > 0 ? "calc(var(--ready-center) - 28px)" : "var(--ready-center)" } : undefined} inert={state.phase === "battle" || state.phase === "reward" || state.backpackOpen || characterOpen || territoryOpen}><WandBoard state={state} dispatch={dispatch} activeCharacterId={activeCharacter?.id ?? ""} onHeightChange={setWandBoardHeight} /></div>
    {characterOpen && !territoryOpen && <section className="game-character-stage" aria-label="角色详情"><div className="game-character-stage__content"><CharacterPage state={state} dispatch={dispatch} activeCharacterId={activeCharacter?.id ?? ""} showLoadout={loadoutVisible} /></div></section>}
    {territoryOpen && menuPage === null && <section className="game-territory-stage" aria-label="领地管理"><TerritoryPanel state={state} onUpgrade={(track: TerritoryUpgradeTrack) => dispatch({ id: commandId(), type: "upgradeTerritory", track })} /></section>}
    {state.phase !== "battle" && !characterOpen && !territoryOpen && <div className="game-center-stage" style={state.phase === "ready" ? { top: readyWandHeight > 0 ? "min(calc(var(--ready-center) + var(--ready-wand-height) / 2 - 16px), calc(100% - var(--game-hud-inset) - 48px))" : "min(calc(var(--ready-center) - 22px), calc(100% - var(--game-hud-inset) - 48px))" } : undefined}><div className="game-center-stage__content">
      {state.phase === "ready" && <Button style={{ minHeight: 44 }} onClick={() => send({type:"startWave"})}>{state.wave === 0 ? "开始游戏" : "开始下一波"}</Button>}

      {state.phase === "defeat" && <PencilSurface as="section" className="reward-panel" variant="paper" seed="defeat" radius={6}><PencilText as="h2" seed="defeat-title">领地失守</PencilText><PencilText as="p" seed="defeat-summary">{`本次抵达第 ${state.wave} 波。`}</PencilText></PencilSurface>}
    </div></div>}
    <MotionPresence active={state.phase === "reward" && !state.backpackOpen && !characterOpen && !territoryOpen} className="game-reward-stage"><RewardChoices rewards={state.rewards} onClaim={rewardId => send({type:"claimReward", rewardId})} /></MotionPresence>
    </div>
    <div id="game-inventory-panel" ref={loadoutRef} className="game-inventory" data-open={state.backpackOpen && menuPage === null} inert={!state.backpackOpen || menuPage !== null} aria-hidden={!state.backpackOpen || menuPage !== null} aria-label="背包" role="region" tabIndex={-1}>
      <PencilLine className="game-inventory__separator" seed="inventory-separator" aria-hidden="true" />
      <div className="game-inventory__content"><InventoryDock key={state.id} activeCharacterId={activeCharacter?.id ?? ""} state={state} dispatch={dispatch} showWands={!characterOpen && !territoryOpen} showLoadout={loadoutVisible} onCategoryChange={category => { setInventoryCategory(category); if (category === "equipment") { setTerritoryOpen(false); setCharacterOpen(true); } else if (category === "spells") setCharacterOpen(false); }} onWandAreaHeightChange={setInventoryWandAreaHeight} /></div>
    </div>
    <MenuPages restart={restart} dispatch={dispatch} page={menuPage} navigate={setMenuPage} close={closeMenu} agentPanel={agentPanel} state={state} unlock={() => send({type:"unlockCheats"})} toggleCheats={() => send({type:"setCheats", enabled:!state.cheats.enabled})} heal={() => send({type:"cheat", action:"heal"})} />
  </main>;
}
