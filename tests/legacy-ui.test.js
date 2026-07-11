import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('document starts with the HTML doctype', () => {
  assert.ok(html.startsWith('<!DOCTYPE html>'));
});

test('educational UI keeps ruby, sliders, wizard, 3D and parachute drawing surfaces', () => {
  assert.ok((html.match(/<ruby/g) || []).length >= 100);
  assert.ok((html.match(/type="range"/g) || []).length >= 20);
  for (const id of ['wizard', 'rocket-canvas', 'parachute-canvas', 'flight-plot-container', 'education-modal']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  for (const id of ['flight_angle', 'flight_launcher_length', 'flight_wind_speed', 'flight_wind_direction', 'range_out', 'launcher_v_out']) assert.match(html, new RegExp(`id="${id}"`));
  for (const id of ['flight_bottle_volume','flight_pressure_kind','flight_temperature','flight_discharge_coefficient','flight_polytropic_exponent','flight_drag_coefficient','flight_time_step','flight_hero_height']) assert.match(html,new RegExp(`id="${id}"`));
});

test('Pyodide dependency is removed and compatibility adapter is loaded', () => {
  assert.doesNotMatch(html, /src="[^"]*pyodide/i);
  assert.match(html, /type="module" src="js\/legacy-adapter\.js"/);
});

test('legacy element IDs remain unique', () => {
  const markupOnly = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const ids = [...markupOnly.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});

test('flight summary belongs only to the flight tab',()=>{
  const parachute=html.slice(html.indexOf('<div id="ptab"'),html.indexOf('<div id="ftab"'));
  const flight=html.slice(html.indexOf('<div id="ftab"'));
  assert.doesNotMatch(parachute,/flight_hero_/);
  assert.equal((flight.match(/id="flight_hero_/g)||[]).length,4);
});

test('UI documents the PET 0.7 threshold and removes decorative emoji',()=>{
  assert.match(html,/0\.7<ruby>以上/);
  assert.doesNotMatch(html,/[📏🎨🚀📐🌬🔧🏔⚡↔⏱😆🫤⚠✅💧💨⭐🪂🏁📊]/u);
});
