import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { AVRRunner } from '../../../src/worker/runners/avr-runner.ts';

describe('NeoPixel per-edge dispatch (WS2812 content)', () => {
  test('GRB frame decodes red+green through true-cycle edges', () => {
    const noop = () => {};
    const r = new AVRRunner(':00000001FF', [
      { id: 'uno1', type: 'openhw-arduino-uno', attrs: {} },
      { id: 'neo1', type: 'openhw-neopixel-matrix', attrs: {} },
    ], [
      { from: 'uno1:6', to: 'neo1:DIN' },
      { from: 'uno1:5V', to: 'neo1:VCC' },
      { from: 'uno1:gnd_1', to: 'neo1:GND' },
    ], noop, { boardId: 'uno1' });
    // WS2812 @16MHz AVR cycles: T0H ~6c, T1H ~14c, 20c period.
    // GRB byte order on the wire.
    let t = 1000000;
    const edge = (high, cycles) => r.dispatchOptionalNeoPixel('6', high, cycles);
    const bit = (v) => {
      edge(true, t);
      edge(false, t + (v ? 14 : 6));
      t += 20;
    };
    const byte = (v) => {
      for (let i = 7; i >= 0; i -= 1) bit((v >> i) & 1);
    };
    // LED0 red (GRB 00 FF 00), LED1 green (GRB FF 00 00), rest off.
    for (const b of [0x00, 0xff, 0x00, 0xff, 0x00, 0x00]) byte(b);
    for (let i = 0; i < 6; i += 1) byte(0x00), byte(0x00), byte(0x00);
    edge(true, t + 1000); // >25us reset gap latches the frame
    const neo = r.instances.get('neo1');
    assert.deepEqual(neo.state.pixels.slice(0, 2), [0xff0000, 0x00ff00]);
    assert.equal(neo.state.pixels.length, 8);
    try { r.stop?.(); } catch { /* ignore */ }
  });

  test('single show() latches on idle timeout with no trailing edge', () => {
    // The normal Arduino pattern: show() once, DIN idles LOW forever.
    // Real strips latch ~50us after the last edge; the model must too.
    const noop = () => {};
    const r = new AVRRunner(':00000001FF', [
      { id: 'uno1', type: 'openhw-arduino-uno', attrs: {} },
      { id: 'neo1', type: 'openhw-neopixel-matrix', attrs: {} },
    ], [
      { from: 'uno1:6', to: 'neo1:DIN' },
      { from: 'uno1:5V', to: 'neo1:VCC' },
      { from: 'uno1:gnd_1', to: 'neo1:GND' },
    ], noop, { boardId: 'uno1' });
    const neo = r.instances.get('neo1');
    let t = 1000000;
    const edge = (high, cycles) => r.dispatchOptionalNeoPixel('6', high, cycles);
    const bit = (v) => {
      edge(true, t);
      edge(false, t + (v ? 14 : 6));
      t += 20;
    };
    const byte = (v) => {
      for (let i = 7; i >= 0; i -= 1) bit((v >> i) & 1);
    };
    for (const b of [0x00, 0xff, 0x00, 0xff, 0x00, 0x00]) byte(b);
    for (let i = 0; i < 6; i += 1) byte(0x00), byte(0x00), byte(0x00);
    // No reset edge — just time passing (update ticks call this per frame).
    assert.deepEqual(neo.state.pixels, []);
    neo.update(t + 5000, [], new Map());
    assert.deepEqual(neo.state.pixels.slice(0, 2), [0xff0000, 0x00ff00]);
    assert.equal(neo.state.pixels.length, 8);
    try { r.stop?.(); } catch { /* ignore */ }
  });

  test('repeated idle levels are not phantom edges', () => {
    // Tick fan-out re-asserts the settled level; each repeat must be
    // ignored or idle ticks emit 0xFF bytes that overwrite the frame.
    const noop = () => {};
    const r = new AVRRunner(':00000001FF', [
      { id: 'uno1', type: 'openhw-arduino-uno', attrs: {} },
      { id: 'neo1', type: 'openhw-neopixel-matrix', attrs: {} },
    ], [
      { from: 'uno1:6', to: 'neo1:DIN' },
      { from: 'uno1:5V', to: 'neo1:VCC' },
      { from: 'uno1:gnd_1', to: 'neo1:GND' },
    ], noop, { boardId: 'uno1' });
    const neo = r.instances.get('neo1');
    let t = 1000000;
    const edge = (high, cycles) => r.dispatchOptionalNeoPixel('6', high, cycles);
    const bit = (v) => {
      edge(true, t);
      edge(false, t + (v ? 14 : 6));
      t += 20;
    };
    const byte = (v) => {
      for (let i = 7; i >= 0; i -= 1) bit((v >> i) & 1);
    };
    for (const b of [0x00, 0xff, 0x00]) byte(b);
    for (let i = 0; i < 6; i += 1) byte(0x00), byte(0x00), byte(0x00);
    // 30 repeated idle-LOW deliveries, then time passes. Decode must hold
    // the full 7-pixel frame (red + 6 off) with no phantom bytes.
    for (let i = 0; i < 30; i += 1) edge(false, t + i);
    neo.update(t + 5000, [], new Map());
    assert.deepEqual(neo.state.pixels, [0xff0000, 0, 0, 0, 0, 0, 0]);
    // Re-asserted idle must not grow phantom bytes afterwards either.
    for (let i = 0; i < 16; i += 1) edge(false, t + 6000 + i);
    neo.update(t + 20000, [], new Map());
    assert.deepEqual(neo.state.pixels, [0xff0000, 0, 0, 0, 0, 0, 0]);
    try { r.stop?.(); } catch { /* ignore */ }
  });
});
