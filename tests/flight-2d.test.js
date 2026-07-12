import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateFlight, simulateTrajectory2D } from '../js/flight.js';

const base = {
  geometry: { bodyDiameterM: .066, bodyLengthM: .22, bottleVolumeM3: .0015 }, mass: { dryMassKg: .1 },
  launch: { waterVolumeM3: .0004, nozzleDiameterM: .008, initialAbsolutePressurePa: 601325, airTemperatureK: 293.15, angleRad: Math.PI / 2, launcherLengthM: .5 },
  environment: { atmosphericPressurePa: 101325, airDensityKgM3: 1.225, gravityMps2: 9.80665, dragCoefficient: .5, dischargeCoefficient: .95, polytropicExponent: 1.2, windMps: { x: 0, z: 0 } },
  parachute: { enabled: false, areaM2: .12, dragCoefficient: .75 }
};

const run = changes => simulateTrajectory2D({ ...structuredClone(base), ...changes });

test('vertical zero-wind 2D agrees with the backward-compatible 1D API', () => {
  const input = structuredClone(base); input.launch.launcherLengthM = 0;
  const one = simulateFlight(input), two = simulateTrajectory2D(input);
  assert.ok(Math.abs(one.maxAltitudeM - two.maxAltitudeM) < 1e-9);
});

test('higher pressure increases maximum thrust and altitude', () => {
  const low = run({ launch: { ...base.launch, initialAbsolutePressurePa: 4 * 101325 } });
  const high = run({ launch: { ...base.launch, initialAbsolutePressurePa: 7 * 101325 } });
  assert.ok(high.maxThrustN > low.maxThrustN); assert.ok(high.maxAltitudeM > low.maxAltitudeM);
});

test('larger nozzle increases peak thrust and shortens water jet duration', () => {
  const small = run({ launch: { ...base.launch, nozzleDiameterM: .006 } });
  const large = run({ launch: { ...base.launch, nozzleDiameterM: .012 } });
  assert.ok(large.maxThrustN > small.maxThrustN); assert.ok(large.waterJetTimeS < small.waterJetTimeS);
});

test('higher dry mass and drag coefficient reduce altitude', () => {
  const normal = run({});
  const heavy = run({ mass: { dryMassKg: .2 } });
  const draggy = run({ environment: { ...base.environment, dragCoefficient: 1 } });
  assert.ok(heavy.maxAltitudeM < normal.maxAltitudeM); assert.ok(draggy.maxAltitudeM < normal.maxAltitudeM);
});

test('water fill has an interior altitude optimum', () => {
  const low = run({ launch: { ...base.launch, waterVolumeM3: .0001 } });
  const middle = run({ launch: { ...base.launch, waterVolumeM3: .0005 } });
  const high = run({ launch: { ...base.launch, waterVolumeM3: .0012 } });
  assert.ok(middle.maxAltitudeM > low.maxAltitudeM);
  assert.ok(middle.maxAltitudeM > high.maxAltitudeM);
});

test('reversing wind reverses horizontal drift', () => {
  const right = run({ environment: { ...base.environment, windMps: { x: 5, z: 0 } } });
  const left = run({ environment: { ...base.environment, windMps: { x: -5, z: 0 } } });
  assert.ok(right.horizontalRangeM > 0); assert.ok(left.horizontalRangeM < 0);
});

test('launcher exit is recorded and all numeric series values stay finite and non-negative where required', () => {
  const result = run({});
  assert.ok(result.events.some(event => event.type === 'launcher-exit')); assert.ok(result.launcherExitVelocityMps > 0);
  for (const point of result.series) {
    assert.ok(Object.values(point).filter(v => typeof v === 'number').every(Number.isFinite));
    assert.ok(point.waterVolumeM3 >= 0 && point.airMassKg >= 0 && point.airTemperatureK > 0 && point.massKg >= 0 && point.pressurePa >= 0);
  }
});

test('RK4 result converges when the time step is halved',()=>{
  const coarse=run({integration:{timeStepS:.002,maxTimeS:60}}),fine=run({integration:{timeStepS:.001,maxTimeS:60}});
  assert.ok(Math.abs(coarse.maxAltitudeM-fine.maxAltitudeM)/fine.maxAltitudeM<.01);
  assert.ok(Math.abs(coarse.horizontalRangeM-fine.horizontalRangeM)<.25);
});

test('actual ballast increases dry mass and lowers altitude without using recommended ballast implicitly',()=>{
  const light=run({mass:{baseDryMassKg:.07,ballastMassKg:0,dryMassKg:.07}});
  const heavy=run({mass:{baseDryMassKg:.07,ballastMassKg:.2,dryMassKg:.27}});
  assert.equal(light.massBreakdown.dryMassKg,.07);assert.equal(heavy.massBreakdown.ballastMassKg,.2);assert.ok(light.maxAltitudeM>heavy.maxAltitudeM);
});

test('diagnostics identify excessive ballast and low actual static margin',()=>{
  const result=run({mass:{baseDryMassKg:.07,ballastMassKg:.2,dryMassKg:.27},stabilityAssessment:{staticMarginFull:.4,staticMarginEmpty:.6,threshold:.7}});
  assert.ok(result.diagnostics.some(item=>item.code==='HEAVY_BALLAST'));assert.ok(result.diagnostics.some(item=>item.code==='LOW_STATIC_MARGIN'));
});
