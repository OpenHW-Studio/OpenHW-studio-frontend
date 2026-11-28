/**
 * esp32-camera-pump.ts — ESP32 OV2640 camera tap wiring (esp32-emu camera path).
 *
 * All camera runner logic lives HERE. esp32-runner.ts stays untouched except
 * two call lines (see the wiring snippet at the bottom of this file, applied
 * by the owner): wireEsp32CameraTap() once after sim.run(), and
 * pollEsp32CameraTap() on every pollBusTaps() tick.
 *
 * What the pump does (mirrors the proven engine cells
 * tests/test-worker-camera.mjs + tests/test-worker-camera-fed.mjs):
 *  1. attachCameraSccb(0, 0x30) — in-worker OV2640 SCCB sensor model on I2C
 *     bus 0 (answers the esp-camera driver's PID probe 0x26/0x42 + register
 *     init through the I2C tap). Must land before the guest's
 *     esp_camera_init() runs — wireBusTaps() runs right after sim.run(),
 *     while the guest is still in the bootloader/early setup.
 *  2. setCameraFrameBytes(0, 38400) — explicit QQVGA RGB565 frame size
 *     (160*120*2). The Rust default is already 38400; explicit wins over
 *     default drift.
 *  3. armCamera(0) — arms the guest→host frame tap (js_i2s_cam_data staging;
 *     strictly observation-only, never required for fb contents).
 *  4. VSYNC pump — the esp-camera driver configures VSYNC (GPIO 25) NEGEDGE
 *     and captures synchronously once a frame boundary arrives, so the host
 *     must pulse it: every ~160ms wall, GPIO25 high 30ms then low. Without
 *     this, esp_camera_fb_get() returns NULL forever (deterministic hang).
 *
 * Frame flow (guest→host): fb_get() starts I2S RX DMA in camera mode →
 * virtual-sensor bytes (ramp byte[i] = i & 0xFF, or one staged fed frame)
 * are consumed → staged per-DMA-chunk when the hook is armed → host drains
 * via pollCameraFrame(idx) (u32 words, sensor byte each). The runner drains
 * and discards (serial-only cell); a future framebuffer component can keep
 * the drained words instead.
 *
 * Never breaks boot or tick: every engine call is fire-and-forget with a
 * swallowed rejection, and the VSYNC edge uses setTimeout outside the tick.
 */

const CAM_SCCB_BUS = 0;
const CAM_SCCB_ADDR = 0x30;
const CAM_FRAME_BYTES = 160 * 120 * 2; // QQVGA RGB565
const CAM_VSYNC_GPIO = 25;
const PUMP_EVERY_N_TICKS = 20; // ≈160ms at the 8ms runner tick
const VSYNC_HIGH_MS = 30;

let wiredSim: any = null;
let pollTick = 0;
let vsyncHigh = false;
let vsyncPulses = 0;
let lastDrained = 0;

/** One-shot tap wiring after sim.run(). Safe to call repeatedly; attaches
 * once per SimulatorWorker instance (re-attaches on a fresh sim). */
export function wireEsp32CameraTap(sim: any): void {
    if (!sim || sim === wiredSim) return;
    wiredSim = sim;
    try {
        const p: any = (sim as any).attachCameraSccb?.(CAM_SCCB_BUS, CAM_SCCB_ADDR);
        void (p as Promise<unknown>)?.catch?.(() => {});
    } catch { /* camera tap never breaks boot */ }
    try {
        const p: any = (sim as any).setCameraFrameBytes?.(0, CAM_FRAME_BYTES);
        void (p as Promise<unknown>)?.catch?.(() => {});
    } catch { /* camera tap never breaks boot */ }
    try {
        const p: any = (sim as any).armCamera?.(0);
        void (p as Promise<unknown>)?.catch?.(() => {});
    } catch { /* camera tap never breaks boot */ }
}

/** Per-tick pump: drain staged sensor bytes + pulse one VSYNC boundary per
 * cadence window. Call from pollBusTaps(). */
export function pollEsp32CameraTap(sim: any): void {
    if (!sim || sim !== wiredSim) return;
    try {
        const t = (pollTick + 1) % PUMP_EVERY_N_TICKS;
        pollTick = t;
        if (t !== 0) return;
        try {
            const p: any = (sim as any).pollCameraFrame?.(0);
            if (p && typeof (p as Promise<unknown>).then === 'function') {
                (p as Promise<number[]>).then((words) => {
                    try { lastDrained = Array.isArray(words) ? words.length : 0; } catch { /* ignore */ }
                }).catch(() => {});
            }
        } catch { /* drain never breaks tick */ }
        if (vsyncHigh) return;
        vsyncHigh = true;
        vsyncPulses += 1;
        try {
            const p: any = (sim as any).setPinInput?.(CAM_VSYNC_GPIO, 1);
            void (p as Promise<unknown>)?.catch?.(() => {});
        } catch { /* ignore */ }
        const target = sim;
        setTimeout(() => {
            try {
                const p: any = (target as any)?.setPinInput?.(CAM_VSYNC_GPIO, 0);
                void (p as Promise<unknown>)?.catch?.(() => {});
            } catch { /* ignore */ }
            vsyncHigh = false;
        }, VSYNC_HIGH_MS);
    } catch { /* camera pump never breaks tick */ }
}

/** Debug counters for console triage (pulses sent, words in last drain). */
export function cameraTapStats(): { pulses: number; lastDrained: number; wired: boolean } {
    return { pulses: vsyncPulses, lastDrained, wired: !!wiredSim };
}

/** Test seam: forget wiring so the next wire call re-attaches. */
export function resetEsp32CameraTap(): void {
    wiredSim = null;
    pollTick = 0;
    vsyncHigh = false;
    vsyncPulses = 0;
    lastDrained = 0;
}

// ── Wiring snippet (owner applies inside esp32-runner.ts — the ONLY edit
// allowed outside this file; two call lines + one import) ────────────────
// import { wireEsp32CameraTap, pollEsp32CameraTap } from './esp32-camera-pump.ts';
// …in wireBusTaps(), after the RMT-DHT block:
//     try { wireEsp32CameraTap(self.sim); } catch { /* camera tap never breaks boot */ }
// …in pollBusTaps(), next to pollRmtDht():
//     try { pollEsp32CameraTap(self.sim); } catch { /* never breaks tick */ }
