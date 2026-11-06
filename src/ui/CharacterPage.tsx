import { GameTabsList } from "./GameTabsList";
import type { CharacterTab } from "./uiSession";
import { useMemo, useRef, useState } from "react";
import { PencilIcon, PencilSurface, PencilText, Radar, Tabs, Tooltip } from "@inkra/react";
import type { RadarAxis, RadarSeries } from "@inkra/react/radar";
import type { Command, CommandResult, Element, GameState, GearInstance, GearSlot, Grade, WandInstance } from "../contracts";
import { demoContent } from "../content/demo";
import { gradeDefinitions } from "../content/grades";
import { getCharacterStats } from "../content/characters";
import { getGatheringStats } from "../content/economy";
import { getCharacterGrowth } from "../content/characterGrowth";
import { gearDefinitions } from "../content/gear";
import { AssetImage, resolveAsset } from "./assets";
import { GearPresentationIcon, getGearPresentationIcon } from "./gearPresentationIcons";
import { CharacterPresentationIcon } from "./characterPresentationIcons";
import { WandPreview } from "./WandMiniatures";
import "./CharacterPage.css";

export type CharacterPageTab = CharacterTab;
type Props = { state: GameState; dispatch: (command: Command) => CommandResult; activeCharacterId: string; showLoadout?: boolean; loadoutCategory?: "items" | "equipment"; tab?: CharacterPageTab; onTabChange?: (tab: CharacterPageTab) => void };

const pathwayNames: Record<string, string> = { fire: "火之途径", wood: "木之途径", metal: "金之途径", water: "水之途径", earth: "土之途径", light: "光之途径", dark: "暗之途径", lightning: "雷之途径", wind: "风之途径" };

const headPaths = [{ d: "M4 14a8 8 0 0 1 16 0M6 14h12M8 14v5h8v-5", mode: "stroke" as const }];
const bodyPaths = [{ d: "M7 4h10l3 16H4L7 4Zm0 5h10", mode: "stroke" as const }];
const feetPaths = [{ d: "M6 4v10l-3 4h8v-4L9 4m5 0v10l-2 4h9l-3-4V4", mode: "stroke" as const }];
const accessoryPaths = [{ d: "M12 3 14 9l6 3-6 3-2 6-2-6-6-3 6-3 2-6Z", mode: "stroke" as const }];
const overviewPaths = [{ d: "M3 18 9 12l4 4 8-9M15 7h6v6", mode: "stroke" as const }];
const attributesPaths = [{ d: "M12 3v18M3 12h18M5.6 5.6l12.8 12.8m0-12.8L5.6 18.4", mode: "stroke" as const }];
const radarPaths = [{ d: "M12 2 22 9l-4 12H6L2 9 12 2Zm0 0v20M2 9l20 0M6 21 17 6M18 21 7 6", mode: "stroke" as const }];
const gearQualityPaths = [{ d: "m12 2 2.8 6.2 6.7.6-5.1 4.5 1.5 6.6L12 16.4l-5.9 3.5 1.5-6.6-5.1-4.5 6.7-.6L12 2Z", mode: "stroke" as const }];
const pathwaysPaths = [{ d: "M5 4v6l7 4v6m7-16v6l-7 4", mode: "stroke" as const }];
const growthPaths = [{ d: "M4 19V5m0 14h16M7 15l4-4 3 2 5-7", mode: "stroke" as const }];
const levelPaths = [{ d: "M4 19V5m0 14h16M8 15l3-4 3 2 4-6", mode: "stroke" as const }];
const manaPaths = [{ d: "M12 3c-2 4-6 7-6 11a6 6 0 0 0 12 0c0-4-4-7-6-11Z", mode: "stroke" as const }];
const regenPaths = [{ d: "M20 7v5h-5M4 17v-5h5m9-2a6 6 0 0 0-10-2L4 12m16 0-4 4a6 6 0 0 1-10-2", mode: "stroke" as const }];
const attackPaths = [{ d: "M5 19 19 5m-2 0h2v2M4 16l4 4", mode: "stroke" as const }];
const attackSpeedPaths = [{ d: "M12 4v2m0 12v2m8-8h-2M6 12H4m13.7-5.7-1.4 1.4M7.7 16.3l-1.4 1.4m11.4 0-1.4-1.4M7.7 7.7 6.3 6.3M12 8v4l3 2", mode: "stroke" as const }];
const projectileSpeedPaths = [{ d: "M4 20 15 9m-4 0h4v4M5 5h4M5 9h2M5 13h2", mode: "stroke" as const }];
const rangePaths = [{ d: "M3 12c2.5-4 5.5-6 9-6s6.5 2 9 6c-2.5 4-5.5 6-9 6s-6.5-2-9-6Zm6 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z", mode: "stroke" as const }];
const accuracyPaths = [{ d: "M12 3v4m0 10v4M3 12h4m10 0h4M7 7l2.5 2.5m5 5L17 17m0-10-2.5 2.5m-5 5L7 17m2-5a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z", mode: "stroke" as const }];
const critPaths = [{ d: "m12 3 2.4 5.3 5.8.7-4.3 4 1.1 5.8-5-2.9-5 2.9 1.1-5.8-4.3-4 5.8-.7L12 3Z", mode: "stroke" as const }];
const luckPaths = [{ d: "M12 20C6 17 3 13 4 8c.7-3 4-4 6-1l2 3 2-3c2-3 5.3-2 6 1 1 5-2 9-8 12Z", mode: "stroke" as const }];
const gatheringPaths = [{ d: "M4 14h4l3 3h5l4-5M4 20h4l4 1 8-6M4 13v8M13 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 2v4", mode: "stroke" as const }];
const elementPaths = [{ d: "M12 3c-2 4-6 7-6 11a6 6 0 0 0 12 0c0-4-4-7-6-11Zm-2 12c.4 1.3 1.2 2 2.5 2", mode: "stroke" as const }];
const elementShortNames: Record<Element, string> = { fire: "火系", wood: "木系", metal: "金系", water: "水系", earth: "土系", light: "光系", dark: "暗系", lightning: "雷系", wind: "风系", undead: "亡灵系" };
const elementOrder: Element[] = ["fire", "wood", "metal", "water", "earth", "light", "dark", "lightning", "wind", "undead"];

function statNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}
function signedNumber(value: number): string {
  return `${value >= 0 ? "+" : ""}${statNumber(value)}`;
}
function percent(value: number): string {
  return `${statNumber(value * 100)}%`;
}
function signedPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${percent(value)}`;
}
function resourceCharacterValue(sources: { character: { maxMana: number | null; manaRegen: number | null }; combined: { maxMana: number; manaRegen: number }; status: { maxMana: "derived" | "combined"; manaRegen: "derived" | "combined" } }, key: "maxMana" | "manaRegen"): string {
  if (sources.status[key] === "combined") return Number.isFinite(sources.combined[key]) ? `合计 ${statNumber(sources.combined[key])}` : "—";
  const value = sources.character[key];
  return value !== null && Number.isFinite(value) ? statNumber(value) : "—";
}
function resourceRunValue(sources: { run: { maxMana: number | null; manaRegen: number | null }; status: { maxMana: "derived" | "combined"; manaRegen: "derived" | "combined" } }, key: "maxMana" | "manaRegen"): string {
  if (sources.status[key] === "combined") return "—";
  const value = sources.run[key];
  return value !== null && Number.isFinite(value) && value !== 0 ? signedNumber(value) : "—";
}
const wandPaths = [{ d: "m5 19 14-14M5 5l2 2m2-5 1 3m5 11 3 1m-1-5 3 2", mode: "stroke" as const }];

export function CharacterPage({ state, dispatch: _dispatch, activeCharacterId, showLoadout = false, loadoutCategory, tab: controlledTab, onTabChange }: Props) {
  const [localTab, setLocalTab] = useState<CharacterPageTab>("overview");
  const tab = controlledTab ?? localTab;
  const handleTabChange = (value: string) => {
    const nextTab = value as CharacterPageTab;
    if (controlledTab === undefined) setLocalTab(nextTab);
    onTabChange?.(nextTab);
  };
  const character = state.characters.find((entry) => entry.id === activeCharacterId) ?? state.characters[0];
  const gearLoadout = tab === "equipment" && showLoadout && loadoutCategory === "items";
  const wandLoadout = tab === "equipment" && showLoadout && loadoutCategory === "equipment";
  const knownSequences = useMemo(() => state.knowledge.sequenceIds
    .map((id) => demoContent.sequences[id])
    .filter((sequence) => sequence !== undefined), [state.knowledge.sequenceIds]);
  const characterPathwayId = character ? demoContent.sequences[character.sequenceId]?.pathwayId : undefined;
  const equippedWands = (character?.wandIds ?? []).slice(0, 2).map(id => state.wands.find(wand => wand.id === id && wand.characterId === character?.id));
  const stats = character ? getCharacterStats(state, character.id) : undefined;
  const growth = character ? getCharacterGrowth(character) : undefined;
  const gathering = getGatheringStats(state);
  const knownPathwaySequences = useMemo(() => knownSequences.filter(sequence => sequence.pathwayId === characterPathwayId), [knownSequences, characterPathwayId]);
  const statRows = stats ? [
    { label: "攻击", icon: attackPaths, values: [statNumber(stats.final.attack), signedNumber(stats.base.attack), signedNumber(stats.growth.attack), signedNumber(stats.equipment.attack), `${signedNumber(stats.run.attackPercent)}%`, "—"] },
    { label: "攻速", icon: attackSpeedPaths, values: [`×${statNumber(1 / stats.final.cooldownMultiplier)}`, `${signedNumber(stats.base.castSpeedPercent)}%`, `${signedNumber(stats.growth.castSpeedPercent)}%`, `${signedNumber(stats.equipment.castSpeedPercent)}%`, stats.run.cooldownPercent ? `冷却 ${signedNumber(-stats.run.cooldownPercent)}%` : "—", "—"] },
    { label: "弹速", icon: projectileSpeedPaths, values: [`×${statNumber(stats.final.projectileSpeedMultiplier)}`, `${signedNumber(stats.base.projectileSpeedPercent ?? 0)}%`, `${signedNumber(stats.growth.projectileSpeedPercent)}%`, `${signedNumber(stats.equipment.projectileSpeedPercent ?? 0)}%`, "—", "—"] },
    { label: "射程", icon: rangePaths, values: [statNumber(stats.final.range), signedNumber(stats.base.range), signedNumber(stats.growth.range), signedNumber(stats.equipment.range), stats.run.rangePercent ? `${signedNumber(stats.run.rangePercent)}%` : "—", "—"] },
    { label: "精准", icon: accuracyPaths, values: [percent(stats.final.accuracy), percent(stats.base.accuracy), "—", signedPercent(stats.equipment.accuracy), "—", "—"] },
    { label: "暴击", icon: critPaths, values: [percent(stats.final.critChance), percent(stats.base.critChance), "—", signedPercent(stats.equipment.critChance), "—", "—"] },
    { label: "暴伤", icon: critPaths, values: [`×${statNumber(stats.final.critMultiplier)}`, `×${statNumber(stats.base.critMultiplier)}`, "—", `+${statNumber(stats.equipment.critMultiplier)}`, "—", "—"] },
    { label: "幸运", icon: luckPaths, values: [statNumber(stats.final.totalLuck), statNumber(stats.base.luck), "—", statNumber(stats.equipment.luck), statNumber(state.luck), "—"] },
    { label: "法力", ariaLabel: "法力上限", icon: manaPaths, values: [statNumber(stats.resourceSources.final.maxMana), resourceCharacterValue(stats.resourceSources, "maxMana"), signedNumber(stats.resourceSources.growth.maxMana), signedNumber(stats.resourceSources.equipment.maxMana), resourceRunValue(stats.resourceSources, "maxMana"), "—"] },
    { label: "恢复", icon: regenPaths, values: [`${statNumber(stats.resourceSources.final.manaRegen)}/秒`, resourceCharacterValue(stats.resourceSources, "manaRegen"), signedNumber(stats.resourceSources.growth.manaRegen), signedNumber(stats.resourceSources.equipment.manaRegen), resourceRunValue(stats.resourceSources, "manaRegen"), "—"] },
  ] : [];
  const elementRows = stats ? elementOrder.map((element) => ({
    label: elementShortNames[element], icon: elementPaths,
    values: [signedPercent(stats.final.elementBonuses[element] ?? 0), percent(stats.base.elementBonuses[element] ?? 0), "—", signedPercent(stats.equipment.elementBonuses[element] ?? 0), "—", signedPercent(stats.sequence.elementBonuses[element] ?? 0)],
    calculation: "个人加成与途径加成相乘；实际值已包含计算层的边界限制。",
  })) : [];
  // Keep points in their real units. Radar applies the same (value - min) /
  // (max - min) normalization to each axis; reference ranges are display only.
  const radarMetrics = stats ? [
    { label: "攻击", value: stats.final.attack, reference: 30, format: statNumber },
    { label: "攻速", value: 1 / stats.final.cooldownMultiplier, reference: 3, format: (value: number) => `×${statNumber(value)}` },
    { label: "射程", value: stats.final.range, reference: 48, format: statNumber },
    { label: "弹速", value: stats.final.projectileSpeedMultiplier, reference: 3, format: (value: number) => `×${statNumber(value)}` },
    { label: "精准", value: stats.final.accuracy, reference: 1, format: percent },
    { label: "暴击", value: stats.final.critChance, reference: 1, format: percent },
    { label: "暴伤", value: stats.final.critMultiplier, reference: 4, format: (value: number) => `×${statNumber(value)}` },
    { label: "幸运", value: stats.final.totalLuck, reference: 30, format: statNumber },
    { label: "法力", value: stats.final.maxMana, reference: 300, format: statNumber },
    { label: "恢复", value: stats.final.manaRegen, reference: 36, format: (value: number) => `${statNumber(value)}/秒` },
  ] : [];
  const radarAxes: RadarAxis[] = radarMetrics.map(metric => ({
    id: metric.label, label: metric.label, ariaLabel: metric.label === "法力" ? "法力上限" : metric.label,
    min: metric.value < 0 ? -Math.max(metric.reference, Math.abs(metric.value) * 1.2) : 0,
    max: Math.max(metric.reference, metric.value > metric.reference ? metric.value * 1.2 : metric.reference),
    formatValue: metric.format,
  }));
  const radarSeries: RadarSeries[] = character && stats ? [{ id: character.id, label: character.name,
    data: radarMetrics.map(metric => ({ axisId: metric.label, value: metric.value })),
  }] : [];
  const calculations: Record<string, string> = stats ? {
    攻击: `基础、成长与装备相加后应用本局倍率 ×${statNumber(stats.final.attackMultiplier)}。此值是角色攻击贡献，具体法术另有自身伤害。`,
    攻速: `基础、成长与装备攻速叠加，再应用本局冷却缩减；显示最终冷却倍率 ×${statNumber(stats.final.cooldownMultiplier)} 的倒数。`,
    射程: `角色射程贡献；基础、成长与装备相加后应用本局倍率 ×${statNumber(stats.final.rangeMultiplier)}。具体法术将其加至自身射程，法术自身射程也应用该倍率。`,
    弹速: "基础、成长与装备弹速百分比相加，转换为施加于法术弹速的倍率。",
    精准: "基础与装备相加，实际值限制在 0%～100%。",
    暴击: "基础与装备相加，实际值限制在 0%～100%。",
    暴伤: "基础与装备相加，实际倍率限制在 ×1～×10。",
    幸运: "角色基础与装备相加并取非负值，再叠加本局幸运。",
    法力: stats.resourceSources.status.maxMana === "combined" ? "历史存档无法拆分基础与本局，基础栏显示合计；再叠加成长与装备，实际上限取非负值。" : "基础、本局、成长与装备相加，实际法力上限取非负值。",
    恢复: stats.resourceSources.status.manaRegen === "combined" ? "历史存档无法拆分基础与本局，基础栏显示合计；再叠加成长与装备，实际每秒恢复取非负值。" : "基础、本局、成长与装备相加，实际每秒恢复取非负值。",
  } : {};

  return <section className="character-page" aria-label="角色详情">
    {character ? <div className="character-page__layout">
      <section className="character-page__details" aria-label="角色属性与成长">
        <Tabs.Root orientation="vertical" value={tab} onValueChange={handleTabChange}>
          <GameTabsList className="character-page__tabs" orientation="vertical" aria-label="角色详情标签" fullWidth>
            <Tabs.Trigger value="equipment" aria-label="装备" startIcon={<PencilIcon paths={bodyPaths} size={32} sourceSize={24} seed="equipment-tab" decorative />} />
            <Tabs.Trigger value="overview" aria-label="概览" startIcon={<PencilIcon paths={overviewPaths} size={32} sourceSize={24} seed="overview-tab" decorative />} />
            <Tabs.Trigger value="radar" aria-label="雷达" startIcon={<PencilIcon paths={radarPaths} size={32} sourceSize={24} seed="radar-tab" decorative />} />
            <Tabs.Trigger value="attributes" aria-label="属性" startIcon={<PencilIcon paths={attributesPaths} size={32} sourceSize={24} seed="attributes-tab" decorative />} />
            <Tabs.Trigger value="elements" aria-label="元素" startIcon={<PencilIcon paths={elementPaths} size={32} sourceSize={24} seed="elements-tab" decorative />} />
            <Tabs.Trigger value="pathways" aria-label="途径" startIcon={<PencilIcon paths={pathwaysPaths} size={32} sourceSize={24} seed="pathways-tab" decorative />} />
            <Tabs.Trigger value="growth" aria-label="成长" startIcon={<PencilIcon paths={growthPaths} size={32} sourceSize={24} seed="growth-tab" decorative />} />
          </GameTabsList>
          <Tabs.Content className="character-page__panel character-page__equipment-panel" value="equipment">
      <section className="character-page__equipment" aria-label="角色与装备位">
        <div className="character-page__gear-grid">
          <GearSlot className="character-page__slot--head" icon={headPaths} label="头部" slot="head" state={state} characterId={character.id} loadout={gearLoadout} />
          <GearSlot className="character-page__slot--wand-one" icon={wandPaths} label="法杖位一" item={equippedWands[0]} state={state} loadout={wandLoadout} />
          <div className="character-page__portrait">
            <CharacterPresentationIcon pathwayId={characterPathwayId} characterName={character.name} seed={`portrait-${character.id}`} size={88} />
          </div>
          <GearSlot className="character-page__slot--body" icon={bodyPaths} label="身体" slot="body" state={state} characterId={character.id} loadout={gearLoadout} />
          <GearSlot className="character-page__slot--wand-two" icon={wandPaths} label="法杖位二" item={equippedWands[1]} state={state} loadout={wandLoadout} />
          <GearSlot className="character-page__slot--feet" icon={feetPaths} label="足部" slot="feet" state={state} characterId={character.id} loadout={gearLoadout} />
          <GearSlot className="character-page__slot--accessory" icon={accessoryPaths} label="饰品" slot="accessory" state={state} characterId={character.id} loadout={gearLoadout} />
        </div>
      </section>

          </Tabs.Content>
          <Tabs.Content className="character-page__panel character-page__overview" value="overview">
            <SummaryRow icon={levelPaths} label="等级" value={String(character.level)} seed="overview-level" />
            <SummaryRow icon={manaPaths} label="法力" value={stats ? `${Math.floor(stats.final.mana)} / ${statNumber(stats.final.maxMana)}` : `${Math.floor(character.mana)} / ${character.maxMana}`} seed="overview-mana" />
            {stats && <>
              <SummaryRow icon={attackPaths} label="攻击" value={statNumber(stats.final.attack)} seed="overview-attack" />
              <SummaryRow icon={attackSpeedPaths} label="攻速" value={`×${statNumber(1 / stats.final.cooldownMultiplier)}`} seed="overview-speed" />
              <SummaryRow icon={rangePaths} label="射程" value={statNumber(stats.final.range)} seed="overview-range" />
              <SummaryRow icon={accuracyPaths} label="精准" value={percent(stats.final.accuracy)} seed="overview-accuracy" />
              <SummaryRow icon={critPaths} label="暴击" value={percent(stats.final.critChance)} seed="overview-crit" />
              <SummaryRow icon={luckPaths} label="幸运" value={signedNumber(stats.final.totalLuck)} seed="overview-luck" />
            </>}
          </Tabs.Content>
          <Tabs.Content className="character-page__panel character-page__radar-panel" value="radar">
            {radarAxes.length >= 3 && <Radar className="character-page__radar" axes={radarAxes} series={radarSeries} label={`${character.name}十项真实属性雷达，法力表示上限，各轴按参考范围归一化`} size="100%" showAxes showLabels showValues={false} showTable={false} showLegend={false} levels={4} />}
          </Tabs.Content>
          <Tabs.Content className="character-page__panel character-page__attributes" value="attributes">
            <Tooltip.Provider delayDuration={180}>
              <div className="character-page__attribute-list" aria-label="角色实际属性">
                {statRows.map(row => <AttributeRow key={row.label} {...row} calculation={calculations[row.label]} range={radarAxes.find(axis => axis.id === row.label)} />)}
                <AttributeRow label="采集" icon={gatheringPaths} values={[`${statNumber(gathering.total)}%`]} sources={[
                  { label: "全队基础", value: `${signedNumber(gathering.base)}%` },
                  { label: "全队装备", value: `${signedNumber(gathering.equipment)}%` },
                  { label: "本局", value: `${signedNumber(gathering.run)}%` },
                ]} calculation={`全队基础与有效装备的采集加成汇总，本局加成仅计一次。金币收益倍率 ×${statNumber(gathering.multiplier)}。`} />
              </div>
            </Tooltip.Provider>
          </Tabs.Content>
          <Tabs.Content className="character-page__panel character-page__elements" value="elements">
            <Tooltip.Provider delayDuration={180}>
              <div className="character-page__attribute-list" aria-label="角色实际元素加成">
                {elementRows.map(row => <AttributeRow key={row.label} {...row} />)}
              </div>
            </Tooltip.Provider>
          </Tabs.Content>
          <Tabs.Content className="character-page__panel character-page__pathways" value="pathways">
            {characterPathwayId && <section className="character-page__pathway">
              <PencilText as="h4" seed="known-pathway-name">{pathwayNames[characterPathwayId] ?? characterPathwayId}</PencilText>
              {knownPathwaySequences.map((sequence) => <PencilText as="p" key={sequence.id} seed="known-sequence-name">{`${sequence.name}${sequence.id === character.sequenceId ? " · 当前" : ""}`}</PencilText>)}
            </section>}

          </Tabs.Content>
          <Tabs.Content className="character-page__panel character-page__growth" value="growth" aria-label="角色成长">
            {growth && <>
              <PencilText as="h4" seed="growth-profile">{`成长倾向 · ${growth.name}`}</PencilText>
              <div className="character-page__growth-table" role="table" aria-label="角色成长数据">
                <div className="character-page__growth-row character-page__growth-header" role="row">
                  <PencilText as="span" seed="growth-header-stat" role="columnheader">属性</PencilText>
                  <PencilText as="span" seed="growth-header-per-level" role="columnheader">每级增量</PencilText>
                  <PencilText as="span" seed="growth-header-multiplier" role="columnheader">成长倍率</PencilText>
                  <PencilText as="span" seed="growth-header-total" role="columnheader">累计成长</PencilText>
                </div>
                {([
                  ["攻击", "attack", "number"], ["攻速", "castSpeedPercent", "percent"], ["射程", "range", "number"],
                  ["弹速", "projectileSpeedPercent", "percent"], ["法力", "maxMana", "number"], ["恢复", "manaRegen", "regen"],
                ] as const).map(([label, key, format]) => <GrowthRow key={key} label={label} ariaLabel={key === "maxMana" ? "法力上限" : undefined} perLevel={growth.perLevel[key]} multiplier={growth.multipliers[key]} total={growth.total[key]} format={format} />)}
              </div>
            </>}
          </Tabs.Content>
        </Tabs.Root>
      </section>
    </div> : <PencilText as="p" className="sr-only" seed="character-empty">尚无角色。</PencilText>}
  </section>;
}

function SummaryRow({ icon, label, value, seed }: { icon: readonly { d: string; mode?: "stroke" }[]; label: string; value: string; seed: string }) {
  return <div className="character-page__summary-row">
    <PencilIcon paths={icon} size={24} sourceSize={24} seed={`${seed}-icon`} decorative />
    <PencilText as="span" seed={`${seed}-label`}>{label}</PencilText>
    <PencilText as="strong" seed={`${seed}-value`}>{value}</PencilText>
  </div>;
}

type BreakdownValues = { label: string; ariaLabel?: string; icon: readonly { d: string; mode?: "stroke" }[]; values: string[] };

function AttributeRow({ label, ariaLabel, icon, values, calculation, range, sources }: BreakdownValues & { calculation?: string; range?: RadarAxis; sources?: readonly { label: string; value: string }[] }) {
  const [open, setOpen] = useState(false);
  const pointerOpen = useRef<boolean | null>(null);
  return <Tooltip.Root open={open} onOpenChange={setOpen}>
    <Tooltip.Trigger className="character-page__summary-row character-page__attribute-trigger" aria-label={`${ariaLabel ?? label} ${values[0]}，查看来源与计算`} onPointerDown={() => { pointerOpen.current = open; }} onPointerCancel={() => { pointerOpen.current = null; }} onKeyDown={() => { pointerOpen.current = null; }} onClick={event => { event.preventDefault(); setOpen(!(pointerOpen.current ?? open)); pointerOpen.current = null; }}>
      <PencilIcon paths={icon} size={24} sourceSize={24} seed={`attribute-${label}-icon`} decorative />
      <PencilText as="span" seed={`attribute-${label}-label`}>{label}</PencilText>
      <PencilText as="strong" seed={`attribute-${label}-value`}>{values[0]}</PencilText>
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content className="character-page__attribute-tooltip" side="bottom" collisionPadding={12}>
        <strong>{ariaLabel ?? label} · {values[0]}</strong>
        <dl>{(sources ?? ["基础", "成长", "装备", "本局", "途径"].map((source, index) => ({ label: source, value: values[index + 1] }))).map(source => <div key={source.label}><dt>{source.label}</dt><dd>{source.value}</dd></div>)}</dl>
        <p>{calculation}</p>
        {range && <p>雷达参考：{range.formatValue?.(range.min ?? 0)}～{range.formatValue?.(range.max ?? 1)}；各轴按参考范围归一化，超出时扩展范围。</p>}
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>;
}

function GearSlot({ className, icon, label, slot, item, state, characterId, loadout = false }: { className: string; icon: readonly { d: string; mode?: "stroke" }[]; label: string; slot?: GearSlot; item?: WandInstance; state: GameState; characterId?: string; loadout?: boolean }) {
  const gearId = slot && characterId ? state.characters.find((character) => character.id === characterId)?.gearIds?.[slot] : undefined;
  const candidate = gearId ? state.gear?.[gearId] : undefined;
  const equippedGear: GearInstance | undefined = candidate && candidate.id === gearId && candidate.characterId === characterId && candidate.slot === slot ? candidate : undefined;
  const definition = equippedGear ? gearDefinitions[equippedGear.definitionId ?? equippedGear.id] : undefined;
  const presentationId = equippedGear?.definitionId ?? equippedGear?.id;
  const hasGearPresentation = Boolean(presentationId && getGearPresentationIcon(presentationId));
  const hasGearPreview = Boolean(equippedGear && definition);
  const accessibleDescription = item ? `${label}：${item.name}，${item.width}×${item.height}，等级 ${item.level}，${gradeDefinitions[item.grade].name}` : equippedGear ? `${label}：${equippedGear.name}，${gradeDefinitions[equippedGear.grade].name}，等级 ${equippedGear.level}` : `${label}：空装备位`;
  const grade = item?.grade ?? equippedGear?.grade;
  return <PencilSurface as="div" style={grade ? { "--inkra-accent-strong": gradeDefinitions[grade].color } as React.CSSProperties : undefined} className={`character-page__gear-slot ${className}${loadout ? " is-loadout" : ""}`} variant="outline" seed={`gear-slot-${className}`} radius={8} role={loadout ? "group" : "img"} aria-label={accessibleDescription} data-character-wand-slot={loadout && !slot ? label : undefined} data-character-gear-slot={slot}>
    {item ? <span className="character-page__gear-slot-preview" aria-hidden="true"><WandPreview state={state} wand={item} size={44} /></span> : hasGearPreview && equippedGear && definition ? <span className="character-page__gear-slot-preview character-page__gear-art" aria-hidden="true" style={{ color: definition.asset.color }}>{hasGearPresentation && presentationId ? <GearPresentationIcon definitionId={presentationId} size={36} seed={`character-gear-${equippedGear.id}`} /> : <AssetImage asset={resolveAsset(definition.asset, { label: equippedGear.name, icon: equippedGear.name.slice(0, 1) || "◇" })} />}</span> : <PencilIcon paths={icon} sourceSize={24} size={32} className="character-page__gear-slot-icon" decorative />}
    {slot && equippedGear && <span className="character-page__gear-quality" aria-hidden="true" style={{ color: gradeDefinitions[equippedGear.grade].color }}><PencilIcon paths={gearQualityPaths} size={12} sourceSize={24} decorative /></span>}
  </PencilSurface>;
}

function GrowthRow({ label, ariaLabel, perLevel, multiplier, total, format }: { label: string; ariaLabel?: string; perLevel: number; multiplier: number; total: number; format: "number" | "percent" | "regen" }) {
  const formatted = (value: number) => format === "percent" ? `${signedNumber(value)}%` : format === "regen" ? `${signedNumber(value)}/秒` : signedNumber(value);
  return <div className="character-page__growth-row" role="row">
    <PencilText as="span" seed={`growth-${label}-name`} role="rowheader" aria-label={ariaLabel}>{label}</PencilText>
    <PencilText as="span" seed={`growth-${label}-per-level`} role="cell">{formatted(perLevel)}</PencilText>
    <PencilText as="span" seed={`growth-${label}-multiplier`} role="cell">{`×${statNumber(multiplier)}`}</PencilText>
    <PencilText as="span" seed={`growth-${label}-total`} role="cell">{formatted(total)}</PencilText>
  </div>;
}
