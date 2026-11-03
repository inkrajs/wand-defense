import { PencilText } from "@inkra/react";
import { Progress } from "@inkra/react/display";
import { getExperienceProgress } from "../content/progression";
import type { GameState } from "../contracts";
import "./Battlefield.css";
import { AssetImage, resolveEntityAsset } from "./assets";

function ratio(value: number, maximum: number) {
  if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0) return 0;
  return Math.max(0, Math.min(1, value / maximum));
}

/** Read-only battlefield projection. World coordinates are expressed on a 0–100 field. */
export function Battlefield({ state }: { state: GameState }) {

  return (
    <section className={`battlefield battlefield--${state.phase}`} aria-label="战场">
      <div className={`battlefield__field${state.paused ? " is-paused" : ""}`} role="group" aria-label={`第 ${state.wave} 波战场，${state.entities.length} 个单位，领地生命 ${state.territory.hp} / ${state.territory.maxHp}`}>
        {state.entities.map(entity => {
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

        <div className="battlefield__heroes" aria-label="守城角色">
          {state.characters.map((character, index) => (
            <div className="battlefield__hero" key={character.id} title={`${character.name} · 法力 ${character.mana} / ${character.maxMana}`}>
              {index === 0 ? <Progress shape="circular" diameter={72} thickness={3} contentPosition="center" value={getExperienceProgress(state.xp, state.playerLevel).value} max={getExperienceProgress(state.xp, state.playerLevel).max} aria-label="本局经验"><span aria-hidden="true" className="battlefield__hero-mark">♙</span></Progress> : <span aria-hidden="true" className="battlefield__hero-mark">♙</span>}
              <Progress className="battlefield__mana" value={character.mana} max={Math.max(1, character.maxMana)} aria-label={`${character.name} 法力`} size="sm" seed={`mana-${character.id}`} />
            </div>
          ))}
        </div>

        <div className="territory-vitals">
          <Progress className="territory-vitals__bar territory-vitals__shield" aria-label="领地护盾" value={state.territory.shield ?? 0} max={Math.max(1, state.territory.maxShield ?? 0)} seed="territory-shield" size="lg" />
          <Progress className="territory-vitals__bar territory-vitals__hp" aria-label="领地生命" value={state.territory.hp} max={state.territory.maxHp} seed="territory-hp" size="lg" />
        </div>
        {state.entities.length === 0 && <PencilText as="p" className="battlefield__empty" seed="battlefield-empty">{state.phase === "battle" ? "敌人正在接近…" : "防线暂时平静"}</PencilText>}
        {state.paused && <div className="battlefield__pause" aria-live="polite"><PencilText seed="paused">已暂停</PencilText></div>}
      </div>

    </section>
  );
}
