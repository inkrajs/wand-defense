import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Button, PencilIcon, PencilText } from "@inkra/react";
import type { CharacterStatBonuses, CommandResult, GameState } from "../contracts";
import { demoContent } from "../content/demo";
import { elementAppearances } from "../content/elements";
import { gradeDefinitions, gradePower } from "../content/grades";
import { enrichMagicReward } from "../content/magicDescriptions";
import { AssetImage, resolveAsset } from "./assets";
import { GearPresentationIcon, getGearPresentationIcon } from "./gearPresentationIcons";
import { getSupplyPresentationIcon, SupplyPresentationIcon } from "./supplyPresentationIcons";
import { PanelBackdrop } from "./PanelBackdrop";
import { WandPreview } from "./WandMiniatures";

export function hasInventoryDetail(state: GameState, id: string): boolean {
  return Object.hasOwn(state.items, id) || Object.hasOwn(state.gear ?? {}, id)
    || Object.hasOwn(state.supplies ?? {}, id) || state.wands.some(wand => wand.id === id);
}

export function InventoryDetailScreen({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const back = useRef<HTMLButtonElement>(null);
  const touchHit = useRef<Element | null>(null);
  useLayoutEffect(() => { back.current?.focus({ preventScroll: true }); }, []);
  return <div className="inventory-detail-screen" role="dialog" aria-modal="true" aria-label="物品详情" onKeyDown={event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
  }}>
    <header className="inventory-detail-screen__header">
      <Button ref={back} type="button" variant="ghost" onClick={onClose}>
        <PencilIcon paths={[{ d: "m13 5-7 7 7 7M6 12h13", mode: "stroke" }]} sourceSize={24} size={24} decorative />返回
      </Button>
    </header>
    <div className="inventory-detail-screen__scroll" onPointerDownCapture={() => { touchHit.current = null; }}
      onPointerUpCapture={event => {
        // A touch click can be snapped to nearby content even when the finger landed in the gap.
        if (event.pointerType === "touch") touchHit.current = document.elementFromPoint(event.clientX, event.clientY);
      }}
      onClick={event => {
        const target = event.detail > 0 ? touchHit.current ?? event.target : event.target;
        touchHit.current = null;
        const control = "button, a, input, select, textarea, [role='button']";
        if (!(target instanceof Element) || !(event.target instanceof Element)
          || target.closest(control) || event.target.closest(control)) return;
        if (target === event.currentTarget || target.matches(".inventory-detail-screen__page") || target.closest("[data-dismiss-detail]")) onClose();
      }}>
      <div className="inventory-detail-screen__page">{children}</div>
    </div>
  </div>;
}

type Row = [string, string];
const numberFormat = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
const fmt = (value: number) => numberFormat.format(value);
const statLabels = {
  attack: ["攻击", 1, ""], maxMana: ["法力上限", 1, ""], manaRegen: ["法力回复", 1, "/秒"],
  range: ["射程", 1, ""], castSpeedPercent: ["施法速度", 1, "%"], projectileSpeedPercent: ["弹速", 1, "%"],
  accuracy: ["命中率", 100, "%"], critChance: ["暴击率", 100, "%"], critMultiplier: ["暴击倍率", 1, "倍"],
  luck: ["幸运", 1, ""], gatheringPercent: ["采集", 1, "%"],
} as const;
function statRows(stats?: CharacterStatBonuses): Row[] {
  if (!stats) return [];
  const rows: Row[] = [];
  for (const [key, [label, scale, suffix]] of Object.entries(statLabels)) {
    const amount = stats[key as keyof typeof statLabels];
    if (typeof amount === "number" && amount !== 0) rows.push([label, `${amount > 0 ? "+" : ""}${fmt(amount * scale)}${suffix}`]);
  }
  for (const [element, appearance] of Object.entries(elementAppearances)) {
    const amount = stats.elementBonuses?.[element as keyof typeof elementAppearances];
    if (typeof amount === "number" && amount !== 0) rows.push([`${appearance.name}系威力`, `${amount > 0 ? "+" : ""}${fmt(amount * 100)}%`]);
  }
  return rows;
}

export function InventoryEntityDetails({ state, itemId, onUseSupply }: { state: GameState; itemId: string; onUseSupply: () => CommandResult }) {
  const wand = state.wands.find(entry => entry.id === itemId);
  const gear = state.gear?.[itemId];
  const supply = state.supplies?.[itemId];
  const entity = wand ?? gear ?? supply;
  if (!entity) return null;
  const rows: Row[] = [["等级", `Lv.${entity.level}`], ["品质", gradeDefinitions[entity.grade]?.name ?? "未知"]];
  let name: string;
  let icon: ReactNode;
  let extra: ReactNode;
  if (wand) {
    name = wand.name;
    rows.push(["法杖尺寸", `${wand.width} × ${wand.height}`], ["已装魔法", String(wand.placements.length)], ...statRows(wand.statBonuses));
    icon = <WandPreview state={state} wand={wand} size={144} detailMode />;
    const installed = wand.placements.flatMap(({ itemId }) => {
      const item = state.items[itemId];
      if (!item) return [];
      const definition = item.kind === "spell" ? demoContent.spells[item.definitionId] : demoContent.arcana[item.definitionId];
      if (!definition) return [];
      const info = enrichMagicReward({ id: item.id, kind: "item", definitionId: definition.id, label: definition.name, grade: item.grade }, demoContent);
      return [{ item, info }];
    });
    if (installed.length) extra = <ul className="inventory-detail-screen__installed" aria-label="已装魔法">{installed.map(({ item, info }) => <li key={item.id}>
      <PencilText as="strong">{info.label}</PencilText><PencilText as="span">{`Lv.${item.level} · ${gradeDefinitions[item.grade].name}`}</PencilText>
      {info.description && <PencilText as="p">{info.description}</PencilText>}
    </li>)}</ul>;
  } else if (gear) {
    const definition = gear.definitionId ? demoContent.gear?.[gear.definitionId] : undefined;
    name = definition?.name ?? gear.name;
    const slots = { head: "头部", body: "身体", feet: "足部", accessory: "饰品" };
    rows.push(["装备部位", slots[gear.slot]], ...statRows(gear.statBonuses));
    icon = gear.definitionId && getGearPresentationIcon(gear.definitionId)
      ? <GearPresentationIcon definitionId={gear.definitionId} size={72} />
      : <AssetImage asset={resolveAsset(definition?.asset, { label: name, icon: "◇" })} />;
  } else {
    const definition = demoContent.items?.[supply!.definitionId];
    name = definition?.name ?? "道具";
    icon = definition && getSupplyPresentationIcon(definition.id) ? <SupplyPresentationIcon definitionId={definition.id} size={72} />
      : <AssetImage asset={resolveAsset(definition?.asset, { label: name, icon: "◇" })} />;
    if (definition) {
      const type = definition.effect.type;
      const percentage = type === "partyManaPercent" || type === "territoryHealPercent" || type === "territoryShieldPercent";
      const scaled = definition.effect.value * gradePower[supply!.grade] / gradePower[definition.grade];
      const value = fmt(percentage ? Math.min(100, scaled) : type === "cooldownAdvance" ? scaled / 1000 : scaled);
      rows.push(["效果", definition.asset.label], ["效果数值", `${value}${percentage ? "%" : type === "cooldownAdvance" ? " 秒" : ""}`]);
      extra = <Button type="button" disabled={state.phase === "defeat" || (state.phase === "battle" && !state.paused)} onClick={onUseSupply}>使用道具</Button>;
    }
  }
  return <section className="magic-details" aria-label={name}>
    <PanelBackdrop><div className="magic-details__body">
      <div className="inventory-detail-screen__icon" aria-hidden="true">{icon}</div>
      <PencilText as="h2" className="magic-details__name">{name}</PencilText>
      <dl className="magic-details__stats">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {extra}
    </div></PanelBackdrop>
  </section>;
}
