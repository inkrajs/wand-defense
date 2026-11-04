import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button, PencilIcon, PencilText, Tabs } from "@inkra/react";
import { GameTabsList } from "./GameTabsList";
import type { GameState } from "../contracts";
import { getTerritoryRepair, getTerritoryUpgrade, type TerritoryUpgradeTrack } from "../content/territory";
import { getTerritoryRecovery } from "../content/territoryRecovery";
import "./TerritoryPanel.css";

type Props = {
  state: GameState;
  onUpgrade: (track: TerritoryUpgradeTrack) => void;
  onRepair: (track: TerritoryUpgradeTrack) => void;
  onUpgradeRecovery: (track: TerritoryUpgradeTrack) => void;
};

const wallPaths = [{ d: "M3 6h18M3 12h18M3 18h18M8 6v6m8 0v6m-8 0v-6m8-6v6", mode: "stroke" as const }];
const shieldPaths = [{ d: "M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z", mode: "stroke" as const }];
const upgradePaths = [{ d: "M12 20V4m-7 7 7-7 7 7", mode: "stroke" as const }];
const repairPaths = [{ d: "M12 4v16M4 12h16", mode: "stroke" as const }];
const wallRecoveryPaths = [{ d: "M14 5a5 5 0 0 0-5.8 6L3 16.2 6.8 20l5.2-5.2A5 5 0 0 0 18 9l-3 3-3-3 3-4Z", mode: "stroke" as const }];
const shieldRecoveryPaths = [{ d: "M20 7v5h-5M4 17v-5h5M6 10a7 7 0 0 1 12-3l2 2M4 13l2 2a7 7 0 0 0 12-3", mode: "stroke" as const }];
const lockPaths = [{ d: "M6 10h12v10H6zM8 10V7a4 4 0 0 1 8 0v3m-4 4v2", mode: "stroke" as const }];
const coinPaths = [{ d: "M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z", mode: "stroke" as const }, { d: "M12 7v10M9 9c0-2 6-2 6 0s-6 2-6 4 6 2 6 0", mode: "stroke" as const }];

export function TerritoryPanel({ state, onUpgrade, onRepair, onUpgradeRecovery }: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const tracksRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [measuring, setMeasuring] = useState(true);
  const bounds = useRef({ available: -1, width: -1 });
  const [activeTrack, setActiveTrack] = useState<TerritoryUpgradeTrack>("wall");
  useLayoutEffect(() => {
    const panel = panelRef.current, tracks = tracksRef.current;
    const host = panel?.closest<HTMLElement>(".game-territory-stage") ?? panel?.parentElement;
    if (!panel || !tracks || !host) return;
    const requestMeasurement = () => {
      let available = host.clientHeight;
      // Measure the bounded workspace, not the currently selected page's natural height.
      for (let node: HTMLElement | null = panel.parentElement; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        available -= (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
        if (node === host) break;
        available -= (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
      }
      available = Math.max(0, available);
      const width = panel.clientWidth;
      // Ignore height changes caused by switching our own content mode.
      if (bounds.current.available === available && bounds.current.width === width) return;
      bounds.current = { available, width };
      setMeasuring(true);
    };
    requestMeasurement();
    const observer = new ResizeObserver(requestMeasurement);
    observer.observe(host); observer.observe(panel);
    return () => observer.disconnect();
  }, []);
  const wall = getTerritoryUpgrade(state, "wall");
  const shield = getTerritoryUpgrade(state, "shield");
  const wallRepair = getTerritoryRepair(state, "wall");
  const shieldRepair = getTerritoryRepair(state, "shield");
  const wallRecovery = getTerritoryRecovery(state, "wall");
  const shieldRecovery = getTerritoryRecovery(state, "shield");
  useLayoutEffect(() => {
    setMeasuring(true);
  }, [wall.level, shield.level, wallRecovery.level, shieldRecovery.level]);
  useLayoutEffect(() => {
    if (!measuring || !tracksRef.current) return;
    // Measurement renders the same two tracks as ordinary divs, then settles before paint.
    setCompact(tracksRef.current.getBoundingClientRect().height > bounds.current.available + 0.5);
    setMeasuring(false);
  }, [measuring]);
  const tabbed = compact && !measuring;

  return <section ref={panelRef} id="territory-panel" className="territory-panel" data-compact={tabbed ? "true" : "false"} aria-label="领地管理">
    <Tabs.Root className="territory-panel__tabs" value={activeTrack} onValueChange={value => {if (value === "wall" || value === "shield") setActiveTrack(value);}}>
      <GameTabsList className="territory-panel__navigation" aria-label="领地管理分类" labelVisibility="hidden">
        <Tabs.Trigger value="wall" aria-label="城墙" title="城墙" startIcon={<PencilIcon paths={wallPaths} size={28} sourceSize={24} seed="territory-wall-tab" decorative />}>城墙</Tabs.Trigger>
        <Tabs.Trigger value="shield" aria-label="护盾" title="护盾" startIcon={<PencilIcon paths={shieldPaths} size={28} sourceSize={24} seed="territory-shield-tab" decorative />}>护盾</Tabs.Trigger>
      </GameTabsList>
    <div ref={tracksRef} className="territory-panel__tracks">
      <TerritoryContent compact={tabbed} value="wall">
      <TerritoryTrack
        track="wall"
        title="城墙"
        icon={wallPaths}
        unit="生命"
        level={wall.level}
        current={wallRepair.current}
        maximum={wallRepair.maximum}
        upgradeCost={wall.cost}
        upgradeAllowed={wall.allowed}
        repair={wallRepair}
        recovery={wallRecovery}
        onUpgrade={onUpgrade}
        onRepair={onRepair}
        onUpgradeRecovery={onUpgradeRecovery}
      />
      </TerritoryContent>
      <TerritoryContent compact={tabbed} value="shield">
      <TerritoryTrack
        track="shield"
        title="护盾"
        icon={shieldPaths}
        unit="护盾"
        level={shield.level}
        current={shieldRepair.current}
        maximum={shieldRepair.maximum}
        upgradeCost={shield.cost}
        upgradeAllowed={shield.allowed}
        repair={shieldRepair}
        recovery={shieldRecovery}
        onUpgrade={onUpgrade}
        onRepair={onRepair}
        onUpgradeRecovery={onUpgradeRecovery}
      />
      </TerritoryContent>
    </div>
    </Tabs.Root>
  </section>;
}

function TerritoryContent({ compact, value, children }: { compact: boolean; value: TerritoryUpgradeTrack; children: ReactNode }) {
  return compact
    ? <Tabs.Content value={value} forceMount className="territory-panel__content">{children}</Tabs.Content>
    : <div className="territory-panel__content">{children}</div>;
}

function TerritoryTrack({ track, title, icon, unit, level, current, maximum, upgradeCost, upgradeAllowed, repair, recovery, onUpgrade, onRepair, onUpgradeRecovery }: {
  track: TerritoryUpgradeTrack;
  title: string;
  icon: readonly { d: string; mode?: "stroke" }[];
  unit: string;
  level: number;
  current: number;
  maximum: number;
  upgradeCost: number;
  upgradeAllowed: boolean;
  repair: ReturnType<typeof getTerritoryRepair>;
  recovery: ReturnType<typeof getTerritoryRecovery>;
  onUpgrade: (track: TerritoryUpgradeTrack) => void;
  onRepair: (track: TerritoryUpgradeTrack) => void;
  onUpgradeRecovery: (track: TerritoryUpgradeTrack) => void;
}) {
  return <section className="territory-panel__track" aria-label={`${title}管理`}>
    <div className="territory-panel__heading">
      <PencilIcon paths={icon} size={28} sourceSize={24} seed={`territory-${track}-icon`} decorative />
      <PencilText as="h3" className="territory-panel__track-title" seed={`territory-${track}-title`}>{`${title} · 等级 ${level}`}</PencilText>
    </div>
    <PencilText as="p" className="territory-panel__current" seed={`territory-${track}-current`}>{`${unit} ${statValue(current)} / ${statValue(maximum)}`}</PencilText>
    <div className="territory-panel__actions">
      <ActionButton
        kind="upgrade"
        ariaLabel={`${title}升级，费用 ${upgradeCost} 金币`}
        cost={upgradeCost}
        allowed={upgradeAllowed}
        onClick={() => onUpgrade(track)}
      />
      <ActionButton
        kind="repair"
        ariaLabel={`${title}修复，费用 ${repair.cost} 金币`}
        cost={repair.cost}
        allowed={repair.allowed}
        onClick={() => onRepair(track)}
      />
    </div>
    <RecoveryTrack
      track={track}
      title={title}
      rate={recovery.rate}
      level={recovery.level}
      unlocked={recovery.unlocked}
      cost={recovery.cost}
      allowed={recovery.allowed}
      onUpgrade={() => onUpgradeRecovery(track)}
    />
  </section>;
}

function ActionButton({ kind, ariaLabel, cost, allowed, onClick }: { kind: "upgrade" | "repair"; ariaLabel: string; cost: number; allowed: boolean; onClick: () => void }) {
  const paths = kind === "upgrade" ? upgradePaths : repairPaths;
  return <Button className={`territory-panel__action territory-panel__action--${kind}`} size="sm" fullWidth startIcon={<PencilIcon paths={paths} size={20} sourceSize={24} seed={`territory-${kind}-action`} decorative />} aria-label={ariaLabel} title={ariaLabel} disabled={!allowed} onClick={onClick}>
    <span className="territory-panel__action-cost" aria-hidden="true">
      <PencilText as="span" seed={`territory-${kind}-cost`}>{String(cost)}</PencilText>
      <PencilIcon paths={coinPaths} size={14} sourceSize={24} seed={`territory-${kind}-coin`} decorative />
    </span>
  </Button>;
}

function RecoveryTrack({ track, title, rate, level, unlocked, cost, allowed, onUpgrade }: {
  track: TerritoryUpgradeTrack;
  title: string;
  rate: number;
  level: number;
  unlocked: boolean;
  cost: number;
  allowed: boolean;
  onUpgrade: () => void;
}) {
  const recoveryIcon = track === "wall" ? wallRecoveryPaths : shieldRecoveryPaths;
  const actionIcon = unlocked ? upgradePaths : lockPaths;
  const actionName = unlocked ? "升级" : "解锁";
  const ariaLabel = `${title}自动恢复${actionName}，费用 ${cost} 金币`;
  return <section className={`territory-panel__recovery territory-panel__recovery--${track}`} aria-label={`${title}自动恢复`}>
    <div className="territory-panel__recovery-heading">
      <PencilIcon paths={recoveryIcon} size={20} sourceSize={24} seed={`territory-${track}-recovery`} decorative />
      <PencilText as="h4" seed={`territory-${track}-recovery-title`}>{`自动恢复 · 等级 ${level}`}</PencilText>
      <PencilText as="p" seed={`territory-${track}-recovery-rate`}>{`${statValue(rate)} / 秒`}</PencilText>
    </div>
    <Button className="territory-panel__recovery-action" size="sm" fullWidth startIcon={<PencilIcon paths={actionIcon} size={20} sourceSize={24} seed={`territory-${track}-recovery-action`} decorative />} aria-label={ariaLabel} title={ariaLabel} disabled={!allowed} onClick={onUpgrade}>
      <span className="territory-panel__action-cost" aria-hidden="true">
        <PencilText as="span" seed={`territory-${track}-recovery-cost`}>{String(cost)}</PencilText>
        <PencilIcon paths={coinPaths} size={14} sourceSize={24} seed={`territory-${track}-recovery-coin`} decorative />
      </span>
    </Button>
  </section>;
}

function statValue(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}
