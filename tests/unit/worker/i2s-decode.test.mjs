import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { AVRRunner } from '../../../src/worker/runners/avr-runner.ts';

// Runner-level I2S proof: BCLK/WS edges through tickI2S must decode a
// frame and drive the DAC/amp analog outputs (headless, no browser).
describe('AVR runner I2S decode (MAX98357 content)', () => {
  test('0x8000 frame drives OUT+ to 0V and OUT- to 3.3V', () => {
    const noop = () => {};
    const r = new AVRRunner(':00000001FF', [
      { id: 'uno1', type: 'openhw-arduino-uno', attrs: {} },
      { id: 'max1', type: 'openhw-max98357', attrs: {} },
    ], [
      { from: 'uno1:5', to: 'max1:BCLK' },
      { from: 'uno1:6', to: 'max1:LRC' },
      { from: 'uno1:7', to: 'max1:DIN' },
      { from: 'uno1:5V', to: 'max1:VIN' },
      { from: 'uno1:gnd_1', to: 'max1:GND' },
    ], noop, { boardId: 'uno1' });
    const inst = r.instances.get('max1');
    // Stop the background run-loop: its traversal re-walks floating nets
    // and would flap the assembler's WS/BCLK state mid-sequence.
    try { r.stop(); } catch { /* ignore */ }
    const tick = (pin, high) => r.tickI2S(inst, 'max1', pin, high);
    // Realistic framing: WS toggles per channel (also clears any stale
    // assembler state), then 16 MSB-first bits, WS closes the frame.
    // NOTE: DIN is written via direct pin store, not setPinVoltage —
    // setPinVoltage re-enters net traversal (component drives net), which
    // injects traversal edges and makes edge-counting nondeterministic.
    tick('LRC', true);
    tick('LRC', false);
    for (let i = 0; i < 16; i += 1) {
      inst.pins['DIN'].voltage = i === 0 ? 5.0 : 0.0;
      tick('BCLK', true);
      tick('BCLK', false);
    }
    tick('LRC', true); // WS edge flushes (also auto-flushed at 16 bits)
    const vp = Number(inst.getPinVoltage('OUT+'));
    const vn = Number(inst.getPinVoltage('OUT-'));
    assert.ok(Math.abs(vp - 0.0) < 0.05, `OUT+ expected ~0V, got ${vp}`);
    assert.ok(Math.abs(vn - 3.3) < 0.05, `OUT- expected ~3.3V, got ${vn}`);
    try { r.stop?.(); } catch { /* ignore */ }
  });
});
