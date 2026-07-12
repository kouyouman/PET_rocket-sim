const STORAGE_KEY = 'rocketPresets';
export const PRESET_SCHEMA_VERSION = 2;

export function migratePreset(raw) {
  if (!raw) return null;
  if (raw.schemaVersion === PRESET_SCHEMA_VERSION) return raw;
  const old = raw.params || raw;
  return {
    schemaVersion: PRESET_SCHEMA_VERSION,
    name: raw.name || '旧プリセット',
    savedAt: raw.savedAt || new Date().toISOString(),
    ui: {
      rocketType: old.mode || old.rocketType || 'pet',
      diam: old.diam ?? old.D ?? 66, lbody: old.lbody ?? old.Lbody ?? 220,
      bottleVolume: old.bottleVolume ?? 1500, lnose: old.lnose ?? old.Lnose ?? 80,
      wnose: old.wnose ?? old.Wnose ?? 20, wbody: old.wbody ?? old.Wbody ?? 30,
      vwater: old.vwater ?? old.Vw ?? 400, cRoot: old.c_root ?? old.Cr ?? 80,
      span: old.span ?? old.S ?? 60, sweep: old.sweep ?? old.Sweep ?? 10,
      nfin: old.nfin ?? old.Nfin ?? 4, mfin: old.mfin ?? old.Mfin ?? 5,
      finpos: old.finpos ?? old.FinPos ?? 20, smTarget: old.sm_target ?? old.SM_t ?? 1.2,
      pressureKind: old.flight_pressure_kind ?? old.pressureKind ?? 'gauge',
      actualBallast: old.flight_actual_ballast ?? old.actualBallast ?? 0
    }
  };
}

export function getPresets(storage = localStorage) {
  try { return JSON.parse(storage.getItem(STORAGE_KEY) || '[]').map(migratePreset).filter(Boolean); }
  catch { return []; }
}

export function savePreset(name, ui, storage = localStorage) {
  const presets = getPresets(storage);
  presets.push({ schemaVersion: PRESET_SCHEMA_VERSION, name: name.trim() || `設計 ${presets.length + 1}`, savedAt: new Date().toISOString(), ui });
  storage.setItem(STORAGE_KEY, JSON.stringify(presets));
  return presets;
}

export function deletePreset(index, storage = localStorage) {
  const presets = getPresets(storage);
  presets.splice(index, 1);
  storage.setItem(STORAGE_KEY, JSON.stringify(presets));
  return presets;
}
