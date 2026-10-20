import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { LEDLogic } from '@openhw/emulator/src/components/openhw-led/logic';

function makeLed(id = 'led1') {
  return new LEDLogic(id, {
    type: 'openhw-led',
    attrs: {},
    pins: [{ id: 'A' }, { id: 'K' }],
  });
}

// Fake resistor instance: only the type tag matters to the LED's
// hasResistorInConnectedPath (same as the runner netlist bridge check).
function resistor(id = 'res1') {
  return { id, type: 'openhw-resistor' };
}

describe('LED physics on a virtual harness (no board, plan §8)', () => {
  test('lights with rail volts through a series resistor', () => {
    const led = makeLed();
    const wires = [
      { from: 'board:L2', to: 'res1:p1' },
      { from: 'res1:p2', to: 'led1:A' },
      { from: 'led1:K', to: 'board:GND' },
    ];
    const instances = new Map([
      ['led1', led],
      ['res1', resistor()],
    ]);
    led.setPinVoltage('A', 5.0);
    led.setPinVoltage('K', 0.0);
    led.update(1000, wires, instances);
    led.update(2000, wires, instances);
    assert.equal(led.state.burnedOut, false);
    const sync = led.getSyncState();
    assert.equal(sync.illuminated, true);
    assert.ok(sync.brightness > 0);
    const ui = led.uiState();
    assert.equal(ui.i.illuminated, 1);
    assert.ok(ui.f.brightness > 0);
  });

  test('burns out above 4V with no series resistor', () => {
    const led = makeLed();
    const wires = [
      { from: 'board:L2', to: 'led1:A' },
      { from: 'led1:K', to: 'board:GND' },
    ];
    const instances = new Map([['led1', led]]);
    led.setPinVoltage('A', 5.0);
    led.setPinVoltage('K', 0.0);
    led.update(1000, wires, instances);
    assert.equal(led.state.burnedOut, true);
    assert.equal(led.state.illuminated, false);
  });

  test('stays dark below forward voltage', () => {
    const led = makeLed();
    const wires = [
      { from: 'board:L2', to: 'res1:p1' },
      { from: 'res1:p2', to: 'led1:A' },
      { from: 'led1:K', to: 'board:GND' },
    ];
    const instances = new Map([['led1', led], ['res1', resistor()]]);
    led.setPinVoltage('A', 1.0);
    led.setPinVoltage('K', 0.0);
    led.update(1000, wires, instances);
    led.update(2000, wires, instances);
    assert.equal(led.getSyncState().illuminated, false);
  });
});
