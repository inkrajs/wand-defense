import { useDebugUnlock } from "./useDebugUnlock";
import { useInventoryPageRows } from "./inventoryViewport";
import { PanelBackdrop } from "./PanelBackdrop";
import { getCharacterPresentationIcon } from "./characterPresentationIcons";
import { RunSummary } from "./RunSummary";
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { Button, PencilIcon, PencilLine, PencilSurface, PencilText, type PencilIconPath } from "@inkra/react";
import { GAME_SPEEDS, type Command, type CommandResult, type GameState, type RuntimePort } from "../contracts";
import { Battlefield } from "./Battlefield";
import { ConstructDeployment } from "./ConstructDeployment";
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
import type { MenuPage } from "./MenuPages";
import type { TerritoryUpgradeTrack } from "../content/territory";
import "./App.css";

const MagicDetails = lazy(() => import("./MagicDetails").then(module=>({default:module.MagicDetails})));
const CharacterPage = lazy(() => import("./CharacterPage").then(module => ({ default: module.CharacterPage })));
const MenuPages = lazy(() => import("./MenuPages").then(module => ({ default: module.MenuPages })));
const TerritoryPanel = lazy(() => import("./TerritoryPanel").then(module => ({ default: module.TerritoryPanel })));
const SkillTree = lazy(() => import("./SkillTree").then(module => ({default:module.SkillTree})));
const TalentPanel = lazy(() => import("./TalentPanel").then(module => ({ default: module.TalentPanel })));

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
const skillTreePaths: PencilIconPath[] = [{d:"M12 4v6M5 10h14M5 10v6m14-6v6M12 10v6",mode:"stroke"},{d:"M10 2h4v4h-4ZM3 16h4v4H3Zm7 0h4v4h-4Zm7 0h4v4h-4Z",mode:"stroke"}];
const talentPaths: PencilIconPath[] = [{ d: "M12 3 14.5 9l6.5.5-5 4.2L17.5 20 12 16.7 6.5 20 8 13.7 3 9.5 9.5 9 12 3Z", mode: "stroke" }];
const territoryPaths: PencilIconPath[] = [
  { d: "M3 21V9l4-3 5 3 5-3 4 3v12M3 13h18", mode: "stroke" },
  { d: "M7 13v4m5-4v4m5-4v4M12 21v-4", mode: "stroke" },
];

function commandId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `ui-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function App({ runtime, agentPanel }: { runtime: RuntimePort; agentPanel?: ReactNode }) {
  const inventoryPageRows = useInventoryPageRows();
  const debugUnlock = useDebugUnlock(runtime);
  const [state, setState] = useState<GameState>(() => runtime.getState());
  const [inspectedMagic,setInspectedMagic]=useState<string|null>(null);
  const inspectionPause=useRef<{runId:string;paused:boolean}|null>(null);
  function inspectMagic(itemId:string) {
    const current=runtime.getState(),item=current.items[itemId];
    if(!item||(item.kind!=="spell"&&item.kind!=="arcana"))return;
    inspectionPause.current={runId:current.id,paused:current.paused};
    if(current.phase==="battle"&&!current.paused) {
      const result=runtime.dispatch({id:commandId(),type:"setPaused",paused:true});
      if(result.status==="rejected"){inspectionPause.current=null;return;}
    }
    setInspectedMagic(itemId);
  }
  function closeMagicDetails() {
    const previous=inspectionPause.current;inspectionPause.current=null;setInspectedMagic(null);
    const current=runtime.getState();
    if(previous&&previous.runId===current.id&&current.phase==="battle"&&!current.backpackOpen&&current.paused!==previous.paused)
      runtime.dispatch({id:commandId(),type:"setPaused",paused:previous.paused});
  }
  useEffect(()=>{
    if(inspectedMagic&&(!state.items[inspectedMagic]||inspectionPause.current?.runId!==state.id))closeMagicDetails();
  },[state.id,state.items,inspectedMagic]);
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
  const [skillTreeOpen, setSkillTreeOpen] = useState(initialUi?.skillTreeOpen ?? false);
  const skillTreeButtonRef = useRef<HTMLButtonElement>(null);
  const skillTreePanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (skillTreeOpen) { const id=requestAnimationFrame(()=>skillTreePanelRef.current?.focus()); return ()=>cancelAnimationFrame(id); }
  }, [skillTreeOpen]);
  const [activeCharacterId, setActiveCharacterId] = useState(() => initialUi?.activeCharacterId ?? state.characters[0]?.id ?? "");
  const [characterTab, setCharacterTab] = useState<CharacterTab>(initialUi?.characterTab ?? "overview");
  const [menuPage, setMenuPage] = useState<MenuPage | null>(null);
  const [menuMounted, setMenuMounted] = useState(false);
  useEffect(() => {
    if (inspectedMagic && (menuPage !== null || characterOpen || territoryOpen || talentOpen || skillTreeOpen)) closeMagicDetails();
  }, [menuPage, characterOpen, territoryOpen, talentOpen, skillTreeOpen]);
  const pausedBeforeMenu = useRef(false);
  const pendingPauseRestore = useRef<boolean | null>(null);
  const runId = useRef(state.id);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const characterButtonRef = useRef<HTMLButtonElement>(null);
  const menuEntry = useRef<"menu" | "character">("menu");
  const loadoutRef = useRef<HTMLDivElement>(null);
  const backpackButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      const preferences = JSON.parse(window.localStorage.getItem("wand-defense.preferences.v1") ?? "null");
      document.documentElement.dataset.gameReduceMotion = String(preferences?.reduceMotion === true);
      document.documentElement.dataset.gameTextEffects = String(preferences?.textEffects !== false);
    } catch {
      document.documentElement.dataset.gameReduceMotion = "false";
      document.documentElement.dataset.gameTextEffects = "true";
    }
  }, []);

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
      setSkillTreeOpen(false);
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
    writeUiSession(state.id, { activeCharacterId, characterOpen, territoryOpen, talentOpen, skillTreeOpen, inventoryCategory, characterTab }, state.characters);
  }, [uiRunId, state.id, characterIds, activeCharacterId, characterOpen, territoryOpen, talentOpen, skillTreeOpen, inventoryCategory, characterTab]);
  function dispatch(command: Command): CommandResult {
    const result = runtime.dispatch(command);
    const deploymentErrors: Record<string, string> = {
      CONSTRUCT_UNAVAILABLE: "该法术暂时无法部署", CONSTRUCT_NOT_READY: "法术尚未冷却或未装备",
      INSUFFICIENT_RESOURCES: "法力或金币不足", INVALID_POSITION: "请选择战场内的位置",
      DEPLOY_REQUIRES_PAUSE: "请先暂停战斗",
    };
    setMessage(result.status === "rejected" ? (result.message || (command.type === "deployConstruct" && result.code ? deploymentErrors[result.code] : undefined) || result.code || "操作未能执行") : "");
    return result;
  }
  const send = (command: Omit<Extract<Command, { type: "startWave" }>, "id"> | Omit<Extract<Command, { type: "setPaused" }>, "id"> | Omit<Extract<Command, { type: "setBackpack" }>, "id"> | Omit<Extract<Command, { type: "claimReward" }>, "id"> | Omit<Extract<Command, { type: "refreshRewards" }>, "id"> | Omit<Extract<Command, { type: "unlockCheats" }>, "id"> | Omit<Extract<Command, { type: "setCheats" }>, "id"> | Omit<Extract<Command, { type: "cheat" }>, "id"> | Omit<Extract<Command, { type: "setSpeed" }>, "id">) => dispatch({ ...command, id: commandId() } as Command);
  function openMenu(page: MenuPage = "menu") {
    closeMagicDetails();
    setSkillTreeOpen(false);
    setMenuMounted(true);
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
  const loadoutVisible = state.backpackOpen && characterOpen && characterTab === "equipment" && (inventoryCategory === "equipment" || inventoryCategory === "items") && !territoryOpen && !talentOpen;
  const readyWandHeight = state.backpackOpen ? inventoryWandAreaHeight : wandBoardHeight;
  const speedIndex = Math.max(0, GAME_SPEEDS.indexOf(state.speed));
  const phaseLabel = { ready: "准备中", battle: "战斗中", reward: "选择奖励", defeat: "领地失守" }[state.phase];
  return <main data-magic-inspection={inspectedMagic !== null} className={`game-shell game-shell--${state.phase}`} style={{ "--inventory-page-rows": inventoryPageRows, "--game-vitals-height": localProgress ? "20px" : "28px", "--game-hero-mini-space": "0px", "--game-board-space": state.phase === "battle" ? `${wandBoardHeight * .2}px` : "0px", "--wand-height": `${wandBoardHeight}px`, "--ready-wand-height": `${readyWandHeight}px` } as CSSProperties} aria-label="杀死那个巫师游戏画面">
    <div className={`game-scene${state.backpackOpen ? " game-scene--inventory" : ""}`} inert={menuPage !== null}><Battlefield state={state} flashes={castFlashes} activeCharacterId={territoryOpen || talentOpen || skillTreeOpen ? "" : activeCharacter?.id ?? ""} hideActiveMini={state.phase === "ready" && !territoryOpen && !talentOpen && !skillTreeOpen} onCharacterSelect={characterId => { closeMagicDetails(); setSkillTreeOpen(false); setActiveCharacterId(characterId); setTerritoryOpen(false); setTalentOpen(false); }} />
    <ConstructDeployment state={state} characterId={activeCharacter?.id ?? ""} runtime={runtime} dispatch={dispatch} enabled={inspectedMagic === null && menuPage === null && !state.backpackOpen && !characterOpen && !territoryOpen && !talentOpen && !skillTreeOpen} />
    {!characterOpen && !territoryOpen && !talentOpen && !skillTreeOpen && menuPage === null && <WaveProgress state={state} />}
    <header className="game-header" aria-label="游戏状态">
      <div className="game-coins" aria-label={`金币 ${state.coins}`}><PencilIcon paths={coinPaths} sourceSize={24} size={32} seed="coin" decorative /><PencilText seed="coin-count">{String(state.coins)}</PencilText></div><div className="game-meta" onClick={debugUnlock.onTitleClick}><PencilText seed="wave-status">{`第 ${state.wave} 波 · ${phaseLabel}`}</PencilText></div>
    </header>
    <div className="game-actions">
      {state.phase !== "defeat" && <HudToggle className="game-backpack" open={state.backpackOpen}><Button ref={backpackButtonRef} size="icon" variant="ghost" aria-label={state.backpackOpen ? "收起背包" : "打开背包"} aria-expanded={state.backpackOpen} aria-controls="game-inventory-panel" onClick={() => { closeMagicDetails(); if (!state.backpackOpen) setSkillTreeOpen(false); send({type:"setBackpack", open:!state.backpackOpen}); }}><PencilIcon paths={backpackPaths} sourceSize={24} size={32} seed="backpack" decorative /></Button></HudToggle>}
      <HudToggle className="game-skill-tree" open={skillTreeOpen}><Button ref={skillTreeButtonRef} size="icon" variant="ghost" aria-label="技能树" aria-expanded={skillTreeOpen} aria-pressed={skillTreeOpen} aria-controls="skill-tree-panel" onClick={() => {closeMagicDetails(); setSkillTreeOpen(open=>!open); setCharacterOpen(false); setTerritoryOpen(false); setTalentOpen(false);}}><PencilIcon paths={skillTreePaths} sourceSize={24} size={32} seed="skill-tree-entry" decorative /></Button></HudToggle>
      <HudToggle className="game-talent" open={talentOpen}><Button size="icon" variant="ghost" aria-label="天赋" aria-pressed={talentOpen} aria-expanded={talentOpen} aria-controls="talent-panel" onClick={() => { const next = !talentOpen; setSkillTreeOpen(false); setTalentOpen(next); if (next) { setCharacterOpen(false); setTerritoryOpen(false); } }}><PencilIcon paths={talentPaths} sourceSize={24} size={32} seed="talent-entry" decorative /></Button></HudToggle>
      <HudToggle className="game-territory" open={territoryOpen}><Button size="icon" variant="ghost" aria-label="领地" aria-pressed={territoryOpen} aria-expanded={territoryOpen} aria-controls="territory-panel" onClick={() => { const next = !territoryOpen; setSkillTreeOpen(false); setTerritoryOpen(next); if (next) { setCharacterOpen(false); setTalentOpen(false); } }}><PencilIcon paths={territoryPaths} sourceSize={24} size={32} seed="territory-entry" decorative /></Button></HudToggle>
      <HudToggle className="game-character" open={characterOpen}><Button {...debugUnlock.holdHandlers} className={debugUnlock.shaking ? "is-debug-unlocked" : undefined} ref={characterButtonRef} size="icon" variant="ghost" aria-label="角色" aria-pressed={characterOpen} aria-expanded={characterOpen} aria-controls="character-panel" onClick={() => { setSkillTreeOpen(false); setTerritoryOpen(false); setTalentOpen(false); setCharacterOpen(open => !open); }}><PencilIcon paths={characterPaths} sourceSize={24} size={32} strokeWidth={0.8} seed="character" decorative /></Button></HudToggle>
      <div className="game-controls" aria-label="战斗控制">
        <Button size="icon" variant="ghost" aria-label="减速" disabled={speedIndex === 0} onClick={() => send({type:"setSpeed", speed: GAME_SPEEDS[speedIndex - 1]})}><PencilIcon paths={minusPaths} size={32} sourceSize={24} seed="speed-down" decorative /></Button>
        <PencilText className="game-controls__speed" seed="speed-value">{`${state.speed}×`}</PencilText>
        <Button size="icon" variant="ghost" aria-label="加速" disabled={speedIndex === GAME_SPEEDS.length - 1} onClick={() => send({type:"setSpeed", speed: GAME_SPEEDS[speedIndex + 1]})}><PencilIcon paths={plusPaths} size={32} sourceSize={24} seed="speed-up" decorative /></Button>
        <Button size="icon" variant="ghost" aria-label={state.paused ? "继续战斗" : "暂停战斗"} disabled={state.phase !== "battle" || state.backpackOpen} onClick={() => send({type:"setPaused", paused: !state.paused})}><PencilIcon paths={state.paused ? playPaths : pausePaths} size={32} sourceSize={24} seed={state.paused ? "play" : "pause"} decorative /></Button>
        <Button ref={menuButtonRef} size="icon" variant="ghost" aria-label="打开菜单" aria-expanded={menuPage !== null} onClick={() => openMenu()}><PencilIcon paths={settingsPaths} sourceSize={24} size={32} seed="menu" decorative /></Button>
      </div>
    </div>
    {message && <p className="game-message" role="alert">{message}</p>}

    <div className={`game-workbench game-workbench--${state.phase}${state.backpackOpen || characterOpen || territoryOpen || talentOpen || skillTreeOpen || state.phase === "reward" || state.phase === "battle" ? " is-obscured" : ""}`} style={state.phase === "ready" ? { top: wandBoardHeight > 0 ? "calc(var(--ready-center) - 28px)" : "var(--ready-center)" } : undefined} inert={inspectedMagic !== null || state.phase === "battle" || state.phase === "reward" || state.backpackOpen || characterOpen || territoryOpen || talentOpen || skillTreeOpen}><WandBoard state={state} flashes={castFlashes} dispatch={dispatch} activeCharacterId={activeCharacter?.id ?? ""} onHeightChange={setWandBoardHeight} onInspectMagic={inspectMagic} /></div>
    {characterOpen && !territoryOpen && !skillTreeOpen && <section id="character-panel" className="game-character-stage" aria-label="角色详情"><div className="game-character-stage__content"><PanelBackdrop wide><Suspense fallback={<span role="status">正在加载角色…</span>}><CharacterPage state={state} dispatch={dispatch} activeCharacterId={activeCharacter?.id ?? ""} showLoadout={loadoutVisible} loadoutCategory={inventoryCategory === "items" || inventoryCategory === "equipment" ? inventoryCategory : undefined} tab={characterTab} onTabChange={setCharacterTab} /></Suspense></PanelBackdrop></div></section>}
    <MotionPresence active={skillTreeOpen && menuPage === null} className="game-territory-stage game-skill-tree-stage" label="技能树" containerRef={skillTreePanelRef}><div id="skill-tree-panel" className="game-skill-tree-stage__content" onKeyDown={event=>{if(event.key==="Escape"&&!event.defaultPrevented){event.preventDefault();setSkillTreeOpen(false);requestAnimationFrame(()=>skillTreeButtonRef.current?.focus());}}}><PanelBackdrop wide><Suspense fallback={null}><SkillTree knowledge={state.knowledge} /></Suspense></PanelBackdrop></div></MotionPresence>
    {talentOpen && menuPage === null && <section id="talent-panel" className="game-territory-stage" aria-label="天赋"><PanelBackdrop><Suspense fallback={<span role="status">正在加载天赋…</span>}><TalentPanel state={state} /></Suspense></PanelBackdrop></section>}
    {territoryOpen && menuPage === null && <section className="game-territory-stage" aria-label="领地管理"><PanelBackdrop><Suspense fallback={<span role="status">正在加载领地…</span>}><TerritoryPanel state={state} onUpgrade={(track: TerritoryUpgradeTrack) => dispatch({ id: commandId(), type: "upgradeTerritory", track })} onRepair={(track: TerritoryUpgradeTrack) => dispatch({ id: commandId(), type: "repairTerritory", track })} onUpgradeRecovery={(track: TerritoryUpgradeTrack) => dispatch({ id: commandId(), type: "upgradeTerritoryRecovery", track })} /></Suspense></PanelBackdrop></section>}
    {state.phase === "ready" && !characterOpen && !territoryOpen && !talentOpen && !skillTreeOpen && <div className="game-center-stage" inert={inspectedMagic !== null} style={state.phase === "ready" ? { top: readyWandHeight > 0 ? "min(calc(var(--ready-center) + var(--ready-wand-height) / 2 - 16px), calc(100% - var(--game-hud-inset) - 48px))" : "min(calc(var(--ready-center) - 22px), calc(100% - var(--game-hud-inset) - 48px))" } : undefined}><div className="game-center-stage__content">
      {state.phase === "ready" && <Button style={{ minHeight: 44 }} onClick={() => send({type:"startWave"})}>{state.wave === 0 ? "开始游戏" : "开始下一波"}</Button>}

    </div></div>}
    {state.phase === "defeat" && !characterOpen && !territoryOpen && !talentOpen && !skillTreeOpen && menuPage === null && <div className="game-overlay game-overlay--center"><RunSummary state={state} onRestart={restart} /></div>}
    <MotionPresence active={rewardReady && !state.backpackOpen && !characterOpen && !territoryOpen && !talentOpen && !skillTreeOpen} className="game-reward-stage"><RewardChoices key={`${state.id}:${state.wave}`} rewards={state.rewards} onClaim={rewardId => send({type:"claimReward", rewardId})} refreshQuote={getRewardRefreshQuote(state)} onRefresh={offerId => send({type:"refreshRewards", offerId})} /></MotionPresence>
    <MotionPresence active={inspectedMagic !== null} className="game-magic-stage"><Suspense fallback={null}>{inspectedMagic && <MagicDetails state={state} itemId={inspectedMagic} onClose={closeMagicDetails} />}</Suspense></MotionPresence>
    </div>
    <div id="game-inventory-panel" ref={loadoutRef} className="game-inventory" data-open={state.backpackOpen && menuPage === null} inert={!state.backpackOpen || menuPage !== null || inspectedMagic !== null} aria-hidden={!state.backpackOpen || menuPage !== null || inspectedMagic !== null} aria-label="背包" role="region" tabIndex={-1}>
      <PencilLine className="game-inventory__separator" seed="inventory-separator" aria-hidden="true" />
      <div className="game-inventory__content"><InventoryDock key={state.id} pageRows={inventoryPageRows} onInspectMagic={inspectMagic} category={inventoryCategory} activeCharacterId={activeCharacter?.id ?? ""} state={state} dispatch={dispatch} showWands={!characterOpen && !territoryOpen && !talentOpen && !skillTreeOpen} showLoadout={loadoutVisible} onCategoryChange={category => { setSkillTreeOpen(false); setInventoryCategory(category); if (category === "equipment" || category === "items") { setTerritoryOpen(false); setTalentOpen(false); setCharacterOpen(true); setCharacterTab("equipment"); } else if (category === "spells") { setCharacterOpen(false); setTalentOpen(false); } }} onWandAreaHeightChange={setInventoryWandAreaHeight} /></div>
    </div>
    {menuMounted && <Suspense fallback={<span role="status">正在加载菜单…</span>}><MenuPages restart={restart} dispatch={dispatch} page={menuPage} navigate={setMenuPage} close={closeMenu} agentPanel={agentPanel} state={state} unlock={() => send({type:"unlockCheats"})} toggleCheats={() => send({type:"setCheats", enabled:!state.cheats.enabled})} heal={() => send({type:"cheat", action:"heal"})} /></Suspense>}
  </main>;
}
