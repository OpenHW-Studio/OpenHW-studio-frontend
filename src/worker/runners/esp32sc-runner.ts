/**
 * esp32sc-runner.ts — classic ESP32 DevKit board runner over the esp32sim
 * (xtensa LX6) WASM, driven through the direct WASM ABI proven by
 * `sperte/esp32sim/wasm/openhw-probe/{boot,bridge,components}-proof.mjs`.
 *
 * WHY A SECOND ESP32 RUNNER: `openhw-esp32` stays on esp32-emu (SAB worker
 * split mode). This board runs the SAME compiled Arduino merged-bin on a
 * different engine so the two can be A/B'd in the browser. Both runners are
 * isolated instances; no shared engine state.
 *
 * ENGINE RESOLUTION: there is no JS glue to import — esp32sim's WASM is
 * instantiated here from `/wasm/esp32sim-bridge.wasm` (byte-identical to
 * `src/engines/esp32sim/esp32sim-bridge.wasm` and the vendor mirror; md5
 * 5daf387d3277f4a361a249cf263dc84d). The matching mask ROM ELF is served
 * from `/firmware/esp32sc_rev300_rom.elf` (Espressif esp-rom-elfs 20241011,
 * sha256 920b70635440517866aab2230964a570d2cf2b676658d93c52fbac108c1cca31).
 * When esp32sim becomes an npm package, only this fetch pair moves; the
 * runner ABI calls and family registration stay put.
 *
 * FIRMWARE CONTRACT: boardHexMap carries base64 of the backend's
 * `<sketch>.ino.merged.bin` — a full 4 MB flash image (bootloader@0x1000,
 * partitions@0x8000, app@0x10000). It is loaded with `esp32sim_load(kind=5)`
 * after the mask ROM (`kind=0`). Intel HEX text (compiler `hex` artifact) is
 * parsed into the same flat image. MicroPython is NOT bridged here.
 *
 * PROVEN / NOT PROVEN (see boards-registry family `esp32sc`):
 *   PROVEN  boot to setup()/loop(), guest serial TX, guest millis()/delay().
 *   GAP     `esp32sim_new_bridge` REFUSES classic ESP32 ("the host bridge
 *           supports only S3, C3 and C6 boards", verified against the staged
 *           WASM). Therefore the bridge GPIO/I2C/SPI/PWM/ADC/I2S exports are
 *           unreachable on this board: no firmware-driven GPIO output
 *           readback, no host I2C/SPI devices. GPIO LED / EEPROM / MAX7219
 *           cells are skipped, not weakened. GPIO input drive is possible via
 *           `esp32sim_in_text({"t":"gpio",...})` but is not claimed until a
 *           cell proves it.
 */
import { ArmRunnerBase, importEngine } from './arm-runner-base.ts';
import { AVRRunnerOptions } from '../registries/component-registry.ts';

const WASM_URL = '/wasm/esp32sim-bridge.wasm';
const ROM_URL = '/firmware/esp32sc_rev300_rom.elf';
const FLASH_SIZE = 4 * 1024 * 1024;
/** Classic ESP32 CPU clock (cycles per guest second), the engine's native rate. */
const CPU_HZ = 240_000_000;
/** Max cycles per esp32sim_run call. The worker entry uses the same 1 M slice. */
const RUN_SLICE = 1_000_000;

function b64ToU8(b64: string): Uint8Array {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

/** Intel HEX → flat flash image (same parser as esp32-runner; record types
 *  00 data, 01 EOF, 02 ext segment, 04 ext linear). */
function intelHexToU8(text: string, size: number): Uint8Array {
    const out = new Uint8Array(size).fill(0xff);
    let base = 0;
    for (const line of text.split(/\r?\n/)) {
        const s = line.trim();
        if (!s.startsWith(':') || s.length < 11) continue;
        const n = parseInt(s.slice(1, 3), 16);
        const addr = parseInt(s.slice(3, 7), 16);
        const type = parseInt(s.slice(7, 9), 16);
        if (type === 0) {
            const at = base + addr;
            for (let i = 0; i < n; i++) {
                const v = parseInt(s.slice(9 + i * 2, 11 + i * 2), 16);
                if (at + i < size) out[at + i] = v;
            }
        } else if (type === 1) break;
        else if (type === 2) base = parseInt(s.slice(9, 13), 16) << 4;
        else if (type === 4) base = parseInt(s.slice(9, 13), 16) << 16;
    }
    return out;
}

/**
 * Minimal equivalent of esp32sim's `web/wasm/jit.mjs` host. The WASM module
 * imports exactly three env functions: host_jit_compile, host_jit_release and
 * host_log. JIT compilation failures are safe (return 0 → the engine
 * interprets that block), so this host never fails a boot.
 */
function createJitHost() {
    const free: number[] = [];
    const live = new Map<number, number>();
    let w: any = null;
    const stats = { compiled: 0, failed: 0, released: 0, compileMs: 0 };
    const imports = {
        host_jit_compile(ptr: number, len: number): number {
            const start = performance.now();
            try {
                const bytes = new Uint8Array(w.memory.buffer, ptr, len).slice();
                const module = new WebAssembly.Module(bytes);
                const instance = new WebAssembly.Instance(module, {
                    env: { memory: w.memory, table: w.__indirect_function_table },
                });
                const slot = free.length ? free.pop()! : w.__indirect_function_table.grow(1);
                w.__indirect_function_table.set(slot, (instance.exports as any).run);
                live.set(slot, len);
                stats.compiled++;
                return slot;
            } catch {
                stats.failed++;
                return 0;
            } finally {
                stats.compileMs += performance.now() - start;
            }
        },
        host_jit_release(slot: number): void {
            if (!live.has(slot)) return;
            live.delete(slot);
            try { w.__indirect_function_table.set(slot, null); } catch { /* ignore */ }
            free.push(slot);
            stats.released++;
        },
    };
    return {
        imports,
        stats,
        attach(instanceExports: any) { w = instanceExports; },
    };
}

export class Esp32ScRunner extends ArmRunnerBase {
    protected uartTxPins = ['1', 'D1', 'TX', 'TX0', 'GPIO1'];
    protected uartRxPins = ['3', 'D3', 'RX', 'RX0', 'GPIO3'];

    private w: any = null;              // WASM exports
    private emu = 0;                    // esp32sim emulator handle
    private jit = createJitHost();
    private txQueue: number[] = [];
    private logs: string[] = [];
    private boards: any[] = [];
    private bootRc = -1;
    private runRc = 0;
    private bootAt = 0;
    /** Diagnostic counters surfaced on request via console (worker side). */
    private outMessages = 0;
    private insnsAtBoot = 0;

    protected engine = this.makeEngine();

    constructor(
        hexData: string,
        componentsDef: any[],
        wiresDef: any[],
        onStateUpdate: (state: any) => void,
        options: AVRRunnerOptions = {},
    ) {
        super(hexData, componentsDef, wiresDef, onStateUpdate, options);
        try {
            for (const c of (componentsDef || [])) {
                if (c && c.id !== undefined) this.compAttrById.set(String(c.id), (c as any).attrs || {});
            }
        } catch { /* attrs snapshot never breaks construction */ }
        void this.boot('openhw-esp32sc');
    }

    private compAttrById = new Map<string, any>();

    /** Step budget is guest CYCLES (not instructions): 240k cycles per ms at
     *  the native clock. Keep the 8 ms base tick at ~1.9 M guest cycles, under
     *  the per-tick cap. A slow engine simply takes longer wall time — the
     *  A/B number is the guest/wall ratio measured from the guest's millis(). */
    protected budgetForDelta(deltaMs: number): number {
        return Math.floor(Math.max(0, deltaMs) * (CPU_HZ / 1000) * Math.max(0.05, Number(this.speed) || 1));
    }
    protected maxBudgetPerTick(): number { return 4_000_000; }
    protected cyclesPerMicrosecond(): number { return CPU_HZ / 1_000_000; }

    /** Drain the esp32sim outbox. Every kind-1 message is JSON text; serial
     *  rows are the guest's TX bytes. Other rows (board/stat/emu) are kept as
     *  boot evidence only. */
    private drainOut(): void {
        const w = this.w;
        if (!w || !this.emu) return;
        const dec = new TextDecoder();
        let n = 0;
        try { n = Number(w.esp32sim_out_take(this.emu)) || 0; } catch { return; }
        for (let i = 0; i < n; i++) {
            try {
                const kind = Number(w.esp32sim_out_kind(this.emu, i)) || 0;
                const p = Number(w.esp32sim_out_ptr(this.emu, i)) || 0;
                const len = Number(w.esp32sim_out_len(this.emu, i)) || 0;
                if (kind !== 1 || len === 0) continue;
                const raw = dec.decode(new Uint8Array(w.memory.buffer, p, len));
                this.outMessages++;
                let msg: any;
                try { msg = JSON.parse(raw); } catch { continue; }
                if (msg && msg.t === 'serial' && typeof msg.data === 'string') {
                    for (let k = 0; k < msg.data.length; k++) this.txQueue.push(msg.data.charCodeAt(k) & 0xff);
                } else if (msg && msg.t === 'board') {
                    if (this.boards.length < 4) this.boards.push(msg);
                } else if (msg && msg.t === 'emu' && typeof msg.msg === 'string') {
                    if (this.logs.length < 64) this.logs.push(msg.msg);
                }
            } catch { /* one malformed row never breaks the drain */ }
        }
    }

    private withBytes(buf: Uint8Array, f: (ptr: number, len: number) => any): any {
        const p = Number(this.w.esp32sim_alloc(buf.length)) || 0;
        if (!p) return undefined;
        try {
            new Uint8Array(this.w.memory.buffer, p, buf.length).set(buf);
            return f(p, buf.length);
        } finally {
            try { this.w.esp32sim_free(p, buf.length); } catch { /* ignore */ }
        }
    }

    private withText(s: string, f: (ptr: number, len: number) => any): any {
        return this.withBytes(new TextEncoder().encode(s), f);
    }

    private makeEngine() {
        const self = this;
        return {
            async loadFirmware(firmware: string, _boardType: string): Promise<void> {
                // Both fetches are plain public assets, not JS imports: the
                // engine's only runtime module is the WASM itself.
                const [wasmRes, romRes] = await Promise.all([
                    fetch(WASM_URL),
                    fetch(ROM_URL),
                ]);
                if (!wasmRes.ok) throw new Error(`[Esp32ScRunner] WASM ${WASM_URL}: HTTP ${wasmRes.status}`);
                const wasmBytes = new Uint8Array(await wasmRes.arrayBuffer());
                const dec = new TextDecoder();
                const hostLog = (p: number, n: number) => {
                    try {
                        const line = dec.decode(new Uint8Array(self.w.memory.buffer, p, n));
                        if (self.logs.length < 64) self.logs.push(line);
                    } catch { /* log never breaks boot */ }
                };
                const { instance } = await WebAssembly.instantiate(wasmBytes, {
                    env: { ...self.jit.imports, host_log: hostLog },
                });
                self.w = instance.exports;
                self.jit.attach(self.w);
                // Classic ESP32 DevKit: `esp32` is the bare esp32dev module in
                // esp32sim's board factory (none/bare select the S3 instead).
                // The bridge constructor is refused for classic boards, so
                // plain esp32sim_new is the only working path.
                self.emu = Number(self.withText('esp32', (p, n) => self.w.esp32sim_new(p, n, FLASH_SIZE / (1024 * 1024), 0))) || 0;
                if (!self.emu) {
                    console.error('[Esp32ScRunner] esp32sim_new failed:', self.logs.slice(-6));
                    return;
                }
                try { self.w.esp32sim_set_jit(self.emu, 1); } catch { /* JIT optional */ }
                // Mask ROM ELF (kind 0).
                if (romRes.ok) {
                    const rom = new Uint8Array(await romRes.arrayBuffer());
                    self.withBytes(rom, (p, n) => self.w.esp32sim_load(self.emu, 0, p, n));
                } else {
                    console.error(`[Esp32ScRunner] ROM ${ROM_URL}: HTTP ${romRes.status}`);
                }
                // Whole flash image (kind 5) from the backend's merged bin.
                const s = String(firmware || '').trim();
                if (s) {
                    let img: Uint8Array | null = null;
                    if (s.startsWith(':')) {
                        img = intelHexToU8(s, FLASH_SIZE);
                    } else {
                        const raw = s.startsWith('UF2BASE64:') || s.startsWith('ELFBASE64:')
                            ? s.slice(s.indexOf(':') + 1) : s;
                        try {
                            const bin = b64ToU8(raw);
                            img = new Uint8Array(FLASH_SIZE).fill(0xff);
                            img.set(bin.subarray(0, FLASH_SIZE), 0);
                        } catch { /* boot ROM only */ }
                    }
                    if (img) self.withBytes(img, (p, n) => self.w.esp32sim_load(self.emu, 5, p, n));
                }
                self.bootRc = Number(self.w.esp32sim_boot(self.emu, 0)) || 0;
                self.bootAt = Date.now();
                try { self.insnsAtBoot = Number(self.w.esp32sim_insns(self.emu)) || 0; } catch { self.insnsAtBoot = 0; }
                self.drainOut();
                console.log(`[Esp32ScRunner] boot rc=${self.bootRc} chip=${JSON.stringify(self.boards)} logs=${JSON.stringify(self.logs.slice(-3))}`);
            },

            stepBudget(budget: number): number {
                const w = self.w;
                if (!w || !self.emu) return 0;
                let want = Math.max(0, Math.min(4_000_000, Math.floor(budget)));
                let ran = 0;
                // Bounded slices: esp32sim_run takes a u32 cycle count and the
                // proven harnesses use 1 M per call (pacing.mjs cap).
                while (want > 0 && !self.runRc) {
                    const slice = Math.min(RUN_SLICE, want);
                    try { self.runRc = Number(w.esp32sim_run(self.emu, slice, Date.now())) || 0; }
                    catch { self.runRc = 1; break; }
                    ran += slice;
                    want -= slice;
                }
                self.drainOut();
                return ran;
            },

            drainUartOut(): number[] {
                self.drainOut();
                const out = self.txQueue;
                self.txQueue = [];
                return out;
            },

            injectUartByte(value: number, _source?: string): void {
                // Documented esp32sim input path (web-ui.md): UART0 line.
                if (!self.w || !self.emu) return;
                try {
                    const line = JSON.stringify({ t: 'serial', line: String.fromCharCode(value & 0xff), src: 'uart0' });
                    self.withText(line, (p, n) => self.w.esp32sim_in_text(self.emu, p, n));
                } catch { /* input never breaks the tick */ }
            },

            getPc(): number { return 0; },  // esp32sim has no PC export

            /** Bridge GPIO readback is unavailable on classic ESP32. Returning
             *  null keeps wired components on the net's own state (honest gap,
             *  not a fake HIGH). */
            sampleGpioOut(_pinId: string): { level: number; driving: boolean } | null {
                void _pinId;
                return null;
            },

            isHalted(): boolean { return self.runRc !== 0; },

            close(): void {
                if (self.w && self.emu) {
                    try { self.w.esp32sim_delete(self.emu); } catch { /* ignore */ }
                }
                self.emu = 0;
                self.w = null;
            },

            resetEngine(): void {
                // Full reset: delete + recreate the machine with the same ROM
                // and firmware payload is handled by the worker restart path;
                // here report honestly instead of faking a reset vector.
                console.warn('[Esp32ScRunner] resetEngine: engine restart unsupported (reload board to reset)');
            },
        };
    }

    /** Boot diagnostics used by the A/B spec's console log (worker-side read). */
    public diag(): Record<string, any> {
        let cycles = 0, insns = 0;
        try { cycles = Number(this.w?.esp32sim_cycles?.(this.emu)) || 0; } catch { cycles = 0; }
        try { insns = Number(this.w?.esp32sim_insns?.(this.emu)) || 0; } catch { insns = 0; }
        return {
            chip: this.boards[0]?.chip || null,
            bootRc: this.bootRc,
            runRc: this.runRc,
            bootWallMs: this.bootAt ? Date.now() - this.bootAt : null,
            guestMs: cycles / (CPU_HZ / 1000),
            guestWallRatio: this.bootAt ? (cycles / (CPU_HZ / 1000)) / Math.max(1, Date.now() - this.bootAt) : null,
            cycles,
            insns,
            insnsAtBoot: this.insnsAtBoot,
            txQueued: this.txQueue.length,
            outMessages: this.outMessages,
            jit: { ...this.jit.stats },
            logs: this.logs.slice(-6),
        };
    }
}

// Keep the importEngine resolution point warm for the future npm flip: there
// is no JS glue today (the WASM is fetched directly), but routing the
// stub specifier through importEngine documents the package path the staged
// bytes stand in for. Never used on the boot path.
void importEngine;
