import { PencilSurface, PencilText } from "@inkra/react";
import { Progress } from "@inkra/react/display";
import { getExperienceProgress } from "../content/progression";
import type { GameState } from "../contracts";
import "./Battlefield.css";
import { AssetImage, resolveEntityAsset } from "./assets";
import { CombatEffects } from "./CombatEffects";
import { BloodDecals } from "./BloodDecals";
import { localProgress, ringOptions, strokeOptions } from "./progressOptions";

function ratio(value: number, maximum: number) {
  if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0) return 0;
  return Math.max(0, Math.min(1, value / maximum));
}

/** Read-only battlefield projection. World coordinates are expressed on a 0–100 field. */
type Props = { state: GameState; activeCharacterId: string; onCharacterSelect: (characterId: string) => void };

export function Battlefield({ state, activeCharacterId, onCharacterSelect }: Props) {

  return (
    <section className={`battlefield battlefield--${state.phase}`} data-progress-mode={localProgress ? "local" : "fallback"} aria-label="战场">
      <div className={`battlefield__field${state.paused ? " is-paused" : ""}`} role="group" aria-label={`第 ${state.wave} 波战场，${state.entities.length} 个单位，领地生命 ${state.territory.hp} / ${state.territory.maxHp}`}>
        <BloodDecals state={state} />
        {state.entities.filter(entity => entity.kind !== "projectile").map(entity => {
          const left = Math.max(2, Math.min(98, entity.x));
          const top = Math.max(3, Math.min(88, entity.y));
          const health = ratio(entity.hp, entity.maxHp) * 100;
          const asset = resolveEntityAsset(entity);
          return (
            <div key={entity.id} className={`battlefield__unit battlefield__unit--${entity.kind} battlefield__unit--${entity.faction}`}
              style={{ left: `${left}%`, top: `${top}%` }}
              aria-label={`${asset.label}，生命 ${entity.hp} / ${entity.maxHp}`}>
              <span className="battlefield__unit-mark" aria-hidden="true"><AssetImage asset={asset} /></span>
              {entity.kind !== "projectile" && <span className="battlefield__unit-health" aria-hidden="true"><i style={{ width: `${health}%` }} /></span>}
            </div>
          );
        })}

        <CombatEffects state={state} />
        <div className="battlefield__heroes" aria-label="守城角色">
          {state.characters.map((character) => (
            <button type="button" className={`battlefield__hero${character.id === activeCharacterId ? " is-selected" : ""}`} key={character.id}
              aria-label={`选择角色：${character.name}，法力 ${character.mana} / ${character.maxMana}`} aria-pressed={character.id === activeCharacterId}
              title={`${character.name} · 法力 ${character.mana} / ${character.maxMana}`} onClick={() => onCharacterSelect(character.id)}>
              <Progress className="battlefield__xp" shape="circular" diameter={96} thickness={3} value={getExperienceProgress(character.xp ?? 0, character.level).value} max={getExperienceProgress(character.xp ?? 0, character.level).max} aria-label={`${character.name}经验`} seed={`experience-ring-${character.id}`} {...ringOptions("var(--inkra-success-pigment)")} />
              <Progress className="battlefield__mana" shape="circular" diameter={76} thickness={3} value={character.mana} max={Math.max(1, character.maxMana)} aria-label={`${character.name} 法力`} seed={`mana-${character.id}`} {...ringOptions("var(--inkra-info-pigment)")} />
              <PencilSurface as="span" className="battlefield__hero-wash" variant="selection" radius={12} seed={`hero-selection-${character.id}`} aria-hidden="true" />
              <span aria-hidden="true" className="battlefield__hero-mark">♙</span>
            </button>
          ))}
        </div>

        <div className="territory-vitals">
          <Progress className="territory-vitals__bar territory-vitals__shield" aria-label="领地护盾" value={state.territory.shield ?? 0} max={Math.max(1, state.territory.maxShield ?? 0)} seed="territory-shield" size="sm" {...strokeOptions("var(--inkra-info-foreground)")} />
          <Progress className="territory-vitals__bar territory-vitals__hp" aria-label="领地生命" value={state.territory.hp} max={state.territory.maxHp} seed="territory-hp" size="sm" {...strokeOptions("var(--inkra-danger-foreground)")} />
        </div>
        {state.entities.length === 0 && state.phase === "battle" && <PencilText as="p" className="battlefield__empty" seed="battlefield-empty">敌人正在接近…</PencilText>}
        {state.phase === "battle" && state.paused && <div className="battlefield__pause" aria-live="polite"><PencilText seed="paused">已暂停</PencilText></div>}
      </div>

    </section>
  );
}
