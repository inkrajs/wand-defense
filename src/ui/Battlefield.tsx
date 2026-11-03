import { PencilText } from "@inkra/react";
import type { GameState } from "../contracts";
import "./Battlefield.css";
import { AssetImage, resolveEntityAsset } from "./assets";

function ratio(value: number, maximum: number) {
  if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0) return 0;
  return Math.max(0, Math.min(1, value / maximum));
}

/** Read-only battlefield projection. World coordinates are expressed on a 0–100 field. */
export function Battlefield({ state }: { state: GameState }) {
  const territoryRatio = ratio(state.territory.hp, state.territory.maxHp);

  return (
    <section className="battlefield" aria-label="战场">
      <header className="battlefield__header">
        <div>
          <PencilText as="h2" className="battlefield__title">战场</PencilText>
          <p className="battlefield__subtitle">第 {state.wave} 波 · {state.phase === "battle" ? "战斗中" : state.phase === "reward" ? "波次完成" : state.phase === "defeat" ? "防线失守" : "待命"}</p>
        </div>
        <div className="battlefield__territory-status" aria-label={`领地生命 ${state.territory.hp} / ${state.territory.maxHp}`}>
          <span>领地</span>
          <strong>{state.territory.hp}<small> / {state.territory.maxHp}</small></strong>
        </div>
      </header>

      <div className={`battlefield__field${state.paused ? " is-paused" : ""}`} role="img" aria-label={`第 ${state.wave} 波战场，${state.entities.length} 个单位，领地生命 ${state.territory.hp} / ${state.territory.maxHp}`}>
        <div className="battlefield__skyline" aria-hidden="true"><span>✧</span><span>·</span><span>✦</span></div>
        <div className="battlefield__lane" aria-hidden="true" />
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
          {state.characters.map(character => (
            <div className="battlefield__hero" key={character.id} title={`${character.name} · 法力 ${character.mana} / ${character.maxMana}`}>
              <span aria-hidden="true">♙</span>
              <small>{character.name} · Lv.{character.level}</small>
              <span className="battlefield__mana" aria-hidden="true"><i style={{ width: `${ratio(character.mana, character.maxMana) * 100}%` }} /></span>
            </div>
          ))}
        </div>

        <div className="battlefield__keep" aria-hidden="true"><span>⌂</span><i style={{ width: `${territoryRatio * 100}%` }} /></div>
        {state.entities.length === 0 && <p className="battlefield__empty">{state.phase === "battle" ? "敌人正在接近…" : "防线暂时平静"}</p>}
        {state.paused && <div className="battlefield__pause" aria-live="polite">已暂停</div>}
      </div>

      <footer className="battlefield__legend" aria-label="战场单位图例">
        <span><i className="legend-dot legend-dot--enemy" />敌人</span>
        <span><i className="legend-dot legend-dot--ally" />我方单位</span>
        <span className="battlefield__wave-count">剩余来袭 {state.waveSpawnRemaining}</span>
      </footer>
    </section>
  );
}
