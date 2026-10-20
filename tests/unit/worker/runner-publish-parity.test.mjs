import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { ArmRunnerBase } from '../../../src/worker/runners/arm-runner-base.ts';
import {
  allocateStateSab,
  SabStateWriter,
  SabPinWriter,
} from '../../../src/worker/sab/layout.ts';
import { readPinRegion } from '../../../src/pages/simulationpage/utils/sabReader.js';
import { SabTransport } from '../../../src/worker/hal/transport.ts';

// Runner-level publish parity (plan §10/§11: one event fabric, separate
// delivery lanes). publishGpio must keep three views in agreement:
//   1. the SAB pin region (observation/transport plane),
//   2. the runner pinStates mirror,
//   3. the component model pins (electrical fan-out).
// A minimal ArmRunnerBase subclass stands in for every inheriting runner
// (pico/esp32/stm32/retro share this exact publish path).
class ProbeRunner extends ArmRunnerBase {
  engine = {
    sampleGpioOut: () => null,
    setGpioInput() {},
  };
  uartTxPins = [];
  uartRxPins = [];
}

const BOARD_PINS = ['L0', 'L1', 'L2', 'L3', 'GND'];

function buildBoundRunner() {
  const alloc = allocateStateSab(
    ['led1'],
    64,
    [{ boardId: 'b1', boardIdx: 0, pins: BOARD_PINS }],
  );
  const pinIndex = new Map(BOARD_PINS.map((p, i) => [p, i]));
  const pinWriter = new SabPinWriter(alloc.buffer);
  pinWriter.bindGeometry(alloc.pinBitWords, alloc.analogBase);
  const transport = new SabTransport({
    buffer: alloc.buffer,
    pinIndex,
    pinWriter,
    stateWriter: new SabStateWriter(alloc.buffer),
    railVoltage: 5.0,
    clock: () => 1000,
  });
  const msgs = [];
  const r = new ProbeRunner(
    ':00000001FF',
    [
      { id: 'b1', type: 'openhw-arduino-uno', attrs: {} },
      { id: 'led1', type: 'openhw-led', attrs: {} },
    ],
    [
      { from: 'b1:L3', to: 'led1:A' },
      { from: 'led1:K', to: 'b1:GND' },
    ],
    (m) => msgs.push(m),
    { boardId: 'b1' },
  );
  r.transport = transport;
  return { r, msgs, alloc };
}

function sabBit(alloc, high) {
  const pins = readPinRegion(alloc.buffer, [{ boardId: 'b1', pins: BOARD_PINS }]);
  const word = pins.b1.bits[0] >>> 0;
  return (word & 0b1000) !== 0 ? high === true : high === false;
}

describe('runner publish parity (SAB lane vs model vs mirror)', () => {
  test('publishGpio keeps all three views in agreement', () => {
    const { r, alloc } = buildBoundRunner();
    const led = r.instances.get('led1');
    assert.ok(led, 'led instance exists');

    r.publishGpio('L3', true);
    assert.equal(sabBit(alloc, true), true, 'SAB pin region shows L3 HIGH');
    assert.equal(r.pinStates['L3'], true, 'runner mirror shows L3 HIGH');
    assert.ok(led.getPinVoltage('A') > 1.8, 'LED anode driven HIGH via fan-out');

    r.publishGpio('L3', false);
    assert.equal(sabBit(alloc, false), true, 'SAB pin region shows L3 LOW');
    assert.equal(r.pinStates['L3'], false, 'runner mirror shows L3 LOW');
    assert.ok(!(led.getPinVoltage('A') > 1.8), 'LED anode released LOW via fan-out');
  });

  test('unbound runner still drives model + mirror (message fallback)', () => {
    const msgs = [];
    const r = new ProbeRunner(
      ':00000001FF',
      [
        { id: 'b1', type: 'openhw-arduino-uno', attrs: {} },
        { id: 'led1', type: 'openhw-led', attrs: {} },
      ],
      [
        { from: 'b1:L3', to: 'led1:A' },
        { from: 'led1:K', to: 'b1:GND' },
      ],
      (m) => msgs.push(m),
      { boardId: 'b1' },
    );
    assert.equal(r.transport, null);
    r.publishGpio('L3', true);
    const led = r.instances.get('led1');
    assert.equal(r.pinStates['L3'], true);
    assert.ok(led.getPinVoltage('A') > 1.8);
  });
});
