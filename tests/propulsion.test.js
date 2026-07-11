import test from 'node:test';
import assert from 'node:assert/strict';
import { createPropulsionState, evaluateWaterJet, evaluateAirJet, advancePropulsion } from '../js/flight/propulsion.js';

const input={geometry:{bottleVolumeM3:.0015},launch:{waterVolumeM3:.0004,nozzleDiameterM:.008,initialAbsolutePressurePa:601325,airTemperatureK:293.15},environment:{atmosphericPressurePa:101325,dischargeCoefficient:.95,polytropicExponent:1.2}};

test('water jet applies discharge coefficient once and clamps water boundary',()=>{const state=createPropulsionState(input),rates=evaluateWaterJet(state,input);assert.ok(rates.thrustN>0);const advanced=advancePropulsion({...state,waterVolumeM3:1e-9},rates,.01);assert.equal(advanced.state.waterVolumeM3,0);assert.equal(advanced.state.phase,'air');assert.ok(advanced.events[0].fraction<1)});
test('compressible air jet identifies choked and unchoked flow',()=>{const initial=createPropulsionState({...input,launch:{...input.launch,waterVolumeM3:0}});const choked=evaluateAirJet(initial,input);assert.equal(choked.flowRegime,'air-choked');const low={...initial,airMassKg:101325*1.05*input.geometry.bottleVolumeM3/(287.05*initial.airTemperatureK)};const unchoked=evaluateAirJet(low,input);assert.equal(unchoked.flowRegime,'air-unchoked');assert.ok(unchoked.thrustN>0)});
