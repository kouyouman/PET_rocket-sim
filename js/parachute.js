/** @typedef {{massKg:number, targetDescentMps:number, dragCoefficient:number, airDensityKgM3:number}} ParachuteSizingInput */

/** Pure parachute sizing calculation. */
export function sizeParachute({ massKg, targetDescentMps, dragCoefficient, airDensityKgM3, gravityMps2 = 9.80665 }) {
  if (![massKg, targetDescentMps, dragCoefficient, airDensityKgM3].every(v => Number.isFinite(v) && v > 0)) {
    return { ok: false, issues: [{ field: 'parachute', code: 'INVALID_INPUT', severity: 'error', message: 'パラシュート計算値は0より大きくしてください。' }] };
  }
  const areaM2 = 2 * massKg * gravityMps2 / (airDensityKgM3 * dragCoefficient * targetDescentMps ** 2);
  const equivalentDiameterM = Math.sqrt(4 * areaM2 / Math.PI);
  const materialDiameterM = equivalentDiameterM / 0.7;
  const hexSideM = Math.sqrt((Math.PI * (materialDiameterM / 2) ** 2) / (3 * Math.sqrt(3) / 2));
  return { ok: true, areaM2, equivalentDiameterM, materialDiameterM, hexSideM, shroudLengthM: materialDiameterM * 1.5, issues: [] };
}
