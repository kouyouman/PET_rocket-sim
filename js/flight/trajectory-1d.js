import { simulateTrajectory2D } from './trajectory-2d.js';

/** Vertical specialization sharing the exact propulsion, aerodynamics and integration engine. */
export function simulateTrajectory1D(input) {
  const result = simulateTrajectory2D({ ...input, launch: { ...input.launch, angleRad: Math.PI / 2, launcherLengthM: 0 }, environment: { ...input.environment, windMps: { x: 0, z: 0 } } });
  return result.ok ? { ...result, model: `Vertical specialization of ${result.model}` } : result;
}
