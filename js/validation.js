/** @typedef {{field:string, code:string, severity:'error'|'warning', message:string}} ValidationIssue */

/** @returns {ValidationIssue[]} */
export function validateDesign({ geometry, mass, launch, environment, parachute }) {
  const issues = [];
  const error = (field, code, message) => issues.push({ field, code, severity: 'error', message });
  const warning = (field, code, message) => issues.push({ field, code, severity: 'warning', message });

  for (const [field, value] of Object.entries({ ...geometry, ...mass, ...launch, ...environment })) {
    if (typeof value === 'number' && !Number.isFinite(value)) error(field, 'NOT_FINITE', '有限の数値を入力してください。');
  }
  if (geometry.bodyDiameterM <= 0) error('bodyDiameterM', 'POSITIVE_REQUIRED', '胴体直径は0より大きくしてください。');
  if (geometry.bodyLengthM <= 0) error('bodyLengthM', 'POSITIVE_REQUIRED', '胴体長は0より大きくしてください。');
  if (geometry.bottleVolumeM3 <= 0) error('bottleVolumeM3', 'POSITIVE_REQUIRED', '実ボトル容量を入力してください。');
  if (launch.waterVolumeM3 < 0) error('waterVolumeM3', 'NON_NEGATIVE_REQUIRED', '水量を0以上にしてください。');
  if (launch.waterVolumeM3 >= geometry.bottleVolumeM3) error('waterVolumeM3', 'NO_AIR_VOLUME', '水量は実ボトル容量より少なくしてください。');
  if (launch.nozzleDiameterM <= 0 || launch.nozzleDiameterM >= geometry.bodyDiameterM) error('nozzleDiameterM', 'INVALID_NOZZLE', 'ノズル径は0より大きく、胴体径より小さくしてください。');
  if (mass.dryMassKg <= 0) error('dryMassKg', 'POSITIVE_REQUIRED', '乾燥質量は0より大きくしてください。');
  if (launch.initialAbsolutePressurePa <= environment.atmosphericPressurePa) warning('initialAbsolutePressurePa', 'NO_PRESSURE_DIFFERENCE', '初期圧力が大気圧以下のため推力は発生しません。');
  if (environment.dragCoefficient <= 0) error('dragCoefficient', 'POSITIVE_REQUIRED', '抗力係数は0より大きくしてください。');
  if (environment.dischargeCoefficient <= 0 || environment.dischargeCoefficient > 1) error('dischargeCoefficient', 'OUT_OF_RANGE', '流量係数は0より大きく1以下にしてください。');
  if (parachute.enabled && (parachute.areaM2 <= 0 || parachute.dragCoefficient <= 0)) error('parachute', 'INVALID_PARACHUTE', 'パラシュート面積と抗力係数は0より大きくしてください。');
  if (launch.angleRad !== undefined && (!Number.isFinite(launch.angleRad) || launch.angleRad < 0 || launch.angleRad > Math.PI)) error('angleRad', 'INVALID_ANGLE', '発射角は0〜180度の範囲にしてください。');
  if (launch.launcherLengthM !== undefined && (!Number.isFinite(launch.launcherLengthM) || launch.launcherLengthM < 0)) error('launcherLengthM', 'INVALID_LAUNCHER', 'ランチャー長は0以上にしてください。');
  if (environment.windMps && (!Number.isFinite(environment.windMps.x) || !Number.isFinite(environment.windMps.z))) error('windMps', 'INVALID_WIND', '風速と風向を確認してください。');
  return issues;
}

export const hasErrors = issues => issues.some(issue => issue.severity === 'error');
