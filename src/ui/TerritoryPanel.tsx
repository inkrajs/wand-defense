import { Button, PencilSurface, PencilText } from "@inkra/react";
import type { GameState } from "../contracts";
import { getTerritoryUpgrade, type TerritoryUpgradeTrack } from "../content/territory";
import "./TerritoryPanel.css";

type Props = { state: GameState; onUpgrade: (track: TerritoryUpgradeTrack) => void };

export function TerritoryPanel({ state, onUpgrade }: Props) {
  const wall = getTerritoryUpgrade(state, "wall");
  const shield = getTerritoryUpgrade(state, "shield");

  return <PencilSurface as="section" id="territory-panel" className="territory-panel" variant="paper" seed="territory-panel" radius={8} aria-label="领地升级">
    <div className="territory-panel__tracks">
      <UpgradeTrack
        track="wall"
        title="城墙"
        level={wall.level}
        current={`${state.territory.hp} / ${state.territory.maxHp} 生命`}
        benefit={wall.nextLevel === null ? "已满级" : `下级：生命上限 +${wall.increase}`}
        capped={wall.nextLevel === null}
        cost={wall.cost}
        allowed={wall.allowed}
        onUpgrade={onUpgrade}
      />
      <UpgradeTrack
        track="shield"
        title="护盾"
        level={shield.level}
        current={`${state.territory.shield ?? 0} / ${state.territory.maxShield ?? 0} 护盾`}
        benefit={shield.nextLevel === null ? "已满级" : `下级：护盾上限 +${shield.increase}`}
        capped={shield.nextLevel === null}
        cost={shield.cost}
        allowed={shield.allowed}
        onUpgrade={onUpgrade}
      />
    </div>
  </PencilSurface>;
}

function UpgradeTrack({ track, title, level, current, benefit, cost, allowed, capped, onUpgrade }: {
  track: TerritoryUpgradeTrack;
  title: string;
  level: number;
  current: string;
  benefit: string;
  cost: number;
  capped: boolean;
  allowed: boolean;
  onUpgrade: (track: TerritoryUpgradeTrack) => void;
}) {
  return <section className="territory-panel__track" aria-label={`${title}升级`}>
    <PencilText as="h3" className="territory-panel__track-title" seed="territory-track-title">{`${title} · 等级 ${level}`}</PencilText>
    <PencilText as="p" className="territory-panel__current" seed="territory-current">{current}</PencilText>
    <PencilText as="p" className="territory-panel__benefit" seed="territory-benefit">{benefit}</PencilText>
    {!capped && <PencilText as="p" className="territory-panel__cost" seed="territory-cost">{"费用：" + cost + " 金币"}</PencilText>}
    <Button className="territory-panel__upgrade" disabled={!allowed} onClick={() => onUpgrade(track)}>升级</Button>
  </section>;
}
