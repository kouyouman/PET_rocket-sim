import { DEFAULT_MAX_TIME_S, DEFAULT_TIME_STEP_S, WATER_DENSITY_KG_M3 } from './constants.js';
import { createPropulsionState, evaluatePropulsion, advancePropulsion } from './propulsion.js';
import { dragVector } from './aerodynamics.js';
import { validateDesign, hasErrors } from '../validation.js';
import { rk4Step, zeroCrossingFraction, interpolate } from './integrator.js';

/** Simulate a 2D point mass, using SI units throughout. */
export function simulateTrajectory2D(input) {
  const issues = validateDesign(input); if (hasErrors(issues)) return failed(issues);
  const dtS = input.integration?.timeStepS ?? DEFAULT_TIME_STEP_S;
  const maxTimeS = input.integration?.maxTimeS ?? DEFAULT_MAX_TIME_S;
  const angleRad = input.launch.angleRad ?? Math.PI / 2;
  const launcherLengthM = Math.max(0, input.launch.launcherLengthM ?? 0);
  const axis = { x: Math.cos(angleRad), z: Math.sin(angleRad) };
  const wind = input.environment.windMps ?? { x: 0, z: 0 };
  const bodyAreaM2 = Math.PI * (input.geometry.bodyDiameterM / 2) ** 2;
  const massBreakdown = { baseDryMassKg: input.mass.baseDryMassKg ?? input.mass.dryMassKg, ballastMassKg: input.mass.ballastMassKg ?? 0, dryMassKg: input.mass.dryMassKg };
  const pressureInput = input.launch.pressureInput ?? { kind: 'absolute', valueAtm: input.launch.initialAbsolutePressurePa / input.environment.atmosphericPressurePa, absolutePressurePa: input.launch.initialAbsolutePressurePa };
  const resultContext = { massBreakdown, pressureInput, stabilityAssessment: input.stabilityAssessment ?? null, bottleVolumeM3: input.geometry.bottleVolumeM3, initialWaterVolumeM3: input.launch.waterVolumeM3 };
  let propulsion = createPropulsionState(input);
  let position = { x: 0, z: 0 }, velocity = { x: 0, z: 0 };
  let onLauncher = launcherLengthM > 0, parachuteDeployed = false, apogeeReached = false, previousVz = 0;
  let maxAltitudeM = 0, maxVelocityMps = 0, maxAscentVelocityMps = 0, maxDescentVelocityMps = 0, maxThrustN = 0, launcherExitVelocityMps = launcherLengthM === 0 ? 0 : null;
  const events = [], series = []; const sampleEvery = Math.max(1, Math.round(.02 / dtS));
  for (let step = 0, timeS = 0; timeS <= maxTimeS; step++, timeS += dtS) {
    const propulsionRates = evaluatePropulsion(propulsion, input);
    const speed = Math.hypot(velocity.x, velocity.z);
    const thrustDirection = onLauncher || speed < 1e-9 ? axis : { x: velocity.x / speed, z: velocity.z / speed };
    const activeArea = parachuteDeployed ? input.parachute.areaM2 : bodyAreaM2;
    const activeCd = parachuteDeployed ? input.parachute.dragCoefficient : input.environment.dragCoefficient;
    const drag = dragVector({ velocity, wind, airDensityKgM3: input.environment.airDensityKgM3, dragCoefficient: activeCd, referenceAreaM2: activeArea });
    const massKg = input.mass.dryMassKg + propulsion.waterVolumeM3 * WATER_DENSITY_KG_M3 + propulsion.airMassKg;
    let acceleration = { x: (propulsionRates.thrustN * thrustDirection.x + drag.x) / massKg, z: (propulsionRates.thrustN * thrustDirection.z + drag.z) / massKg - input.environment.gravityMps2 };
    const previousPosition = { ...position }, previousVelocity = { ...velocity };
    if (onLauncher) {
      const along = acceleration.x * axis.x + acceleration.z * axis.z;
      const constrained = Math.max(0, along); acceleration = { x: constrained * axis.x, z: constrained * axis.z };
      const velocityAlong = Math.max(0, velocity.x * axis.x + velocity.z * axis.z + constrained * dtS);
      velocity = { x: velocityAlong * axis.x, z: velocityAlong * axis.z };
      position = { x: position.x + velocity.x * dtS, z: position.z + velocity.z * dtS };
      const beforeDistance = previousPosition.x * axis.x + previousPosition.z * axis.z;
      const afterDistance = position.x * axis.x + position.z * axis.z;
      if (afterDistance >= launcherLengthM) { const fraction = Math.max(0, Math.min(1, (launcherLengthM - beforeDistance) / Math.max(1e-12, afterDistance - beforeDistance))); onLauncher = false; launcherExitVelocityMps = velocityAlong; events.push({ type: 'launcher-exit', timeS: timeS + fraction * dtS, xM: interpolate(previousPosition.x, position.x, fraction), altitudeM: interpolate(previousPosition.z, position.z, fraction) }); }
    } else {
      const next = rk4Step({ x: position.x, z: position.z, vx: velocity.x, vz: velocity.z }, dtS, current => {
        const stageSpeed = Math.hypot(current.vx, current.vz);
        const stageDirection = stageSpeed < 1e-9 ? thrustDirection : { x: current.vx / stageSpeed, z: current.vz / stageSpeed };
        const stageDrag = dragVector({ velocity: { x: current.vx, z: current.vz }, wind, airDensityKgM3: input.environment.airDensityKgM3, dragCoefficient: activeCd, referenceAreaM2: activeArea });
        return { x: current.vx, z: current.vz, vx: (propulsionRates.thrustN * stageDirection.x + stageDrag.x) / massKg, vz: (propulsionRates.thrustN * stageDirection.z + stageDrag.z) / massKg - input.environment.gravityMps2 };
      });
      position = { x: next.x, z: next.z }; velocity = { x: next.vx, z: next.vz };
    }
    const advanced = advancePropulsion(propulsion, propulsionRates, dtS); propulsion = advanced.state;
    for (const event of advanced.events) events.push({ type: event.type, timeS: timeS + event.fraction * dtS, xM: interpolate(previousPosition.x, position.x, event.fraction), altitudeM: interpolate(previousPosition.z, position.z, event.fraction) });
    if (!apogeeReached && previousVz > 0 && velocity.z <= 0) { const fraction = zeroCrossingFraction(previousVz, velocity.z); const eventTime = timeS + fraction * dtS; apogeeReached = true; events.push({ type: 'apogee', timeS: eventTime, xM: interpolate(previousPosition.x, position.x, fraction), altitudeM: interpolate(previousPosition.z, position.z, fraction) }); if (input.parachute.enabled) { parachuteDeployed = true; events.push({ type: 'parachute-deploy', timeS: eventTime, xM: interpolate(previousPosition.x, position.x, fraction), altitudeM: interpolate(previousPosition.z, position.z, fraction) }); } }
    previousVz = velocity.z; const currentSpeed = Math.hypot(velocity.x, velocity.z);
    maxAltitudeM = Math.max(maxAltitudeM, position.z); maxVelocityMps = Math.max(maxVelocityMps, currentSpeed); maxAscentVelocityMps = Math.max(maxAscentVelocityMps, velocity.z); maxDescentVelocityMps = Math.max(maxDescentVelocityMps, -velocity.z); maxThrustN = Math.max(maxThrustN, propulsionRates.thrustN);
    if (step % sampleEvery === 0) series.push({ timeS, xM: position.x, altitudeM: Math.max(0, position.z), vxMps: velocity.x, vzMps: velocity.z, velocityMps: currentSpeed, accelerationMps2: Math.hypot(acceleration.x, acceleration.z), thrustN: propulsionRates.thrustN, dragN: drag.magnitudeN, massKg, pressurePa: propulsionRates.pressurePa, waterVolumeM3: propulsion.waterVolumeM3, airMassKg: propulsion.airMassKg, airTemperatureK: propulsion.airTemperatureK, phase: propulsion.phase, flowRegime: propulsionRates.flowRegime, onLauncher });
    if (onLauncher && propulsion.phase === 'coast' && currentSpeed < 1e-6) {
      issues.push({ field: 'launcher', code: 'NO_LAUNCH', severity: 'warning', message: '推力不足のためランチャーを離脱できませんでした。' });
      events.push({ type: 'no-launch', timeS, xM: position.x, altitudeM: position.z });
      return finish({ series, events, issues, maxAltitudeM, maxVelocityMps, maxAscentVelocityMps, maxDescentVelocityMps, maxThrustN, position, velocity, launcherExitVelocityMps, coefficients: coefficientSnapshot(input), ...resultContext });
    }
    if (!onLauncher && timeS > .05 && position.z <= 0 && velocity.z < 0) { const fraction = zeroCrossingFraction(previousPosition.z, position.z); const landingTime = timeS + fraction * dtS; const landingX = interpolate(previousPosition.x, position.x, fraction); events.push({ type: 'landing', timeS: landingTime, xM: landingX, altitudeM: 0 }); return finish({ series, events, issues, maxAltitudeM, maxVelocityMps, maxAscentVelocityMps, maxDescentVelocityMps, maxThrustN, position: { x: landingX, z: 0 }, velocity, launcherExitVelocityMps, coefficients: coefficientSnapshot(input), ...resultContext }); }
  }
  issues.push({ field: 'simulation', code: 'TIME_LIMIT', severity: 'warning', message: '制限時間内に着地しませんでした。' });
  return finish({ series, events, issues, maxAltitudeM, maxVelocityMps, maxAscentVelocityMps, maxDescentVelocityMps, maxThrustN, position, velocity, launcherExitVelocityMps, coefficients: coefficientSnapshot(input), ...resultContext });
}

function finish(data) { const event = type => data.events.find(item => item.type === type); const result={ ok: true, ...data, horizontalRangeM: data.position.x, landingVelocityMps: Math.hypot(data.velocity.x, data.velocity.z), waterJetTimeS: event('water-out')?.timeS ?? 0, propulsionEndTimeS: event('air-out')?.timeS ?? event('water-out')?.timeS ?? 0, apogeeTimeS: event('apogee')?.timeS ?? null, totalFlightTimeS: event('landing')?.timeS ?? data.series.at(-1)?.timeS ?? 0, model: '2D point-mass v2: RK4 translation, compressible air blowdown, launcher constraint and relative-wind drag', assumptions: ['姿勢は持たず、離脱後の推力は速度方向', '風は一定', '抗力係数は一定', 'パラシュートは最高点で瞬時に全開'] }; result.diagnostics=buildDiagnostics(result);return result; }
function failed(issues) { return { ok: false, series: [], events: [], issues, model: '2D point-mass bottle rocket', assumptions: [] }; }
function coefficientSnapshot(input) { return { modelVersion: '2d-point-mass-v2', dischargeCoefficient: input.environment.dischargeCoefficient, polytropicExponent: input.environment.polytropicExponent, dragCoefficient: input.environment.dragCoefficient }; }
function buildDiagnostics(result) {
  const diagnostics=[];
  if(result.massBreakdown.ballastMassKg>result.massBreakdown.baseDryMassKg*2||result.massBreakdown.ballastMassKg>.15)diagnostics.push({code:'HEAVY_BALLAST',severity:'warning',title:'バラストが重い',message:'実搭載バラストが大きく、高度を下げています。機体形状と安定性を見直してください。'});
  if(result.massBreakdown.dryMassKg>.3)diagnostics.push({code:'HEAVY_DRY_MASS',severity:'info',title:'乾燥質量が大きい',message:'機体が重いため加速しにくい条件です。質量内訳を確認してください。'});
  if(result.pressureInput.absolutePressurePa<3*101325)diagnostics.push({code:'LOW_PRESSURE_DIFFERENCE',severity:'info',title:'圧力差が小さい',message:'ボトル内圧と外気圧の差が小さく、推力が限られています。'});
  if(result.initialWaterVolumeM3>.75*result.bottleVolumeM3)diagnostics.push({code:'HIGH_WATER_FILL',severity:'info',title:'水量が多い可能性',message:'水が多いと初期空気体積が減り、機体も重くなります。'});
  if(result.launcherExitVelocityMps!==null&&result.launcherExitVelocityMps<5)diagnostics.push({code:'LOW_LAUNCHER_EXIT_SPEED',severity:'warning',title:'離脱速度が低い',message:'ランチャー離脱時の速度が低く、安定した飛行へ移りにくい条件です。'});
  if(result.stabilityAssessment&&Math.min(result.stabilityAssessment.staticMarginFull,result.stabilityAssessment.staticMarginEmpty)<result.stabilityAssessment.threshold-1e-9)diagnostics.push({code:'LOW_STATIC_MARGIN',severity:'warning',title:'実搭載量では静安定不足',message:'実際のバラスト量で計算したSMが0.7未満です。高度だけでなく安定性も確認してください。'});
  return diagnostics;
}
