import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateFlight } from '../js/flight.js';

const base = {
  geometry: { bodyDiameterM: .066, bodyLengthM: .22, bottleVolumeM3: .0015 },
  mass: { dryMassKg: .1 },
  launch: { waterVolumeM3: .0004, nozzleDiameterM: .008, initialAbsolutePressurePa: 601325, airTemperatureK: 293.15 },
  environment: { atmosphericPressurePa: 101325, airDensityKgM3: 1.225, gravityMps2: 9.80665, dragCoefficient: .5, dischargeCoefficient: .95, polytropicExponent: 1.2 },
  parachute: { enabled: true, areaM2: .12, dragCoefficient: .75 }
};

test('nominal flight is finite, monotonic in propellant mass, and lands', () => {
  const result = simulateFlight(base);
  assert.equal(result.ok, true);
  assert.ok(result.maxAltitudeM > 0);
  assert.ok(result.events.some(event => event.type === 'water-out'));
  assert.ok(result.events.some(event => event.type === 'apogee'));
  assert.ok(result.events.some(event => event.type === 'landing'));
  assert.ok(result.series.every(point => Object.values(point).filter(value => typeof value === 'number').every(Number.isFinite)));
  for (let i = 1; i < result.series.length; i++) {
    assert.ok(result.series[i].waterVolumeM3 <= result.series[i - 1].waterVolumeM3 + 1e-12);
    assert.ok(result.series[i].massKg <= result.series[i - 1].massKg + 1e-12);
  }
});

test('full bottle is rejected', () => {
  const input = structuredClone(base); input.launch.waterVolumeM3 = input.geometry.bottleVolumeM3;
  const result = simulateFlight(input);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some(issue => issue.code === 'NO_AIR_VOLUME'));
});

test('pressure at or below atmosphere produces warning and no meaningful launch', () => {
  const input = structuredClone(base); input.launch.initialAbsolutePressurePa = input.environment.atmosphericPressurePa;
  const result = simulateFlight(input);
  assert.ok(result.issues.some(issue => issue.code === 'NO_PRESSURE_DIFFERENCE'));
  assert.equal(result.maxAltitudeM, 0);
});
