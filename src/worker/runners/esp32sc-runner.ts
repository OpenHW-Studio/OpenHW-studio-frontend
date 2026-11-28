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
 * 13228d2a1a67073efd20fbc5fc1f000d). The matching mask ROM ELF is served
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
 *   PROVEN  classic `esp32sim_new_bridge` now creates the machine; all 15
 *           bridge exports are reachable. The runner drives GPIO readback /
 *           input, I2C EEPROM + display replies, SPI shift-register replies,
 *           ADC source and I2S PCM through those exports and feeds the shared
 *           bus bridges (`bus-bridge.ts`) from host-captured guest traffic.
 *   GAP     no bridge for one-wire/RMT (DS18B20, DHT22, NeoPixel), camera,
 *           WiFi or BLE on this runner — those cells stay explicitly skipped.
 */
import { ArmRunnerBase, importEngine } from './arm-runner-base.ts';
import { AVRRunnerOptions } from '../registries/component-registry.ts';
import { createI2CBridge, createSPIBridge, collectI2CSlaveAddresses } from '../bus-bridge.ts';

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
    /** Optional host-bus bridges (only when wired components claim a bus). */
    private i2cBridge: any = null;
    private spiBridge: any = null;
    private i2cAddrs: number[] = [];
    private bridgeStats = { i2cWrites: 0, i2cReadBytes: 0, spiBytes: 0, gpioEdges: 0, adcSets: 0, pcmFrames: 0 };

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

    private pinNumber(ref: string): number {
        const m = /^(?:GPIO|GP|D)?(\d{1,2})$/i.exec(String(ref || '').trim());
        return m ? Number(m[1]) : -1;
    }

    private static adcGpio(label: string): number {
        const m = /^(?:GPIO)?(\d{1,2})$/i.exec(String(label || '').trim());
        if (!m) return String(label || '').toUpperCase() === 'VP' ? 36 : String(label || '').toUpperCase() === 'VN' ? 39 : -1;
        const n = Number(m[1]);
        return (n >= 32 && n <= 39) || n === 0 || n === 2 || n === 4 || (n >= 12 && n <= 15) || (n >= 25 && n <= 27) ? n : -1;
    }

    /** Addresses of wired I2C models. `collectI2CSlaveAddresses` misses models
     *  whose address is implicit (SSD1306/AT24 defaults), so add those. */
    private i2cAddresses(): number[] {
        const out = new Set<number>(collectI2CSlaveAddresses({ instances: this.instances, compAttrById: this.compAttrById } as any));
        try {
            for (const inst of this.instances.values()) {
                const type = `${String((inst as any)?.type || '')} ${String((inst as any)?.id || '')}`.toLowerCase();
                if (type.includes('ssd1306') || type.includes('oled')) out.add(0x3c);
                if (type.includes('mpu6050')) out.add(0x68);
                if (type.includes('eeprom') || type.includes('at24')) out.add(0x50);
            }
        } catch { /* ignore */ }
        return [...out];
    }

    /** Install the shared host bus bridges for the wired component models and
     *  pre-stage neutral reply bytes before the guest's first instruction. */
    private wireBusBridges(): void {
        if (!this.w || !this.emu) return;
        const self = this;
        const ctx: any = {
            boardId: this.boardId,
            onStateUpdate: (msg: any) => { try { this.onStateUpdate(msg); } catch { /* ignore */ } },
            getSimTimeMs: () => { try { return this.getSimulatedTimeMs(); } catch { return 0; } },
            instances: this.instances,
            compAttrById: this.compAttrById,
            pinToNet: (this as any).pinToNet,
            boardPinLevel: (pin: string) => {
                try { const v = (this.pinStates as any)?.[pin]; return typeof v === 'boolean' ? v : null; }
                catch { return null; }
            },
        };
        this.i2cAddrs = this.i2cAddresses();
        const addrs = this.i2cAddrs;
        if (addrs.length) {
            this.i2cBridge = createI2CBridge(ctx);
            for (const a of addrs.slice(0, 8)) {
                // 0xff idle reads until the model supplies real bytes in tickEnd.
                this.withBytes(new Uint8Array(32).fill(0xff), (p, n) => this.w.esp32sim_bridge_i2c_set(this.emu, 0, a & 0x7f, p, n));
            }
        }
        let hasSpi = false;
        try {
            for (const inst of this.instances.values()) {
                if (typeof (inst as any)?.onSPIByte === 'function' || typeof (inst as any)?.onSPIByteExchange === 'function') { hasSpi = true; break; }
            }
        } catch { /* ignore */ }
        if (hasSpi) {
            this.spiBridge = createSPIBridge(ctx);
            for (const host of [2, 3]) {
                this.withBytes(new Uint8Array(16).fill(0xff), (p, n) => this.w.esp32sim_bridge_spi_set(this.emu, host, p, n));
            }
        }
        void self;
    }

    /** Host component voltage → engine ADC raw count (12-bit, 3.3 V full scale). */
    private driveEsp32Adc(): void {
        const w = this.w;
        if (!w || !this.emu) return;
        try {
            for (const [node, netId] of (this as any).pinToNet ?? []) {
                const sep = String(node).indexOf(':');
                if (sep < 0) continue;
                if (String(node).slice(0, sep) !== this.boardId) continue;
                const gpio = Esp32ScRunner.adcGpio(String(node).slice(sep + 1));
                if (gpio < 0) continue;
                let volts: number | null = null;
                for (const [node2, net2] of (this as any).pinToNet) {
                    if (net2 !== netId) continue;
                    const s2 = String(node2).indexOf(':');
                    if (s2 < 0 || String(node2).slice(0, s2) === this.boardId) continue;
                    const inst = this.instances.get(String(node2).slice(0, s2));
                    const v = Number((inst as any)?.getPinVoltage?.(String(node2).slice(s2 + 1)));
                    if (Number.isFinite(v)) { volts = v; break; }
                }
                if (volts === null) continue;
                const raw = Math.max(0, Math.min(4095, Math.round((volts / 3.3) * 4095)));
                if (w.esp32sim_bridge_adc_set(this.emu, gpio, raw) === 0) this.bridgeStats.adcSets++;
            }
        } catch { /* ADC translator never breaks a tick */ }
    }

    /** Only devices that actually answer master reads (EEPROM/sensors) get a
     *  staged reply queue. Write-only sinks such as SSD1306 must not see a
     *  synthetic read-mode START every tick — it resets their frame state. */
    private i2cCanRead(addr: number): boolean {
        try {
            for (const inst of this.instances.values()) {
                if (typeof inst?.onI2CReadByte !== 'function' && typeof inst?.readByte !== 'function') continue;
                const attrs: any = this.compAttrById.get(String(inst?.id || '')) || {};
                for (const c of [inst?.i2cAddr, typeof inst?.getI2CAddress === 'function' ? inst.getI2CAddress() : NaN,
                                 attrs.address, attrs.i2cAddress, attrs.addr]) {
                    if (Number(c) === (addr & 0x7f)) return true;
                }
            }
        } catch { /* ignore */ }
        return false;
    }

    /** Drain host-observed traffic from the WASM bridge into the shared model
     *  bridges, and stage their replies back into WASM for the next slice. */
    private tickBridge(): void {
        const w = this.w;
        if (!w || !this.emu) return;
        // GPIO output edges → host LEDs / protocol models.
        try {
            const p = Number(w.esp32sim_alloc(16 * 128)) || 0;
            if (p) {
                try {
                    const n = Number(w.esp32sim_bridge_gpio_take(this.emu, p, 128)) || 0;
                    const buf = new Uint8Array((w.memory as WebAssembly.Memory).buffer, p, 16 * n);
                    const dv = new DataView(buf.buffer, buf.byteOffset);
                    for (let i = 0; i < n; i++) {
                        const pin = buf[i * 16 + 8], high = !!buf[i * 16 + 9];
                        this.bridgeStats.gpioEdges++;
                        // publishGpio owns the dedup state; never pre-set it here.
                        try { this.publishGpio(`GPIO${pin}`, high, undefined, Number(dv.getBigUint64(i * 16, true))); } catch { /* ignore */ }
                    }
                } finally { try { w.esp32sim_free(p, 16 * 128); } catch { /* ignore */ } }
            }
        } catch { /* GPIO tap never breaks a tick */ }
        // I2C: captured writes into the model, model reads back into WASM.
        if (this.i2cBridge) {
            try {
                for (const addr of this.i2cAddrs.slice(0, 8)) {
                    const p = Number(w.esp32sim_alloc(256)) || 0;
                    if (!p) continue;
                    let wrote = 0;
                    try {
                        wrote = Number(w.esp32sim_bridge_i2c_take(this.emu, addr & 0x7f, p, 256)) || 0;
                        if (wrote) {
                            const bytes = new Uint8Array((w.memory as WebAssembly.Memory).buffer, p, wrote).slice();
                            try { this.i2cBridge.start(addr & 0x7f, false); } catch { /* ignore */ }
                            for (const b of bytes) { try { this.i2cBridge.write(b); } catch { /* ignore */ } }
                            try { this.i2cBridge.stop(); } catch { /* ignore */ }
                            this.bridgeStats.i2cWrites += wrote;
                        }
                    } finally { try { w.esp32sim_free(p, 256); } catch { /* ignore */ } }
                    // Stage the model's read bytes only after a captured guest
                    // write (register pointer). Staging on every tick drove the
                    // model's i2cTxBytes to 533088 and starved real reads.
                    if (!wrote || !this.i2cCanRead(addr & 0x7f)) continue;
                    try {
                        this.i2cBridge.start(addr & 0x7f, true);
                        const reply = new Uint8Array(6);
                        for (let i = 0; i < reply.length; i++) reply[i] = Number(this.i2cBridge.read()) & 0xff;
                        try { this.i2cBridge.stop(); } catch { /* ignore */ }
                        this.bridgeStats.i2cReadBytes += reply.length;
                        this.withBytes(reply, (rp, rn) => w.esp32sim_bridge_i2c_set(this.emu, 0, addr & 0x7f, rp, rn));
                    } catch { /* reply stage never breaks a tick */ }
                }
            } catch { /* I2C tap never breaks a tick */ }
        }
        // SPI: captured MOSI into the model, model MISO back into WASM.
        if (this.spiBridge) {
            try {
                for (const host of [2, 3]) {
                    const p = Number(w.esp32sim_alloc(256)) || 0;
                    if (!p) continue;
                    try {
                        const n = Number(w.esp32sim_bridge_spi_take(this.emu, host, p, 256)) || 0;
                        if (!n) continue;
                        const mosi = new Uint8Array((w.memory as WebAssembly.Memory).buffer, p, n).slice();
                        const reply = new Uint8Array(n);
                        for (let i = 0; i < n; i++) reply[i] = Number(this.spiBridge.exchange(mosi[i], i)) & 0xff;
                        // Single-slave models (MAX7219) commit the frame on CS
                        // deassert; our capture sees bytes, not the deassert
                        // instant, so synthesize it after the frame.
                        let slaves: any[] = [];
                        try {
                            for (const inst of this.instances.values()) {
                                if (typeof inst?.onSPIByte === 'function' || typeof inst?.onSPIByteExchange === 'function') slaves.push(inst);
                            }
                        } catch { /* ignore */ }
                        if (slaves.length === 1) {
                            try {
                                const inst = slaves[0];
                                if (inst.csActive && typeof inst.onPinStateChange === 'function') {
                                    let pin = 'CS';
                                    try { if (typeof inst.getCSPinName === 'function') pin = String(inst.getCSPinName()) || 'CS'; } catch { /* default */ }
                                    try { inst.onPinStateChange(pin, true, 0); } catch { /* ignore */ }
                                    if (Array.isArray(inst._frame)) inst._frame.length = 0;
                                }
                            } catch { /* ignore */ }
                        }
                        this.bridgeStats.spiBytes += n;
                        this.withBytes(reply, (rp, rn) => w.esp32sim_bridge_spi_set(this.emu, host, rp, rn));
                    } finally { try { w.esp32sim_free(p, 256); } catch { /* ignore */ } }
                }
            } catch { /* SPI tap never breaks a tick */ }
        }
        this.driveEsp32Adc();
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
                // The rebuilt WASM accepts it in esp32sim_new_bridge.
                self.emu = Number(self.withText('esp32', (p, n) => self.w.esp32sim_new_bridge(p, n, FLASH_SIZE / (1024 * 1024), 0))) || 0;
                if (!self.emu) {
                    console.error('[Esp32ScRunner] esp32sim_new failed:', self.logs.slice(-6));
                    return;
                }
                try { self.w.esp32sim_set_jit(self.emu, 1); } catch { /* JIT optional */ }
                // Attach host I2C/SPI devices before the first instruction.
                self.wireBusBridges();
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

            /** Firmware-driven GPIO output via esp32sim_bridge_gpio_get:
             *  bit 0 input, 1 output latch, 2 output-enable. */
            sampleGpioOut(pinId: string): { level: number; driving: boolean } | null {
                const pin = self.pinNumber(pinId);
                if (!self.w || !self.emu || pin < 0 || pin > 255) return null;
                try {
                    const s = Number(self.w.esp32sim_bridge_gpio_get(self.emu, pin));
                    if (s < 0) return null;
                    return { level: (s & 2) !== 0 ? 1 : 0, driving: (s & 4) !== 0 };
                } catch { return null; }
            },

            /** Host component (button/sensor) drives a board input through the bridge. */
            setGpioInput(pinId: string, high: boolean): void {
                const pin = self.pinNumber(pinId);
                if (!self.w || !self.emu || pin < 0 || pin > 255) return;
                try { self.w.esp32sim_bridge_gpio_set(self.emu, pin, high ? 1 : 0); } catch { /* ignore */ }
            },

            /** ADC observation (volts) from the engine's last conversion. */
            readAnalog(ref: string): number {
                const pin = Esp32ScRunner.adcGpio(ref);
                if (!self.w || !self.emu || pin < 0) return NaN;
                try {
                    const o = Number(self.w.esp32sim_bridge_adc_get(self.emu, pin));
                    return o > 0xffff_ffff_ffff_ffff ? NaN : ((o & 0xffff) / 4095) * 3.3;
                } catch { return NaN; }
            },

            /** Routed PWM snapshot for a host actuator model (Hz, duty 0..65535). */
            pwmSnapshot(pinId: string): { hz: number; duty: number } | null {
                const pin = self.pinNumber(pinId);
                if (!self.w || !self.emu || pin < 0) return null;
                try {
                    const hz = Number(self.w.esp32sim_bridge_pwm_hz(self.emu, pin));
                    const duty = Number(self.w.esp32sim_bridge_pwm_duty(self.emu, pin));
                    return hz >= 0 && duty <= 0xffff ? { hz, duty } : null;
                } catch { return null; }
            },

            /** Stereo i16le PCM frames into an I2S input port. */
            i2sPcm(port: number, frames: Uint8Array): number {
                if (!self.w || !self.emu) return 0;
                let accepted = 0;
                self.withBytes(frames, (p, n) => {
                    const r = Number(self.w.esp32sim_bridge_i2s_pcm(self.emu, port, p, n));
                    if (Number.isFinite(r) && r !== 0xffff_ffff) { accepted = r; self.bridgeStats.pcmFrames += r; }
                });
                return accepted;
            },

            /** Called by ArmRunnerBase after component models update. */
            tickEnd(): void { self.tickBridge(); },

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
            bridge: { ...this.bridgeStats, i2c: !!this.i2cBridge, spi: !!this.spiBridge },
            logs: this.logs.slice(-6),
        };
    }
}

// Keep the importEngine resolution point warm for the future npm flip: there
// is no JS glue today (the WASM is fetched directly), but routing the
// stub specifier through importEngine documents the package path the staged
// bytes stand in for. Never used on the boot path.
void importEngine;
