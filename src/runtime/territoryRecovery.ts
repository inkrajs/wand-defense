import type { Command, CommandTransition, GameEvent, GameState } from '../contracts';
import { getTerritoryRecovery } from '../content/territoryRecovery';
import { isTerritoryUpgradeTrack } from '../content/territory';

type RecoveryUpgradeCommand = Extract<Command, { type: 'upgradeTerritoryRecovery' }>;

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

/** Unlock or raise one independent territory recovery track as an atomic command. */
export function applyTerritoryRecoveryUpgrade(
  state: GameState,
  command: RecoveryUpgradeCommand,
): CommandTransition {
  if (command.type !== 'upgradeTerritoryRecovery' || !isTerritoryUpgradeTrack(command.track)) {
    return reject(state, command.id, 'INVALID_ARGUMENT', '未知领地恢复类别');
  }
  if (!hasValidTransactionMetadata(state)) return reject(state, command.id, 'INVALID_STATE', '领地恢复状态无效');

  const preview = getTerritoryRecovery(state, command.track);
  if (!preview.allowed) {
    switch (preview.reason) {
      case 'coins': return reject(state, command.id, 'INSUFFICIENT_COINS', '金币不足');
      case 'phase': return reject(state, command.id, 'INVALID_PHASE', '请先暂停战斗再升级领地恢复');
      default: return reject(state, command.id, 'INVALID_STATE', '领地恢复状态无效');
    }
  }

  const level = preview.unlocked ? preview.level + 1 : 1;
  if (!Number.isSafeInteger(preview.level) || preview.level < 0
      || !Number.isSafeInteger(level) || level < 1
      || !isSafeNonnegative(preview.nextRate) || preview.nextRate <= 0
      || !isSafeNonnegative(preview.cost) || preview.cost <= 0
      || !isSafeNonnegative(state.coins - preview.cost)) {
    return reject(state, command.id, 'INVALID_STATE', '领地恢复状态无效');
  }

  const territory = command.track === 'wall'
    ? { ...state.territory, wallRepairLevel: level }
    : { ...state.territory, shieldRepairLevel: level };
  const event: GameEvent = {
    seq: state.nextEventSeq,
    gameTimeMs: state.gameTimeMs,
    type: 'territoryRecoveryUpgraded',
    data: { track: command.track, level, cost: preview.cost, rate: preview.nextRate },
  };
  const next: GameState = {
    ...state,
    territory,
    coins: state.coins - preview.cost,
    revision: state.revision + 1,
    nextEventSeq: state.nextEventSeq + 1,
    events: [...state.events, event],
  };
  return {
    state: next,
    events: [event],
    result: { commandId: command.id, status: 'executed', revision: next.revision },
  };
}
