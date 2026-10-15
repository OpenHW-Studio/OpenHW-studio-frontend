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
});
