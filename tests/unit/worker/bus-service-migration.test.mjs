import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { DHT22Logic } from '@openhw/emulator/src/components/DHT-22/logic';

function makeDht(id = 'dht1') {
  const dht = new DHT22Logic(id, {
    type: 'openhw-dht22',
    attrs: {},
    pins: [{ id: 'VCC' }, { id: 'DATA' }, { id: 'NC' }, { id: 'GND' }],
  });
  dht._simCpu = {
    _avrRunner: { currentWires: [{ from: 'uno1:2', to: `${id}:DATA` }] },
  };
  return dht;
}

describe('escape-hatch migration to _driveBoardPin (plan Phase 3)', () => {
  test('DHT22 prefers the bus service over the AVR-only fast path', () => {
    const dht = makeDht();
    const viaService = [];
    const viaLegacy = [];
    dht._driveBoardPin = (pin, high) => { viaService.push([pin, high]); };
    dht._setAvrPinDirect = (pin, high) => { viaLegacy.push([pin, high]); };
    dht.drivePin(5.0);
    dht.drivePin(0.0);
    assert.deepEqual(viaService, [['2', true], ['2', false]]);
    assert.deepEqual(viaLegacy, []);
  });

  test('legacy AVR path still works when no bus service is provided', () => {
    const dht = makeDht();
    const viaLegacy = [];
    dht._driveBoardPin = null;
    dht._setAvrPinDirect = (pin, high) => { viaLegacy.push([pin, high]); };
    dht.drivePin(5.0);
    assert.deepEqual(viaLegacy, [['2', true]]);
  });

  test('DHT22 schedules and resolves nets through services only', () => {
    const dht = makeDht();
    dht._simCpu = null;
    dht._setAvrPinDirect = null;
    const driven = [];
    const scheduled = [];
    dht._driveBoardPin = (pin, high) => { driven.push([pin, high]); };
    dht._scheduleBoardCycles = (cb, delay) => { scheduled.push(delay); };
    dht._boardNetOf = (pin) => (pin === 'DATA' ? '2' : null);
    assert.equal(dht.getConnectedBoardPin(), '2');
    dht.startAckSequence();
    assert.equal(dht.protocolState, 'ACKING');
    assert.deepEqual(scheduled, [30 * 16]);
  });

  test('LED prefers _boardCyclesNow over _simCpu for PWM timestamps', async () => {
    const { LEDLogic } = await import('@openhw/emulator/src/components/openhw-led/logic');
    const led = new LEDLogic('led1', {
      type: 'openhw-led', attrs: {},
      pins: [{ id: 'A' }, { id: 'K' }],
    });
    // Service reports 8000; legacy mirror is stale at 1000. Service must win.
    led._boardCyclesNow = () => 8000;
    led._simCpu = { cycles: 1000 };
    led.onPWM('A', { dutyCycle: 0.5 });
    assert.equal(led._pwmTimestampCycles, 8000);
    // Without the service the legacy mirror still works (fallback).
    const led2 = new LEDLogic('led2', {
      type: 'openhw-led', attrs: {},
      pins: [{ id: 'A' }, { id: 'K' }],
    });
    led2._boardCyclesNow = null;
    led2._simCpu = { cycles: 1234 };
    led2.onPWM('A', { dutyCycle: 0.5 });
    assert.equal(led2._pwmTimestampCycles, 1234);
  });

  test('HC-SR04 and IR receiver schedule through the clock service first', async () => {
    const { HCSR04Logic } = await import('@openhw/emulator/src/components/openhw-hc-sr04/logic');
    const hcsr = new HCSR04Logic('h1', {
      type: 'openhw-hc-sr04', attrs: { distance: '100' },
      pins: [{ id: 'VCC' }, { id: 'TRIG' }, { id: 'ECHO' }, { id: 'GND' }],
    });
    const hSched = [];
    let legacyClockCalls = 0;
    hcsr._scheduleBoardCycles = (cb, delay) => { hSched.push(delay); };
    hcsr._simCpu = { addClockEvent: () => { legacyClockCalls += 1; } };
    hcsr.startEcho();
    assert.deepEqual(hSched, [200 * 16]);
    assert.equal(legacyClockCalls, 0);

    const { IRReceiverLogic } = await import('@openhw/emulator/src/components/openhw-ir-receiver/logic');
    const ir = new IRReceiverLogic('ir1', {
      type: 'openhw-ir-receiver', attrs: {},
      pins: [{ id: 'GND' }, { id: 'VCC' }, { id: 'OUT' }],
    });
    const irSched = [];
    let irLegacy = 0;
    ir._scheduleBoardCycles = (cb, delay) => { irSched.push(delay); };
    ir._simCpu = { addClockEvent: () => { irLegacy += 1; } };
    ir.onEvent({ type: 'ir-send', button: 'POWER' });
    assert.ok(irSched.length > 60, `expected full NEC train via service, got ${irSched.length}`);
    assert.equal(irLegacy, 0);
  });

  test('OneWire presence pulse prefers the clock service', async () => {
    const { OneWireProtocol } = await import('@openhw/emulator/src/protocol-handlers/onewire-device');
    const dev = new OneWireProtocol('ow1', {
      type: 'openhw-ds18b20', attrs: {},
      pins: [{ id: 'GND' }, { id: 'DQ' }, { id: 'VCC' }],
    });
    const sched = [];
    let legacy = 0;
    dev._scheduleBoardCycles = (cb, delay) => { sched.push(delay); };
    dev._simCpu = { addClockEvent: () => { legacy += 1; } };
    dev.onOneWireReset('DQ', {});
    assert.deepEqual(sched, [480]);
    assert.equal(legacy, 0);
  });
});
