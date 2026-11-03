import { useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import { PencilSurface, PencilText } from "@inkra/react";
import type { RewardOption } from "../contracts";
import { gradeDefinitions } from "../content/grades";
import "./RewardChoices.css";

type Props = { rewards: RewardOption[]; onClaim: (rewardId: string) => void };
const kindNames: Record<RewardOption["kind"], string> = { item: "物品", character: "角色", wand: "法杖", heal: "恢复", coins: "金币", buff: "增益" };

export function RewardChoices({ rewards, onClaim }: Props) {
  const [flipped, setFlipped] = useState<Set<string>>(() => new Set());
  const pointerStarts = useRef(new Map<string, { x: number; y: number; selectedText: string }>());
  const suppressedClicks = useRef(new Map<string, number>());
  function toggleFlip(id: string) {
    setFlipped((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return <div className="reward-choices" aria-label="奖励选项">
    {rewards.map((reward) => {
      const isFlipped = flipped.has(reward.id);
      const grade = reward.grade ?? "common";
      const details = reward.details ?? [];
      const showLegacyDetails = details.length === 0;
      return <article key={reward.id} className="reward-choice" data-grade={grade} data-flipped={isFlipped} style={{ "--reward-grade": gradeDefinitions[grade].color } as CSSProperties} aria-label={reward.label} onClick={(event: MouseEvent<HTMLElement>) => {
        const suppressedUntil = suppressedClicks.current.get(reward.id) ?? 0;
        if (event.detail !== 0 && suppressedUntil > Date.now()) {
          suppressedClicks.current.delete(reward.id);
          event.preventDefault();
          return;
        }
        suppressedClicks.current.delete(reward.id);
        onClaim(reward.id);
      }} onPointerDownCapture={() => suppressedClicks.current.delete(reward.id)}>
        <div className="reward-choice__stage">
          <div className="reward-choice__flipper">
            <PencilSurface as="div" className="reward-choice__face reward-choice__front" variant="outline" seed={`reward-${reward.id}-front`} radius={6} aria-hidden={isFlipped} inert={isFlipped}>
              <div className="reward-choice__front-content">
                <div className="reward-choice__art" aria-hidden="true" />
                <PencilText as="h3" seed={`reward-${reward.id}-title`}>{reward.label}</PencilText>
                <PencilText as="p" seed={`reward-${reward.id}-intro`}>{reward.description || kindNames[reward.kind]}</PencilText>
              </div>
            </PencilSurface>
            <PencilSurface as="div" className="reward-choice__face reward-choice__back" variant="outline" seed={`reward-${reward.id}-back`} radius={6} aria-hidden={!isFlipped} inert={!isFlipped}>
              <div className="reward-choice__back-content">
                <PencilText as="h3" seed={`reward-${reward.id}-details-title`}>{reward.label}</PencilText>
                <div className="reward-choice__details-scroll" role="region" aria-label={`${reward.label}详细属性`} tabIndex={0}
                  onPointerDown={(event: PointerEvent<HTMLDivElement>) => pointerStarts.current.set(reward.id, { x: event.clientX, y: event.clientY, selectedText: event.currentTarget.ownerDocument.getSelection()?.toString() ?? "" })}
                  onPointerUp={(event: PointerEvent<HTMLDivElement>) => {
                    const start = pointerStarts.current.get(reward.id);
                    pointerStarts.current.delete(reward.id);
                    const selectedText = event.currentTarget.ownerDocument.getSelection()?.toString() ?? "";
                    if (start && (Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 6 || (selectedText.length > 0 && selectedText !== start.selectedText))) suppressedClicks.current.set(reward.id, Date.now() + 450);
                  }}
                  onPointerCancel={(event: PointerEvent<HTMLDivElement>) => {
                    const start = pointerStarts.current.get(reward.id);
                    pointerStarts.current.delete(reward.id);
                    const selectedText = event.currentTarget.ownerDocument.getSelection()?.toString() ?? "";
                    if (start && (Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 6 || (selectedText.length > 0 && selectedText !== start.selectedText))) suppressedClicks.current.set(reward.id, Date.now() + 450);
                  }}>
                  <dl>
                    {details.map((detail, index) => <div key={`${detail.label}-${index}`}><dt><PencilText as="span">{detail.label}</PencilText></dt><dd><PencilText as="span">{detail.value}</PencilText></dd></div>)}
                    {showLegacyDetails && <>
                      <div><dt><PencilText as="span">类型</PencilText></dt><dd><PencilText as="span">{kindNames[reward.kind]}</PencilText></dd></div>
                      {reward.amount !== undefined && <div><dt><PencilText as="span">数量</PencilText></dt><dd><PencilText as="span">{String(reward.amount)}</PencilText></dd></div>}
                      {reward.effect?.type === "attackPercent" && <div><dt><PencilText as="span">攻击加成</PencilText></dt><dd><PencilText as="span">{`+${reward.effect.value}%`}</PencilText></dd></div>}
                    </>}
                  </dl>
                </div>
              </div>
            </PencilSurface>
          </div>
        </div>
        <button type="button" className="reward-choice__claim" aria-label={`领取奖励：${reward.label}`} />
        <button type="button" className="reward-choice__flip" aria-label={`${isFlipped ? "翻回" : "查看"}${reward.label}详情`} aria-pressed={isFlipped} onClick={(event) => { event.stopPropagation(); toggleFlip(reward.id); }}>
        </button>
      </article>;
    })}
  </div>;
}
