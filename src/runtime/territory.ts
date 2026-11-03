import type { Command, CommandTransition, GameEvent, GameState } from '../contracts';
import {
  getTerritoryRepair,
  getTerritoryUpgrade,
  isTerritoryUpgradeTrack,
} from '../content/territory';

type UpgradeCommand = Extract<Command, { type: 'upgradeTerritory' }>;
type RepairCommand = Extract<Command, { type: 'repairTerritory' }>;

const MAX_SAFE = Number.MAX_SAFE_INTEGER;

function reject(state: GameState, commandId: string, code: string, message: string): CommandTransition {
  return {
    state,
    events: [],
    result: { commandId, status: 'rejected', revision: state.revision, code, message },
  };
}

function hasValidTransactionMetadata(state: GameState): boolean {
  return Number.isSafeInteger(state.revision) && state.revision >= 0 && state.revision < MAX_SAFE
    && Number.isSafeInteger(state.nextEventSeq) && state.nextEventSeq >= 0 && state.nextEventSeq < MAX_SAFE
    && Number.isFinite(state.gameTimeMs) && state.gameTimeMs >= 0 && state.gameTimeMs <= MAX_SAFE
    && Array.isArray(state.events);
}

function isSafeNonnegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= MAX_SAFE;
}

function errorCode(reason: string | undefined): [string, string] {
  switch (reason) {
    case 'coins': return ['INSUFFICIENT_COINS', '金币不足'];
    case 'phase': return ['INVALID_PHASE', '请先暂停战斗再整理领地'];
    case 'full': return ['ALREADY_FULL', '领地状态已满'];
    default: return ['INVALID_STATE', '领地数值无效'];
  }
}

function commit(
  state: GameState,
  commandId: string,
  type: 'territoryUpgraded' | 'territoryRepaired',
  data: Record<string, unknown>,
  territory: GameState['territory'],
  coins: number,
): CommandTransition {
  if (!isSafeNonnegative(coins)) return reject(state, commandId, 'INVALID_STATE', '领地数值无效');
  const event: GameEvent = {
    seq: state.nextEventSeq,
    gameTimeMs: state.gameTimeMs,
    type,
    data,
  };
  const next: GameState = {
    ...state,
    territory,
    coins,
    revision: state.revision + 1,
    nextEventSeq: state.nextEventSeq + 1,
    events: [...state.events, event],
  };
  return {
    state: next,
    events: [event],
    result: { commandId, status: 'executed', revision: next.revision },
  };
}

/** One pure transaction; command-ID idempotence is handled by the runtime router. */
export function applyTerritoryUpgrade(state: GameState, command: UpgradeCommand): CommandTransition {
  if (command.type !== 'upgradeTerritory' || !isTerritoryUpgradeTrack(command.track)) {
    return reject(state, command.id, 'INVALID_ARGUMENT', '未知领地升级类别');
  }
  if (!hasValidTransactionMetadata(state)) return reject(state, command.id, 'INVALID_STATE', '领地数值无效');

  const upgrade = getTerritoryUpgrade(state, command.track);
  if (!upgrade.allowed || upgrade.nextLevel === null) {
    const [code, message] = errorCode(upgrade.reason);
    return reject(state, command.id, code, message);
  }
  const t = state.territory;
  const territory = command.track === 'wall'
    ? { ...t, wallLevel: upgrade.nextLevel, hp: t.hp + upgrade.increase, maxHp: t.maxHp + upgrade.increase }
    : { ...t, shieldLevel: upgrade.nextLevel, shield: (t.shield ?? 0) + upgrade.increase, maxShield: (t.maxShield ?? 0) + upgrade.increase };
  if (![territory.hp, territory.maxHp, territory.shield ?? 0, territory.maxShield ?? 0, upgrade.cost, upgrade.increase]
    .every(isSafeNonnegative) || !Number.isSafeInteger(upgrade.nextLevel)) {
    return reject(state, command.id, 'INVALID_STATE', '领地数值无效');
  }
  return commit(state, command.id, 'territoryUpgraded', {
    track: command.track,
    level: upgrade.nextLevel,
    cost: upgrade.cost,
    increase: upgrade.increase,
  }, territory, state.coins - upgrade.cost);
}

/** Restore one territory track atomically; the preview and execution share content rules. */
export function applyTerritoryRepair(state: GameState, command: RepairCommand): CommandTransition {
  if (command.type !== 'repairTerritory' || !isTerritoryUpgradeTrack(command.track)) {
    return reject(state, command.id, 'INVALID_ARGUMENT', '未知领地修复类别');
  }
  if (!hasValidTransactionMetadata(state)) return reject(state, command.id, 'INVALID_STATE', '领地数值无效');

  const repair = getTerritoryRepair(state, command.track);
  if (!repair.allowed) {
    const [code, message] = errorCode(repair.reason);
    return reject(state, command.id, code, message);
  }
  if (!isSafeNonnegative(repair.current) || !isSafeNonnegative(repair.maximum)
      || !isSafeNonnegative(repair.restore) || !isSafeNonnegative(repair.cost)
      || repair.restore <= 0 || repair.cost <= 0) {
    return reject(state, command.id, 'INVALID_STATE', '领地数值无效');
  }

  const t = state.territory;
  const territory = command.track === 'wall'
    ? { ...t, hp: repair.maximum }
    : { ...t, shield: repair.maximum };
  const coins = state.coins - repair.cost;
  if (!isSafeNonnegative(coins)) return reject(state, command.id, 'INVALID_STATE', '领地数值无效');
  return commit(state, command.id, 'territoryRepaired', {
    track: command.track,
    cost: repair.cost,
    increase: repair.restore,
    hp: territory.hp,
    shield: territory.shield ?? 0,
  }, territory, coins);
}
