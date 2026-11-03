import { PencilText } from "@inkra/react";
import type { ClaimedReward, GameState, RewardOption } from "../contracts";
import { gradeDefinitions } from "../content/grades";
import "./TalentPanel.css";

type Props = { state: GameState };

const effectNames: Record<NonNullable<RewardOption["effect"]>["type"], string> = {
  attackPercent: "攻击",
  maxMana: "最大法力",
  manaRegen: "法力恢复",
  rangePercent: "射程",
  cooldownPercent: "冷却",
  luck: "幸运",
  gatheringPercent: "采集",
};

function fallbackEffect(reward: RewardOption): string | null {
  if (reward.effect) {
    const { type, value } = reward.effect;
    if (type === "cooldownPercent") return `${effectNames[type]} -${value}%`;
    if (type === "attackPercent" || type === "rangePercent" || type === "gatheringPercent") return `${effectNames[type]} +${value}%`;
    if (type === "manaRegen") return `${effectNames[type]} +${value}/秒`;
    return `${effectNames[type]} +${value}`;
  }
  if (reward.amount === undefined) return null;
  if (reward.kind === "coins") return `获得 ${reward.amount} 金币`;
  if (reward.kind === "heal") return `恢复 ${reward.amount} 生命`;
  return null;
}

function RewardEntry({ reward }: { reward: RewardOption }) {
  const grade = gradeDefinitions[reward.grade ?? "common"];
  const details = reward.details?.filter(detail => !grade || detail.label !== "品级") ?? [];
  const effect = fallbackEffect(reward);

  return <li className="talent-panel__reward" data-grade={reward.grade}>
    <div className="talent-panel__reward-heading">
      <PencilText as="span" className="talent-panel__reward-name">{reward.label}</PencilText>
      {grade && <PencilText as="span" className="talent-panel__grade" style={{ "--talent-grade": grade.color } as React.CSSProperties}>{grade.name}</PencilText>}
    </div>
    {(reward.description || details.length > 0 || effect) && <ul className="talent-panel__effects">
      {reward.description && <li><PencilText as="span">{reward.description}</PencilText></li>}
      {details.length > 0
        ? details.map((detail, index) => <li key={`${detail.label}-${index}`}><PencilText as="span">{`${detail.label}：${detail.value}`}</PencilText></li>)
        : effect && <li><PencilText as="span">{effect}</PencilText></li>}
    </ul>}
  </li>;
}

function groupByWave(history: readonly ClaimedReward[]): Array<{ wave: number; rewards: ClaimedReward[] }> {
  const groups = new Map<number, ClaimedReward[]>();
  for (const entry of history) {
    const rewards = groups.get(entry.wave) ?? [];
    rewards.push(entry);
    groups.set(entry.wave, rewards);
  }
  return [...groups]
    .sort(([left], [right]) => left - right)
    .map(([wave, rewards]) => ({
      wave,
      rewards: [...rewards].sort((left, right) => left.gameTimeMs - right.gameTimeMs),
    }));
}

export function TalentPanel({ state }: Props) {
  const waves = groupByWave(state.rewardHistory ?? []);
  return <section className="talent-panel" aria-labelledby="talent-panel-title">
    <PencilText as="h2" id="talent-panel-title" className="talent-panel__title">已领取奖励</PencilText>
    {waves.length === 0
      ? <PencilText as="p" className="talent-panel__empty">暂无已领取奖励</PencilText>
      : <ol className="talent-panel__waves">
          {waves.map(({ wave, rewards }) => <li className="talent-panel__wave" key={wave}>
            <PencilText as="h3" className="talent-panel__wave-title">{`第 ${wave} 波`}</PencilText>
            <ul className="talent-panel__reward-list">
              {rewards.map(({ id, reward }) => <RewardEntry key={id} reward={reward} />)}
            </ul>
          </li>)}
        </ol>}
  </section>;
}
