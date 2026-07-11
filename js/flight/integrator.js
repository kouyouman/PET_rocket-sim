/** Generic fourth-order Runge-Kutta step for numeric object states. */
export function rk4Step(state, dt, derivative) {
  const keys = Object.keys(state);
  const add = (base, slope, scale) => Object.fromEntries(keys.map(key => [key, base[key] + slope[key] * scale]));
  const k1 = derivative(state), k2 = derivative(add(state, k1, dt / 2)), k3 = derivative(add(state, k2, dt / 2)), k4 = derivative(add(state, k3, dt));
  return Object.fromEntries(keys.map(key => [key, state[key] + dt / 6 * (k1[key] + 2 * k2[key] + 2 * k3[key] + k4[key])]));
}

export function zeroCrossingFraction(before, after) {
  const denominator = before - after;
  return Math.abs(denominator) < 1e-15 ? 1 : Math.max(0, Math.min(1, before / denominator));
}

export function interpolate(a, b, fraction) { return a + (b - a) * fraction; }
