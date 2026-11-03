import { useMemo, useState } from "react";
import { Button, PencilText, Select } from "@inkra/react";
import type { Command, CommandResult, GameState } from "../contracts";
import { demoContent } from "../content/demo";
import "./CharacterPage.css";

type Props = { state: GameState; dispatch: (command: Command) => CommandResult };

const gradeNames: Record<string, string> = { common: "普通", uncommon: "优秀", rare: "稀有", epic: "史诗", legendary: "传说" };
const elementNames: Record<string, string> = { fire: "火", wood: "木", metal: "金", water: "水", earth: "土", light: "光", dark: "暗", lightning: "雷", wind: "风" };
const pathwayNames: Record<string, string> = { fire: "火之途径", wood: "木之途径", metal: "金之途径", water: "水之途径", earth: "土之途径", light: "光之途径", dark: "暗之途径", lightning: "雷之途径", wind: "风之途径" };

function commandId() { return `character-page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

export function CharacterPage({ state, dispatch }: Props) {
  const [characterId, setCharacterId] = useState(state.characters[0]?.id ?? "");
  const character = state.characters.find((entry) => entry.id === characterId) ?? state.characters[0];
  const [wandId, setWandId] = useState(state.wands[0]?.id ?? "");
  const [result, setResult] = useState<CommandResult | null>(null);
  const knownSequences = useMemo(() => state.knowledge.sequenceIds
    .map((id) => demoContent.sequences[id])
    .filter((sequence) => sequence !== undefined), [state.knowledge.sequenceIds]);
  const knownPathways = useMemo(() => {
    const groups = new Map<string, typeof knownSequences>();
    for (const sequence of knownSequences) groups.set(sequence.pathwayId, [...(groups.get(sequence.pathwayId) ?? []), sequence]);
    return [...groups.entries()];
  }, [knownSequences]);
  const currentSequence = knownSequences.find((sequence) => sequence.id === character?.sequenceId);
  const equippedWands = state.wands.filter((wand) => wand.characterId === character?.id && character?.wandIds.includes(wand.id));

  function equip() {
    if (!character || !wandId) return;
    setResult(dispatch({ id: commandId(), type: "equipWand", wandId, characterId: character.id }));
  }

  return <section className="character-page" aria-label="角色详情">
    {state.characters.length > 1 && <label className="character-page__character-select">
      <span>查看角色</span>
      <Select.Root value={character?.id ?? ""} onValueChange={(value) => {
        setCharacterId(value);
        const nextCharacter = state.characters.find((entry) => entry.id === value);
        setWandId(nextCharacter?.wandIds[0] ?? state.wands[0]?.id ?? "");
        setResult(null);
      }}>
        <Select.Trigger aria-label="选择查看的角色"><Select.Value placeholder="选择角色" /></Select.Trigger>
        <Select.Content><Select.Viewport>{state.characters.map((entry) => <Select.Item key={entry.id} value={entry.id}><Select.ItemText>{entry.name}</Select.ItemText></Select.Item>)}</Select.Viewport></Select.Content>
      </Select.Root>
    </label>}

    {character ? <>
      <div className="character-page__profile">
        <div className="character-page__identity">
          <PencilText as="h3" seed="character-name">{character.name}</PencilText>
          <span className="character-page__grade">{gradeNames[character.grade] ?? character.grade}</span>
        </div>
        <div className="character-page__stats" aria-label="角色属性">
          <div><span>等级</span><strong>{character.level}</strong></div>
          <div><span>法力</span><strong>{Math.floor(character.mana)} / {character.maxMana}</strong></div>
          <div><span>恢复</span><strong>{character.manaRegen} / 秒</strong></div>
        </div>
      </div>

      <section className="character-page__section" aria-labelledby="character-pathways-heading">
        <PencilText as="h4" id="character-pathways-heading" seed="pathways-heading">已知途径</PencilText>
        {knownPathways.length ? <ul className="character-page__pathways">
          {knownPathways.map(([pathwayId, sequences]) => <li key={pathwayId}>
            <span>{pathwayNames[pathwayId] ?? pathwayId}</span>
            <div>{sequences.map((sequence) => <span key={sequence.id} className={sequence.id === character.sequenceId ? "is-current" : ""}>
              <strong>{sequence.name}</strong>{sequence.id === character.sequenceId && <small>当前</small>}
            </span>)}</div>
          </li>)}
        </ul> : <p className="character-page__muted">尚未记录已知途径。</p>}
      </section>

      <section className="character-page__section" aria-labelledby="character-bonuses-heading">
        <PencilText as="h4" id="character-bonuses-heading" seed="bonuses-heading">当前序列加成</PencilText>
        {currentSequence ? Object.entries(currentSequence.bonuses).filter(([, value]) => typeof value === "number" && value !== 0).length ? <ul className="character-page__bonuses">
          {Object.entries(currentSequence.bonuses).filter((entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] !== 0).map(([element, value]) => <li key={element}><span>{elementNames[element] ?? element}</span><strong>+{Math.round(value * 100)}%</strong></li>)}
        </ul> : <p className="character-page__muted">当前序列没有配置属性加成。</p> : <p className="character-page__muted">当前序列尚未收录在已知途径中。</p>}
      </section>

      <section className="character-page__section" aria-labelledby="character-wands-heading">
        <PencilText as="h4" id="character-wands-heading" seed="wands-heading">已装备法杖</PencilText>
        {equippedWands.length ? <ul className="character-page__wands">{equippedWands.map((wand) => <li key={wand.id}>
          <span>{wand.name}</span><small>Lv.{wand.level} · {gradeNames[wand.grade] ?? wand.grade}</small>
        </li>)}</ul> : <p className="character-page__muted">尚未装备法杖。</p>}
        {state.wands.length > 0 && <div className="character-page__equip">
          <label htmlFor="character-wand-select">调整法杖归属</label>
          <div className="character-page__equip-controls">
            <Select.Root value={wandId} onValueChange={setWandId}>
              <Select.Trigger id="character-wand-select" aria-label="选择要装备的法杖"><Select.Value placeholder="选择法杖" /></Select.Trigger>
              <Select.Content><Select.Viewport>{state.wands.map((wand) => <Select.Item key={wand.id} value={wand.id}><Select.ItemText>{wand.name}</Select.ItemText></Select.Item>)}</Select.Viewport></Select.Content>
            </Select.Root>
            <Button size="sm" variant="outline" onClick={equip}>装备给此角色</Button>
          </div>
          {result && <output className={`character-page__result is-${result.status}`} aria-live="polite">{result.status === "rejected" ? result.message ?? result.code ?? "装备未完成" : result.status === "accepted" ? "装备操作已提交" : "法杖已装备"}</output>}
        </div>}
      </section>
    </> : <PencilText as="p" seed="character-empty">尚无角色。</PencilText>}
  </section>;
}
