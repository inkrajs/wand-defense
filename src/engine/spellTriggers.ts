import type { CombatEntity, GameState } from '../contracts';
import { TRIGGER_LIMITS } from '../contracts/trigger-limits';
import { spawnAreaEffects } from './areaEffects';

type Emit = (type: string, data: Record<string, unknown>) => void;

/** One-shot release of an already paid, detached payload. It cannot carry another trigger. */
export function releaseSpellTrigger(
  state: GameState, carrier: CombatEntity, emit: Emit, allowed: boolean,
  spawnPayloadProjectiles: typeof import('./projectiles').spawnProjectiles,
): void {
  const trigger = carrier.trigger;
  if (!trigger) return;
  delete carrier.trigger; delete carrier.triggerRemainingMs;
  if (!allowed) {
    emit('spellTriggerSuppressed', { entityId: carrier.id, reason: 'stepBudget', x: carrier.x, y: carrier.y });
    return;
  }
  const payload = trigger.payload;
  if (!carrier.sourceCharacterId || !Number.isFinite(carrier.x) || !Number.isFinite(carrier.y)) return;
  // Explicit fields exclude any nested trigger supplied by a malformed old checkpoint.
  const spec = {
    itemId: payload.itemId, definitionId: payload.definitionId,
    ...(payload.element ? { element: payload.element } : {}),
    power: payload.power, range: payload.range,
    casts: Math.min(TRIGGER_LIMITS.payloadCopies, Math.max(1, payload.casts)),
    burstCount: Math.min(TRIGGER_LIMITS.payloadCopies, Math.max(1, payload.burstCount)),
    splitCount: Math.min(TRIGGER_LIMITS.payloadCopies, Math.max(1, payload.splitCount)),
    attackRoll: payload.attackRoll, onHit: payload.onHit,
  };
  // Truncate the product as well as individual burst/split counts through the factory's budget.
  let spawned = false;
  if (payload.effect === 'projectile') {
    spawned = spawnPayloadProjectiles(state, carrier.sourceCharacterId, {
      ...spec, speed: payload.speed ?? 72, impact: payload.impact,
      origin: { x: carrier.x, y: carrier.y }, fixedOrigin: true, maxCasts: TRIGGER_LIMITS.payloadCopies,
    }, emit);
  } else if (payload.effect === 'area' && payload.area) {
    spawned = spawnAreaEffects(state, carrier.sourceCharacterId, {
      ...spec, area: structuredClone(payload.area), position: { x: carrier.x, y: carrier.y }, maxCasts: TRIGGER_LIMITS.payloadCopies,
    }, emit);
  }
  emit('spellTriggered', {
    entityId: carrier.id, sourceCharacterId: carrier.sourceCharacterId,
    sourceItemId: carrier.sourceItemId, payloadItemId: payload.itemId, definitionId: payload.definitionId,
    modifierItemId: trigger.modifierItemId, mode: trigger.mode, x: carrier.x, y: carrier.y, spawned,
  });
}
