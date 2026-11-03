/** Integrates a capped exponential speed ramp over one simulation step. */
export function integrateMotion(
  current: number,
  cap: number,
  rampMs: number,
  dtMs: number,
): { speed: number; distance: number } {
  const safeCap = Number.isFinite(cap) ? Math.max(0, cap) : 0;
  const safeCurrent = Number.isFinite(current) ? Math.min(safeCap, Math.max(0, current)) : safeCap;
  const dt = Number.isFinite(dtMs) ? Math.max(0, dtMs) : 0;
  const tau = Number.isFinite(rampMs) ? Math.max(0, rampMs) / 1_000 : 0;
  const seconds = dt / 1_000;
  if (tau === 0) return { speed: safeCap, distance: safeCap * seconds };
  const response = -Math.expm1(-seconds / tau);
  return {
    speed: Math.min(safeCap, safeCurrent + (safeCap - safeCurrent) * response),
    distance: Math.max(0, safeCap * seconds - (safeCap - safeCurrent) * tau * response),
  };
}
