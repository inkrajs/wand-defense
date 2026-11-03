import { GameTabsList } from "./GameTabsList";
import { useMemo, useState } from "react";
import { PencilIcon, PencilSurface, PencilText, Radar, Tabs } from "@inkra/react";
import type { RadarAxis, RadarSeries } from "@inkra/react/radar";
import type { Command, CommandResult, Element, GameState, Grade } from "../contracts";
import { demoContent } from "../content/demo";
import { gradeDefinitions } from "../content/grades";
import "./CharacterPage.css";

type Props = { state: GameState; dispatch: (command: Command) => CommandResult; activeCharacterId: string; showLoadout?: boolean };
type Tab = "overview" | "attributes" | "pathways" | "growth";

const elementNames: Record<Element, string> = { fire: "火", wood: "木", metal: "金", water: "水", earth: "土", light: "光", dark: "暗", lightning: "雷", wind: "风" };
const pathwayNames: Record<string, string> = { fire: "火之途径", wood: "木之途径", metal: "金之途径", water: "水之途径", earth: "土之途径", light: "光之途径", dark: "暗之途径", lightning: "雷之途径", wind: "风之途径" };

const portraitPaths = [
  { d: "M15 4a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z", mode: "stroke" as const },
  { d: "M10 10c-5 0-8 3-8 8h16c0-5-3-8-8-8Z", mode: "stroke" as const },
  { d: "M5 20h10", mode: "stroke" as const },
];
const headPaths = [{ d: "M4 14a8 8 0 0 1 16 0M6 14h12M8 14v5h8v-5", mode: "stroke" as const }];
const bodyPaths = [{ d: "M7 4h10l3 16H4L7 4Zm0 5h10", mode: "stroke" as const }];
const feetPaths = [{ d: "M6 4v10l-3 4h8v-4L9 4m5 0v10l-2 4h9l-3-4V4", mode: "stroke" as const }];
const accessoryPaths = [{ d: "M12 3 14 9l6 3-6 3-2 6-2-6-6-3 6-3 2-6Z", mode: "stroke" as const }];
const overviewPaths = [{ d: "M3 18 9 12l4 4 8-9M15 7h6v6", mode: "stroke" as const }];
const attributesPaths = [{ d: "M12 3v18M3 12h18M5.6 5.6l12.8 12.8m0-12.8L5.6 18.4", mode: "stroke" as const }];
const pathwaysPaths = [{ d: "M5 4v6l7 4v6m7-16v6l-7 4", mode: "stroke" as const }];
const growthPaths = [{ d: "M4 19V5m0 14h16M7 15l4-4 3 2 5-7", mode: "stroke" as const }];
const levelPaths = [{ d: "M4 19V5m0 14h16M8 15l3-4 3 2 4-6", mode: "stroke" as const }];
const manaPaths = [{ d: "M12 3c-2 4-6 7-6 11a6 6 0 0 0 12 0c0-4-4-7-6-11Z", mode: "stroke" as const }];
const regenPaths = [{ d: "M20 7v5h-5M4 17v-5h5m9-2a6 6 0 0 0-10-2L4 12m16 0-4 4a6 6 0 0 1-10-2", mode: "stroke" as const }];
const attackPaths = [{ d: "M5 19 19 5m-2 0h2v2M4 16l4 4", mode: "stroke" as const }];
const wandPaths = [{ d: "m5 19 14-14M5 5l2 2m2-5 1 3m5 11 3 1m-1-5 3 2", mode: "stroke" as const }];

export function CharacterPage({ state, dispatch: _dispatch, activeCharacterId, showLoadout = false }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const character = state.characters.find((entry) => entry.id === activeCharacterId) ?? state.characters[0];
  const knownSequences = useMemo(() => state.knowledge.sequenceIds
    .map((id) => demoContent.sequences[id])
    .filter((sequence) => sequence !== undefined), [state.knowledge.sequenceIds]);
  const currentSequence = knownSequences.find((sequence) => sequence.id === character?.sequenceId);
  const equippedWands = state.wands.filter((wand) => wand.characterId === character?.id && character?.wandIds.includes(wand.id)).slice(0, 2);
  const knownBonuses = Object.entries(currentSequence?.bonuses ?? {}).filter((entry): entry is [Element, number] => typeof entry[1] === "number" && entry[1] !== 0);
  const attackPercent = Math.max(0, state.runBonuses?.attackPercent ?? 0);
  const knownPathways = useMemo(() => Array.from(new Set(knownSequences.map((sequence) => sequence.pathwayId))).map((pathwayId) => ({
    id: pathwayId,
    name: pathwayNames[pathwayId] ?? pathwayId,
    sequences: knownSequences.filter((sequence) => sequence.pathwayId === pathwayId),
  })), [knownSequences]);

  const radarAxes = useMemo<RadarAxis[]>(() => {
    if (!character) return [];
    const maxMana = Math.max(1, character.maxMana);
    const maxRegen = Math.max(1, character.manaRegen);
    const maxLevel = Math.max(1, character.level);
    const maxWands = Math.max(1, equippedWands.length);
    return [
      { id: "level", label: "等级", min: 0, max: maxLevel, formatValue: (value) => `${Math.round(value)}级` },
      { id: "mana", label: "法力", min: 0, max: maxMana, formatValue: (value) => `${Math.round(value)}` },
      { id: "capacity", label: "容量", min: 0, max: maxMana, formatValue: (value) => `${Math.round(value)}` },
      { id: "regen", label: "恢复", min: 0, max: maxRegen, formatValue: (value) => `${Math.round(value)}/秒` },
      { id: "wands", label: "法杖", min: 0, max: maxWands, formatValue: (value) => `${Math.round(value)}根` },
      ...knownBonuses.map(([element, value]) => ({
        id: `bonus-${element}`,
        label: `${elementNames[element]}系`,
        min: Math.min(0, value),
        max: Math.max(1, value),
        formatValue: (amount: number) => `${Math.round(amount * 100)}%`,
      })),
    ];
  }, [character, equippedWands.length, knownBonuses]);

  const radarSeries = useMemo<RadarSeries[]>(() => {
    if (!character) return [];
    return [{
      id: character.id,
      label: character.name,
      data: [
        { axisId: "level", value: character.level },
        { axisId: "mana", value: character.mana },
        { axisId: "capacity", value: character.maxMana },
        { axisId: "regen", value: character.manaRegen },
        { axisId: "wands", value: equippedWands.length },
        ...knownBonuses.map(([element, value]) => ({ axisId: `bonus-${element}`, value })),
      ],
    }];
  }, [character, equippedWands.length, knownBonuses]);

  return <section className="character-page" aria-label="角色详情">
    {character ? <div className="character-page__layout">
      <section className="character-page__equipment" aria-label="角色与装备位">
        <div className="character-page__gear-grid">
          <GearSlot className="character-page__slot--head" icon={headPaths} label="头部" />
          <GearSlot className="character-page__slot--wand-one" icon={wandPaths} label="法杖位一" item={equippedWands[0]} loadout={showLoadout} />
          <div className="character-page__portrait" role="img" aria-label={`${character.name}立绘占位`}>
            <PencilIcon paths={portraitPaths} sourceSize={24} size={88} seed={`portrait-${character.id}`} decorative />
          </div>
          <GearSlot className="character-page__slot--body" icon={bodyPaths} label="身体" />
          <GearSlot className="character-page__slot--wand-two" icon={wandPaths} label="法杖位二" item={equippedWands[1]} loadout={showLoadout} />
          <GearSlot className="character-page__slot--feet" icon={feetPaths} label="足部" />
          <GearSlot className="character-page__slot--accessory" icon={accessoryPaths} label="饰品" />
        </div>
      </section>

      <section className="character-page__details" aria-label="角色属性与成长">
        <Tabs.Root orientation="vertical" value={tab} onValueChange={value => setTab(value as Tab)}>
          <GameTabsList className="character-page__tabs" orientation="vertical" aria-label="角色详情标签" fullWidth>
            <Tabs.Trigger value="overview" aria-label="概览" startIcon={<PencilIcon paths={overviewPaths} size={32} sourceSize={24} seed="overview-tab" decorative />} />
            <Tabs.Trigger value="attributes" aria-label="属性" startIcon={<PencilIcon paths={attributesPaths} size={32} sourceSize={24} seed="attributes-tab" decorative />} />
            <Tabs.Trigger value="pathways" aria-label="途径" startIcon={<PencilIcon paths={pathwaysPaths} size={32} sourceSize={24} seed="pathways-tab" decorative />} />
            <Tabs.Trigger value="growth" aria-label="成长" startIcon={<PencilIcon paths={growthPaths} size={32} sourceSize={24} seed="growth-tab" decorative />} />
          </GameTabsList>
          <Tabs.Content className="character-page__panel character-page__overview" value="overview">
            <SummaryRow icon={levelPaths} label="等级" value={String(character.level)} seed="overview-level" />
            <SummaryRow icon={manaPaths} label="法力" value={`${Math.floor(character.mana)} / ${character.maxMana}`} seed="overview-mana" />
            <SummaryRow icon={regenPaths} label="恢复" value={`${character.manaRegen}/秒`} seed="overview-regen" />
            {attackPercent > 0 && <SummaryRow icon={attackPaths} label="增幅" value={`+${attackPercent}%`} seed="overview-attack" />}
          </Tabs.Content>
          <Tabs.Content className="character-page__panel character-page__attributes" value="attributes">
            {radarAxes.length >= 3 && <Radar className="character-page__radar" axes={radarAxes} series={radarSeries} label={`${character.name}属性雷达`} description="角色等级、法力、容量、恢复、法杖数量及已知序列属性。" size={240} showAxes showLabels showValues={false} showTable={false} showLegend={false} levels={4} />}
          </Tabs.Content>
          <Tabs.Content className="character-page__panel character-page__pathways" value="pathways">
            {knownPathways.map((pathway) => <section className="character-page__pathway" key={pathway.id}>
              <PencilText as="h4" seed="known-pathway-name">{pathway.name}</PencilText>
              {pathway.sequences.map((sequence) => <PencilText as="p" key={sequence.id} seed="known-sequence-name">{`${sequence.name}${sequence.id === character.sequenceId ? " · 当前" : ""}`}</PencilText>)}
            </section>)}
          </Tabs.Content>
          <Tabs.Content className="character-page__panel character-page__growth" value="growth" aria-label="成长记录暂无内容" />
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

function GearSlot({ className, icon, label, item, loadout = false }: { className: string; icon: readonly { d: string; mode?: "stroke" }[]; label: string; item?: { name: string; level: number; grade: Grade; width: number; height: number }; loadout?: boolean }) {
  const accessibleDescription = item ? `${label}：${item.name}，${item.width}×${item.height}，等级 ${item.level}，${gradeDefinitions[item.grade].name}` : `${label}：空装备位`;
  return <PencilSurface as="div" className={`character-page__gear-slot ${className}${loadout ? " is-loadout" : ""}`} variant="outline" seed={`gear-slot-${className}`} radius={8} role={loadout ? "group" : "img"} aria-label={accessibleDescription} data-character-wand-slot={loadout ? label : undefined}>
    <PencilIcon paths={item ? wandPaths : icon} sourceSize={24} size={32} className="character-page__gear-slot-icon" decorative />
  </PencilSurface>;
}
