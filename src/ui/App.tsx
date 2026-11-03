import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, PencilIcon, PencilSurface, PencilText, type PencilIconPath } from "@inkra/react";
import type { Command, CommandResult, GameState, RuntimePort } from "../contracts";
import { Battlefield } from "./Battlefield";
import { LoadoutPanel } from "./LoadoutPanel";
import { WandBoard } from "./WandBoard";
import { MenuPages, type MenuPage } from "./MenuPages";
import "./App.css";

const characterPaths: PencilIconPath[] = [{ d: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z", mode: "stroke" }, { d: "M4 21c0-5 3-8 8-8s8 3 8 8", mode: "stroke" }];
const coinPaths: PencilIconPath[] = [{ d: "M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z", mode: "stroke" }, { d: "M12 7v10M9 9c0-2 6-2 6 0s-6 2-6 4 6 2 6 0", mode: "stroke" }];
const backpackPaths: PencilIconPath[] = [{ d: "M8 7V5a4 4 0 0 1 8 0v2", mode: "stroke" }, { d: "M6 8h12a2 2 0 0 1 2 2v10H4V10a2 2 0 0 1 2-2Z", mode: "stroke" }, { d: "M8 15h8v5H8Z", mode: "stroke" }];
const settingsPaths: PencilIconPath[] = [{ d: "M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4", mode: "stroke" }, { d: "M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z", mode: "stroke" }, { d: "M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z", mode: "stroke" }];

function commandId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `ui-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function App({ runtime, agentPanel }: { runtime: RuntimePort; agentPanel?: ReactNode }) {
  const [state, setState] = useState<GameState>(() => runtime.getState());
  const [message, setMessage] = useState("");
  const [menuPage, setMenuPage] = useState<MenuPage | null>(null);
  const pausedBeforeMenu = useRef(false);
  const pendingPauseRestore = useRef<boolean | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const characterButtonRef = useRef<HTMLButtonElement>(null);
  const menuEntry = useRef<"menu" | "character">("menu");
  const loadoutRef = useRef<HTMLDivElement>(null);
  const backpackButtonRef = useRef<HTMLButtonElement>(null);

  const [loadoutMode, setLoadoutMode] = useState<"backpack" | "wand">("backpack");
  const lastEntry = useRef<"backpack" | "wand">("backpack");
  const wasOpen = useRef(false);
  useEffect(() => {
    if (state.backpackOpen) loadoutRef.current?.focus();
    else if (wasOpen.current) backpackButtonRef.current?.focus();
    wasOpen.current = state.backpackOpen;
  }, [state.backpackOpen]);
  useEffect(() => {
    if (menuPage === null && !state.backpackOpen && pendingPauseRestore.current !== null) {
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
  function dispatch(command: Command): CommandResult {
    const result = runtime.dispatch(command);
    setMessage(result.status === "rejected" ? (result.message || result.code || "操作未能执行") : "");
    return result;
  }
  const send = (command: Omit<Extract<Command, { type: "startWave" }>, "id"> | Omit<Extract<Command, { type: "setPaused" }>, "id"> | Omit<Extract<Command, { type: "setBackpack" }>, "id"> | Omit<Extract<Command, { type: "claimReward" }>, "id"> | Omit<Extract<Command, { type: "unlockCheats" }>, "id"> | Omit<Extract<Command, { type: "setCheats" }>, "id"> | Omit<Extract<Command, { type: "cheat" }>, "id">) => dispatch({ ...command, id: commandId() } as Command);
  function openMenu(page: MenuPage = "menu") {
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
  const primaryWand = state.wands.find(w => w.id === state.characters[0]?.wandIds[0]);
  const phaseLabel = { ready: "准备中", battle: "战斗中", reward: "选择奖励", defeat: "领地失守" }[state.phase];
  return <main className={`game-shell game-shell--${state.phase}`} aria-label="法杖守城游戏画面">
    <div className="game-scene" inert={menuPage !== null}><Battlefield state={state} />
    <header className="game-header" aria-label="游戏状态">
      <div className="game-coins" aria-label={`金币 ${state.coins}`}><PencilIcon paths={coinPaths} sourceSize={24} size={32} seed="coin" decorative /><PencilText seed="coin-count">{String(state.coins)}</PencilText></div><div className="game-meta"><PencilText seed="wave-status">{`第 ${state.wave} 波 · ${phaseLabel}`}</PencilText></div>
    </header>
    <div className="game-actions" inert={state.backpackOpen}>
      <div className="game-battle-actions">{state.phase === "battle" && <Button variant="secondary" onClick={() => send({ type: "setPaused", paused: !state.paused })}>{state.paused ? "继续战斗" : "暂停"}</Button>}</div>
      <div className="game-corner-actions"><Button ref={characterButtonRef} size="icon" variant="ghost" aria-label="角色" onClick={() => openMenu("character")}><PencilIcon paths={characterPaths} sourceSize={24} size={32} seed="character" decorative /></Button>{state.phase !== "defeat" && <Button ref={backpackButtonRef} size="icon" variant="ghost" aria-label="打开背包" onClick={() => { lastEntry.current = "backpack"; setLoadoutMode("backpack"); send({type:"setBackpack", open:true}); }}><PencilIcon paths={backpackPaths} sourceSize={24} size={32} seed="backpack" decorative /></Button>}</div>
      <div className="game-settings"><Button ref={menuButtonRef} size="icon" variant="ghost" aria-label="打开菜单" aria-expanded={menuPage !== null} onClick={() => openMenu()}><PencilIcon paths={settingsPaths} sourceSize={24} size={32} seed="menu" decorative /></Button></div>
    </div>
    {message && <p className="game-message" role="alert">{message}</p>}
    {state.backpackOpen && <div ref={loadoutRef} className="game-overlay game-overlay--loadout" role="dialog" aria-modal="true" aria-label="法杖工坊" tabIndex={-1}><LoadoutPanel state={state} dispatch={dispatch} mode={loadoutMode} onModeChange={setLoadoutMode} /></div>}
    {!state.backpackOpen && <div className={`game-workbench game-workbench--${state.phase}`} style={state.phase === "battle" ? { width: ((primaryWand?.width ?? 1) * 56 + 8) * .1, height: ((primaryWand?.height ?? 1) * 56 + 8) * .1 } : undefined}><div className="game-workbench__grid" inert={state.phase === "battle"}><WandBoard state={state} dispatch={dispatch} /></div></div>}
    {state.phase === "ready" && !state.backpackOpen && <div className="game-overlay game-overlay--center game-overlay--ready"><Button onClick={() => send({type:"startWave"})}>{state.wave === 0 ? "开始游戏" : "开始下一波"}</Button></div>}
    {state.phase === "reward" && !state.backpackOpen && <div className="game-overlay game-overlay--center"><div className="reward-stack"><Button disabled>开始下一波</Button><PencilSurface as="section" className="reward-panel" variant="paper" seed="reward" radius={6} aria-labelledby="reward-heading"><p className="eyebrow">WAVE COMPLETE</p><PencilText as="h2" id="reward-heading" seed="reward-heading">选择一份奖励</PencilText><PencilText as="p" seed="reward-help">整理好法杖后，领取奖励继续旅程。</PencilText><div className="reward-list">{state.rewards.map(reward => <Button key={reward.id} variant="outline" onClick={() => send({type:"claimReward", rewardId:reward.id})}>{reward.label}</Button>)}</div><Button variant="ghost" onClick={() => { lastEntry.current = "backpack"; setLoadoutMode("backpack"); send({type:"setBackpack", open:true}); }}>整理背包</Button></PencilSurface></div></div>}
    {state.phase === "defeat" && <div className="game-overlay game-overlay--center"><PencilSurface as="section" className="reward-panel" variant="paper" seed="defeat" radius={6}><PencilText as="h2" seed="defeat-title">领地失守</PencilText><PencilText as="p" seed="defeat-summary">{`本次抵达第 ${state.wave} 波。`}</PencilText></PencilSurface></div>}
    </div>
    <MenuPages dispatch={dispatch} page={menuPage} navigate={setMenuPage} close={closeMenu} agentPanel={agentPanel} state={state} unlock={() => send({type:"unlockCheats"})} toggleCheats={() => send({type:"setCheats", enabled:!state.cheats.enabled})} heal={() => send({type:"cheat", action:"heal"})} />
  </main>;
}
