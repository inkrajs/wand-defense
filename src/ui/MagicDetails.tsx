import { useLayoutEffect, useRef } from "react";
import { PencilIcon, PencilText, type PencilIconPath } from "@inkra/react";
import type { GameState } from "../contracts";
import { demoContent } from "../content/demo";
import { elementAppearances } from "../content/elements";
import { gradeDefinitions } from "../content/grades";
import { enrichMagicReward } from "../content/magicDescriptions";
import { AssetImage, resolveAsset } from "./assets";
import { getMagicPresentationIcon, MagicPresentationIcon } from "./magicPresentationIcons";
import { PanelBackdrop } from "./PanelBackdrop";
import "./MagicDetails.css";

type Props = { state: GameState; itemId: string; onClose: () => void };
const icons: Record<string, readonly PencilIconPath[]> = {
  等级: [{ d: "M4 19V5m0 14h16M8 15l3-4 3 2 4-6", mode: "stroke" }],
  品质: [{ d: "m12 3 2.5 5.5 6 .6-4.5 4 1.2 6-5.2-3-5.2 3 1.2-6-4.5-4 6-.6Z", mode: "stroke" }],
  元素: [{ d: "M12 3c-2 4-6 7-6 11a6 6 0 0 0 12 0c0-4-4-7-6-11Z", mode: "stroke" }],
  基础威力: [{ d: "M5 19 19 5m-2 0h2v2M4 16l4 4", mode: "stroke" }],
  基础法力消耗: [{ d: "M12 3c-2 4-6 7-6 11a6 6 0 0 0 12 0c0-4-4-7-6-11ZM9 14h6", mode: "stroke" }],
  基础冷却: [{ d: "M12 4v2m0 12v2m8-8h-2M6 12H4m8-4v4l3 2", mode: "stroke" }],
  基础射程: [{ d: "M3 12c2.5-4 5.5-6 9-6s6.5 2 9 6c-2.5 4-5.5 6-9 6s-6.5-2-9-6Zm6 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z", mode: "stroke" }],
};

export function MagicDetails({ state, itemId, onClose }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  const item = Object.hasOwn(state.items, itemId) ? state.items[itemId] : undefined;
  const spell = item?.kind === "spell" && Object.hasOwn(demoContent.spells, item.definitionId) ? demoContent.spells[item.definitionId] : undefined;
  const arcana = item?.kind === "arcana" && Object.hasOwn(demoContent.arcana, item.definitionId) ? demoContent.arcana[item.definitionId] : undefined;
  const definition = spell ?? arcana;
  const description = definition && item ? enrichMagicReward({ id: item.id, kind: "item", definitionId: item.definitionId, label: definition.name, grade: item.grade }, demoContent).description : undefined;
  const rows = item && definition ? [
    ["等级", `Lv.${item.level}`],
    ["品质", gradeDefinitions[item.grade].name],
    ...(spell ? [
      ["元素", elementAppearances[spell.element].name],
      ...(Number.isFinite(spell.power) ? [["基础威力", String(spell.power)]] : []),
      ...(Number.isFinite(spell.manaCost) ? [["基础法力消耗", String(spell.manaCost)]] : []),
      ...(Number.isFinite(spell.cooldownMs) ? [["基础冷却", `${spell.cooldownMs / 1000} 秒`]] : []),
      ...(Number.isFinite(spell.range) ? [["基础射程", String(spell.range)]] : []),
    ] : []),
  ] : [];

  useLayoutEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = dialog.current;
    node?.focus({ preventScroll: true });
    return () => {
      if (node && (document.activeElement === node || node.contains(document.activeElement)) && previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [itemId]);

  return <div ref={dialog} className="magic-details" role="region" aria-label={definition?.name ?? "魔法详情"} tabIndex={-1} onClick={onClose} onKeyDown={event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
  }}>
    <div className="magic-details__content">
      <PanelBackdrop>
        {item && definition ? <div className="magic-details__body">
          <div className="magic-details__icon" aria-hidden="true">{getMagicPresentationIcon(item.definitionId)
            ? <MagicPresentationIcon definitionId={item.definitionId} size={72} seed={`magic-details-${item.id}`} />
            : <AssetImage asset={resolveAsset(definition.asset, { label: definition.name, icon: "◇" })} />}</div>
          <PencilText as="h2" className="magic-details__name">{definition.name}</PencilText>
          {description && <PencilText as="p" className="magic-details__description">{description}</PencilText>}
          <dl className="magic-details__stats">{rows.map(([label, value]) => <div key={label}><dt><PencilIcon paths={icons[label]} sourceSize={24} size={24} seed={`magic-detail-${label}`} decorative /><PencilText as="span">{label}</PencilText></dt><dd><PencilText as="span">{value}</PencilText></dd></div>)}</dl>
        </div> : <PencilText as="p" className="magic-details__missing">魔法不可用</PencilText>}
      </PanelBackdrop>
    </div>
  </div>;
}
