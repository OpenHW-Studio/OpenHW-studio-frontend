/**
 * pico-pio-pump.ts — RP2040 PIO0 SM0 RX-FIFO → NeoPixel frame bridge
 * (Pico WS2812 cell).
 *
 * Engine: pico-emu PIO FIFO taps — `picoemu_pio_tx_push(block, sm, word)`
 * feeds words TO a PIO program, `picoemu_pio_rx_pop(block, sm, *word)`
 * observes words FROM it, `picoemu_pio_state(block, sm, *pc, *txlevel,
 * *rxlevel, *stalled)` reads pc + FIFO levels + stalled (any out-param
 * nullable; -1 on bad index/full/empty). WASM exports are the same names
 * with a `_picoemu_` prefix.
 *
 * Why a pump instead of the GPIO path: a WS2812 bit is 1.25us (~156 core
 * cycles @125MHz) and a whole multi-pixel frame fits inside ONE runner
 * tick (2.5M steps/16ms), so per-tick whole-port GPIO polling
 * (sampleGpioOut) only ever sees the settled idle level — the 800kHz PIO
 * waveform is invisible there. The cell firmware therefore runs a small
 * raw PIO program that shifts the WS2812 waveform to the pin AND pushes a
 * copy of every 32-bit pixel word (GRB in bits 31:8, MSB first) to the RX
 * FIFO (noblock, so pin timing never stalls). This pump drains that FIFO
 * once per tick and feeds the words as a pixel frame through
 * `onNeoPixelFrame` — the same entry point the AVR bit-bang path lands on,
 * so `activePixels`/telemetry matches shape.
 *
 * Cell contract: firmware drives PIO0 SM0 (block 0, sm 0); the DIN net of
 * every `openhw-neopixel-matrix` / `openhw-neopixel-ring` instance in the
 * circuit receives the decoded frame (broadcast — one strip per cell).
 * No-ops without NeoPixel instances or without the taps (older cores), so
 * stock behavior is unchanged for every other cell.
 *
 * Style mirrors esp32-i2s-pump.ts: exported helpers, try/catch
 * everywhere, never breaks boot/tick, stateless across ticks (no
 * cross-board expandos — every tick re-derives everything from the taps).
 */

/** PIO block/SM the cell firmware drives (see the cell sketch). */
export const PICO_PIO_NEOPIXEL_BLOCK = 0;
export const PICO_PIO_NEOPIXEL_SM = 0;

/** Max RX words drained per tick (one 4-deep FIFO + headroom; frames are
 * a handful of pixels, show()-once firmware never overruns this). */
const MAX_RX_WORDS_PER_TICK = 16;


function hasPioTaps(mod: any): boolean {
    try {
        return !!mod
            && typeof mod._picoemu_pio_state === 'function'
            && typeof mod._picoemu_pio_rx_pop === 'function';
    } catch { return false; }
}

/** Little-endian u32 load via HEAPU8 (never HEAPU32 — emscripten 6.x
 * builds may not export typed views; same caveat as the I2C/PWM drains
 * in pico-runner.ts). */
function loadU32le(mod: any, addr: number): number {
    try {
        const b = mod.HEAPU8;
        return (((b[addr] || 0) | ((b[addr + 1] || 0) << 8)
            | ((b[addr + 2] || 0) << 16) | ((b[addr + 3] || 0) << 24)) >>> 0);
    } catch { return 0; }
}

/** Read one SM's pc + FIFO levels + stalled flag via `_picoemu_pio_state`.
 * Returns null when the tap is missing or rejects the index. */
export function readPioSmState(
    mod: any,
    block: number,
    sm: number,
): { pc: number; txlevel: number; rxlevel: number; stalled: boolean } | null {
    try {
        if (!hasPioTaps(mod)) return null;
        if (typeof mod._malloc !== 'function' || typeof mod._free !== 'function') return null;
        const ptr = mod._malloc(16);
        try {
            const r = mod._picoemu_pio_state(block | 0, sm | 0, ptr, ptr + 4, ptr + 8, ptr + 12);
            if (r !== 0) return null;
            return {
                pc: loadU32le(mod, ptr),
                txlevel: loadU32le(mod, ptr + 4),
                rxlevel: loadU32le(mod, ptr + 8),
                stalled: loadU32le(mod, ptr + 12) !== 0,
            };
        } finally {
            try { mod._free(ptr); } catch { /* ignore */ }
        }
    } catch { return null; }
}

/** Drain up to `maxWords` RX-FIFO words from one SM via
 * `_picoemu_pio_rx_pop` (0 ok / -1 empty). Never steals TX words — RX is
 * the SM-to-host direction, so guest PIO execution is undisturbed. */
export function drainPioRxFifo(
    mod: any,
    block: number,
    sm: number,
    maxWords = MAX_RX_WORDS_PER_TICK,
): number[] {
    const out: number[] = [];
    try {
        if (!hasPioTaps(mod)) return out;
        if (typeof mod._malloc !== 'function' || typeof mod._free !== 'function') return out;
        const n = Math.max(1, Math.min(64, Math.floor(maxWords) || 1));
        const ptr = mod._malloc(4);
        try {
            for (let i = 0; i < n; i++) {
                let r = -1;
                try { r = mod._picoemu_pio_rx_pop(block | 0, sm | 0, ptr); } catch { break; }
                if (r !== 0) break;
                out.push(loadU32le(mod, ptr));
            }
        } finally {
            try { mod._free(ptr); } catch { /* ignore */ }
        }
    } catch { /* drain never breaks the tick */ }
    return out;
}

/** Convert raw RX words to packed 0xRRGGBB pixels. Cell firmware sends
 * GRB in bits 31:8 (MSB-first shift order); low byte is padding. Pure. */
export function pioWordsToPixels(words: ArrayLike<number>): number[] {
    const pixels: number[] = [];
    try {
        const len = (words as any)?.length || 0;
        for (let i = 0; i < len; i++) {
            const w = Number((words as any)[i]) >>> 0;
            const g = (w >>> 24) & 0xff;
            const r = (w >>> 16) & 0xff;
            const b = (w >>> 8) & 0xff;
            pixels.push(((r << 16) | (g << 8) | b) >>> 0);
        }
    } catch { /* decode never breaks the tick */ }
    return pixels;
}

/** Collect NeoPixel sink instances (matrix + ring share the
 * `onNeoPixelFrame` entry point; capability detection, no per-type
 * code — same pattern as the I2C/SPI bridge arming in pico-runner.ts). */
export function neopixelSinks(instances: Map<string, any> | Iterable<any>): any[] {
    const sinks: any[] = [];
    try {
        const vals = (instances as Map<string, any>)?.values
            ? Array.from((instances as Map<string, any>).values())
            : Array.from(instances as Iterable<any>);
        for (const inst of vals) {
            try {
                if (inst && typeof (inst as any).onNeoPixelFrame === 'function') sinks.push(inst);
            } catch { /* one instance never breaks the scan */ }
        }
    } catch { /* scan never breaks the tick */ }
    return sinks;
}

/** Per-tick entry: drain PIO0 SM0's RX mirror into every NeoPixel sink.
 * Call once per stepBudget tick (after the mirror/ADC/PWM drains); see
 * the one-line wiring snippet in the cell report. */
export function pollPicoPioNeopixel(
    mod: any,
    instances: Map<string, any> | Iterable<any>,
): void {
    try {
        if (!mod) return;
        // Fast path: no NeoPixel sink present → skip the tap round-trip
        // (same contract as pollEsp32I2sTx's hasDac check).
        const sinks = neopixelSinks(instances);
        if (sinks.length === 0) return;
        if (!hasPioTaps(mod)) return;
        // Level check first: _picoemu_pio_state proves the SM is alive
        // (pc advancing / FIFOs moving) and skips the drain when the RX
        // FIFO is empty.
        let rxlevel = 0;
        try {
            const st = readPioSmState(mod, PICO_PIO_NEOPIXEL_BLOCK, PICO_PIO_NEOPIXEL_SM);
            if (!st) return;
            rxlevel = st.rxlevel || 0;
        } catch { return; }
        if (rxlevel <= 0) return;
        const words = drainPioRxFifo(mod, PICO_PIO_NEOPIXEL_BLOCK, PICO_PIO_NEOPIXEL_SM);
        if (words.length === 0) return;
        const pixels = pioWordsToPixels(words);
        if (pixels.length === 0) return;
        for (const sink of sinks) {
            try { (sink as any).onNeoPixelFrame(pixels.slice()); } catch { /* ignore */ }
        }
    } catch { /* pump never breaks the tick */ }
}
