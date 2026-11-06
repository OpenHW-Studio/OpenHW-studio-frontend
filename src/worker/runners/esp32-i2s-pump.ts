/**
 * esp32-i2s-pump.ts — ESP32 I2S TX → I2S DAC bridge (MAX98357 cell).
 *
 * Engine: esp32-emu I2S TX tap (§9): `armI2sTx()` arms the sticky guest→host
 * DMA hook, `pollI2sTx(idx)` drains staged u32 LE words. The words are the raw
 * `i2s_write` byte stream (LE-packed), so the pump regroups them into 16-bit
 * stereo frames and feeds `onI2SFrame(channel, sample, 16)` on every wired
 * DAC instance — the same entry point the AVR bit-bang `tickI2S` decoder
 * uses, so `totalFrameCount`/`peakAmplitude` telemetry matches shape.
 *
 * Style mirrors the RMT-DHT pump in esp32-runner.ts: fire-and-forget
 * promises, try/catch everywhere, never breaks boot/tick. Per-pump state
 * rides sim expandos (`__i2s*`), same as `rmtDhtArmed` there.
 */

/** Arm the I2S TX hook. Call once from wireBusTaps (sticky wiring; staging
 * starts on the next TX DMA, i.e. long after boot — firmware installs the
 * driver in setup()). */
export function armEsp32I2sTx(sim: any): void {
    try {
        if (!sim || typeof sim.armI2sTx !== 'function') return;
        void (sim.armI2sTx() as Promise<unknown>)?.catch?.(() => {});
    } catch { /* arm never breaks boot */ }
}

/** Drain staged I2S TX words and decode them into DAC frames. Call once per
 * pollBusTaps tick; internally throttled + no-ops without a DAC instance. */
export function pollEsp32I2sTx(sim: any, instances: Map<string, any> | Iterable<any>): void {
    try {
        if (!sim || typeof sim.pollI2sTx !== 'function') return;
        // Fast path: no I2S sink present → skip the SAB round-trip.
        let hasDac = false;
        try {
            const vals = (instances as Map<string, any>)?.values
                ? Array.from((instances as Map<string, any>).values())
                : Array.from(instances as Iterable<any>);
            for (const inst of vals) {
                if (inst && typeof (inst as any).onI2SFrame === 'function') { hasDac = true; break; }
            }
            if (!hasDac) return;
        } catch { return; }
        const tick = (((sim as any).__i2sTick || 0) + 1) % 5;
        (sim as any).__i2sTick = tick;
        if (tick !== 0) return;
        // Re-arm while nothing was ever staged (covers an arm that raced
        // boot); sticky + harmless once flowing.
        try {
            if (!((sim as any).__i2sWords || 0)) {
                const n = ((sim as any).__i2sRearm || 0) + 1;
                (sim as any).__i2sRearm = n;
                if (n % 20 === 1) armEsp32I2sTx(sim);
            }
        } catch { /* ignore */ }
        let p: any = null;
        try { p = sim.pollI2sTx(0); } catch { /* ignore */ }
        if (!p || typeof (p as any).then !== 'function') return;
        (p as Promise<number[]>).then((words) => {
            try {
                if (!Array.isArray(words) || words.length === 0) return;
                (sim as any).__i2sWords = (Number((sim as any).__i2sWords) || 0) + words.length;
                // u32 LE words → byte stream (+ carry from the last drain).
                let bytes: number[] = [];
                try {
                    const carry = (sim as any).__i2sCarry;
                    if (Array.isArray(carry) && carry.length > 0) bytes = carry.slice(0, 3);
                } catch { /* ignore */ }
                for (const w of words) {
                    const u = Number(w) >>> 0;
                    bytes.push(u & 0xff, (u >>> 8) & 0xff, (u >>> 16) & 0xff, (u >>> 24) & 0xff);
                }
                // 16-bit stereo frames: [L16 LE][R16 LE] → one L + one R
                // onI2SFrame pair (R call bumps totalFrameCount).
                const n = bytes.length - (bytes.length % 4);
                try { (sim as any).__i2sCarry = bytes.slice(n); } catch { /* ignore */ }
                if (n === 0) return;
                const vals = (instances as Map<string, any>)?.values
                    ? Array.from((instances as Map<string, any>).values())
                    : Array.from(instances as Iterable<any>);
                for (let i = 0; i < n; i += 4) {
                    const l = (bytes[i] | (bytes[i + 1] << 8)) & 0xffff;
                    const r = (bytes[i + 2] | (bytes[i + 3] << 8)) & 0xffff;
                    const ls = ((l << 16) >> 0) || 0;
                    const rs = ((r << 16) >> 0) || 0;
                    for (const inst of vals) {
                        try {
                            if (inst && typeof (inst as any).onI2SFrame === 'function') {
                                try { (inst as any).onI2SFrame(0, ls, 16); } catch { /* ignore */ }
                                try { (inst as any).onI2SFrame(1, rs, 16); } catch { /* ignore */ }
                            }
                        } catch { /* one instance never breaks the pump */ }
                    }
                }
            } catch { /* decode never breaks tick */ }
        }).catch(() => {});
    } catch { /* pump never breaks tick */ }
}
