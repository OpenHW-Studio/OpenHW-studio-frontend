import { describe, expect, it } from 'vitest';
import { rmtWordsToPixels, splitRmtWord, grbBytesToPixels } from '../../../src/worker/runners/rmt-neopixel.ts';

// Decoder for the ESP32 RMT-TX word stream that Adafruit_NeoPixel produces.
// Adafruit never bit-bangs DIN: it fills one RMT item per WS2812 bit
// ({duration0, level0 = 1, duration1, level1 = 0}) and the runner's only
// copy of the frame is the engine's RMT tap. These tests pin the word
// packing, both clock rates the library uses in the wild, and the
// GRB→RGB convention shared with the AVR framer.

type Bit = 0 | 1;

function item(d0: number, l0: number, d1: number, l1: number): number {
  return ((d0 & 0x7fff) | ((l0 & 1) << 15) | ((d1 & 0x7fff) << 16) | ((l1 & 1) << 31)) >>> 0;
}

/** One WS2812 item for `bit` at `tickHz` (Adafruit timing constants). */
function ws2812Item(bit: Bit, tickHz: number): number {
  const us = 1e6 / tickHz; // µs per tick
  const t0h = Math.round(400 / 1000 / us);
  const t0l = Math.round(850 / 1000 / us);
  const t1h = Math.round(800 / 1000 / us);
  const t1l = Math.round(450 / 1000 / us);
  return bit ? item(t1h, 1, t1l, 0) : item(t0h, 1, t0l, 0);
}

/** `bytes` (G,R,B per pixel) → Adafruit's RMT word list + terminator. */
function frameWords(bytes: number[], tickHz: number): number[] {
  const out: number[] = [];
  for (const b of bytes) {
    for (let i = 7; i >= 0; i--) out.push(ws2812Item(((b >> i) & 1) as Bit, tickHz));
  }
  out.push(0); // engine terminator
  return out;
}

const RED = [0, 255, 0];   // GRB, red
const GREEN = [255, 0, 0]; // GRB, green

describe('rmtWordsToPixels', () => {
  it('packs and splits the RmtTap word layout', () => {
    const w = item(16, 1, 34, 0);
    expect(splitRmtWord(w)).toEqual({ d0: 16, l0: 1, d1: 34, l1: 0 });
  });

  it('decodes a two-pixel frame at the legacy div-2 rate (40 MHz)', () => {
    // Adafruit's rmtWrite path: clk_div = 2 on the 80 MHz APB → 40 MHz.
    const pixels = rmtWordsToPixels(frameWords([...RED, ...GREEN], 40_000_000), 40_000_000);
    expect(pixels).toEqual([0xff0000, 0x00ff00]);
  });

  it('decodes the same frame at the IDF5 helper rate (10 MHz)', () => {
    // The IDF5 branch of Adafruit esp.c asks rmtInit for 10 MHz: the same
    // 0.4/0.8 µs highs are 4/8 ticks there, so the decoder must not assume
    // a fixed tick rate.
    const pixels = rmtWordsToPixels(frameWords([...RED, ...GREEN], 10_000_000), 10_000_000);
    expect(pixels).toEqual([0xff0000, 0x00ff00]);
  });

  it('falls back to 40 MHz when the tick rate is unknown', () => {
    const pixels = rmtWordsToPixels(frameWords([...RED], 40_000_000), 0);
    expect(pixels).toEqual([0xff0000]);
  });

  it('treats a bare 50 µs low as a frame boundary, not a bit', () => {
    // A latch gap with no preceding high (firmware-encoded reset item)
    // must close the frame and must not fabricate a data bit.
    const reset = item(50 * 40, 0, 0, 0);
    const words = [...frameWords([...RED], 40_000_000).slice(0, -1), reset, ...frameWords([...GREEN], 40_000_000)];
    const pixels = rmtWordsToPixels(words, 40_000_000);
    expect(pixels).toEqual([0xff0000, 0x00ff00]);
  });

  it('ignores an incomplete tail (frame split across polls)', () => {
    const words = frameWords([...RED, ...GREEN], 40_000_000).slice(0, 30); // 1 pixel + 6 bits
    expect(rmtWordsToPixels(words, 40_000_000)).toEqual([0xff0000]);
  });

  it('decodes WS2811 timing (1.25 ms bit period)', () => {
    // WS2811: 0.5 µs high = 0, 1.2 µs = 1 at a 2.5 µs period; the 0.65 µs
    // threshold still separates them.
    const hz = 40_000_000;
    const mk = (bit: Bit) => (bit
      ? item(Math.round(1.2 * 40), 1, Math.round(1.3 * 40), 0)
      : item(Math.round(0.5 * 40), 1, Math.round(2.0 * 40), 0));
    const words: number[] = [];
    for (const b of [...GREEN, ...RED]) for (let i = 7; i >= 0; i--) words.push(mk(((b >> i) & 1) as Bit));
    words.push(0);
    expect(rmtWordsToPixels(words, hz)).toEqual([0x00ff00, 0xff0000]);
  });
});

describe('grbBytesToPixels', () => {
  it('swaps GRB wire order into 0xRRGGBB', () => {
    expect(grbBytesToPixels([0, 255, 0, 255, 0, 0])).toEqual([0xff0000, 0x00ff00]);
  });
});
