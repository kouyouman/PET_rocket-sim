import test from 'node:test';
import assert from 'node:assert/strict';
import { mmToM, gToKg, mlToM3, pressureToAbsolutePa, atmospheresToAbsolutePa } from '../js/units.js';

test('UI units convert to SI', () => {
  assert.equal(mmToM(1000), 1);
  assert.equal(gToKg(1000), 1);
  assert.equal(mlToM3(1000), 0.001);
  assert.equal(pressureToAbsolutePa(5, 'gauge', 101325), 601325);
  assert.equal(pressureToAbsolutePa(5, 'absolute', 101325), 500000);
  assert.equal(atmospheresToAbsolutePa(5,'gauge',101325),607950);
  assert.equal(atmospheresToAbsolutePa(5,'absolute',101325),506625);
});
