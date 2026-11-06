import { memo } from "react";
import { PencilSurface, PencilText } from "@inkra/react";
import { Progress } from "@inkra/react/display";
import { getExperienceProgress } from "../content/progression";
import { MonsterPresentationIcon, getMonsterPresentationIcon } from "./monsterPresentationIcons";
import { CharacterPresentationIcon } from "./characterPresentationIcons";
import { ConstructPresentationIcon, hasConstructPresentationIcon } from "./ConstructPresentationIcon";
import { demoContent } from "../content/demo";
import { getCharacterStats } from "../content/characters";
import { getCharacterAnchors } from "../content/characterAnchors";
import { getMonsterSize } from "../content/monsters";
import type { CombatEntity, GameState } from "../contracts";
import "./Battlefield.css";
import { AssetImage, resolveEntityAsset } from "./assets";
import { CombatEffects } from "./CombatEffects";
import { DeathEffects } from "./DeathEffects";
import { WandMiniatures } from "./WandMiniatures";
import type { CastFlashLookup } from "./wandMiniatureEvents";
import { ChainEffects } from "./ChainEffects";
import { AreaEffects } from "./AreaEffects";
import { BloodDecals } from "./BloodDecals";
import { BeamEffects } from "./BeamEffects";
import { MagicEffectArt } from "./MagicEffectArt";
import { localProgress, ringOptions, strokeOptions } from "./progressOptions";
import { useMonsterAttackBobs, type ActiveMonsterBob } from "./monsterAnimation";
import { useGraphicsSettings } from "./graphicsSettings";

function ratio(value: number, maximum: number) {
  if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0) return 0;
  return Math.max(0, Math.min(1, value / maximum));
}

function hasVisibleSlow(entity: CombatEntity): boolean {
  const slow = entity.kind === "enemy" ? entity.status?.slow : undefined;
  return Boolean(slow && Number.isFinite(slow.multiplier) && slow.multiplier > 0 && slow.multiplier < 1 && Number.isFinite(slow.remainingMs) && slow.remainingMs > 0);
}

function hasVisibleBurn(entity: CombatEntity): boolean {
  const burns = entity.kind === "enemy" ? entity.status?.burns : undefined;
  return Array.isArray(burns) && burns.some(burn => Number.isFinite(burn.remainingMs) && burn.remainingMs > 0);
}

function visibleStatusKey(entity: CombatEntity): string {
  return `${hasVisibleSlow(entity) ? "slow" : ""}:${hasVisibleBurn(entity) ? "burn" : ""}`;
}

const UnitHealth = memo(function UnitHealth({ health, label, id }: { health: number; label: string; id: string }) {
  return <Progress className="battlefield__unit-health" value={health} max={100} aria-label={`${label}生命`} seed={`health-${id}`} size="sm" {...strokeOptions("var(--inkra-danger-foreground)")} {...(localProgress ? { thickness: 4 } : {})} />;
});

const BattlefieldUnit = memo(function BattlefieldUnit({ entity, attackBob, resolution }: { entity: CombatEntity; attackBob?: ActiveMonsterBob; resolution: number }) {
  const x = Number.isFinite(entity.x) ? entity.x : 50;
  const y = Number.isFinite(entity.y) ? entity.y : 0;
  const left = entity.kind === "enemy" || entity.kind === "summon" || entity.kind === "building" ? x : Math.max(2, Math.min(98, x));
  const top = entity.kind === "enemy" || entity.kind === "summon" || entity.kind === "building" ? y : Math.max(3, Math.min(88, y));
  const health = ratio(entity.hp, entity.maxHp) * 100;
  const asset = resolveEntityAsset(entity);
  const pixels = entity.kind === "enemy" ? getMonsterSize(entity).pixels : entity.kind === "summon" || entity.kind === "building" ? 36 : 32;
  const construct = entity.kind === "summon" || entity.kind === "building";
  const label = construct ? demoContent.spells[entity.definitionId]?.name ?? asset.label : asset.label;
  const remainingSeconds = construct && entity.remainingMs !== undefined ? Math.ceil(Math.max(0, entity.remainingMs) / 1000) : undefined;
  const slowed = hasVisibleSlow(entity);
  const burning = hasVisibleBurn(entity);
  const statusLabel = [slowed ? "迟缓" : "", burning ? "燃烧" : ""].filter(Boolean).join("、");
  return <div className={`battlefield__unit battlefield__unit--${entity.kind} battlefield__unit--${entity.faction}`}
    data-status-slow={slowed || undefined} data-status-burn={burning || undefined}
    style={{ left: `${left}%`, top: `${top}%`, "--unit-monster-size": `${pixels}px`, "--unit-health-width": `${entity.kind === "enemy" ? Math.max(34, pixels * 1.25) : 34}px` } as React.CSSProperties}
    aria-label={`${label}${statusLabel ? `，${statusLabel}中` : ""}，生命 ${entity.hp} / ${entity.maxHp}${remainingSeconds === undefined ? "" : `，剩余 ${remainingSeconds} 秒`}`}>
    <span className="battlefield__unit-mark" data-attacked={attackBob?.variant} aria-hidden="true">
      {slowed && <MagicEffectArt resolution={resolution} className="battlefield__status-frost" kind="field" seed="enemy-status-slow" width={pixels * 1.42} height={pixels * 1.42} color="var(--inkra-info-pigment)" />}
      {burning && <>
        <MagicEffectArt resolution={resolution} className="battlefield__status-spark battlefield__status-spark--one" kind="ember" seed="enemy-status-burn-a" width={Math.max(10, pixels * .38)} height={Math.max(12, pixels * .46)} color="var(--inkra-warning-pigment)" />
        <MagicEffectArt resolution={resolution} className="battlefield__status-spark battlefield__status-spark--two" kind="ember" seed="enemy-status-burn-b" width={Math.max(8, pixels * .3)} height={Math.max(10, pixels * .38)} color="var(--inkra-danger-pigment)" />
      </>}
      <span className={`battlefield__unit-mark-icon${slowed ? " is-slowed" : ""}`}>{entity.kind === "enemy" && getMonsterPresentationIcon(entity.definitionId, entity.id) ? <MonsterPresentationIcon definitionId={entity.definitionId} entityId={entity.id} size={pixels} /> : (entity.kind === "summon" || entity.kind === "building") && hasConstructPresentationIcon(entity.definitionId) ? <ConstructPresentationIcon definitionId={entity.definitionId} entityId={entity.id} size={pixels} /> : <AssetImage asset={asset} />}</span>
    </span>
    <UnitHealth health={health} label={label} id={entity.id} />
  </div>;
}, (a, b) => a.attackBob?.eventSeq === b.attackBob?.eventSeq && a.resolution === b.resolution && a.entity.id === b.entity.id && a.entity.kind === b.entity.kind && a.entity.faction === b.entity.faction && a.entity.definitionId === b.entity.definitionId && a.entity.bodySize === b.entity.bodySize && a.entity.x === b.entity.x && a.entity.y === b.entity.y && a.entity.hp === b.entity.hp && a.entity.maxHp === b.entity.maxHp && ((a.entity.kind !== "summon" && a.entity.kind !== "building") || Math.ceil((a.entity.remainingMs ?? 0) / 1000) === Math.ceil((b.entity.remainingMs ?? 0) / 1000)) && visibleStatusKey(a.entity) === visibleStatusKey(b.entity));

/** Read-only battlefield projection. World coordinates are expressed on a 0–100 field. */
type Props = { state: GameState; flashes: CastFlashLookup; activeCharacterId: string; hideActiveMini?: boolean; onCharacterSelect: (characterId: string) => void };

export function Battlefield({ state, flashes, activeCharacterId, hideActiveMini = false, onCharacterSelect }: Props) {
  const monsterAttackBob = useMonsterAttackBobs(state);
  const { settings } = useGraphicsSettings();
  const anchors = new Map(getCharacterAnchors(state.characters).map(anchor => [anchor.characterId, anchor]));
  return (
    <section className={`battlefield battlefield--${state.phase}`} data-progress-mode={localProgress ? "local" : "fallback"} aria-label="战场">
      <div className={`battlefield__field${state.paused ? " is-paused" : ""}`} role="group" aria-label={`第 ${state.wave} 波战场，${state.entities.length} 个单位，领地生命 ${state.territory.hp} / ${state.territory.maxHp}`}>
        <BloodDecals state={state} />
        {state.entities.filter(entity => entity.kind !== "projectile" && entity.kind !== "beam" && entity.kind !== "area" && entity.kind !== "chain").map(entity => <BattlefieldUnit key={entity.id} entity={entity} resolution={settings.effectResolution} attackBob={entity.kind === "enemy" ? monsterAttackBob(entity.id) : undefined} />)}

        <AreaEffects state={state} />
        <ChainEffects state={state} />
        <DeathEffects state={state} />
        <CombatEffects state={state} />
        <BeamEffects state={state} />
        <div className="battlefield__heroes" aria-label="守城角色">
          {state.characters.map((character) => {
            const effective = getCharacterStats(state, character.id)?.final;
            const mana = effective?.mana ?? character.mana;
            const maxMana = effective?.maxMana ?? character.maxMana;
            return <div className="battlefield__hero-group" key={character.id} style={{ left: `${anchors.get(character.id)?.x ?? 50}%` }}><button type="button" className={`battlefield__hero${character.id === activeCharacterId ? " is-selected" : ""}`} data-character-id={character.id}
              aria-label={`选择角色：${character.name}，法力 ${mana} / ${maxMana}`} aria-pressed={character.id === activeCharacterId}
              title={`${character.name} · 法力 ${mana} / ${maxMana}`} onClick={() => onCharacterSelect(character.id)}>
              <Progress className="battlefield__xp" shape="circular" diameter={64} thickness={3} value={getExperienceProgress(character.xp ?? 0, character.level).value} max={getExperienceProgress(character.xp ?? 0, character.level).max} aria-label={`${character.name}经验`} seed={`experience-ring-${character.id}`} {...ringOptions("var(--inkra-success-pigment)")} />
              <Progress className="battlefield__mana" shape="circular" diameter={50} thickness={3} value={mana} max={Math.max(1, maxMana)} aria-label={`${character.name} 法力`} seed={`mana-${character.id}`} {...ringOptions("var(--inkra-info-pigment)")} />
              <PencilSurface as="span" className="battlefield__hero-wash" variant="selection" radius={12} seed={`hero-selection-${character.id}`} aria-hidden="true" />
              <span aria-hidden="true" className="battlefield__hero-mark"><CharacterPresentationIcon pathwayId={demoContent.sequences[character.sequenceId]?.pathwayId} seed={`battle-hero-${character.id}`} size={44} /></span>
            </button>
            <div className="battlefield__hero-mini"><WandMiniatures state={state} characterId={character.id} activeCharacterId={activeCharacterId} hideActive={hideActiveMini} flashes={flashes} /></div>
            </div>;
          })}
        </div>

        <div className="territory-vitals">
          <Progress className="territory-vitals__bar territory-vitals__shield" aria-label="领地护盾" value={state.territory.shield ?? 0} max={Math.max(1, state.territory.maxShield ?? 0)} seed="territory-shield" size="sm" {...strokeOptions("var(--game-territory-ink)")} />
          <Progress className="territory-vitals__bar territory-vitals__hp" aria-label="领地生命" value={state.territory.hp} max={state.territory.maxHp} seed="territory-hp" size="sm" {...strokeOptions("var(--game-territory-ink)")} />
        </div>
        {state.entities.length === 0 && state.phase === "battle" && <PencilText as="p" className="battlefield__empty" seed="battlefield-empty">敌人正在接近…</PencilText>}
        {state.phase === "battle" && state.paused && <div className="battlefield__pause" aria-live="polite"><PencilText seed="paused">已暂停</PencilText></div>}
      </div>

    </section>
  );
}
