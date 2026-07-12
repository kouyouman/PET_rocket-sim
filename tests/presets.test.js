import test from 'node:test';
import assert from 'node:assert/strict';
import { migratePreset, PRESET_SCHEMA_VERSION } from '../js/presets.js';

test('legacy preset migrates FinPos zero without replacing it', () => {
  const migrated = migratePreset({ name: 'legacy', params: { mode: 'pet', FinPos: 0, D: 66 } });
  assert.equal(migrated.schemaVersion, PRESET_SCHEMA_VERSION);
  assert.equal(migrated.ui.finpos, 0);
  assert.equal(migrated.ui.diam, 66);
  assert.equal(migrated.ui.pressureKind,'gauge');
});
