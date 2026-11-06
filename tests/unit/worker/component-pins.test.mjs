import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { AVRRunner } from '../../../src/worker/runners/avr-runner.ts';

// Instantiated components must get their manifest pins — never the
// A/K/GND/VSS fallback (which left ePaper powerless and SPI-deaf live:
// no VCC, no DIN/CLK/CS/DC).
describe('AVR component pin assignment', () => {
  test('ePaper gets manifest pins and a live VCC rail', () => {
    const noop = () => {};
    const r = new AVRRunner(':00000001FF', [
      { id: 'uno1', type: 'openhw-arduino-uno', attrs: {} },
      { id: 'ep1', type: 'openhw-ePaperDisplay', attrs: {} },
    ], [
      { from: 'uno1:11', to: 'ep1:DIN' },
      { from: 'uno1:13', to: 'ep1:CLK' },
      { from: 'uno1:8', to: 'ep1:CS' },
      { from: 'uno1:7', to: 'ep1:DC' },
      { from: 'uno1:6', to: 'ep1:RST' },
      { from: 'uno1:5V', to: 'ep1:VCC' },
      { from: 'uno1:gnd_1', to: 'ep1:GND' },
    ], noop, { boardId: 'uno1' });
    const ep = r.instances.get('ep1');
    for (const p of ['VCC', 'GND', 'DIN', 'CLK', 'CS', 'DC', 'RST', 'BUSY']) {
      assert.ok(ep.pins[p] !== undefined, `epaper missing pin ${p}`);
    }
    assert.equal(ep.getPinVoltage('VCC'), 5.0);
    assert.equal(ep.pins['5V'], undefined);
    try { r.stop?.(); } catch { /* ignore */ }
  });
});
