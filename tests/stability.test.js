import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStability } from '../js/stability.js';

const base = {
  rocketType: 'pet',
  geometry: { noseLengthM: .08, bodyDiameterM: .066, bodyLengthM: .22, bottleVolumeM3: .0015, finRootChordM: .08, finSpanM: .06, finSweepRad: 10 * Math.PI / 180, finCount: 4, finRearOffsetM: .02, upperDiameterM: .011, upperLengthM: .1, transitionLengthM: .005, lowerDiameterM: .016, lowerLengthM: .15 },
  mass: { noseMassKg: .02, bodyMassKg: .03, finMassEachKg: .005 }, waterVolumeM3: .0004, targetStaticMargin: 1.2
};

test('stability calculation returns finite CG, CP and requested full SM', () => {
  const result = calculateStability(base);
  assert.equal(result.ok, true);
  assert.ok(Number.isFinite(result.cpM));
  assert.ok(Number.isFinite(result.cgFullM));
  assert.ok(Math.abs(result.staticMarginFull - 1.2) < 1e-10);
  assert.ok(result.recommendedBallastKg >= 0);
});

test('negative fin tip chord is rejected', () => {
  const input = structuredClone(base);
  input.geometry.finRootChordM = .01;
  input.geometry.finSpanM = .2;
  input.geometry.finSweepRad = Math.PI / 4;
  const result = calculateStability(input);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some(issue => issue.code === 'NEGATIVE_FIN_TIP'));
});

test('unreachable ballast target uses structured error, not sentinel', () => {
  const input = structuredClone(base); input.targetStaticMargin = 20;
  const result = calculateStability(input);
  assert.equal(result.ok, false);
  assert.equal(result.recommendedBallastKg, null);
  assert.ok(result.issues.some(issue => issue.code === 'BALLAST_UNREACHABLE'));
});

test('PET stability recommendation threshold is 0.7',()=>{
  const passing=structuredClone(base);passing.targetStaticMargin=.7;
  const failing=structuredClone(base);failing.targetStaticMargin=.69;
  assert.equal(calculateStability(passing).issues.some(issue=>issue.code==='UNSTABLE'),false);
  assert.equal(calculateStability(failing).issues.some(issue=>issue.code==='UNSTABLE'),true);
});

test('hydrogen stability recommendation threshold remains 1.0',()=>{
  const input=structuredClone(base);input.rocketType='hydrogen';input.geometry.upperDiameterM=.011;input.geometry.lowerDiameterM=.016;input.geometry.upperLengthM=.1;input.geometry.transitionLengthM=.005;input.geometry.lowerLengthM=.15;input.geometry.finRootChordM=.015;input.geometry.finSpanM=.003;input.mass.bodyMassKg=.05;input.mass.noseMassKg=0;input.waterVolumeM3=0;input.targetStaticMargin=null;input.workshopBallastKg=0;
  assert.equal(calculateStability(input).issues.some(issue=>issue.code==='UNSTABLE'),true);
});

test('default PET mass breakdown separates 70 g base mass from recommended ballast',()=>{
  const input=structuredClone(base);input.targetStaticMargin=1.2;const result=calculateStability(input);
  assert.ok(Math.abs(result.baseDryMassKg-.07)<1e-12);
  assert.ok(result.recommendedBallastKg>.45&&result.recommendedBallastKg<.49);
  assert.equal(result.appliedBallastKg,0);
});
