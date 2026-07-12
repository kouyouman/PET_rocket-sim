import { mmToM, gToKg, mlToM3, atmospheresToAbsolutePa } from './units.js';
import { calculateStability } from './stability.js';
import { sizeParachute } from './parachute.js';
import { simulateFlight, simulateTrajectory2D } from './flight.js';
import { drawUnifiedFlightChart } from './charts.js';
import { normalizeCalibration } from './flight/calibration.js';

const byId = id => document.getElementById(id);
const number = (id, fallback = 0) => {
  const value = Number(byId(id)?.value);
  return Number.isFinite(value) ? value : fallback;
};

const state = { stability: null, parachute: null, flight: null };

function rocketType() { return byId('rocket_type')?.value || 'pet'; }
function isWorkshop() { return Boolean(byId('workshop_mode')?.checked); }

function stabilityInput() {
  const type = rocketType();
  return {
    rocketType: type,
    geometry: {
      noseLengthM: mmToM(number('lnose')),
      bodyDiameterM: mmToM(type === 'pet' ? number('diam') : number('d_lower')),
      bodyLengthM: mmToM(number('lbody')),
      bottleVolumeM3: .0015,
      finRootChordM: mmToM(number('c_root')),
      finSpanM: mmToM(number('span')),
      finSweepRad: number('sweep') * Math.PI / 180,
      finCount: number('nfin'),
      finRearOffsetM: mmToM(number('finpos')),
      upperDiameterM: mmToM(number('d_upper')),
      upperLengthM: mmToM(number('l_upper')),
      transitionLengthM: mmToM(number('l_trans')),
      lowerDiameterM: mmToM(number('d_lower')),
      lowerLengthM: mmToM(number('l_lower'))
    },
    mass: {
      noseMassKg: gToKg(number('wnose')),
      bodyMassKg: gToKg(type === 'pet' ? number('wbody') : number('w_h2_body')),
      finMassEachKg: gToKg(number('mfin'))
    },
    waterVolumeM3: type === 'pet' ? mlToM3(number('vwater')) : 0,
    targetStaticMargin: isWorkshop() ? null : number('sm_target', 1.2),
    workshopBallastKg: isWorkshop() ? gToKg(number('ws_ballast')) : 0
  };
}

function legacyParams(input, result) {
  const g = input.geometry;
  return {
    D: g.bodyDiameterM * 1000, Lbody: g.bodyLengthM * 1000, Lnose: g.noseLengthM * 1000,
    Vw: input.waterVolumeM3 * 1e6, Cr: g.finRootChordM * 1000, S: g.finSpanM * 1000,
    Sweep: g.finSweepRad * 180 / Math.PI, Nfin: g.finCount, FinPos: g.finRearOffsetM * 1000,
    D_up: g.upperDiameterM * 1000, L_up: g.upperLengthM * 1000, L_trans: g.transitionLengthM * 1000,
    D_low: g.lowerDiameterM * 1000, L_low: g.lowerLengthM * 1000,
    Ct: result.finTipChordM * 1000
  };
}

function legacyResult(result) {
  return {
    CP: result.cpM * 1000, CG_full: result.cgFullM * 1000, CG_empty: result.cgEmptyM * 1000,
    SM_full: result.staticMarginFull, SM_empty: result.staticMarginEmpty,
    Ct: result.finTipChordM * 1000, M_empty: result.totalDryMassKg * 1000,
    m_ballast: result.recommendedBallastKg == null ? null : result.recommendedBallastKg * 1000,
    S_fin_one_cm2: result.finAreaOneM2 * 10000
  };
}

function setText(id, value) { const element = byId(id); if (element) element.textContent = value; }
function setStatus(kind, title, note) {
  const box = byId('status-box');
  if (!box) return;
  const palette = {
    success: ['#edf5f0', '#356b52'], warning: ['#faf3e4', '#93651d'], error: ['#faeeee', '#a34141'], info: ['#e8f0f6', '#174f78']
  }[kind];
  box.style.display = 'block'; box.style.backgroundColor = palette[0]; box.style.color = palette[1]; box.style.borderLeftColor = palette[1];
  setText('status-text', title); setText('status-note', note);
}

function renderStabilityIssues(result) {
  const firstError = result.issues?.find(issue => issue.severity === 'error');
  const firstWarning = result.issues?.find(issue => issue.severity === 'warning');
  if (firstError) setStatus('error', '入力を確認してください', firstError.message);
  else if (firstWarning) setStatus('warning', isWorkshop() ? 'あと少しです' : '静安定不足', firstWarning.message);
}

function updateStability() {
  const input = stabilityInput();
  const tipChord = input.geometry.finRootChordM - input.geometry.finSpanM * Math.tan(input.geometry.finSweepRad);
  const tipOutput = byId('c_tip_out');
  if (tipOutput) {
    tipOutput.textContent = `${Math.max(0, tipChord * 1000).toFixed(1)} mm`;
    tipOutput.style.color = tipChord < 0 ? 'var(--cg-color)' : 'var(--secondary-color)';
    tipOutput.style.fontWeight = tipChord < 0 ? 'bold' : 'normal';
  }
  const result = calculateStability(input);
  result.finTipChordM = tipChord;
  state.stability = result;
  const paraButton = byId('para-tab-button');
  const flightButton = byId('flight-tab-button');
  if (!result.ok) {
    if (paraButton) paraButton.disabled = true;
    if (flightButton) flightButton.disabled = true;
    renderStabilityIssues(result);
    return result;
  }

  const legacy = legacyResult(result);
  setText('fin_area_out', `${legacy.S_fin_one_cm2.toFixed(1)} cm²`);
  setText('cg_full', legacy.CG_full.toFixed(1)); setText('sm_full', legacy.SM_full.toFixed(2));
  setText('cg_empty', legacy.CG_empty.toFixed(1)); setText('sm_empty', legacy.SM_empty.toFixed(2));
  const ballast = byId('ballast_out');
  if (ballast) ballast.textContent = result.recommendedBallastKg == null ? '推奨紙粘土: 計算不能' : `推奨紙粘土: ${(result.recommendedBallastKg * 1000).toFixed(1)} g`;
  const threshold = rocketType() === 'pet' ? .7 : 1;
  const stable = Math.min(result.staticMarginFull, result.staticMarginEmpty) >= threshold - 1e-9;
  if (paraButton) paraButton.disabled = !stable;
  if (flightButton) {
    flightButton.disabled = !stable || rocketType() === 'hydrogen';
    flightButton.title = rocketType() === 'hydrogen' ? '水素ロケットの飛行モデルは未対応です' : '';
  }
  if (stable) setStatus('success', isWorkshop() ? '安定性OK' : '安定性OK', rocketType() === 'hydrogen' ? '機体設計は利用できます。水素の飛行計算は未対応です。' : '上部のタブから次の設計に進めます。');
  else renderStabilityIssues(result);
  if (isWorkshop() && byId('flight_actual_ballast')) {
    byId('flight_actual_ballast').value = String(number('ws_ballast', 0));
    const numberField = byId('flight_actual_ballast').nextElementSibling; if (numberField?.classList.contains('range-number')) numberField.value = byId('flight_actual_ballast').value;
  }
  const paraMass = byId('para_mass_out'); if (paraMass) paraMass.value = ((result.baseDryMassKg + gToKg(number('flight_actual_ballast', 0))) * 1000).toFixed(1);
  updateFlightMassBreakdown();
  if (typeof window.drawRocket3D === 'function') window.drawRocket3D(legacyParams(input, result), legacy);
  return result;
}

function updateParachute() {
  const massKg = gToKg(Number(byId('para_mass_out')?.value || state.stability?.totalDryMassKg * 1000 || 0));
  const result = sizeParachute({ massKg, targetDescentMps: number('para_vdown', 5), dragCoefficient: number('para_cdp', .75), airDensityKgM3: 1.225 });
  state.parachute = result;
  if (!result.ok) return result;
  const squareSideM = result.materialDiameterM * Math.sqrt(Math.PI) / 2;
  setText('sp_out', result.areaM2.toFixed(3)); setText('dp_out', (result.equivalentDiameterM * 100).toFixed(1));
  setText('dp0_out', (result.materialDiameterM * 100).toFixed(1)); setText('lph_out', (result.hexSideM * 100).toFixed(1));
  setText('lps_out', (squareSideM * 100).toFixed(1)); setText('lsl_out', (result.shroudLengthM * 100).toFixed(1));
  if (typeof window.drawParachute === 'function') window.drawParachute(result.materialDiameterM * 100, result.shroudLengthM * 100, result.hexSideM * 100);
  return result;
}

function flightInput() {
  const input = stabilityInput();
  const atmosphericPressurePa = 101325;
  const initialAbsolutePressurePa = atmospheresToAbsolutePa(number('flight_pressure', 5), byId('flight_pressure_kind')?.value || 'gauge', atmosphericPressurePa);
  const calibration = normalizeCalibration({ dischargeCoefficient: number('flight_discharge_coefficient', .95), polytropicExponent: number('flight_polytropic_exponent', 1.2), dragCoefficient: number('flight_drag_coefficient', .5) });
  const baseDryMassKg = state.stability?.baseDryMassKg ?? input.mass.noseMassKg + input.mass.bodyMassKg + input.mass.finMassEachKg * input.geometry.finCount;
  const ballastMassKg = gToKg(number('flight_actual_ballast', 0));
  const dryMassKg = baseDryMassKg + ballastMassKg;
  const actualStability = calculateStability({ ...input, targetStaticMargin: null, workshopBallastKg: ballastMassKg });
  return {
    geometry: { ...input.geometry, bottleVolumeM3: mlToM3(number('flight_bottle_volume', 1500)) },
    mass: { baseDryMassKg, ballastMassKg, dryMassKg },
    launch: {
      waterVolumeM3: input.waterVolumeM3, nozzleDiameterM: mmToM(number('flight_d_noz', 8)),
      initialAbsolutePressurePa, airTemperatureK: number('flight_temperature', 20) + 273.15,
      pressureInput: { kind: byId('flight_pressure_kind')?.value || 'gauge', valueAtm: number('flight_pressure', 5), absolutePressurePa: initialAbsolutePressurePa },
      angleRad: number('flight_angle', 90) * Math.PI / 180, launcherLengthM: number('flight_launcher_length', .5)
    },
    environment: { atmosphericPressurePa, airDensityKgM3: 1.225, gravityMps2: 9.80665, dragCoefficient: calibration.dragCoefficient, dischargeCoefficient: calibration.dischargeCoefficient, polytropicExponent: calibration.polytropicExponent,
      windMps: { x: number('flight_wind_speed', 0) * Math.cos(number('flight_wind_direction', 0) * Math.PI / 180), z: 0 } },
    parachute: state.parachute?.ok ? { enabled: true, areaM2: state.parachute.areaM2, dragCoefficient: number('para_cdp', .75), deploymentDelayS: 0 } : { enabled: false, areaM2: .1, dragCoefficient: .75, deploymentDelayS: 0 },
    integration: { timeStepS: number('flight_time_step', .002), maxTimeS: 60 }, calibration,
    stabilityAssessment: actualStability.ok ? { staticMarginFull: actualStability.staticMarginFull, staticMarginEmpty: actualStability.staticMarginEmpty, threshold: .7 } : null
  };
}

function runFlightSimulation() {
  const button = byId('run-flight-sim');
  if (rocketType() === 'hydrogen') { setStatus('warning', '飛行計算は未対応です', '水素ロケットは機体安定性と3D設計のみ利用できます。'); return; }
  if (button) { button.disabled = true; button.textContent = '計算中…'; }
  requestAnimationFrame(() => {
    const result = simulateTrajectory2D(flightInput()); state.flight = result;
    if (result.ok) {
      setText('max_h_out', result.maxAltitudeM.toFixed(2)); setText('max_v_out', result.maxVelocityMps.toFixed(2)); setText('max_f_out', result.maxThrustN.toFixed(2));
      const waterOut = result.events.find(event => event.type === 'water-out'); setText('t_water_out', waterOut ? waterOut.timeS.toFixed(3) : '0.000');
      setText('t_propulsion_out', result.propulsionEndTimeS.toFixed(3)); setText('t_apogee_out', result.apogeeTimeS == null ? '--' : result.apogeeTimeS.toFixed(3));
      setText('t_flight_out', result.totalFlightTimeS.toFixed(3)); setText('range_out', result.horizontalRangeM.toFixed(2)); setText('launcher_v_out', result.launcherExitVelocityMps == null ? '--' : result.launcherExitVelocityMps.toFixed(2));
      setText('flight_used_dry_mass_out', (result.massBreakdown.dryMassKg * 1000).toFixed(1)); setText('flight_absolute_pressure_out', (result.pressureInput.absolutePressurePa / 101325).toFixed(2));
      setText('flight_hero_height', `${result.maxAltitudeM.toFixed(1)} m`); setText('flight_hero_speed', `${result.maxVelocityMps.toFixed(1)} m/s`); setText('flight_hero_range', `${result.horizontalRangeM.toFixed(1)} m`); setText('flight_hero_time', `${result.totalFlightTimeS.toFixed(1)} s`);
      const container = byId('flight-plot-container');
      if (container) renderFlightCharts(container, result);
      renderFlightDiagnostics(result.diagnostics);
    } else {
      const container = byId('flight-plot-container'); if (container) container.textContent = result.issues[0]?.message || '計算できませんでした。';
    }
    if (button) { button.disabled = false; button.innerHTML = 'シミュレーション<ruby>実行<rt>じっこう</rt></ruby>'; }
  });
}

function updateFlightMassBreakdown() {
  if (!state.stability) return;
  const baseKg = state.stability.baseDryMassKg ?? state.stability.totalDryMassKg;
  const actualKg = gToKg(number('flight_actual_ballast', 0));
  const waterKg = gToKg(number('vwater', 0));
  const absolutePressurePa = atmospheresToAbsolutePa(number('flight_pressure', 5), byId('flight_pressure_kind')?.value || 'gauge', 101325);
  const airVolumeM3 = Math.max(1e-9, mlToM3(number('flight_bottle_volume', 1500) - number('vwater', 0)));
  const airKg = Math.max(0, absolutePressurePa * airVolumeM3 / (287.05 * (number('flight_temperature', 20) + 273.15)));
  setText('flight_base_dry_mass', `${(baseKg * 1000).toFixed(1)} g`);
  setText('flight_recommended_ballast', state.stability.recommendedBallastKg == null ? 'なし' : `${(state.stability.recommendedBallastKg * 1000).toFixed(1)} g`);
  setText('flight_water_mass', `${(waterKg * 1000).toFixed(1)} g`);
  setText('flight_launch_mass', `${((baseKg + actualKg + waterKg + airKg) * 1000).toFixed(1)} g`);
}

function updateActualBallastDependents() {
  updateFlightMassBreakdown();
  if (state.stability && byId('para_mass_out')) byId('para_mass_out').value = ((state.stability.baseDryMassKg + gToKg(number('flight_actual_ballast', 0))) * 1000).toFixed(1);
  updateParachute();
}

function renderFlightDiagnostics(diagnostics = []) {
  const container = byId('flight-diagnostics'); if (!container) return;
  container.innerHTML = diagnostics.map(item => `<div class="flight-diagnostic"><strong>${item.title}</strong><br>${item.message}</div>`).join('');
}

function renderFlightCharts(container, result) {
  container.replaceChildren();
  const toolbar = document.createElement('div'); toolbar.className = 'flight-chart-toolbar';
  const trajectoryButton = document.createElement('button'), timeButton = document.createElement('button'); trajectoryButton.textContent = '飛んだ道'; timeButton.textContent = '時間変化'; trajectoryButton.className = 'active';
  toolbar.append(trajectoryButton, timeButton); const canvas = document.createElement('canvas'); canvas.id = 'flight-unified-canvas'; canvas.setAttribute('aria-label', 'フライトシミュレーション統合グラフ');
  const table = document.createElement('table'); table.className = 'flight-data-table'; table.innerHTML = '<caption>グラフの主な時点を数値で読む表</caption><thead><tr><th>イベント</th><th>時刻</th><th>高度</th><th>速度</th><th>推力</th><th>圧力</th><th>水量</th></tr></thead><tbody>' + result.events.map(event => { const sample=result.series.reduce((best,item)=>Math.abs(item.timeS-event.timeS)<Math.abs(best.timeS-event.timeS)?item:best,result.series[0]); return `<tr><td>${eventLabel(event.type)}</td><td>${event.timeS.toFixed(3)} s</td><td>${event.altitudeM.toFixed(2)} m</td><td>${sample.velocityMps.toFixed(2)} m/s</td><td>${sample.thrustN.toFixed(2)} N</td><td>${(sample.pressurePa/101325).toFixed(2)} 気圧</td><td>${(sample.waterVolumeM3*1e6).toFixed(1)} mL</td></tr>`; }).join('') + '</tbody>';
  container.append(toolbar, canvas, table); let mode = 'trajectory', cursorFraction = null;
  const draw = () => drawUnifiedFlightChart(canvas, result, mode, cursorFraction);
  trajectoryButton.onclick = () => { mode = 'trajectory'; trajectoryButton.classList.add('active'); timeButton.classList.remove('active'); draw(); };
  timeButton.onclick = () => { mode = 'timeline'; timeButton.classList.add('active'); trajectoryButton.classList.remove('active'); draw(); };
  canvas.onpointermove = event => { if (mode !== 'timeline') return; const rect = canvas.getBoundingClientRect(); cursorFraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)); draw(); };
  canvas.onpointerleave = () => { cursorFraction = null; draw(); }; draw();
}

function eventLabel(type) { return ({ 'launcher-exit':'ランチャー離脱','water-out':'水噴射終了','air-out':'推進終了','apogee':'最高点','parachute-deploy':'パラシュート展開','landing':'着地','no-launch':'離脱できず' })[type] || type; }

const originalOpenTab = window.openTab;
function openTab(name) {
  originalOpenTab(name);
  if (name === 'ptab') updateParachute();
  if (name === 'ftab' && rocketType() === 'hydrogen') setStatus('warning', '飛行計算は未対応です', '水素ロケットは機体設計のみ利用できます。');
}

function initializeSimulatorCore() {
  updateStability();
  updateParachute();
  byId('flight_actual_ballast')?.addEventListener('input', updateActualBallastDependents);
  ['flight_pressure','flight_pressure_kind','flight_bottle_volume','flight_temperature'].forEach(id => byId(id)?.addEventListener('input', updateFlightMassBreakdown));
  updateFlightMassBreakdown();
}

Object.assign(window, { updateStability, updateParachute, runFlightSimulation, initializeSimulatorCore, openTab });
