import test from 'node:test';
import assert from 'node:assert/strict';
import { sizeParachute } from '../js/parachute.js';

test('parachute area reproduces drag equilibrium', () => {
  const input = { massKg: .2, targetDescentMps: 5, dragCoefficient: .75, airDensityKgM3: 1.225 };
  const result = sizeParachute(input);
  assert.equal(result.ok, true);
  const drag = .5 * input.airDensityKgM3 * input.dragCoefficient * result.areaM2 * input.targetDescentMps ** 2;
  assert.ok(Math.abs(drag - input.massKg * 9.80665) < 1e-10);
});
