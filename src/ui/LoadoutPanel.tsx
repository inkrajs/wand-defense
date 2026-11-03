import { GameTabsList } from "./GameTabsList";
import { useMemo, useState } from "react";
import { Button, PencilIcon, PencilSurface, PencilText, Tabs } from "@inkra/react";
import type { Command, CommandResult, GameState } from "../contracts";
import { demoContent } from "../content/demo";
import { placementCells } from "../loadout/geometry";
import "./LoadoutPanel.css";
import { AssetImage, resolveAsset } from "./assets";

const backpackTabIcon = [{d:"M4 8h16v12H4zM8 8V5h8v3",mode:"stroke" as const}];
const wandTabIcon = [{d:"M5 19 19 5M16 4l3 1 1 3",mode:"stroke" as const}];
type Props = { activeCharacterId: string; onCharacterChange: (id: string) => void; state: GameState; dispatch: (command: Command) => CommandResult; mode: "backpack" | "wand"; onModeChange: (mode: "backpack" | "wand") => void };
type NewCommand = Command extends infer C ? C extends Command ? Omit<C, "id"> : never : never;

// Definitions are intentionally optional: the UI can render a save while the
// content module is being integrated, and switches to its public catalog once present.
type Definition = { id: string; name?: string; asset?: { key: string; label: string; icon?: string; color?: string }; shape?: { x: number; y: number }[] };
type Catalog = { spells?: Record<string, Definition>; arcana?: Record<string, Definition>; recipes?: { id: string; name?: string; inputs?: string[] }[] };
export function LoadoutPanel({ state, dispatch, mode, onModeChange, activeCharacterId, onCharacterChange }: Props) {
  const catalog = useMemo(() => demoContent as Catalog, []);
  const character = state.characters.find((entry) => entry.id === activeCharacterId) ?? state.characters[0];
  const ownedWands = state.wands.filter((wand) => wand.characterId === character?.id);
  const [wandId, setWandId] = useState(ownedWands[0]?.id ?? state.wands[0]?.id ?? "");
  const wand = state.wands.find((entry) => entry.id === wandId) ?? ownedWands[0] ?? state.wands[0];
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedMergeIds, setSelectedMergeIds] = useState<string[]>([]);
  const [recipeId, setRecipeId] = useState(state.knowledge.recipeIds[0] ?? "");
  const [rotation, setRotation] = useState<0 | 1 | 2 | 3>(0);
  const [result, setResult] = useState<CommandResult | null>(null);
  const defs = { ...catalog.spells, ...catalog.arcana };
  const recipes = catalog.recipes ?? [];
  const recipeIds = state.knowledge.recipeIds;

  function send(command: NewCommand) {
    const next = dispatch({ ...command, id: `ui-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` } as Command);
    setResult(next);
    if (next.status === "executed" && command.type === "mergeRecipe") setSelectedMergeIds([]);
    if (next.status === "executed" && command.type === "placeItem") setSelectedItemId("");
  }
  function itemName(id: string) {
    const instance = state.items[id];
    const def = instance ? defs[instance.definitionId] : undefined;
    return resolveAsset(def?.asset, { label: def?.name ?? instance?.definitionId ?? id, icon: "✦" }).label;
  }
  function toggleMerge(id: string) {
    setSelectedMergeIds((old) => old.includes(id) ? old.filter((entry) => entry !== id) : [...old, id]);
  }
  function handleCell(x: number, y: number) {
    if (!wand) return;
    const placed = wand.placements.find((placement) => {
      const item = state.items[placement.itemId];
      const shape = item && defs[item.definitionId]?.shape;
      return placementCells(shape?.length ? shape : [{ x: 0, y: 0 }], placement).some((cell) => cell.x === x && cell.y === y);
    });
    if (placed) {
      send({ type: "removeItem", wandId: wand.id, itemId: placed.itemId });
      return;
    }
    if (selectedItemId) send({ type: "placeItem", wandId: wand.id, itemId: selectedItemId, x, y, rotation });
  }

  return <PencilSurface as="section" variant="paper" seed="loadout" radius={6} className={`loadout loadout--${mode}`} aria-label="构筑与背包">
    <header className="loadout__header">
      <div><p className="loadout__eyebrow">LOADOUT · 整理构筑</p><PencilText as="h2" seed="loadout-heading">{mode === "wand" ? "法杖工坊" : "背包"}</PencilText><PencilText as="p" className="sr-only" seed="loadout-help">选择角色、法杖与物品，再点选空格放置或已装备物品移除。</PencilText></div>
      <div className="loadout__header-actions">
        {character && <span className="loadout__mana">法力 {Math.floor(character.mana)} / {character.maxMana} · 经验 {character.xp ?? 0}</span>}
        <Button variant={state.backpackOpen ? "primary" : "secondary"} onClick={() => send({ type: "setBackpack", open: !state.backpackOpen })}>{state.backpackOpen ? "返回游戏" : "打开背包"}</Button>
      </div>
    </header>

    <Tabs.Root value={mode} onValueChange={value => onModeChange(value as "backpack" | "wand")}><GameTabsList className="loadout__tabs" aria-label="构筑视图"><Tabs.Trigger value="backpack" startIcon={<PencilIcon paths={backpackTabIcon} size={32} sourceSize={24} seed="loadout-bag" decorative />}>背包</Tabs.Trigger><Tabs.Trigger value="wand" startIcon={<PencilIcon paths={wandTabIcon} size={32} sourceSize={24} seed="loadout-wand" decorative />}>法杖</Tabs.Trigger></GameTabsList><Tabs.Content value={mode}>
    <div className="loadout__selectors">
      <label>角色<select value={character?.id ?? ""} onChange={(event) => { onCharacterChange(event.target.value); setSelectedMergeIds([]); const next = state.wands.find((entry) => entry.characterId === event.target.value); if (next) setWandId(next.id); }}>
        {state.characters.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · Lv.{entry.level}</option>)}</select></label>
      <label>法杖<select value={wand?.id ?? ""} onChange={(event) => { setWandId(event.target.value); setSelectedMergeIds([]); }}>
        {state.wands.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {entry.width}×{entry.height}</option>)}</select></label>
      {wand && character && wand.characterId !== character.id && <Button variant="outline" onClick={() => send({ type: "equipWand", wandId: wand.id, characterId: character.id })}>装备给此角色</Button>}
    </div>

    <div className="loadout__layout">
      <section className="loadout__section loadout__wand">
        <div className="loadout__section-title"><div><PencilText as="h3" seed="wand-heading">{wand?.name ?? "法杖格子"}</PencilText><p>等级 {wand?.level ?? "—"} · 品级 {wand?.grade ?? "—"}</p></div>
          <Button variant="outline" onClick={() => setRotation((value) => ((value + 1) % 4) as 0 | 1 | 2 | 3)}>旋转：{rotation * 90}°</Button>
        </div>
        {wand ? <div className="loadout__grid" role="group" aria-label={`${wand.name} 格子`} style={{ "--cols": wand.width } as React.CSSProperties}>
          {Array.from({ length: wand.width * wand.height }, (_, index) => {
            const x = index % wand.width; const y = Math.floor(index / wand.width);
            const placement = wand.placements.find((entry) => {
              const item = state.items[entry.itemId];
              const definition = item ? defs[item.definitionId] : undefined;
              const shape = definition?.shape?.length ? definition.shape : [{ x: 0, y: 0 }];
              return placementCells(shape, entry).some((cell) => cell.x === x && cell.y === y);
            });
            return <button type="button" key={`${x}-${y}`} className={`loadout__cell${placement ? " is-filled" : ""}`} onClick={() => handleCell(x, y)} aria-label={placement ? `${x + 1}列${y + 1}行，${itemName(placement.itemId)}，点击移除` : `${x + 1}列${y + 1}行，${selectedItemId ? "点击放置选中物品" : "空格"}`}>
              <span className="loadout__coord">{x + 1}.{y + 1}</span>{placement && <><strong><AssetImage asset={resolveAsset(defs[state.items[placement.itemId]?.definitionId]?.asset, { label: itemName(placement.itemId), icon: "✦" })} /></strong><span>{itemName(placement.itemId)}</span></>}
            </button>;
          })}
        </div> : <p className="loadout__empty">尚无可用法杖。</p>}
        <PencilText as="p" className="loadout__hint sr-only" seed="grid-help">选中背包物品后点空格放置；点已占用格移除。布局校验由运行时处理。</PencilText>
      </section>

      <section className="loadout__section loadout__backpack">
        <div className="loadout__section-title"><div><PencilText as="h3" seed="inventory-heading">背包</PencilText><p>{state.backpack.length} 件可用物品</p></div></div>
        <div className="loadout__inventory" role="list" aria-label="背包物品">
          {state.backpack.map((id) => { const item = state.items[id]; if (!item) return null; const selected = selectedItemId === id;
            return <div className={`loadout__item${selected ? " is-selected" : ""}`} key={id} role="listitem">
              <button type="button" className="loadout__item-select" aria-pressed={selected} onClick={() => setSelectedItemId(selected ? "" : id)}><span className="loadout__item-icon"><AssetImage asset={resolveAsset(defs[item.definitionId]?.asset, { label: itemName(id), icon: item.kind === "spell" ? "✦" : "◇" })} /></span><span><strong>{itemName(id)}</strong><small>{item.kind === "spell" ? "法术" : "奥术修饰"} · Lv.{item.level} · {item.grade}</small></span></button>
              <button type="button" className={`loadout__merge-pick${selectedMergeIds.includes(id) ? " is-selected" : ""}`} onClick={() => toggleMerge(id)} aria-pressed={selectedMergeIds.includes(id)}>合成选取</button>
            </div>;
          })}
          {!state.backpack.length && <p className="loadout__empty">背包暂时为空。</p>}
        </div>
        <div className="loadout__merge">
          {wand && wand.placements.length > 0 && <div><p>选取法杖上已放置的合成材料：</p>{wand.placements.map((placement) => <Button key={placement.itemId} variant={selectedMergeIds.includes(placement.itemId) ? "primary" : "outline"} aria-pressed={selectedMergeIds.includes(placement.itemId)} onClick={() => toggleMerge(placement.itemId)}>{itemName(placement.itemId)}</Button>)}</div>}
          <div><PencilText as="h4" seed="merge-heading">配方合成</PencilText><PencilText as="p" className="sr-only" seed="merge-help">由运行时确认配方、相邻条件与材料消耗。</PencilText></div>
          <label className="sr-only" htmlFor="loadout-recipe">选择配方</label><select id="loadout-recipe" value={recipeId} onChange={(event) => setRecipeId(event.target.value)}>
            {recipeIds.map((id) => <option key={id} value={id}>{recipes.find((recipe) => recipe.id === id)?.name ?? id}</option>)}
            {!recipeIds.length && <option value="">没有已知配方</option>}
          </select>
          <Button disabled={!recipeId || !selectedMergeIds.length || !wand} onClick={() => { if (wand && recipeId) send({ type: "mergeRecipe", wandId: wand.id, recipeId, itemIds: selectedMergeIds }); }}>合成所选 ({selectedMergeIds.length})</Button>
        </div>
      </section>
    </div>
    <footer className="loadout__footer">
      <span className="loadout__state">{state.paused ? "战斗已暂停" : state.phase === "battle" ? "战斗进行中" : `当前阶段：${state.phase}`}</span>

      {result && <output className={`loadout__result sr-only is-${result.status}`} aria-live="polite" data-command-status={result.status} data-command-code={result.code}>{result.status === "rejected" ? `操作未执行：${result.message ?? result.code ?? "操作被拒绝"}` : result.status === "accepted" ? "操作已提交，等待处理。" : "操作已完成。"}</output>}
    </footer>
  </Tabs.Content></Tabs.Root></PencilSurface>;
}
