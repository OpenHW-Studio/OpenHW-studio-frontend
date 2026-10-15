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
 * UART: UARTE0 polled TXD drain → serial; no RX path (documented gap).
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
                try {
                    const r = await fetch('/wasm/nrf52833_periph_wasm_bg.wasm');
                    if (r.ok && wasm.initSync) wasm.initSync({ module: await r.arrayBuffer() });
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
            },
            stepBudget(budget: number): number {
                if (!self.cpu || !self.mod) return 0;
                const n = Math.max(1, Math.floor(budget));
                let stepped = 0;
                try { stepped = Number(self.cpu.step(n)) || 0; } catch { stepped = 0; }
                try { self.mod.tick_peripherals(); } catch { /* ignore */ }
                try { self.pumpDma(); } catch { /* never breaks tick */ }
                try { self.pollGpio(); } catch { /* never breaks tick */ }
                return stepped > 0 ? stepped : n;
            },
            drainUartOut(): number[] {
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
            close(): void {
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
        // SAADC: mid-scale fill (no ADC cell yet; keeps dma firmware alive).
        try {
            const t = wasm.saadc_take_result();
            if (t && t.length >= 2) {
                try {
                    const fill = new Uint8Array(t[1] * 2).fill(0x80);
                    cpu.mem_write(t[0], fill);
                    wasm.saadc_complete_result(t[1]);
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
