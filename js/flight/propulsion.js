import { WATER_DENSITY_KG_M3, AIR_GAS_CONSTANT_J_KG_K, AIR_HEAT_CAPACITY_RATIO, EPSILON } from './constants.js';

export function createPropulsionState({ geometry, launch }) {
  const initialAirVolumeM3 = geometry.bottleVolumeM3 - launch.waterVolumeM3;
  const initialAirMassKg = launch.initialAbsolutePressurePa * initialAirVolumeM3 / (AIR_GAS_CONSTANT_J_KG_K * launch.airTemperatureK);
  return { phase: launch.waterVolumeM3 > EPSILON ? 'water' : 'air', waterVolumeM3: launch.waterVolumeM3, airMassKg: initialAirMassKg, airTemperatureK: launch.airTemperatureK, initialAirVolumeM3, initialAirMassKg, waterEndPressurePa: null, airMassAtWaterEndKg: null, airTemperatureAtWaterEndK: null };
}

export function evaluateWaterJet(state, { geometry, launch, environment }) {
  const nozzleAreaM2 = Math.PI * (launch.nozzleDiameterM / 2) ** 2;
  const airVolumeM3 = geometry.bottleVolumeM3 - state.waterVolumeM3;
  const pressurePa = launch.initialAbsolutePressurePa * (state.initialAirVolumeM3 / airVolumeM3) ** environment.polytropicExponent;
  const pressureDeltaPa = Math.max(0, pressurePa - environment.atmosphericPressurePa);
  const exhaustVelocityMps = pressureDeltaPa > 0 ? Math.sqrt(2 * pressureDeltaPa / WATER_DENSITY_KG_M3) : 0;
  const waterMassFlowKgs = environment.dischargeCoefficient * nozzleAreaM2 * WATER_DENSITY_KG_M3 * exhaustVelocityMps;
  return { pressurePa, pressureDeltaPa, thrustN: waterMassFlowKgs * exhaustVelocityMps, waterVolumeRateM3s: -waterMassFlowKgs / WATER_DENSITY_KG_M3, airMassRateKgs: 0, airTemperatureRateKs: 0, exhaustVelocityMps, flowRegime: 'water' };
}

/** Compressible ideal-gas nozzle flow, including choked and unchoked regimes. */
export function evaluateAirJet(state, { geometry, launch, environment }) {
  const gamma = AIR_HEAT_CAPACITY_RATIO, area = Math.PI * (launch.nozzleDiameterM / 2) ** 2;
  const temperatureK = Math.max(1, state.airTemperatureK);
  const pressurePa = state.airMassKg * AIR_GAS_CONSTANT_J_KG_K * temperatureK / geometry.bottleVolumeM3;
  const ambient = environment.atmosphericPressurePa;
  if (pressurePa <= ambient || state.airMassKg <= EPSILON) return { pressurePa: Math.max(0, pressurePa), pressureDeltaPa: 0, thrustN: 0, waterVolumeRateM3s: 0, airMassRateKgs: 0, airTemperatureRateKs: 0, exhaustVelocityMps: 0, flowRegime: 'coast' };
  const criticalRatio = (2 / (gamma + 1)) ** (gamma / (gamma - 1));
  const choked = ambient / pressurePa <= criticalRatio;
  let exitPressurePa, exitTemperatureK, exhaustVelocityMps, massFlowKgs;
  if (choked) {
    exitPressurePa = pressurePa * criticalRatio;
    exitTemperatureK = temperatureK * 2 / (gamma + 1);
    exhaustVelocityMps = Math.sqrt(gamma * AIR_GAS_CONSTANT_J_KG_K * exitTemperatureK);
    massFlowKgs = environment.dischargeCoefficient * area * pressurePa * Math.sqrt(gamma / (AIR_GAS_CONSTANT_J_KG_K * temperatureK)) * (2 / (gamma + 1)) ** ((gamma + 1) / (2 * (gamma - 1)));
  } else {
    exitPressurePa = ambient;
    const mach = Math.sqrt(Math.max(0, 2 / (gamma - 1) * ((pressurePa / ambient) ** ((gamma - 1) / gamma) - 1)));
    exitTemperatureK = temperatureK / (1 + (gamma - 1) * mach ** 2 / 2);
    exhaustVelocityMps = mach * Math.sqrt(gamma * AIR_GAS_CONSTANT_J_KG_K * exitTemperatureK);
    massFlowKgs = environment.dischargeCoefficient * area * exitPressurePa / (AIR_GAS_CONSTANT_J_KG_K * exitTemperatureK) * exhaustVelocityMps;
  }
  massFlowKgs = Math.min(massFlowKgs, state.airMassKg / 1e-4);
  const airMassRateKgs = -massFlowKgs;
  const airTemperatureRateKs = (gamma - 1) * temperatureK / Math.max(state.airMassKg, EPSILON) * airMassRateKgs;
  const thrustN = massFlowKgs * exhaustVelocityMps + Math.max(0, exitPressurePa - ambient) * area;
  return { pressurePa, pressureDeltaPa: pressurePa - ambient, thrustN, waterVolumeRateM3s: 0, airMassRateKgs, airTemperatureRateKs, exhaustVelocityMps, exitPressurePa, flowRegime: choked ? 'air-choked' : 'air-unchoked' };
}

export function evaluatePropulsion(state, input) {
  if (state.phase === 'water') return evaluateWaterJet(state, input);
  if (state.phase === 'air') return evaluateAirJet(state, input);
  return { pressurePa: input.environment.atmosphericPressurePa, pressureDeltaPa: 0, thrustN: 0, waterVolumeRateM3s: 0, airMassRateKgs: 0, airTemperatureRateKs: 0, exhaustVelocityMps: 0, flowRegime: 'coast' };
}

/** Advance thermodynamic state, clamping phase boundaries and returning sub-step event fractions. */
export function advancePropulsion(state, rates, dtS) {
  let fraction = 1;
  if (state.phase === 'water' && rates.waterVolumeRateM3s < 0) fraction = Math.min(1, state.waterVolumeM3 / (-rates.waterVolumeRateM3s * dtS));
  const effectiveDt = dtS * fraction;
  const next = { ...state, waterVolumeM3: Math.max(0, state.waterVolumeM3 + rates.waterVolumeRateM3s * effectiveDt), airMassKg: Math.max(0, state.airMassKg + rates.airMassRateKgs * effectiveDt), airTemperatureK: Math.max(1, state.airTemperatureK + rates.airTemperatureRateKs * effectiveDt) };
  const events = [];
  if (state.phase === 'water' && (next.waterVolumeM3 <= EPSILON || rates.pressureDeltaPa <= 0)) {
    next.phase = 'air'; next.waterVolumeM3 = 0; next.waterEndPressurePa = rates.pressurePa; next.airMassAtWaterEndKg = next.airMassKg; next.airTemperatureAtWaterEndK = next.airTemperatureK; events.push({ type: 'water-out', fraction });
  } else if (state.phase === 'air' && (rates.pressureDeltaPa <= 0 || next.airMassKg <= EPSILON)) {
    next.phase = 'coast'; events.push({ type: 'air-out', fraction: 1 });
  }
  return { state: next, events };
}
