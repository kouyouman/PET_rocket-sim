import { simulateTrajectory1D } from './flight/trajectory-1d.js';

/** Backward-compatible vertical 1D API, implemented by the shared 2D engine. */
export function simulateFlight(input) {
  return simulateTrajectory1D(input);
}

export { simulateTrajectory2D } from './flight/trajectory-2d.js';
export { simulateTrajectory1D } from './flight/trajectory-1d.js';
