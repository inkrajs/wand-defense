import { useState } from "react";
import { Button, PencilIcon, PencilLine, PencilText, Select, type PencilIconPath } from "@inkra/react";
import type { Command, CommandResult, GameState } from "../contracts";
import { CHEAT_TARGET_LEVEL } from "../runtime/cheatCatalog";
import "./CheatActions.css";

type BulkAction = "grantAllMagic" | "maxMagic" | "grantAllWands" | "maxWands" | "grantAllGear" | "maxGear" | "grantAllSupplies" | "maxSupplies";
const groups: readonly { label: string; grant: BulkAction; max: BulkAction }[] = [
  { label: "魔法", grant: "grantAllMagic", max: "maxMagic" },
  { label: "法杖", grant: "grantAllWands", max: "maxWands" },
  { label: "装备", grant: "grantAllGear", max: "maxGear" },
  { label: "物品", grant: "grantAllSupplies", max: "maxSupplies" },
];
const add: PencilIconPath[] = [{ d: "M12 4v16M4 12h16", mode: "stroke" }];
const level: PencilIconPath[] = [{ d: "M12 20V5m-6 6 6-6 6 6M5 20h14", mode: "stroke" }];
const commandId = () => globalThis.crypto?.randomUUID?.() ?? `cheat-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function CheatActions({ state, dispatch }: { state: GameState; dispatch: (command: Command) => CommandResult }) {
  const [selectedId, setSelectedId] = useState(state.characters[0]?.id ?? "");
  const characterId = state.characters.some(character => character.id === selectedId) ? selectedId : state.characters[0]?.id ?? "";
  return <div className="cheat-actions" aria-label="作弊操作">
    {groups.map(({ label, grant, max }, index) => <div key={label} className="cheat-actions__group">
      {index > 0 && <PencilLine className="cheat-actions__divider" seed={`cheat-divider-${label}`} aria-hidden="true" />}
      <PencilText as="span" className="cheat-actions__label">{label}</PencilText>
      <div className="cheat-actions__buttons">
        <Button size="sm" variant="ghost" aria-label={`获取全部${label}`} onClick={() => dispatch({ id: commandId(), type: "cheat", action: grant })}><PencilIcon paths={add} sourceSize={24} size={24} decorative />全部</Button>
        <Button size="sm" variant="ghost" aria-label={`${label}提升至至少${CHEAT_TARGET_LEVEL}级，保留更高等级`} title={`提升至至少 Lv.${CHEAT_TARGET_LEVEL}，保留更高等级`} onClick={() => dispatch({ id: commandId(), type: "cheat", action: max })}><PencilIcon paths={level} sourceSize={24} size={24} decorative />满级</Button>
      </div>
    </div>)}
    <Button size="sm" variant="ghost" aria-label="解锁全部技能树" onClick={() => dispatch({ id: commandId(), type: "cheat", action: "revealMagic" })}><PencilIcon paths={add} sourceSize={24} size={24} decorative />解锁技能树</Button>
    <PencilLine className="cheat-actions__divider" seed="cheat-divider-character" aria-hidden="true" />
    <div className="cheat-actions__character">
      <PencilText as="label" htmlFor="cheat-character">角色升级</PencilText>
      <Select.Root value={characterId} onValueChange={setSelectedId}>
        <Select.Trigger id="cheat-character" aria-label="选择升级角色" disabled={!characterId}><Select.Value placeholder="选择角色" /></Select.Trigger>
        <Select.Portal><Select.Content className="menu-settings__select-options"><Select.Viewport>
          {state.characters.map(character => <Select.Item key={character.id} value={character.id}><Select.ItemText>{`${character.name} · Lv.${character.level}`}</Select.ItemText><Select.ItemIndicator /></Select.Item>)}
        </Select.Viewport></Select.Content></Select.Portal>
      </Select.Root>
      <Button size="sm" variant="ghost" disabled={!characterId} aria-label="所选角色提升1级" onClick={() => dispatch({ id: commandId(), type: "cheat", action: "levelCharacter", characterId, levels: 1 })}><PencilIcon paths={level} sourceSize={24} size={24} decorative />升级</Button>
    </div>
  </div>;
}
