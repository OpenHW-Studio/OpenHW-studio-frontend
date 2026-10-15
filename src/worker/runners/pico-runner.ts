/**
 * pico-runner.ts — Raspberry Pi Pico (RP2040) + Pico 2 (RP2350) BoardRunner
 * over pico-emu@1.0.3.
 *
 * Engine: Emscripten `picoemu.wasm.js` (`_picoemu_*`). One Module instance per
 * board runner (verified isolated). Arch select: 0 = RP2040 M0+ (Pico),
 * 2 = RP2350 M33 (Pico 2 default), 1 = RP2350 RISC-V Hazard3 (attr arch=rv32).
 * Same UF2 family-ID auto-detect rule as the pico-emu CLI.
 *
 * Firmware contract (boardHexMap carries `compiled.hex`):
 *   Arduino `.uf2` → backend `uf2` artifact (`UF2BASE64:…`) → _load_uf2.
 *   NOTE: arduino-pico `Serial` is USB CDC (unmodeled) — genericBoardCompile
 *   rewrites bare `Serial.` → `Serial1.` (UART0 GP0/GP1) before compile.
 *   Verified: Serial1.println reaches _read_uart(0); plain Serial is silent.
 *   MicroPython: bundled `micropython_rp2040.uf2` / `micropython_rp2350.uf2`
 *   base image + user `main.py` injected over the REPL.
 *
 * UART: `_write_uart` RX, `_read_uart(0)` TX drain. GPIO: `_set_gpio` in,
 * `_get_gpio_out` out, published into pinStates + SAB pin bitfield.
 * WiFi/BLE/Ethernet: `_wifi_enable` (CYW43, Pico W / Pico 2 W) and
 * `_picoemu_board_eth` (W5500, pico-eth/pico-eth2) are ENABLED at boot when
 * the board type / attrs request them — stub mode (no live gateway socket;
 * DHCP/DNS served by the in-emulator fake net). Live gateway proxy + BLE
 * HCI (`_bt_hci_enable`) stay deferred — see info/gapPico.md.
 */
import { ArmRunnerBase, importEngine } from './arm-runner-base.ts';
import { AVRRunnerOptions } from '../registries/component-registry.ts';

const PICO_UART_TX = ['GP0', 'GPIO0', '0', 'D0', 'TX', 'TX0'];
const PICO_UART_RX = ['GP1', 'GPIO1', '1', 'D1', 'RX', 'RX0'];
const MICROPYTHON_RP2040_URL = '/firmware/micropython_rp2040.uf2';
const MICROPYTHON_RP2350_URL = '/firmware/micropython_rp2350.uf2';
// pico-emu arch ids (same as CLI --arch): 0 = M0+ (RP2040), 2 = M33
// (RP2350 ARM, Pico 2 default), 1 = RV32 Hazard3 (RP2350 RISC-V).
const PICO_ARCH_M0 = 0;
const PICO_ARCH_RV32 = 1;
const PICO_ARCH_M33 = 2;
// UF2 family IDs at offset 28 of block 0 (same table as pico-emu cli.js).
const UF2_FAMILY_ARCH: Record<number, number> = {
  0xe48bff56: PICO_ARCH_M0,
  0xe48bff59: PICO_ARCH_M33,
  0xe48bff5a: PICO_ARCH_RV32,
};

function b64ToU8(b64: string): Uint8Array {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function payloadToU8(firmware: string): Uint8Array | null {
    const s = String(firmware || '').trim();
    if (!s) return null;
    if (s.startsWith('UF2BASE64:')) return b64ToU8(s.slice('UF2BASE64:'.length));
    // Raw UF2 bytes are never passed as text; ELF as base64 with prefix.
    if (s.startsWith('ELFBASE64:')) return b64ToU8(s.slice('ELFBASE64:'.length));
    return null;
}

export class PicoRunner extends ArmRunnerBase {
    protected uartTxPins = PICO_UART_TX;
    protected uartRxPins = PICO_UART_RX;
    protected engine = this.makeEngine();
    private mod: any = null;
    private isMicroPython = false;
    private pyInjected = false;
    private pyScript = '';
    private archOpt = '';
    private isPico2 = false;
    private arch = PICO_ARCH_M0;
    private wantWifi = false;
    private ethBoard: '' | 'w5500' = '';
    private ethSpi = 0;
    // I2C mirror bridge (runner-owned, AVR-TWIAdapter pattern): boards that
    // own I2C peripherals get the core's virtual mirror slaves attached at
    // the models' addresses; per-tick ring drains feed the standard
    // onI2CStart/onI2CByte/onI2CStop model interface. No component patches,
    // no per-board special casing — addresses come from the instances
    // themselves (generic accessor chain). Requires the fork core with the
    // jsmirror SDD (stock 1.0.3 has no observation channel); without it the
    // attach no-ops and behavior is exactly today's (blank I2C displays).
    private wantI2CBridge = false;
    private mirrorAttached = false;
    private mirrorActiveAddr: number | null = null;
    private mirrorBuf: number[] = [];
    private mirrorSlave: any = null;
    private compAttrById: Map<string, any> = new Map();

    constructor(
        hexData: string,
        componentsDef: any[],
        wiresDef: any[],
        onStateUpdate: (state: any) => void,
        options: AVRRunnerOptions & { pyScript?: string; arch?: string | number; wirelessMode?: string; boardSpi?: string | number; ethLive?: string } = {},
    ) {
        super(hexData, componentsDef, wiresDef, onStateUpdate, options);
        this.pyScript = String((options as any)?.pyScript || '');
        this.archOpt = String((options as any)?.arch || (options as any)?.boardArch || '').toLowerCase();
        const typeStr = String((options as any)?.boardType || '') + ' ' + String(this.boardId || '');
        this.isPico2 = /pico-?2|rp2350|2350/.test(typeStr);
        // WiFi: Pico W / Pico 2 W board types, or explicit wirelessMode attr
        // (full/compat-stub/on/1/true). 'off' disables (matches shell default
        // attr wirelessMode=full; shell offers full/compat-stub/off).
        const wifiAttr = String((options as any)?.wirelessMode || (options as any)?.wifi || '').toLowerCase();
        this.wantWifi = /pico-?w|picow|-w\b/.test(typeStr)
            || ['full', 'compat-stub', 'compat', 'stub', 'on', '1', 'true', 'yes'].includes(wifiAttr);
        if (wifiAttr === 'off' || wifiAttr === '0' || wifiAttr === 'false' || wifiAttr === 'no') this.wantWifi = false;
        // Ethernet: pico-eth / pico-2-eth board types (W5500 on SPI). The
        // W6300 (pico-w6300) is a different chip the arduino-pico core does
        // not target — explicit gap, not silently mapped.
        if (/pico-?2-?eth|picoeth2|2-eth/.test(typeStr)) this.ethBoard = 'w5500';
        else if (/pico-?eth|picoeth|w5500/.test(typeStr)) this.ethBoard = 'w5500';
        const spiOpt = Number.parseInt(String((options as any)?.boardSpi ?? '0'), 10);
        this.ethSpi = spiOpt === 1 ? 1 : 0;
        // Snapshot component attrs for generic I2C address resolution + arm
        // the mirror bridge when any owned instance speaks the I2C slave
        // interface (mirror attach happens post-engine-init in loadFirmware).
        try {
            const defs = Array.isArray(componentsDef) ? componentsDef : [];
            for (const c of defs) {
                if (c && c.id !== undefined) this.compAttrById.set(String(c.id), c.attrs || {});
            }
            for (const inst of this.instances.values()) {
                if (typeof (inst as any)?.onI2CStart === 'function') { this.wantI2CBridge = true; break; }
            }
        } catch { /* detection never breaks construction */ }
        void this.boot(this.isPico2 ? 'openhw-pico-2' : 'openhw-pico');
    }

    /** Generic I2C slave addresses owned by this board (no per-type code). */
    private i2cSlaveAddresses(): number[] {
        const out = new Set<number>();
        try {
            for (const inst of this.instances.values()) {
                if (typeof (inst as any)?.onI2CStart !== 'function') continue;
                const id = String((inst as any)?.id || '');
                const attrs = this.compAttrById.get(id) || {};
                const cands = [
                    (inst as any)?.i2cAddr,
                    typeof (inst as any)?.getI2CAddress === 'function' ? (inst as any).getI2CAddress() : NaN,
                    attrs?.address, attrs?.i2cAddress, attrs?.addr,
                ];
                for (const c of cands) {
                    const v = Number(c);
                    if (Number.isFinite(v)) { out.add(v & 0x7f); break; }
                }
            }
        } catch { /* address scan never breaks the tick */ }
        return [...out];
    }

    /** Attach one mirror call batching every owned address (single call — registry resets per call). */
    private attachI2CMirrors(): void {
        if (!this.wantI2CBridge || this.mirrorAttached) return;
        try {
            const mod = this.mod;
            const addFn = mod?._picoemu_sdd_add;
            if (typeof addFn !== 'function') return;
            const addrs = this.i2cSlaveAddresses();
            if (addrs.length === 0) return;
            const arg = `jsmirror:i2c=0,${addrs.slice(0, 8).map((a) => `addr=0x${a.toString(16)}`).join(',')}`;
            const ptr = mod._malloc(arg.length + 1);
            mod.HEAPU8.set(new TextEncoder().encode(arg + '\0'), ptr);
            let r = -1;
            try { r = addFn(ptr); } finally { mod._free(ptr); }
            if (r >= 0) {
                this.mirrorAttached = true;
            } else {
                console.warn('[PicoRunner] jsmirror attach failed (stock core?) — I2C displays stay blank');
            }
        } catch { /* attach never breaks boot */ }
    }

    /** Drain mirror ring entries into the component models (AVR-adapter semantics). */
    private drainI2CMirror(): void {
        if (!this.mirrorAttached || !this.mod) return;
        try {
            const mod = this.mod;
            if (typeof mod._picoemu_jsmirror_pending !== 'function'
                || typeof mod._picoemu_jsmirror_pop !== 'function') return;
            if ((mod._picoemu_jsmirror_pending() || 0) <= 0) return;
            const max = 1024;
            const ptr = mod._malloc(max * 2);
            let n = 0;
            try {
                n = mod._picoemu_jsmirror_pop(ptr, max) || 0;
                if (n <= 0) return;
                const view = mod.HEAPU16
                    ? new Uint16Array(mod.HEAPU16.buffer, ptr, n)
                    : Array.from({ length: n }, (_, i) => mod.HEAPU16?.[ptr / 2 + i] || 0);
                for (let i = 0; i < n; i++) this.feedMirrorEntry(view[i] & 0xffff);
            } finally {
                mod._free(ptr);
            }
        } catch { /* drain never breaks the tick */ }
    }

    private feedMirrorEntry(entry: number): void {
        try {
            if (entry === 0x200) {
                this.mirrorStop();
                return;
            }
            if ((entry & 0x100) !== 0) {
                this.mirrorStart(entry & 0x7f);
                return;
            }
            this.mirrorByte(entry & 0xff);
        } catch { /* one bad entry never breaks the drain */ }
    }

    private mirrorStart(addr: number): void {
        this.mirrorActiveAddr = addr & 0x7f;
        this.mirrorBuf = [];
        this.mirrorSlave = null;
        try {
            // First ACK wins (mirrors AVR connectToSlave); the core already
            // ACKed via the mirror device, so this is purely JS-side routing.
            for (const inst of this.instances.values()) {
                if (typeof (inst as any)?.onI2CStart !== 'function') continue;
                let ack = false;
                try { ack = !!(inst as any).onI2CStart(this.mirrorActiveAddr, false); } catch { ack = false; }
                if (ack && !this.mirrorSlave) this.mirrorSlave = inst;
            }
        } catch { /* start never breaks the drain */ }
    }

    private mirrorByte(value: number): void {
        this.mirrorBuf.push(value & 0xff);
        try {
            // Addressed-slave-only delivery (mirrors AVR writeByte: no
            // broadcast corruption across multi-slave buses). Falls back to
            // all only when no slave claimed the address (general call).
            const targets = this.mirrorSlave ? [this.mirrorSlave] : Array.from(this.instances.values());
            for (const inst of targets) {
                if (typeof (inst as any)?.onI2CByte !== 'function') continue;
                try { (inst as any).onI2CByte(-1, value & 0xff); } catch { /* ignore */ }
            }
        } catch { /* byte never breaks the drain */ }
    }

    private mirrorStop(): void {
        try {
            const instArray = Array.from(this.instances.values());
            for (const inst of instArray) {
                try { if (typeof (inst as any)?.onI2CStop === 'function') (inst as any).onI2CStop(); } catch { /* ignore */ }
            }
            const addr = this.mirrorActiveAddr;
            const data = this.mirrorBuf;
            if (addr !== null && addr !== undefined && data.length > 0) {
                try {
                    this.onStateUpdate({
                        type: 'protocol:i2c',
                        boardId: this.boardId,
                        address: addr,
                        data: [...data],
                        isWrite: true,
                        timestamp: this.getSimulatedTimeMs(),
                    });
                } catch { /* protocol lane never breaks the drain */ }
            }
        } catch { /* stop never breaks the drain */ }
        this.mirrorActiveAddr = null;
        this.mirrorBuf = [];
        this.mirrorSlave = null;
    }

    private makeEngine() {
        const self = this;
        return {
            async loadFirmware(firmware: string, _boardType: string) {
                // Engine loader: bundler first (node_modules, works in
                // vitest + vite build), public/vendor fallback at runtime
                // (workers serving the built app resolve /vendor/...).
                // Engine variant: I2C runs load the fork core (jsmirror SDD;
                // see vendor/pico-emu-fork/README.md). Every other Pico run
                // loads stock 1.0.3 byte-identically to before — the fork
                // never touches non-I2C behavior.
                const useFork = self.wantI2CBridge;
                const engineMod: any = await importEngine(
                    useFork ? '../engines/pico-emu-fork/picoemu.wasm.js' : 'pico-emu/picoemu.wasm.js',
                    '/vendor/board-engines/pico-emu/picoemu.wasm.js',
                );
                const PicoemuModule = engineMod?.default;
                if (!PicoemuModule) {
                    console.warn('[PicoRunner] engine unavailable (test env?) — idle.');
                    return;
                }
                const wasmUrl = useFork ? '/wasm/picoemu-fork.wasm.wasm' : '/wasm/picoemu.wasm.wasm';
                let wasmBinary: ArrayBuffer | undefined;
                try {
                    const r = await fetch(wasmUrl);
                    if (r.ok) wasmBinary = await r.arrayBuffer();
                } catch { /* glue falls back to its own URL */ }
                try {
                    self.mod = await (PicoemuModule as any)({
                        print: () => {}, printErr: () => {},
                        // locateFile: the glue resolves its .wasm relative to
                        // import.meta.url (vite serves the glue from
                        // /src/... or /vendor/... where no .wasm sits, and the
                        // HTML fallback then fails wasm magic). Point it at the
                        // real public/wasm asset. wasmBinary above wins when set.
                        locateFile: (f: string) => f === 'picoemu.wasm.wasm'
                            ? wasmUrl
                            : f,
                        ...(wasmBinary ? { wasmBinary } : {}),
                    });
                } catch (e) {
                    console.log('[PicoRunner BOOT] factory threw:', String(e && (e as any).message || e).slice(0, 200));
                    throw e;
                }
                // Arch select: explicit attr (arch=m33/rv32/m0) wins, else
                // Pico 2 board default (M33), else UF2 family-ID auto-detect
                // (CLI rule), else board default (M0 Pico / M33 Pico 2).
                self.arch = self.resolveArch(payloadToU8(firmware));
                self.mod._picoemu_init(self.arch);
                self.mod._picoemu_set_clock(self.arch === PICO_ARCH_M0 ? 125 : 150);
                // I2C mirror attach (post-init, pre-firmware): one call for
                // every owned slave address (see attachI2CMirrors).
                try { self.attachI2CMirrors(); } catch { /* attach never breaks boot */ }
                // Wireless + wired net (stub mode, no live sockets):
                // CYW43 for Pico W / Pico 2 W, W5500 board for pico-eth
                // variants — same CLI calls minus --board-live (deferred).
                try {
                    if (self.wantWifi) self.mod._picoemu_wifi_enable(0);
                } catch { /* older builds */ }
                try {
                    if (self.ethBoard === 'w5500') self.mod._picoemu_board_eth(1, 0, self.ethSpi);
                } catch { /* older builds */ }
                const u8 = payloadToU8(firmware);
                if (u8 && u8.length > 0) {
                    self.loadImage(u8);
                } else if (self.pyScript.trim()) {
                    await self.bootMicroPython();
                } else {
                    // No firmware: idle halted engine (canvas stays live).
                    // _picoemu_is_halted gates stepping; engine idles.
                }
            },
            stepBudget(budget: number): number {
                if (!self.mod) return 0;
                try {
                    const s = Number(self.mod._picoemu_step(Math.max(1, Math.floor(budget)))) || 0;
                    // NOTE: no per-tick publishGpio here — the base
                    // pollGpioBidirectional() runs right after stepBudget and
                    // owns ALL output publishing (via sampleGpioOut below),
                    // so edges fire once with dispatchOptionalProtocols.
                    // After MicroPython REPL is up, inject the user script once.
                    if (self.isMicroPython && !self.pyInjected && self.pyScript.trim()) {
                        self.tryInjectPython();
                    }
                    try { self.pollGpio(); } catch { /* LED mirror never breaks tick */ }
                    // I2C mirror drain: polled transaction ring → models.
                    try { self.drainI2CMirror(); } catch { /* drain never breaks tick */ }
                    return s;
                } catch { return 0; }
            },
            drainUartOut(): number[] {
                if (!self.mod) return [];
                const out: number[] = [];
                try {
                    let ch: number; let guard = 0;
                    while ((ch = self.mod._picoemu_read_uart(0)) !== -1 && guard++ < 1024) out.push(ch & 0xff);
                } catch { /* ignore */ }
                return out;
            },
            injectUartByte(value: number) {
                try { self.mod?._picoemu_write_uart(value & 0xff); } catch { /* ignore */ }
            },
            getPc(): number {
                try {
                    if (!self.mod) return 0;
                    const pcP = self.mod._malloc(4); const spP = self.mod._malloc(4);
                    self.mod._picoemu_get_core_state(0, pcP, spP);
                    const pc = self.mod.HEAPU32[pcP >> 2];
                    self.mod._free(pcP); self.mod._free(spP);
                    return pc >>> 0;
                } catch { return 0; }
            },
            isHalted(): boolean {
                try { return !!self.mod?._picoemu_is_halted?.(); } catch { return false; }
            },
            // Engine-driven output sampler for the base bidirectional poll.
            // _get_gpio_out is the whole-port output latch; pins the
            // firmware never drives read back their external level, so
            // report driving:false for those (input sampling owns them).
            sampleGpioOut(pinId: string): { level: number; driving: boolean } | null {
                try {
                    const m = self.mod;
                    if (!m?.get_gpio_out && !m?._picoemu_get_gpio_out) return null;
                    const getOut = m._picoemu_get_gpio_out?.bind(m) || m.get_gpio_out?.bind(m);
                    const getOe = m._picoemu_get_gpio_oe?.bind(m) || m.get_gpio_oe?.bind(m);
                    const n = self.gpioIndex(pinId);
                    if (n < 0) return null;
                    const out = Number(getOut()) || 0;
                    // OE mask when available: only driven pins publish.
                    if (getOe) {
                        const oe = Number(getOe()) || 0;
                        if (!((oe >> n) & 1)) return { level: 0, driving: false };
                    }
                    return { level: (out >> n) & 1, driving: true };
                } catch { return null; }
            },
            setGpioInput(pinId: string, high: boolean): void {
                try {
                    const n = self.gpioIndex(pinId);
                    if (n < 0) return;
                    const setFn = self.mod?._picoemu_set_gpio || self.mod?.set_gpio;
                    if (typeof setFn === 'function') setFn.call(self.mod, n, high ? 1 : 0);
                } catch { /* ignore */ }
            },
            // ADC sampler (GP26/27/28 → ADC0/1/2): volts → raw level pushed
            // through the engine's ADC pin override when the package
            // exposes one (pico-emu has no ADC inject — returns NaN so the
            // base falls back to pinStates voltage for analog widgets).
            readAnalog(_ref: string): number {
                return NaN;
            },
            close(): void { self.mod = null; },
            resetEngine(): void {
                try { self.mod?._picoemu_reset?.(); } catch { /* ignore */ }
            },
        };
    }

    private resolveArch(u8: Uint8Array | null): number {
        const opt = String(this.archOpt || '').toLowerCase();
        if (opt === 'm0' || opt === 'rp2040' || opt === '0') return PICO_ARCH_M0;
        if (opt === 'm33' || opt === 'arm' || opt === '2') return PICO_ARCH_M33;
        if (opt === 'rv32' || opt === 'riscv' || opt === 'risc-v' || opt === '1') return PICO_ARCH_RV32;
        if (u8 && u8.length >= 32) {
            const fam = (u8[28] | (u8[29] << 8) | (u8[30] << 16) | (u8[31] << 24)) >>> 0;
            if (fam in UF2_FAMILY_ARCH) return UF2_FAMILY_ARCH[fam];
        }
        return this.isPico2 ? PICO_ARCH_M33 : PICO_ARCH_M0;
    }

    private loadImage(u8: Uint8Array): void {
        // UF2 magic is 'UF2\n' = 55 46 32 0A (NOT 55 46 44 32 = 'UFD2';
        // probed live: every backend UF2 starts 55 46 32 0A and the old
        // check misrouted all Arduino UF2 builds into the ELF loader).
        const looksUf2 = u8.length >= 512 && u8[0] === 0x55 && u8[1] === 0x46 && u8[2] === 0x32 && u8[3] === 0x0a;
        const ptr = this.mod._malloc(u8.length);
        this.mod.HEAPU8.set(u8, ptr);
        try {
            if (looksUf2) this.mod._picoemu_load_uf2(ptr, u8.length);
            else this.mod._picoemu_load_elf(ptr, u8.length);
        } finally {
            this.mod._free(ptr);
        }
        this.mod._picoemu_reset();
    }

    private async bootMicroPython(): Promise<void> {
        try {
            const url = this.arch === PICO_ARCH_M0 ? MICROPYTHON_RP2040_URL : MICROPYTHON_RP2350_URL;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buf = new Uint8Array(await res.arrayBuffer());
            this.loadImage(buf);
            this.isMicroPython = true;
        } catch (e) {
            console.warn('[PicoRunner] MicroPython base UF2 unavailable:', e);
        }
    }

    private tryInjectPython(): void {
        // Wait for the REPL prompt before injecting (drainUartOut feeds emit;
        // we sniff via a lightweight direct read here).
        try {
            // Send the script + \r\n; MicroPython echoes + runs it.
            const script = this.pyScript.replace(/\r\n/g, '\n');
            for (const ch of `\r\n${script}\r\n`) {
                this.mod._picoemu_write_uart(ch.charCodeAt(0) & 0xff);
            }
            this.pyInjected = true;
        } catch { /* retry next tick */ }
    }

    private lastGpioOut = 0;
    /** Board pin label → RP2040 GPIO index (GPn, Dn/An aliases, bare n). */
    public gpioIndex(pinId: string): number {
        const raw = String(pinId || '').toUpperCase();
        let m = raw.match(/^GP(?:IO)?(\d{1,2})$/);
        if (m) return Number(m[1]) <= 28 ? Number(m[1]) : -1;
        m = raw.match(/^D(\d{1,2})$/);
        if (m) {
            const d = Number(m[1]);
            // Arduino-pico mapping: D0..D21 → GP0..GP21 (D22+ unmapped here).
            return d <= 21 ? d : -1;
        }
        m = raw.match(/^A([0-5])$/);
        if (m) return [20, 21, 26, 27, 28, 22][Number(m[1])] ?? -1;
        if (/^\d{1,2}$/.test(raw)) return Number(raw) <= 28 ? Number(raw) : -1;
        return -1;
    }
    private pollGpio(): void {
        // Legacy whole-port publisher — superseded by pollGpioBidirectional
        // → sampleGpioOut (direction-gated via OE, per-pin). Kept only for
        // the onboard GP25 LED state mirror (the shell's builtInLed dot is
        // not a wire net, so the base poll never touches it).
        try {
            const out = Number(this.mod?._picoemu_get_gpio_out?.()) || 0;
            const changed = (out ^ this.lastGpioOut) >>> 0;
            this.lastGpioOut = out;
            // Onboard LED is GP25.
            if ((changed >> 25) & 1) {
                const ledInst = this.instances.get(this.boardId);
                try { (ledInst as any)?.setState?.({ builtInLed: !!((out >> 25) & 1) }); } catch { /* ignore */ }
            }
        } catch { /* GPIO poll never breaks the tick */ }
    }

    protected budgetForDelta(deltaMs: number): number {
        // pico-emu worker uses 2.5M steps / 16ms; match that cadence.
        return Math.floor(deltaMs * 156250 * this.speed);
    }

    protected maxBudgetPerTick(): number {
        return 2_500_000;
    }
}
