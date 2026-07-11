export const CALIBRATION_SCHEMA_VERSION = 1;
export const DEFAULT_CALIBRATION = Object.freeze({ schemaVersion: CALIBRATION_SCHEMA_VERSION, modelVersion: '2d-point-mass-v2', name: '標準設定', dischargeCoefficient: .95, polytropicExponent: 1.2, dragCoefficient: .5 });

export function normalizeCalibration(value = {}) {
  return { ...DEFAULT_CALIBRATION, ...value, schemaVersion: CALIBRATION_SCHEMA_VERSION };
}

export function serializeCalibration(profile) { return JSON.stringify(normalizeCalibration(profile), null, 2); }
export function parseCalibration(json) { return normalizeCalibration(JSON.parse(json)); }
