import assert from "node:assert/strict";
import test from "node:test";
import { integrateMotion } from "./motion";

function close(actual: number, expected: number, epsilon = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be within ${epsilon} of ${expected}`);
}

test("exponential motion integrates a batch identically to its fixed substeps", () => {
  const cap = 10;
  const rampMs = 1200;
  const start = 1.8;
  const batch = integrateMotion(start, cap, rampMs, 1000);
  let speed = start;
  let distance = 0;
  for (let index = 0; index < 20; index++) {
    const step = integrateMotion(speed, cap, rampMs, 50);
    speed = step.speed;
    distance += step.distance;
  }

  close(speed, batch.speed);
  close(distance, batch.distance);
});

test("zero current speed accelerates smoothly without a discontinuous first frame", () => {
  const first = integrateMotion(0, 10, 1200, 50);
  const expectedResponse = -Math.expm1(-(50 / 1000) / 1.2);

  close(first.speed, 10 * expectedResponse);
  close(first.distance, 10 * (50 / 1000) - 10 * 1.2 * expectedResponse);
  assert.ok(first.speed > 0);
  assert.ok(first.speed < 10);
});

test("zero duration, zero cap, and zero ramp produce finite bounded results", () => {
  assert.deepEqual(integrateMotion(4, 10, 1200, 0), { speed: 4, distance: 0 });
  assert.deepEqual(integrateMotion(4, 0, 1200, 100), { speed: 0, distance: 0 });
  assert.deepEqual(integrateMotion(4, 10, 0, 100), { speed: 10, distance: 1 });
});

test("fireball slow start reaches the same speed and distance as waves at an 18 percent launch speed", () => {
  const fireballStart = 50 * 0.18;
  const result = integrateMotion(fireballStart, 50, 600, 50);
  const response = -Math.expm1(-(50 / 1000) / 0.6);

  close(result.speed, fireballStart + (50 - fireballStart) * response);
  close(result.distance, 50 * (50 / 1000) - (50 - fireballStart) * 0.6 * response);
  assert.ok(result.speed < 50 * 0.3);
});
