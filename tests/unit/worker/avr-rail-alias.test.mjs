import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { AVRRunner } from '../../../src/worker/runners/avr-runner.ts';

describe('AVR rail alias resolution (plan §5.3)', () => {
  test('sd VCC rail', () => {
    const noop = () => {};
    const r = new AVRRunner(':00000001FF', [
      { id: 'uno1', type: 'openhw-arduino-uno', attrs: {} },
      { id: 'sd1', type: 'openhw-sd-card', attrs: {} },
    ], [
      { from: 'uno1:11', to: 'sd1:MOSI' },
      { from: 'uno1:12', to: 'sd1:MISO' },
      { from: 'uno1:13', to: 'sd1:SCK' },
      { from: 'uno1:4', to: 'sd1:CS' },
      { from: 'uno1:5V', to: 'sd1:VCC' },
      { from: 'uno1:gnd_1', to: 'sd1:GND' },
    ], noop, { boardId: 'uno1' });
    const sd = r.instances.get('sd1');
    // Alias-safe propagation: real VCC pin driven, no ghost 5V pin.
    assert.equal(sd.getPinVoltage('VCC'), 5.0);
    assert.equal(sd.pins['5V'], undefined);
    assert.equal(sd.getPinVoltage('GND'), 0.0);
    try { r.stop?.(); } catch {}
  });
});
