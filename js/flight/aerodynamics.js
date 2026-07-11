/** Drag vector opposite to velocity relative to the surrounding air. */
export function dragVector({ velocity, wind, airDensityKgM3, dragCoefficient, referenceAreaM2 }) {
  const rx = velocity.x - wind.x, rz = velocity.z - wind.z;
  const speed = Math.hypot(rx, rz);
  if (speed < 1e-12) return { x: 0, z: 0, magnitudeN: 0, relativeSpeedMps: 0 };
  const magnitudeN = .5 * airDensityKgM3 * dragCoefficient * referenceAreaM2 * speed ** 2;
  return { x: -magnitudeN * rx / speed, z: -magnitudeN * rz / speed, magnitudeN, relativeSpeedMps: speed };
}
