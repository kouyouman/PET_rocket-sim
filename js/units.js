/** UI units are converted at the boundary; the simulation core uses SI units. */
export const mmToM = value => value / 1000;
export const mToMm = value => value * 1000;
export const gToKg = value => value / 1000;
export const kgToG = value => value * 1000;
export const mlToM3 = value => value / 1e6;
export const m3ToMl = value => value * 1e6;
export const barToPa = value => value * 100000;

export function pressureToAbsolutePa(valueBar, kind, atmosphericPressurePa = 101325) {
  const pressure = barToPa(valueBar);
  return kind === 'absolute' ? pressure : pressure + atmosphericPressurePa;
}

export function finiteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
