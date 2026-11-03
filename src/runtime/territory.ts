import type { Command, CommandTransition, GameEvent, GameState } from '../contracts';
import { getTerritoryUpgrade, hasValidTerritoryUpgradeValues, isTerritoryUpgradeTrack } from '../content/territory';

type UpgradeCommand = Extract<Command, { type: 'upgradeTerritory' }>;

/** One pure transaction; command-ID idempotence is handled by the runtime router. */
export function applyTerritoryUpgrade(state: GameState, command: UpgradeCommand): CommandTransition {
  const reject = (code: string, message: string): CommandTransition => ({
    state, events: [], result: { commandId: command.id, status: 'rejected', revision: state.revision, code, message },
  });
  if (command.type !== 'upgradeTerritory' || !isTerritoryUpgradeTrack(command.track)) {
    return reject('INVALID_ARGUMENT', '未知领地升级类别');
  }
  if (!hasValidTerritoryUpgradeValues(state)
      || ![state.revision, state.nextEventSeq, state.gameTimeMs].every(value => Number.isFinite(value) && value >= 0)) {
    return reject('INVALID_STATE', '领地数值无效');
  }
  const upgrade = getTerritoryUpgrade(state, command.track);
  if (!upgrade.allowed || upgrade.nextLevel === null) {
    const errors = {
      maxLevel: ['MAX_LEVEL', '已达最高等级'],
      coins: ['INSUFFICIENT_COINS', '金币不足'],
      phase: ['INVALID_PHASE', '请先暂停战斗再升级领地'],
    } as const;
    const [code, message] = errors[upgrade.reason ?? 'phase'];
    return reject(code, message);
  }
  const t = state.territory;
  const territory = command.track === 'wall'
    ? { ...t, wallLevel: upgrade.nextLevel, hp: t.hp + upgrade.increase, maxHp: t.maxHp + upgrade.increase }
    : { ...t, shieldLevel: upgrade.nextLevel, shield: (t.shield ?? 0) + upgrade.increase, maxShield: (t.maxShield ?? 0) + upgrade.increase };
  const event: GameEvent = {
    seq: state.nextEventSeq, gameTimeMs: state.gameTimeMs, type: 'territoryUpgraded',
    data: { track: command.track, level: upgrade.nextLevel, cost: upgrade.cost, increase: upgrade.increase },
  };
  const next: GameState = {
    ...state, territory, coins: state.coins - upgrade.cost,
    revision: state.revision + 1, nextEventSeq: state.nextEventSeq + 1, events: [...state.events, event],
  };
  return { state: next, events: [event], result: { commandId: command.id, status: 'executed', revision: next.revision } };
}
