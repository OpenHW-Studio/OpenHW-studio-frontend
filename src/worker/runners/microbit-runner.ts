/* microbit-runner.ts — BBC micro:bit v2.2 (nRF52833) BoardRunner over the
 * owner first-party engine (nrf52833-periph-wasm, frozen v1 JS API).
 *
 * Engine: Rust/WASM Cortex-M4F + nRF52833 peripherals. Synchronous
 * model — no callbacks into JS. Lifecycle per demo/API.md: reset_state()
 * → taps (BEFORE init!) → init() → WasmCpu → load_firmware → step loop
 * with the EASYDMA pump every frame.
 *
 * Firmware: fixed .bin images (backend has no micro:bit core) via the
 * generic `firmware` board attr (execute.ts → options.fixedFirmware),
 * same pattern as PicoRV32. Images live in public/firmware/microbit/.
 *
 * I2C: TWIM0 serves the edge (P19/P20). DMA-level taps (take/complete +
 * guest-RAM mem_write, per the master-read recipe) — NOT pin level.
 * Discovered slave addresses register via i2c_register_slave (single
 * bus; TWIM1 internal sensors are a documented gap).
 * SPI: SPIM2/3 DMA pump (mem loopback like the demo); no JS slave
 * models (no SPI fixture needs one).
 * GPIO: edge pins P0..P20 publish via publishGpio; gpio_set_input
 * injects. Matrix rows/cols feed the board telemetry (matrixLit).
 * UART: UARTE0 polled TXD drain → serial; RX is a paced single-slot
 * drip (injectUartByte → queue → uart_rx_byte once RXDRDY clears),
 * mirroring each byte into the RXD EasyDMA ring like the owner bench.
 * PWM: PWM0..3 readback (pwm_observe_seq_word + pwm_get_duty/freq_hz)
 * drives LED brightness models via onPWM.
 */
import { ArmRunnerBase, importEngine } from './arm-runner-base.ts';
import { createI2CBridge, collectI2CSlaveAddresses } from '../bus-bridge.ts';

/** Edge label → [port, pin] (nRF52833 P0/P1). From the engine pins.js. */
const MB_EDGE: Record<string, [number, number]> = {
    P0: [0, 2], P1: [0, 3], P2: [0, 4], P3: [0, 31], P4: [0, 28],
    P5: [0, 14], P6: [1, 5], P7: [0, 11], P8: [0, 10], P9: [0, 9],
    P10: [0, 30], P11: [0, 23], P12: [0, 12], P13: [0, 17],
    P14: [0, 1], P15: [0, 13], P16: [1, 2], P19: [0, 26], P20: [1, 0],
};

/** PWM instance bases (nRF52833): PWM0 0x4001C000, PWM1 0x40021000,
 * PWM2 0x40022000, PWM3 0x4002D000 (engine pwm_nrf::pwm_base). */
const MB_PWM_BASE = [0x4001c000, 0x40021000, 0x40022000, 0x4002d000];
/** PWM register offsets used by the readback pump. */
const MB_PWM_SEQ0_PTR = 0x520;   // SEQ[0].PTR
const MB_PWM_SEQ0_CNT = 0x524;   // SEQ[0].CNT (16-bit words)
const MB_PWM_PSEL_OUT0 = 0x560;  // PSEL.OUT[0] (nRF pin number)

/** UARTE0 (console UART) register map — nRF52833 product spec. */
const MB_UART0_BASE = 0x40002000;
const MB_UART0_EVENTS_RXD = 0x40002108;   // EVENTS_RXDRDY (own register)
const MB_UART0_RXD_PTR = 0x40002534;      // RXD.PTR
const MB_UART0_RXD_MAXCNT = 0x40002538;   // RXD.MAXCNT
const MB_UART0_RXD_AMOUNT = 0x4000253c;   // RXD.AMOUNT

/** SAADC input the sample firmware programs: AIN0 = P0.02 = edge pin P0. */
const MB_AIN_EDGE = 'P0';
/** SAADC full scale: internal 0.6 V reference with gain 1/6 -> 3.6 V,
 * 12-bit resolution -> 0..4095 counts (nRF52833 product spec). */
function mvToSaadcCounts(mv: number): number {
    const v = Math.max(0, Math.min(3600, Number(mv) || 0));
    return Math.max(0, Math.min(4095, Math.round((v * 4096) / 3600)));
}

function b64ToU8(s: string): Uint8Array {
    const bin = atob(s.replace(/\s/g, ''));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 0xff;
    return out;
}

export class MicrobitRunner extends ArmRunnerBase {
    protected engine: any = null;
    private mod: any = null;
    private cpu: any = null;
    private mcu: any = null;
    private fixedFirmwareUrl = '';
    private lastGpioOut: Record<string, boolean> = {};
    private lastMatrixLit = -1;
    private i2cBridge: any = null;
    /** Component attrs by component id. Board attrs drive the host-side
     * injection points (tempC, adcMv, nfcField) — without this map every
     * board-attr path in this runner was dead code (same shape as the
     * Pico/ESP32 runners). */
    private compAttrById: Map<string, any> = new Map();
    /** Bytes the host handed us for UARTE0 RX, waiting for a free slot. */
    private rxQueue: number[] = [];
    /** Last PWM readback (duty in basis points, freq in Hz). */
    private lastPwmDutyBp = 0;
    private lastPwmFreqHz = 0;

    constructor(
        hexData: string,
        componentsDef: any[],
        wiresDef: any[],
        onStateUpdate: (state: any) => void,
        options: any = {},
    ) {
        super(hexData, componentsDef, wiresDef, onStateUpdate, options);
        this.fixedFirmwareUrl = String((options as any)?.fixedFirmware || '').trim();
        try { this.snapshotCompAttrs(componentsDef); } catch { /* ignore */ }
        // Component attrs (board attrs drive tempC / adcMv / nfcField).
        try {
            const defs = Array.isArray(componentsDef) ? componentsDef : [];
            for (const c of defs) {
                if (c && c.id !== undefined) this.compAttrById.set(String(c.id), (c as any).attrs || {});
            }
        } catch { /* attrs are optional */ }
        try { this.engine = this.makeEngine(); } catch { /* ignore */ }
        void this.boot('openhw-microbit-v2');
    }

    private makeEngine() {
        const self = this;
        return {
            async loadFirmware(firmware: string, _boardType: string) {
                // Attr fallback (same lesson as PicoRV32): options may not
                // carry board attrs — read them directly.
                try {
                    const battrs = (self as any).compAttrById?.get?.(self.boardId) || {};
                    if (!self.fixedFirmwareUrl && (battrs as any).firmware) {
                        self.fixedFirmwareUrl = String((battrs as any).firmware);
                    }
                } catch { /* ignore */ }
                const engineMod: any = await importEngine(
                    '../engines/microbit/nrf52833_periph_wasm.js',
                    '/vendor/board-engines/microbit/nrf52833_periph_wasm.js',
                );
                const wasm = engineMod;
                if (!wasm?.reset_state || !wasm?.WasmCpu) {
                    console.warn('[MicrobitRunner] engine unavailable — idle.');
                    return;
                }
                // WASM bytes explicitly (glue-URL-relative default breaks
                // under vite worker bundling — same class as pico/8086).
                // Candidates: the canonical public/wasm copy and the
                // deploy mirror that sits next to the vendor glue. All
                // three copies in the repo are the SAME owner build
                // (unit test tests/unit/worker/microbit-engine-pair.test.mjs
                // pins the md5) — glue+wasm must never be mixed.
                try {
                    const urls = [
                        '/wasm/nrf52833_periph_wasm_bg.wasm',
                        '/vendor/board-engines/microbit/nrf52833_periph_wasm_bg.wasm',
                    ];
                    for (const url of urls) {
                        try {
                            const r = await fetch(url);
                            if (!r.ok) continue;
                            const buf = await r.arrayBuffer();
                            if (wasm.initSync) { wasm.initSync({ module: buf }); break; }
                        } catch { /* try the next candidate */ }
                    }
                } catch { /* fall through to default init */ }
                try { wasm.reset_state(); } catch { /* ignore */ }
                self.mod = wasm;
                // I2C slave registration BEFORE init (controllers snapshot
                // at construction). TWIM0 serves the edge bus.
                try {
                    const seen = new Set<number>();
                    try {
                        const ctx: any = { boardId: self.boardId, instances: self.instances };
                        for (const a of collectI2CSlaveAddresses(ctx)) seen.add(a & 0x7f);
                    } catch { /* ignore */ }
                    if (seen.size === 0) seen.add(0x3c);
                    for (const a of seen) {
                        try { wasm.i2c_register_slave('TWIM0', a); } catch { /* ignore */ }
                    }
                } catch { /* taps never break boot */ }
                try { wasm.init(); } catch (e) {
                    console.warn('[MicrobitRunner] init failed:', e);
                    return;
                }
                // Shared I2C bridge (model truth for TWIM0 OLED traffic).
                try {
                    const bridgeCtx: any = {
                        boardId: self.boardId,
                        onStateUpdate: (msg: any) => { try { self.onStateUpdate(msg); } catch { /* ignore */ } },
                        getSimTimeMs: () => { try { return self.getSimulatedTimeMs(); } catch { return 0; } },
                        instances: self.instances,
                        compAttrById: (self as any).compAttrById,
                        pinToNet: (self as any).pinToNet,
                        boardPinLevel: () => null,
                    };
                    self.i2cBridge = createI2CBridge(bridgeCtx);
                } catch { /* bridge never breaks boot */ }
                // Firmware: fixed image (no backend core for nRF52833).
                // URL arrives via the board `firmware` attr (options) or
                // the FIXEDBIN: sentinel (compile bypass payload).
                let bytes: Uint8Array | null = null;
                let fwUrl = self.fixedFirmwareUrl;
                if (!fwUrl && String(firmware || '').startsWith('FIXEDBIN:')) {
                    fwUrl = String(firmware).slice('FIXEDBIN:'.length).trim();
                }
                if (fwUrl) {
                    try {
                        const res = await fetch(fwUrl);
                        if (res.ok) bytes = new Uint8Array(await res.arrayBuffer());
                        else console.warn('[MicrobitRunner] fixed firmware HTTP', res.status);
                    } catch (e) { console.warn('[MicrobitRunner] fixed firmware failed:', e); }
                } else if (firmware && firmware.trim()) {
                    try { bytes = b64ToU8(firmware.trim()); } catch { bytes = null; }
                }
                if (!bytes || bytes.length < 8) {
                    console.warn('[MicrobitRunner] no firmware — idle.');
                    return;
                }
                // Vector table: [SP, Reset+1] (raw .bin at base 0x0).
                const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
                const sp = dv.getUint32(0, true) >>> 0;
                const pc = (dv.getUint32(4, true) >>> 0) & ~1;
                try {
                    self.cpu = new wasm.WasmCpu(sp, pc, 512 * 1024, 128 * 1024);
                    self.cpu.load_firmware(bytes, 0x0);
                } catch (e) {
                    console.warn('[MicrobitRunner] cpu/firmware failed:', e);
                    return;
                }
                self.mcu = {
                    gpio: {
                        pin: (_port: any, _pin: any) => ({
                            read: () => false,
                            on: () => () => {},
                        }),
                    },
                    close: () => { try { self.cpu = null; } catch { /* ignore */ } },
                };
                // Button pull-ups + scripted Button-A press (board-level
                // input stimulus): P5/P11 idle HIGH like the hardware
                // pull-ups; A pulls LOW 3s after boot for 600ms so
                // button-reading firmware observes a real press edge.
                // Existing cells never sample P0.14/P0.23 — no-op for them.
                try {
                    self.mod?.gpio_set_input?.(0, 14, true);
                    self.mod?.gpio_set_input?.(0, 23, true);
                    const gen = ((self as any).btnGen = (((self as any).btnGen || 0) + 1));
                    setTimeout(() => {
                        try {
                            if ((self as any).btnGen !== gen || !self.mod) return;
                            self.mod.gpio_set_input(0, 14, false);
                        } catch { /* ignore */ }
                    }, 3000);
                    setTimeout(() => {
                        try {
                            if ((self as any).btnGen !== gen || !self.mod) return;
                            self.mod.gpio_set_input(0, 14, true);
                        } catch { /* ignore */ }
                    }, 3600);
                } catch { /* button stimulus never breaks boot */ }
            },
            stepBudget(budget: number): number {
                if (!self.cpu || !self.mod) return 0;
                const n = Math.max(1, Math.floor(budget));
                let stepped = 0;
                try { stepped = Number(self.cpu.step(n)) || 0; } catch { stepped = 0; }
                try { self.mod.tick_peripherals(); } catch { /* ignore */ }
                try { self.driveRails(); } catch { /* never breaks tick */ }
                try { self.pumpDma(); } catch { /* never breaks tick */ }
                try { self.pumpUartRx(); } catch { /* never breaks tick */ }
                try { self.pumpPwm(); } catch { /* never breaks tick */ }
                try { self.pollGpio(); } catch { /* never breaks tick */ }
                return stepped > 0 ? stepped : n;
            },
            drainUartOut(): number[] {
                // TEMP cell: board attr `tempC` drives the engine die-temp
                // (temp_set_celsius, synchronous — no pump). Re-applied per
                // drain so fixed-firmware cells and late attr edits converge.
                try {
                    const battrs = (self as any).compAttrById?.get?.(self.boardId) || {};
                    const c = Number((battrs as any)?.tempC);
                    if (Number.isFinite(c) && self.mod?.temp_set_celsius) {
                        self.mod.temp_set_celsius(Math.max(-40, Math.min(85, c)));
                    }
                } catch { /* temp drive never breaks the drain */ }
                try {
                    const s = String(self.mod?.get_uart_output?.() || '');
                    if (!s) return [];
                    const out: number[] = [];
                    for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0xff);
                    return out;
                } catch { return []; }
            },
            setGpioInput(pinId: string, high: boolean): void {
                try {
                    const key = String(pinId || '').toUpperCase();
                    const pp = (MB_EDGE as any)[key];
                    if (!pp) return;
                    self.mod?.gpio_set_input?.(pp[0], pp[1], !!high);
                } catch { /* ignore */ }
            },
            /**
             * UART RX: the host (serial console / inter-board UART) hands
             * us bytes; the engine's UARTE0 RXD holds exactly ONE byte, so
             * a second arrival before the firmware reads RXD is a real
             * OVERRUN. Bytes therefore queue here and the pump drips one
             * per frame, paced on EVENTS_RXDRDY (see pumpUartRx).
             */
            injectUartByte(value: number, _source?: string): void {
                try {
                    self.rxQueue.push(Number(value) & 0xff);
                    // Keep the queue bounded: a firmware that never reads
                    // RXD would otherwise grow it forever.
                    if (self.rxQueue.length > 256) self.rxQueue.splice(0, self.rxQueue.length - 256);
                } catch { /* ignore */ }
            },
            close(): void {
                try { (self as any).btnGen = (((self as any).btnGen || 0) + 1); } catch { /* ignore */ }
                try { self.rxQueue.length = 0; } catch { /* ignore */ }
                try { self.cpu = null; } catch { /* ignore */ }
                try { self.mcu = null; } catch { /* ignore */ }
            },
        };
    }

    /** EASYDMA pump (every frame): UARTE TX loopback-complete, TWIM0
     * OLED via the I2C bridge + guest-RAM recipe, SPIM2/3 loopback,
     * SAADC 0x80 fill (keeps sampling firmware alive). */
    private pumpDma(): void {
        const wasm = this.mod;
        const cpu = this.cpu;
        if (!wasm || !cpu) return;
        // System extras (I2S/NFC drains only — taps verified in-file
        // i2s_take_tx/take_rx/complete_tx/complete_rx 1483-1540,
        // nfct_take_tx/take_rx/complete_tx/complete_rx + nfct_field_present
        // 1631-1700; WDT-reboot/sleep-wake/QSPI-slot are DRAFT, excluded).
        try { this.pumpSysExtras(); } catch { /* never breaks tick */ }
        // UARTE TX: complete with guest bytes (polled-TXD firmware like
        // hello_nrf never stages DMA — take is empty, zero cost).
        try {
            const t = wasm.uarte_take_txdma();
            if (t && t.length >= 2) {
                const bytes = cpu.mem_read(t[0], t[1]);
                try { wasm.uarte_complete_txdma(bytes); } catch { /* ignore */ }
            }
        } catch { /* ignore */ }
        // TWIM0 OLED (bridge-owned model truth).
        try { this.pumpTwim0(); } catch { /* ignore */ }
        // SPIM2 TX / SPIM3 RX (demo-parity loopback).
        try {
            for (const name of ['SPIM2', 'SPIM3']) {
                let t: any = null;
                try { t = wasm.twim_take_txdma(name); } catch { t = null; }
                if (t && t.length >= 3) {
                    try {
                        const bytes = cpu.mem_read(t[1], t[2]);
                        wasm.twim_complete_txdma(name, bytes);
                    } catch { /* ignore */ }
                }
                try { t = wasm.twim_take_rxdma(name); } catch { t = null; }
                if (t && t.length >= 3) {
                    try {
                        const fill = new Uint8Array(t[2]).fill(0xff);
                        cpu.mem_write(t[1], fill);
                        wasm.twim_complete_rxdma(name, t[2]);
                    } catch { /* ignore */ }
                }
            }
        } catch { /* ignore */ }
        // SAADC: the host owns the analog world. Convert the voltage on
        // the sampled AIN pin into SAADC counts and write the sample into
        // RESULT RAM BEFORE completing the transfer (owner recipe:
        // take_result -> mem_write -> complete_result; the guest then
        // reads its own RAM).
        try {
            const t = wasm.saadc_take_result();
            if (t && t.length >= 2) {
                const n = Number(t[1]) || 0;
                const counts = this.saadcCounts();
                const samples = new Uint8Array(Math.max(0, n) * 2);
                for (let i = 0; i < n; i++) {
                    samples[i * 2] = counts & 0xff;
                    samples[i * 2 + 1] = (counts >> 8) & 0xff;
                }
                cpu.mem_write(t[0], samples);
                wasm.saadc_complete_result(n);
            }
        } catch { /* ignore */ }
        // NVMC erase pump (NVS cell): guest page-erase is async in the
        // model — take returns the pending erase descriptor, complete
        // acknowledges it (same take/complete shape as the DMA taps above).
        // Word writes have no tap (synchronous in-model); the cell asserts
        // erase→write→readback so a silent write gap fails loudly.
        try {
            const e = (wasm as any).nvmc_take_erase?.();
            if (e && e.length > 0) {
                try { (wasm as any).nvmc_complete_erase?.(); } catch { /* ignore */ }
            }
        } catch { /* ignore */ }
    }

    /** SAADC sample the host injects (counts): the voltage a wired
     * component drives onto the sampled AIN pin when there is one, else
     * the board attr `adcMv` (default 1800 mV = mid-scale). The engine
     * has no analog handle, so the conversion is host-side by design
     * (owner recipe: "volts -> counts is host-side"). */
    private saadcCounts(): number {
        let mv: number | null = null;
        try {
            const volts = this.analogVoltsAt(MB_AIN_EDGE);
            // analogVoltsAt reports VOLTS; the SAADC scale is millivolts.
            if (volts !== null && Number.isFinite(volts)) mv = volts * 1000;
        } catch { mv = null; }
        if (mv === null) {
            let attrMv = 1800;
            try {
                const battrs = (this as any).compAttrById?.get?.(this.boardId) || {};
                const a = Number((battrs as any)?.adcMv);
                if (Number.isFinite(a)) attrMv = a;
            } catch { /* keep the default */ }
            mv = attrMv;
        }
        return mvToSaadcCounts(Number(mv));
    }

    /** Voltage (volts) a wired component drives onto one of this board's
     * pins. Null when nothing drives that net (no analog source wired). */
    private analogVoltsAt(pinLabel: string): number | null {
        try {
            const net = this.pinToNet.get(`${this.boardId}:${pinLabel}`);
            if (net === undefined) return null;
            for (const [node, netId] of this.pinToNet) {
                if (netId !== net) continue;
                const [cId, cPin] = node.split(':');
                if (!cId || !cPin || cId === this.boardId) continue;
                const inst = this.instances.get(cId);
                if (!inst || typeof (inst as any).getPinVoltage !== 'function') continue;
                const v = Number((inst as any).getPinVoltage(cPin));
                if (Number.isFinite(v)) return v;
            }
        } catch { /* no analog source on this net */ }
        return null;
    }

    /** Rail power: the board sources 3V3 on its 3V3 pin (and 0 V on GND).
     * A component wired to those rails (potentiometer ends, sensor VCC)
     * needs the rail LEVEL, otherwise its output voltage is 0 and every
     * analog reading collapses to zero (same shape as the ESP32 runner's
     * rail drive). */
    private driveRails(): void {
        try {
            for (const inst of this.instances.values()) {
                if (inst === this.instances.get(this.boardId)) continue;
                if (typeof (inst as any)?.getPinVoltage !== 'function') continue;
                for (const nm of ['VCC', '1', '3V3', '+', 'V+']) {
                    let v = 0;
                    try { v = Number((inst as any).getPinVoltage(nm)) || 0; } catch { continue; }
                    if (v > 0.2) continue;
                    const id = String((inst as any)?.id ?? '');
                    const net = this.pinToNet.get(`${id}:${nm}`);
                    if (net === undefined) continue;
                    for (const [node, netId] of this.pinToNet) {
                        if (netId !== net) continue;
                        const sep = node.indexOf(':');
                        if (sep < 0) continue;
                        if (node.slice(0, sep) !== this.boardId) continue;
                        if (!/3V3/i.test(node.slice(sep + 1))) continue;
                        try { (inst as any).setPinVoltage(nm, 3.3); } catch { /* ignore */ }
                        break;
                    }
                }
            }
        } catch { /* rails never break the tick */ }
    }

    /** UARTE0 RX drip (every frame, after the DMA taps).
     *
     * The engine's UARTE0 keeps ONE byte in RXD: injecting a second byte
     * before the firmware reads the first latches a real OVERRUN (bit 0 of
     * ERRORSRC) and loses the byte. So the drip is paced on the guest's
     * own consumption — EVENTS_RXDRDY (0x40002108, its own register on this
     * part) reads 0 only after the firmware cleared it, which is exactly
     * "the previous byte was consumed".
     *
     * The byte is ALSO mirrored into the RXD EasyDMA ring (RXD.PTR +
     * RXD.AMOUNT) so DMA-mode firmware receives it too — the owner bench
     * recipe (demo/index.html pump). Never early-complete a staged RX DMA
     * transfer: that fires ENDRX with no re-arm and the input stalls.
     */
    private pumpUartRx(): void {
        const wasm = this.mod;
        const cpu = this.cpu;
        if (!wasm || !cpu) return;
        if (!this.rxQueue.length) return;
        try {
            // EVENTS_RXDRDY is latched per byte; 0 = the slot is free.
            if (Number(wasm.periph_read(MB_UART0_EVENTS_RXD, 4)) !== 0) return;
            const byte = this.rxQueue.shift();
            if (byte === undefined) return;
            // Mirror into the DMA ring (only when the firmware armed a
            // RXD buffer — MAXCNT > 0 means DMA mode).
            try {
                const ptr = Number(wasm.periph_read(MB_UART0_RXD_PTR, 4)) >>> 0;
                const amt = Number(wasm.periph_read(MB_UART0_RXD_AMOUNT, 4)) >>> 0;
                const max = Number(wasm.periph_read(MB_UART0_RXD_MAXCNT, 4)) >>> 0;
                if (ptr >= 0x20000000 && ptr < 0x20040000 && max > 0 && amt < max && amt < 4096) {
                    cpu.mem_write(ptr + amt, new Uint8Array([byte & 0xff]));
                }
            } catch { /* polled RX needs no DMA mirror */ }
            wasm.uart_rx_byte(MB_UART0_BASE, byte & 0xff);
        } catch { /* the drip never breaks the tick */ }
    }

    /** PWM readback (every frame): the engine keeps the waveform bytes
     * driver-side (no guest-RAM handle), so the runner feeds the SEQ
     * compare words it reads out of guest RAM and asks the engine for the
     * resulting duty/frequency. The duty drives the LED brightness models
     * wired to the PWM output pin (onPWM, same contract as the Pico/ESP32
     * runners).
     * Engine API (owner P164): pwm_observe_seq_word(n, compareWord),
     * pwm_get_duty(n) → basis points, pwm_get_freq_hz(n) → Hz. */
    private pumpPwm(): void {
        const wasm = this.mod;
        const cpu = this.cpu;
        if (!wasm || !cpu) return;
        let bestDutyBp = 0;
        let bestFreqHz = 0;
        let bestPin = -1;
        for (let inst = 0; inst < MB_PWM_BASE.length; inst++) {
            const base = MB_PWM_BASE[inst];
            try {
                const ptr = Number(wasm.periph_read(base + MB_PWM_SEQ0_PTR, 4)) >>> 0;
                const cnt = Number(wasm.periph_read(base + MB_PWM_SEQ0_CNT, 4)) >>> 0;
                if (ptr >= 0x20000000 && ptr < 0x20040000 && cnt > 0) {
                    const words = cpu.mem_read(ptr, Math.min(cnt, 16) * 2);
                    for (let i = 0; i + 1 < words.length; i += 2) {
                        const w = (words[i] | (words[i + 1] << 8)) >>> 0;
                        wasm.pwm_observe_seq_word(inst, w);
                    }
                }
            } catch { /* one instance never breaks the pump */ }
            try {
                const duty = Number(wasm.pwm_get_duty(inst)) || 0;
                const freq = Number(wasm.pwm_get_freq_hz(inst)) || 0;
                if (duty > bestDutyBp) {
                    bestDutyBp = duty;
                    bestFreqHz = freq;
                    try {
                        const psel = Number(wasm.periph_read(base + MB_PWM_PSEL_OUT0, 4)) >>> 0;
                        bestPin = psel < 0x1000 ? psel : -1;
                    } catch { bestPin = -1; }
                }
            } catch { /* readback never breaks the pump */ }
        }
        if (bestDutyBp !== this.lastPwmDutyBp || bestFreqHz !== this.lastPwmFreqHz) {
            this.lastPwmDutyBp = bestDutyBp;
            this.lastPwmFreqHz = bestFreqHz;
            try {
                (this.instances.get(this.boardId) as any)?.setState?.({
                    pwmDutyBp: bestDutyBp, pwmFreqHz: bestFreqHz,
                });
            } catch { /* ignore */ }
        }
        if (bestDutyBp <= 0) return;
        const duty01 = Math.max(0, Math.min(1, bestDutyBp / 10000));
        // Output pin: PSEL.OUT holds the nRF pin number; map it back to the
        // edge label so only the model wired to THAT pin gets the duty.
        const edgeLabel = this.edgeLabelForPin(bestPin);
        for (const inst of this.instances.values()) {
            try {
                if (typeof (inst as any)?.onPWM !== 'function') continue;
                // Components that know their own pin map drive themselves.
                if (typeof (inst as any)?.getPWMPinNames === 'function') continue;
                const id = String((inst as any)?.id ?? '');
                for (const pn of ['A', 'ANODE', '+']) {
                    if (edgeLabel && !this.sameNet(`${id}:${pn}`, `${this.boardId}:${edgeLabel}`)) continue;
                    try { (inst as any).onPWM(pn, { dutyCycle: duty01, frequencyHz: bestFreqHz }); } catch { /* ignore */ }
                }
            } catch { /* one instance never breaks the pump */ }
        }
    }

    /** nRF pin number (PSEL.OUT) → micro:bit edge label (P0..P20). */
    private edgeLabelForPin(pin: number): string {
        if (!Number.isFinite(pin) || pin < 0) return '';
        for (const [label, pp] of Object.entries(MB_EDGE)) {
            if (pp[0] === 0 && pp[1] === pin) return label;
        }
        return '';
    }

    /** True when two component pins share a net. */
    private sameNet(a: string, b: string): boolean {
        try {
            const na = this.pinToNet.get(a);
            const nb = this.pinToNet.get(b);
            return na !== undefined && na === nb;
        } catch { return false; }
    }

    /** System-extras pump (every frame, after the DMA taps): drains
     * guest-initiated I2S/NFC takes into board-state counters (no air
     * peer staged — owner engine owns the air models; counts are future
     * cell oracles, never faked traffic). NFC field is attr-gated
     * (nfcField). WDT-reboot / sleep-wake / QSPI are NOT pumped here
     * (no WasmCpu reboot/wake API; QSPI slot name unverified — DRAFT).
     * Firmware .bins required for I2S/NFC cells (no backend nRF core). */
    private pumpSysExtras(): void {
        const wasm = this.mod as any;
        const cpu = this.cpu;
        if (!wasm || !cpu) return;
        const self = this as any;
        const mark = (key: string, val: any) => {
            try { (this.instances.get(this.boardId) as any)?.setState?.({ [key]: val }); } catch { /* ignore */ }
        };
        // First-tick wiring: NFC field only (attr-gated).
        try {
            if (!self.sysExtrasWired) {
                self.sysExtrasWired = true;
                let attrs: any = {};
                try { attrs = self.compAttrById?.get?.(self.boardId) || {}; } catch { attrs = {}; }
                try {
                    if ((attrs as any)?.nfcField && typeof wasm.nfct_field_present === 'function') {
                        wasm.nfct_field_present(true);
                    }
                } catch { /* ignore */ }
            }
        } catch { /* wiring never breaks the pump */ }
        // I2S TX: ack taken words back verbatim (no consumer model —
        // the count is the oracle), RX: complete pending with silence.
        try {
            const tx = wasm.i2s_take_tx?.();
            if (tx && tx.length > 0) {
                try {
                    self.i2sTxWords = (Number(self.i2sTxWords || 0) + tx.length) | 0;
                    mark('i2sTxWords', self.i2sTxWords);
                    wasm.i2s_complete_tx(new Uint8Array(new Uint32Array(tx).buffer));
                } catch { try { wasm.i2s_complete_tx(new Uint8Array(0)); } catch { /* ignore */ } }
            }
        } catch { /* ignore */ }
        try {
            const rx = wasm.i2s_take_rx?.();
            if (rx && rx.length > 0) {
                try {
                    self.i2sRxReqs = (Number(self.i2sRxReqs || 0) + 1) | 0;
                    mark('i2sRxReqs', self.i2sRxReqs);
                    wasm.i2s_complete_rx();
                } catch { /* ignore */ }
            }
        } catch { /* ignore */ }
        // NFC takes: count only (no peer frames staged).
        try {
            const t = wasm.nfct_take_tx?.();
            if (t && t.length > 0) {
                try {
                    self.nfcTxFrames = (Number(self.nfcTxFrames || 0) + 1) | 0;
                    mark('nfcTxFrames', self.nfcTxFrames);
                    wasm.nfct_complete_tx();
                } catch { /* ignore */ }
            }
        } catch { /* ignore */ }
        try {
            const r = wasm.nfct_take_rx?.();
            if (r && r.length > 0) {
                try {
                    self.nfcRxFrames = (Number(self.nfcRxFrames || 0) + 1) | 0;
                    mark('nfcRxFrames', self.nfcRxFrames);
                    wasm.nfct_complete_rx(0);
                } catch { /* ignore */ }
            }
        } catch { /* ignore */ }
    }

    /** TWIM0 master transactions (SSD1306 edge OLED): TX stream feeds the
     * shared I2C bridge (init commands land in the model); RX answers come
     * from the model via guest-RAM mem_write (DMA path never touches the
     * i2c_push_rx polling queue — frozen-v1 contract). */
    private pumpTwim0(): void {
        const wasm = this.mod;
        const cpu = this.cpu;
        if (!wasm || !cpu || !this.i2cBridge) return;
        const br = this.i2cBridge as any;
        let t: any = null;
        try { t = wasm.twim_take_txdma('TWIM0'); } catch { t = null; }
        if (t && t.length >= 3) {
            try {
                const addr = Number(t[0]) & 0x7f;
                const bytes = cpu.mem_read(t[1], t[2]);
                br.start(addr, false);
                for (const b of bytes) br.write(Number(b) & 0xff);
                br.stop();
                wasm.twim_complete_txdma('TWIM0', bytes);
            } catch { /* ignore */ }
        }
        try { t = wasm.twim_take_rxdma('TWIM0'); } catch { t = null; }
        if (t && t.length >= 3) {
            try {
                const n = Number(t[2]) || 0;
                // Model read at the bridge's current pointer: prime the
                // pointer from the last TX when the firmware uses
                // SHORTS LASTTX_STARTRX (pointer write + chained read).
                const out: number[] = [];
                for (let i = 0; i < n; i++) out.push(br.read() & 0xff);
                cpu.mem_write(t[1], new Uint8Array(out));
                wasm.twim_complete_rxdma('TWIM0', n);
            } catch { /* ignore */ }
        }
    }

    /** GPIO: publish edge-pin outputs; matrix rows/cols feed board
     * telemetry (matrixLit) for the blinky cell. */
    private pollGpio(): void {
        const wasm = this.mod;
        if (!wasm) return;
        try {
            for (const [label, pp] of Object.entries(MB_EDGE)) {
                let high = false;
                try { high = !!wasm.gpio_read_output(pp[0], pp[1]); } catch { continue; }
                if (this.lastGpioOut[label] !== high) {
                    this.lastGpioOut[label] = high;
                    try { (this as any).publishGpio?.(label, high); } catch { /* ignore */ }
                }
            }
        } catch { /* ignore */ }
        try {
            let lit = 0;
            try {
                const m = wasm.matrix_state();
                if (m && m.length) for (const b of m) if (b) lit++;
            } catch { /* ignore */ }
            if (lit !== this.lastMatrixLit) {
                this.lastMatrixLit = lit;
                try { (this.instances.get(this.boardId) as any)?.setState?.({ matrixLit: lit }); } catch { /* ignore */ }
            }
        } catch { /* ignore */ }
    }
}
