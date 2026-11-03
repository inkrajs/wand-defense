import { useEffect, useState } from "react";
import { Button } from "@inkra/react";
import type { Command, CommandResult, GameState, RuntimePort } from "../contracts";
import { Battlefield } from "./Battlefield";
import { LoadoutPanel } from "./LoadoutPanel";
import "./App.css";

function commandId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `ui-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function App({ runtime }: { runtime: RuntimePort }) {
  const [state, setState] = useState<GameState>(() => runtime.getState());
  const [message, setMessage] = useState("");
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
  const phaseLabel = { ready: "准备中", battle: "战斗中", reward: "选择奖励", defeat: "领地失守" }[state.phase];
  return <main className="game-shell">
    <header className="game-header"><div><p className="eyebrow">WAND DEFENSE · 试玩</p><h1>法杖守城</h1></div><div className="game-meta"><span>第 {state.wave} 波 · {phaseLabel}</span><span>金币 {state.coins}</span><span>经验 {state.xp}</span></div></header>
    <div className="game-actions">
      {state.phase === "ready" && <Button onClick={() => send({ type: "startWave" })}>开始下一波</Button>}
      {state.phase === "battle" && !state.backpackOpen && <Button variant="secondary" onClick={() => send({ type: "setPaused", paused: !state.paused })}>{state.paused ? "继续战斗" : "暂停"}</Button>}
      {state.phase !== "defeat" && <Button variant="outline" onClick={() => send({ type: "setBackpack", open: !state.backpackOpen })}>{state.backpackOpen ? "收起背包" : "打开背包"}</Button>}
      {state.backpackOpen && <span className="status">背包打开 · 游戏暂停</span>}
    </div>
    <details className="game-cheats"><summary>调试选项</summary><p>作弊功能需在本机明确解锁。</p>{!state.cheats.unlocked ? <Button variant="outline" onClick={() => send({type:"unlockCheats"})}>解锁作弊</Button> : <><Button variant="outline" onClick={() => send({type:"setCheats", enabled: !state.cheats.enabled})}>{state.cheats.enabled ? "关闭作弊" : "启用作弊"}</Button>{state.cheats.enabled && <Button variant="secondary" onClick={() => send({type:"cheat", action:"heal"})}>恢复领地</Button>}</>}</details>
    {message && <p className="game-message" role="alert">{message}</p>}
    <div className="game-content"><Battlefield state={state} />
      {state.backpackOpen && <LoadoutPanel state={state} dispatch={dispatch} />}
      {state.phase === "reward" && <section className="reward-panel" aria-labelledby="reward-heading"><p className="eyebrow">WAVE COMPLETE</p><h2 id="reward-heading">选择一份奖励</h2><p>整理好法杖后，领取奖励继续旅程。</p><div className="reward-list">{state.rewards.map(reward => <Button key={reward.id} variant="outline" onClick={() => send({type:"claimReward", rewardId:reward.id})}>{reward.label}</Button>)}</div></section>}
      {state.phase === "defeat" && <section className="reward-panel"><h2>领地失守</h2><p>本次抵达第 {state.wave} 波。</p></section>}
    </div>
  </main>;
}
