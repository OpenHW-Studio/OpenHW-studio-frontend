/**
 * rmt-neopixel.ts — WS2812 frame decode from ESP32 RMT-TX item words.
 *
 * Why this file exists: Adafruit_NeoPixel on ESP32 does not bit-bang DIN.
 * It fills an RMT item buffer (`{duration0, level0, duration1, level1}`
 * pairs, one pair per bit) and calls `rmtWrite`; the pin therefore carries
 * no GPIO edges the runner could sample, and the WS2812 edge framer in
 * `NeoPixelProtocol` never sees a bit. The only observable copy of the
 * frame is the engine's RMT-TX tap (`pollRmtTx(ch)` → raw u32 item words).
 *
 * The tap drains one channel at a time and returns the channel's words in
 * RAM order with a zero terminator, packed exactly like `RmtTap.item`:
 *
 *   bit 0..14  duration0 (RMT ticks)   bit 15  level0
 *   bit 16..30 duration1 (RMT ticks)   bit 31  level1
 *
 * WS2812 bit = (high, low) with the high time selecting the bit value:
 * ~0.4 us = 0, ~0.8 us = 1 (WS2811: 0.5 / 1.2 us). Threshold 0.65 us
 * separates both families; durations are converted with the channel tick
 * rate (`getRmtTickHz`) so a firmware's own clock divider (Adafruit uses
 * div 2 → 40 MHz on the legacy driver, 10 MHz on the IDF5 helper) does
 * not matter. A low gap ≥ 50 us is the strip's latch/reset.
 *
 * Pure + side-effect free: the runner owns polling and fan-out, this file
 * owns bits → pixels, so it can be exercised without an engine.
 */

/** Packed WS2812 pixel: 0xRRGGBB (the shape every NeoPixel model stores). */
export type NeoPixelFrame = number[];

/** One RMT word (see the packing table above). */
export interface RmtWord {
    d0: number;
    l0: number;
    d1: number;
    l1: number;
}

export function splitRmtWord(w: number): RmtWord {
    const u = Number(w) >>> 0;
    return {
        d0: u & 0x7fff,
        l0: (u >>> 15) & 1,
        d1: (u >>> 16) & 0x7fff,
        l1: (u >>> 31) & 1,
    };
}

/** High-time threshold between a WS2812/WS2811 '0' and '1' bit (µs). */
export const NEOPIXEL_ONE_HIGH_US = 0.65;

/** Low-time gap that ends a frame (µs). */
export const NEOPIXEL_RESET_US = 50;

/** GRB wire bytes → 0xRRGGBB, the convention shared with the AVR framer
 * (`NeoPixelBusFramer.packPixels`) so telemetry looks identical on both
 * boards. */
export function grbBytesToPixels(bytes: ArrayLike<number>): NeoPixelFrame {
    const pixels: NeoPixelFrame = [];
    for (let i = 0; i + 2 < bytes.length; i += 3) {
        const g = Number(bytes[i]) & 0xff;
        const r = Number(bytes[i + 1]) & 0xff;
        const b = Number(bytes[i + 2]) & 0xff;
        pixels.push(((r << 16) | (g << 8) | b) >>> 0);
    }
    return pixels;
}

/**
 * Decode one drained RMT channel's words into a pixel frame.
 *
 * @param words  raw u32 item words in channel-RAM order (zero terminator
 *               included; extra words after it are ignored)
 * @param tickHz channel tick rate (`getRmtTickHz`), Hz — 0/NaN falls back
 *               to 40 MHz, the legacy driver's div-2 rate
 */
export function rmtWordsToPixels(words: ArrayLike<number>, tickHz: number): NeoPixelFrame {
    const hz = Number(tickHz) > 0 ? Number(tickHz) : 40_000_000;
    const usPerTick = 1e6 / hz;
    const bits: number[] = [];
    const bytes: number[] = [];
    const pixels: NeoPixelFrame = [];
    let highUs = 0;

    const flushBytes = () => {
        while (bits.length >= 8) {
            let b = 0;
            for (let i = 0; i < 8; i++) b = (b << 1) | (bits[i] & 1);
            bits.splice(0, 8);
            bytes.push(b & 0xff);
        }
        // The wire order is GRB per pixel; only whole pixels are meaningful
        // (a truncated tail belongs to a frame the next poll completes).
        while (bytes.length >= 3) {
            const g = bytes[0];
            const r = bytes[1];
            const b = bytes[2];
            pixels.push(((r << 16) | (g << 8) | b) >>> 0);
            bytes.splice(0, 3);
        }
    };

    const len = Number((words as any)?.length) || 0;
    for (let i = 0; i < len; i++) {
        const w = Number((words as any)[i]) >>> 0;
        if (w === 0) break; // engine terminator = end of this TX
        const { d0, l0, d1, l1 } = splitRmtWord(w);
        for (const [dur, level] of [[d0, l0], [d1, l1]] as Array<[number, number]>) {
            const us = dur * usPerTick;
            if (level === 1) {
                highUs += us;
                continue;
            }
            // Low segment closes the bit that the preceding high opened.
            if (highUs > 0) {
                bits.push(highUs >= NEOPIXEL_ONE_HIGH_US ? 1 : 0);
                highUs = 0;
                flushBytes();
                if (us >= NEOPIXEL_RESET_US) flushBytes(); // frame boundary
            } else if (us >= NEOPIXEL_RESET_US) {
                flushBytes();
            }
        }
    }
    flushBytes();
    return pixels;
}
