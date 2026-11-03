import { useEffect, useRef, useState } from "react";
import { Button } from "@inkra/react";
import { demoContent } from "../content/demo";
import type { Command, CommandResult, GameState, RuntimePort } from "../contracts";
import "./ConstructDeployment.css";

type Props = { state: GameState; characterId: string; runtime: RuntimePort; dispatch: (command: Command) => CommandResult; enabled: boolean };
const id = () => globalThis.crypto?.randomUUID?.() ?? `deploy-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function ConstructDeployment({ state, characterId, runtime, dispatch, enabled }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [cursor, setCursor] = useState({ x: 50, y: 50 });
  const resume = useRef(false);
  const run = useRef(state.id);
  const target = useRef<HTMLButtonElement>(null);
  const character = state.characters.find(entry => entry.id === characterId);
  const options = (character?.wandIds ?? []).flatMap(wandId => state.wands.find(wand => wand.id === wandId)?.placements ?? []).flatMap(({ itemId }) => {
    const item = state.items[itemId];
    const spell = item?.kind === "spell" ? demoContent.spells[item.definitionId] : undefined;
    return spell?.construct && (spell.effect === "summon" || spell.effect === "building") ? [{ itemId, spell }] : [];
  });
  const available = enabled && state.phase !== "defeat";
  function finish() {
    const current = runtime.getState();
    if (resume.current && enabled && current.id === run.current && current.phase === "battle" && current.paused && !current.backpackOpen) {
      dispatch({ id: id(), type: "setPaused", paused: false });
    }
    resume.current = false;
    setSelected(null);
  }
  useEffect(() => {
    if (selected && (!available || state.id !== run.current || !options.some(option => option.itemId === selected))) finish();
  });
  useEffect(() => { if (selected) target.current?.focus(); }, [selected]);
  function begin(itemId: string) {
    const current = runtime.getState();
    run.current = current.id;
    resume.current = current.phase === "battle" && !current.paused;
    if (resume.current && dispatch({ id: id(), type: "setPaused", paused: true }).status !== "executed") { resume.current = false; return; }
    setCursor({ x: 50, y: 50 });
    setSelected(itemId);
  }
  function place(x: number, y: number) {
    if (!selected) return;
    const result = dispatch({ id: id(), type: "deployConstruct", characterId, itemId: selected, x: clamp(x), y: clamp(y) });
    if (result.status === "executed") finish();
  }
  if (!available || options.length === 0) return null;
  return <>
    {!selected && <div className="construct-deployment__choices" aria-label="部署召唤物与建筑">
      {options.map(({ itemId, spell }) => <Button key={itemId} size="sm" variant="ghost" onClick={() => begin(itemId)}>{`部署 ${spell.name}`}</Button>)}
    </div>}
    {selected && <>
      <button ref={target} type="button" className="construct-deployment__field" aria-label={`选择部署位置，当前 ${Math.round(cursor.x)}，${Math.round(cursor.y)}。方向键移动，回车确认，Esc 取消`} onClick={event => {
        if (event.detail === 0) { place(cursor.x, cursor.y); return; }
        const rect = event.currentTarget.getBoundingClientRect();
        place((event.clientX - rect.left) / rect.width * 100, (event.clientY - rect.top) / rect.height * 100);
      }} onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); finish(); return; }
        const delta = event.shiftKey ? 10 : 1;
        const moves: Record<string, [number, number]> = { ArrowLeft: [-delta, 0], ArrowRight: [delta, 0], ArrowUp: [0, -delta], ArrowDown: [0, delta] };
        const move = moves[event.key];
        if (move) { event.preventDefault(); setCursor(point => ({ x: clamp(point.x + move[0]), y: clamp(point.y + move[1]) })); }
      }}><span className="construct-deployment__cursor" style={{ left: `${cursor.x}%`, top: `${cursor.y}%` }} aria-hidden="true">＋</span></button>
      <div className="construct-deployment__prompt"><span>选择部署位置</span><Button size="sm" variant="ghost" onClick={finish}>取消</Button></div>
    </>}
  </>;
}
