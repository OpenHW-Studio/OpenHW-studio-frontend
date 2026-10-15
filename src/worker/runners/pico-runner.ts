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
import { createSPIBridge, levelPassiveNets } from '../bus-bridge.ts';
import { pollPicoPioNeopixel } from './pico-pio-pump.ts';

const PICO_UART_TX = ['GP0', 'GPIO0', '0', 'D0', 'TX', 'TX0'];
const PICO_UART_RX = ['GP1', 'GPIO1', '1', 'D1', 'RX', 'RX0'];
const MICROPYTHON_RP2040_URL = '/firmware/micropython_rp2040.uf2';
const MICROPYTHON_RP2350_URL = '/firmware/micropython_rp2350.uf2';

/** Split a MicroPython script into exec()-ready escaped chunks (see
 * PicoRunner.startPythonInject). Cuts only at blank lines or between
 * zero-indent lines so indented blocks (try/while) never split; caps
 * payloads at maxChars so no REPL line exceeds the readline buffer. */
function chunkExecLines(script: string, maxChars: number): string[] {
    const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
    const lines = String(script || '').split('\n');
    const paras: string[][] = [];
    let cur: string[] = [];
    const push = () => { if (cur.length) paras.push(cur); cur = []; };
    for (const ln of lines) {
        if (ln.trim() === '') { push(); continue; }
        cur.push(ln);
        // Cut between zero-indent lines (never inside an indented block).
        if (!/^\s/.test(ln)) {
            const joined = cur.join('\n').length;
            // Peek: cut here only if the block so far is closed (no open
            // `:` block pending). Track simply: an opener (`...:`) followed
            // only by indented lines stays open; a zero-indent non-continuation
            // line after indented lines closes it — cut AFTER such a line only
            // when the accumulated chunk fits.
            void joined;
        }
    }
    push();
    // Sub-split long zero-indent runs (writeto sequences) every few lines.
    const out: string[] = [];
    for (const para of paras) {
        let buf: string[] = [];
        const flush = () => { if (buf.length) { out.push(esc(buf.join('\n'))); buf = []; } };
        for (const ln of para) {
            buf.push(ln);
            const hasIndent = buf.some((l) => /^\s/.test(l));
            if (!hasIndent && buf.join('\n').length >= maxChars) flush();
        }
        flush();
    }
    return out.filter((s) => s.length > 0);
}
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
    // Prompt-driven REPL injection (the old fire-once on first tick raced
    // the REPL boot: bytes typed pre-prompt are lost and never retried).
    // Paced + output-gated: the friendly REPL consumes input line by line,
    // so a 1KB blast overruns the UART RX FIFO and wedges the core in an
    // RX storm (observed live). 16 chars/tick matches REPL consumption;
    // retry only while the script produced no MP_ output yet.
    private pyPromptSeen = false;
    private pyInjectAttempts = 0;
    private pyLastInjectAt = 0;
    private pyUartTail = '';
    private pyQueue = '';
    private pyQueuePos = 0;
    private pyOutputSeen = false;
    private pyExecBuf = '';
    private pyScript = '';
    private archOpt = '';
    private fixedFirmwareUrl = '';
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
    // SPI mirror bridge (runner-owned, same pattern): boards owning SPI
    // peripherals get the core's spimirror slave attached; per-tick ring
    // drains feed the standard onSPIByte path. Requires the fork core
    // with the spimirror SDD (stock 1.0.3 has no SPI channel either).
    private wantSPIBridge = false;
    private spiMirrorAttached = false;
    private spiBridge: any = null;
    // ADC/PWM observation also requires the fork core (see constructor).
    private wantADC = false;
    private wantPWM = false;
    private compAttrById: Map<string, any> = new Map();
    // Runner-side watchdog countdown (RP2040/RP2350 WDT recipe check):
    // pico-emu models the watchdog registers + TRIGGER reboot but runs no
    // timeout countdown (clocks.c has no tick/decrement path), so unfed
    // firmware would never reboot. This poll owns the countdown via
    // _picoemu_mem_read32 (stock + fork cores): ENABLE edge or LOAD change
    // arms/re-feeds, expiry performs the silicon-true reboot by setting
    // the WDT TRIGGER bit via _picoemu_mem_write32 (the engine turns it
    // into the full watchdog reboot: peripherals + cores re-init,
    // setup() re-runs — headless: 209 triggers → 209 boots). While armed
    // the poll also pins the guest clock every tick (reboots reset clocks
    // to the 1MHz fast-forward default; unpinned timers warp ~200x and
    // flood serial). Bare _picoemu_reset() is NOT a reboot (cores-only;
    // the guest wedges after the first reset — headless: 198 resets, 1 boot — and the
    // wedged engine hangs the run). Additive-only (never fires until
    // firmware sets CTRL.ENABLE). Limitation: same-value periodic feeds
    // (watchdog_update rewrites the identical LOAD) are not observable
    // without an engine write-trap — the engine-side countdown is the
    // correct fix; unfed shapes (all WDT cells) are exact.
    private wdtArmed = false;
    private wdtDeadlineMs = 0;
    private wdtPeriodMs = 0;
    private wdtLastLoad = 0;
    private wdtExpiredOnce = false;
    // Guest clock + slow-observe state (timing/pace honesty):
    // picoClockMHz mirrors every _picoemu_set_clock call (arch default
    // 200 M0 / 150 M33 — toolchain truth, opt-in tickMHz attr) so the
    // sim-time divisors track the engine rate. adcLastCode skips redundant ADC register
    // writes (idempotent sets — engine state identical). slowPollTick
    // gates ADC/PWM observation to every 4th tick (human-speed signals;
    // steady-state identical, see drivePicoADC/pollPicoPWM).
    private picoClockMHz = 200;
    private tickMHzOpt = '';
    private adcLastCode: Array<number | null> = [null, null, null];
    private slowPollTick = 0;

    constructor(
        hexData: string,
        componentsDef: any[],
        wiresDef: any[],
        onStateUpdate: (state: any) => void,
        options: AVRRunnerOptions & { pyScript?: string; arch?: string | number; wirelessMode?: string; boardSpi?: string | number; ethLive?: string; tickMHz?: string | number; boardTickMHz?: string | number } = {},
    ) {
        super(hexData, componentsDef, wiresDef, onStateUpdate, options);
        this.pyScript = String((options as any)?.pyScript || '');
        this.archOpt = String((options as any)?.arch || (options as any)?.boardArch || '').toLowerCase();
        this.tickMHzOpt = String((options as any)?.tickMHz ?? (options as any)?.boardTickMHz ?? '').trim();
        this.fixedFirmwareUrl = String((options as any)?.fixedFirmware || '').trim();
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
            for (const inst of this.instances.values()) {
                if (typeof (inst as any)?.onSPIByte === 'function'
                    || typeof (inst as any)?.onSPIByteExchange === 'function') { this.wantSPIBridge = true; break; }
            }
            // ADC/PWM observation needs the fork core too (stock 1.0.3 has
            // neither export): analog sources wired to GP26-28, or models
            // speaking onPWM/onPWMSignal (capability detection, no per-type
            // code — without this the run silently loads stock and every
            // tap guarded-misses, observed live as adcSet=undefined).
            try {
                for (const inst of this.instances.values()) {
                    if (typeof (inst as any)?.onPWM === 'function'
                        || typeof (inst as any)?.onPWMSignal === 'function') { this.wantPWM = true; break; }
                }
                if (!this.wantADC) {
                    try {
                        for (const w of (wiresDef as any[]) || []) {
                            for (const end of [w?.from, w?.to]) {
                                const m = /^[^:]+:(GP2[678])$/i.exec(String(end || ''));
                                if (m) { this.wantADC = true; break; }
                            }
                            if (this.wantADC) break;
                        }
                    } catch { /* ignore */ }
                }
            } catch { /* detection never breaks construction */ }
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
                // NOTE: read via HEAPU8, never HEAPU16 — emscripten 6.x
                // builds may not export HEAPU16 (undefined → the old
                // fallback manufactured zero entries and starved models).
                const bu8 = mod.HEAPU8;
                const view = Array.from({ length: n }, (_, i) => {
                    try { return ((bu8[ptr + i * 2] || 0) | ((bu8[ptr + i * 2 + 1] || 0) << 8)) & 0xffff; }
                    catch { return 0; }
                });
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

    /** Attach the SPI mirror slave (single call — one mirror per bus). */
    private attachSPIMirrors(): void {
        if (!this.wantSPIBridge || this.spiMirrorAttached) return;
        try {
            const mod = this.mod;
            const addFn = mod?._picoemu_sdd_add;
            if (typeof addFn !== 'function') return;
            for (const bus of [0]) {
                try {
                    const arg = `spimirror:spi=${bus}`;
                    const ptr = mod._malloc(arg.length + 1);
                    mod.HEAPU8.set(new TextEncoder().encode(arg + '\0'), ptr);
                    try { addFn(ptr); } finally { mod._free(ptr); }
                } catch { /* one bus never breaks attach */ }
            }
            this.spiMirrorAttached = true;
            try {
                const ctx: any = {
                    boardId: this.boardId,
                    onStateUpdate: (msg: any) => { try { this.onStateUpdate(msg); } catch { /* ignore */ } },
                    getSimTimeMs: () => { try { return this.getSimulatedTimeMs(); } catch { return 0; } },
                    instances: this.instances,
                    compAttrById: this.compAttrById,
                    pinToNet: (this as any).pinToNet,
                    boardPinLevel: (pin: string) => {
                        try {
                            const v = ((this as any).pinStates as any)?.[pin];
                            return typeof v === 'boolean' ? v : null;
                        } catch { return null; }
                    },
                };
                this.spiBridge = createSPIBridge(ctx);
            } catch { /* bridge never breaks attach */ }
        } catch { /* attach never breaks boot */ }
    }

    /** ADC inject: RP2040 ADC0-2 live on GP26-28. Read wired wiper
     * voltages per tick into _picoemu_adc_set (12-bit code). Rails power
     * like the F1 path (boards source no power today). No-ops on cores
     * without the export. */
    private drivePicoADC(): void {
        try {
            const mod = this.mod;
            if (!mod || typeof mod._picoemu_adc_set !== 'function') return;
            const chFor: Record<string, number> = { GP26: 0, GP27: 1, GP28: 2 };
            for (const inst of this.instances.values()) {
                try {
                    if (typeof (inst as any)?.getPinVoltage !== 'function') continue;
                    for (const nm of ['VCC', 'vcc', '1']) {
                        let v = 0;
                        try { v = Number((inst as any).getPinVoltage(nm)) || 0; } catch { continue; }
                        if (v > 0.2) continue;
                        const net = (this as any).pinToNet?.get?.(`${(inst as any)?.id}:${nm}`);
                        if (net === undefined) continue;
                        for (const [node, netId] of (this as any).pinToNet) {
                            if (netId !== net) continue;
                            const sep = node.indexOf(':');
                            if (sep < 0) continue;
                            if (node.slice(0, sep) !== this.boardId) continue;
                            if (!/3V3/i.test(node.slice(sep + 1))) continue;
                            try { (inst as any).setPinVoltage(nm, 3.3); } catch { /* ignore */ }
                            break;
                        }
                    }
                } catch { /* one instance never breaks rails */ }
            }
            for (const [pin, ch] of Object.entries(chFor)) {
                try {
                    let volts: number | null = null;
                    for (const [node, netId] of (this as any).pinToNet) {
                        const sep = node.indexOf(':');
                        if (sep < 0) continue;
                        if (node.slice(0, sep) !== this.boardId) continue;
                        if (node.slice(sep + 1).toUpperCase() !== pin) continue;
                        for (const [node2, net2] of (this as any).pinToNet) {
                            if (net2 !== netId) continue;
                            const s2 = node2.indexOf(':');
                            if (s2 < 0) continue;
                            if (node2.slice(0, s2) === this.boardId) continue;
                            const inst = this.instances.get(node2.slice(0, s2));
                            const v = Number((inst as any)?.getPinVoltage?.(node2.slice(s2 + 1)));
                            if (Number.isFinite(v)) { volts = v; break; }
                        }
                        break;
                    }
                    if (volts !== null) {
                        const code = Math.max(0, Math.min(4095, Math.round(volts / 3.3 * 4095)));
                        try {
                            // Idempotent register set: skip the engine call
                            // when the code is unchanged (engine state
                            // identical, analogRead returns the same value).
                            if (this.adcLastCode[ch] !== code) {
                                this.adcLastCode[ch] = code;
                                mod._picoemu_adc_set(ch, code);
                            }
                        } catch { /* ignore */ }
                    }
                } catch { /* one pin never breaks the drain */ }
            }
        } catch { /* ADC never breaks the tick */ }
    }

    /** PWM observe: poll slices 0-7 via _picoemu_pwm_read (freq + duty A/B
     * in basis points); strongest duty drives LED models via onPWM.
     * No-ops on cores without the export. Single scratch allocation per
     * poll (was one per slice — same values read, 8× fewer mallocs). */
    private pollPicoPWM(): void {
        try {
            const mod = this.mod;
            if (!mod || typeof mod._picoemu_pwm_read !== 'function' || typeof mod._malloc !== 'function') return;
            let best = 0;
            let bestFreq = 0;
            const ptr = mod._malloc(16);
            try {
                for (let slice = 0; slice < 8; slice++) {
                    try {
                        const r = mod._picoemu_pwm_read(slice, ptr, ptr + 4, ptr + 8, ptr + 12);
                        // NOTE: returns 0 on success (like POSIX), nonzero
                        // on bad slice — the old `if (!r) continue` was
                        // inverted and skipped every valid slice.
                        if (r !== 0) continue;
                        // NOTE: read via HEAPU8, never HEAPU32 — emscripten
                        // 6.x builds may not export typed views (the I2C
                        // drain hit the same issue with HEAPU16).
                        const b = mod.HEAPU8;
                        const u32 = (o: number) => ((b[o] || 0) | ((b[o + 1] || 0) << 8) | ((b[o + 2] || 0) << 16) | ((b[o + 3] || 0) << 24)) >>> 0;
                        const freq = u32(ptr), da = u32(ptr + 4), db = u32(ptr + 8), en = u32(ptr + 12) ? 1 : 0;
                        if (!en) continue;
                        const d = Math.max(da, db) / 100;
                        if (d > best) { best = d; bestFreq = freq; }
                    } catch { /* one slice never breaks the poll */ }
                }
            } finally { try { mod._free(ptr); } catch { /* ignore */ } }
            if (best <= 0) return;
            const duty01 = Math.max(0, Math.min(1, best / 100));
            for (const inst of this.instances.values()) {
                try {
                    if (typeof (inst as any)?.onPWM !== 'function') continue;
                    if (typeof (inst as any)?.getPWMPinNames === 'function') continue;
                    for (const pn of ['A', 'ANODE', '+']) {
                        try { (inst as any).onPWM(pn, { dutyCycle: duty01, frequencyHz: bestFreq }); } catch { /* ignore */ }
                    }
                } catch { /* one instance never breaks pwm */ }
            }
        } catch { /* PWM never breaks the tick */ }
    }

    /** Runner-side watchdog countdown (see field note). Polls the
     *  watchdog CTRL/LOAD via _picoemu_mem_read32; expiry sets the TRIGGER
     *  bit via _picoemu_mem_write32 so unfed firmware reboots (WDT_BOOT
     *  needles repeat). Register map from the pico-sdk (RP2040
     *  CTRL=0x40058000, RP2350=0x400D8000; CTRL off 0x00 ENABLE=bit30
     *  TRIGGER=bit31, LOAD off 0x04 in 1us ticks, RP2040 XFACTOR 2 per
     *  errata RP2040-E1, RP2350 XFACTOR 1). No-ops when the export is
     *  absent or the firmware never arms the WDT. */
    private pollPicoWDT(): void {
        try {
            const mod = this.mod;
            if (!mod || typeof mod._picoemu_mem_read32 !== 'function'
                || typeof mod._picoemu_reset !== 'function') return;
            const base = this.arch === PICO_ARCH_M0 ? 0x40058000 : 0x400D8000;
            let ctrl = 0, load = 0;
            try {
                ctrl = mod._picoemu_mem_read32(base) >>> 0;
                load = mod._picoemu_mem_read32(base + 4) >>> 0;
            } catch { return; }
            // Firmware-requested reboot (TRIGGER) is engine-owned — stay out.
            if ((ctrl & 0x80000000) !== 0) { this.wdtArmed = false; this.wdtExpiredOnce = false; return; }
            if ((ctrl & 0x40000000) === 0) { this.wdtArmed = false; this.wdtExpiredOnce = false; return; }
            // While armed, pin the guest clock EVERY tick: an engine-side
            // reboot (our TRIGGER path runs reset_runtime_peripherals →
            // clocks back to the 1MHz fast-forward default) would otherwise
            // leave timers warping ~200x — delay() elapses instantly, serial
            // floods, and the page drowns. The re-arm edge is NOT a reliable
            // reboot detector (fast boots complete between polls), so this
            // is unconditional while armed. Idempotent (same MHz re-set);
            // zero behavior change when never armed.
            if (this.wdtArmed) { try { this.applyPicoClock(); } catch { /* clock never breaks tick */ } }
            const xfactor = this.arch === PICO_ARCH_M0 ? 2 : 1;
            const periodMs = Math.max(1, (load >>> 0) / (1000 * xfactor));
            const now = performance.now();
            if (!this.wdtArmed || load !== this.wdtLastLoad) {
                // ENABLE edge or LOAD change (re-arm / feed with new period).
                this.wdtArmed = true;
                this.wdtLastLoad = load;
                this.wdtPeriodMs = periodMs;
                this.wdtDeadlineMs = now + periodMs;
                this.wdtExpiredOnce = false;
                return;
            }
            if (now < this.wdtDeadlineMs) { this.wdtExpiredOnce = false; return; }
            // Expired: debounce one extra poll (bus misread guard), then
            // reboot via the WDT TRIGGER bit — the silicon-true path (the
            // engine turns TRIGGER into the full watchdog reboot, setup()
            // re-runs and the ARMED needle repeats). Bare _picoemu_reset()
            // only resets the cores and the guest wedges after the first
            // reset (proven headless) — kept as last-resort fallback.
            // The watchdog stays conceptually armed (silicon keeps it running
            // across its own reset); setup's wdt_begin re-feeds anyway.
            if (!this.wdtExpiredOnce) { this.wdtExpiredOnce = true; return; }
            this.wdtExpiredOnce = false;
            this.wdtDeadlineMs = now + this.wdtPeriodMs;
            try {
                const c = mod._picoemu_mem_read32(base) >>> 0;
                mod._picoemu_mem_write32(base, (c | 0x80000000) >>> 0);
            } catch { try { mod._picoemu_reset(); } catch { /* reset never breaks tick */ } }
        } catch { /* WDT never breaks the tick */ }
    }

    /** Drain SPI mirror ring entries into the bridge (AVR-adapter semantics). */
    private drainSPIMirror(): void {
        // Per-tick idle flush first (closes setup-only frames / missing CS
        // edges even when no new entries arrive — same contract as F1/ESP32).
        try {
            const br0 = this.spiBridge as any;
            if (br0 && typeof br0.idleFlush === 'function') {
                let nowMs = 0;
                try { nowMs = this.getSimulatedTimeMs(); } catch { nowMs = 0; }
                br0.idleFlush(nowMs);
            }
        } catch { /* flush never breaks the tick */ }
        if (!this.spiMirrorAttached || !this.mod) return;
        try {
            const mod = this.mod;
            if (typeof mod._picoemu_spimirror_pending !== 'function'
                || typeof mod._picoemu_spimirror_pop !== 'function') return;
            if ((mod._picoemu_spimirror_pending() || 0) <= 0) return;
            if (!this.spiBridge) return;
            const max = 512;
            const ptr = mod._malloc(max * 2);
            let n = 0;
            try {
                n = mod._picoemu_spimirror_pop(ptr, max) || 0;
                if (n <= 0) return;
                // NOTE: HEAPU8, never HEAPU16 (see I2C drain — 6.x may not
                // export HEAPU16 and the fallback manufactures zeros).
                const bu8s = mod.HEAPU8;
                const view = Array.from({ length: n }, (_, i) => {
                    try { return ((bu8s[ptr + i * 2] || 0) | ((bu8s[ptr + i * 2 + 1] || 0) << 8)) & 0xffff; }
                    catch { return 0; }
                });
                const br = this.spiBridge;
                let idx = 0;
                for (let i = 0; i < n; i++) {
                    const entry = view[i] & 0xffff;
                    if (entry === 0x200 || entry === 0x201) {
                        try { br.frame(true); } catch { /* ignore */ }
                    } else if (entry === 0x100 || entry === 0x101) {
                        continue;
                    } else {
                        try { br.exchange(entry & 0xff, idx++); } catch { /* ignore */ }
                    }
                }
            } finally {
                mod._free(ptr);
            }
        } catch { /* drain never breaks the tick */ }
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
                const useFork = self.wantI2CBridge || self.wantSPIBridge || self.wantADC || self.wantPWM;
                const engineMod: any = await importEngine(
                    useFork ? '../engines/pico-emu-fork/picoemu.wasm.js' : 'pico-emu/picoemu.wasm.js',
                    '/vendor/board-engines/pico-emu/picoemu.wasm.js',
                );
                const PicoemuModule = engineMod?.default;
                if (!PicoemuModule) {
                    console.warn('[PicoRunner] engine unavailable (test env?) — idle.');
                    return;
                }
                const wasmUrl = useFork
                    ? '/wasm/picoemu-fork.wasm.wasm'
                    // Stock runs: the MATCHED npm pair (glue + its own
                    // wasm). The untracked public/wasm/picoemu.wasm.wasm
                    // first-party file MISBINDS with the npm glue (proven
                    // 2026-10-14 by glue×wasm pairing matrix, bare-worker:
                    // npm+npm DONE; npm+first-party malloc→undefined (a
                    // void export) then reset→OOB trap — and the glue
                    // ignores the wasmBinary bytes, streaming instead from
                    // locateFile, so the URL alone decides the build).
                    : '/node_modules/pico-emu/picoemu.wasm.wasm';
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
                        // HTML fallback then fails wasm magic). Point it at
                        // the MATCHED wasm for the loaded glue (stock runs:
                        // the npm package twin — see wasmUrl note above;
                        // a mismatched build misbinds exports). wasmBinary
                        // above wins when the glue honors it (this glue
                        // ignores it and streams from locateFile instead —
                        // the URL alone decides the build).
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
                // Fixed-firmware cells init after the image loads (branch
                // below re-inits from the image family ID); skip here.
                // Attr fallback: execute.ts deriveOpts may not carry board
                // attrs (boardId-gated lookup) — read them directly so
                // arch/firmware attrs always land.
                try {
                    const battrs = (self as any).compAttrById?.get?.(self.boardId) || {};
                    if (!(self as any).fixedFirmwareUrl && (battrs as any).firmware) {
                        (self as any).fixedFirmwareUrl = String((battrs as any).firmware);
                    }
                    if (!self.archOpt && (battrs as any).arch) {
                        self.archOpt = String((battrs as any).arch).toLowerCase();
                    }
                    if (!self.tickMHzOpt && (battrs as any).tickMHz) {
                        self.tickMHzOpt = String((battrs as any).tickMHz).trim();
                    }
                } catch { /* attrs never break boot */ }
                if (!self.fixedFirmwareUrl) {
                    self.arch = self.resolveArch(payloadToU8(firmware));
                    self.mod._picoemu_init(self.arch);
                }
                // Guest clock: arch default (200 M0 / 150 M33), opt-in
                // tickMHz attr — the engine honors it for guest timing
                // (timers/SysTick/PWM divide by cycles_per_us).
                self.applyPicoClock();
                // I2C mirror attach (post-init, pre-firmware): one call for
                // every owned slave address (see attachI2CMirrors).
                try { self.attachI2CMirrors(); } catch { /* attach never breaks boot */ }
                // SPI mirror attach (post-init, pre-firmware): spimirror
                // slave on SPI0 (see attachSPIMirrors).
                try { self.attachSPIMirrors(); } catch { /* attach never breaks boot */ }
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
                if (self.fixedFirmwareUrl) {
                    // Fixed-firmware cells (RV32 proof images, etc.): the
                    // backend cannot compile for these cores, so boot a
                    // curated image instead of the (trivial) sketch payload.
                    // Arch auto-detects from the UF2 family ID below.
                    try {
                        const res = await fetch(self.fixedFirmwareUrl);
                        if (res.ok) {
                            const buf = new Uint8Array(await res.arrayBuffer());
                            self.arch = self.resolveArch(buf);
                            self.mod._picoemu_init(self.arch);
                            self.applyPicoClock();
                            self.loadImage(buf);
                        } else {
                            console.warn('[PicoRunner] fixed firmware unavailable:', res.status);
                        }
                    } catch (e) {
                        console.warn('[PicoRunner] fixed firmware load failed:', e);
                    }
                } else if (u8 && u8.length > 0) {
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
                    // After MicroPython REPL is up, inject the user script.
                    // Prompt-driven + paced: 16 chars/tick (a blind 1KB blast
                    // overruns UART RX and wedges the core in an RX storm).
                    // New attempt only while the previous queue fully drained
                    // AND produced no output (a retype mid-drain interleaves
                    // with the in-flight script — observed live as
                    // overlapping fragments wedging both attempts).
                    if (self.isMicroPython && self.pyScript.trim() && self.pyPromptSeen
                        && self.pyInjectAttempts < 3 && !self.pyOutputSeen
                        && self.pyQueuePos >= self.pyQueue.length
                        && (performance.now() - self.pyLastInjectAt > 3000 || self.pyLastInjectAt === 0)) {
                        self.startPythonInject();
                        self.pyInjectAttempts++;
                        self.pyLastInjectAt = performance.now();
                    }
                    // Pump the paced queue every tick until drained.
                    if (self.pyQueuePos < self.pyQueue.length) {
                        try {
                            const chunk = self.pyQueue.slice(self.pyQueuePos, self.pyQueuePos + 16);
                            for (const ch of chunk) {
                                self.mod._picoemu_write_uart(ch.charCodeAt(0) & 0xff);
                            }
                            self.pyQueuePos += chunk.length;
                        } catch { /* pump never breaks tick */ }
                    }
                    try { self.pollGpio(); } catch { /* LED mirror never breaks tick */ }
                    // I2C mirror drain: polled transaction ring → models.
                    try { self.drainI2CMirror(); } catch { /* drain never breaks tick */ }
                    // SPI mirror drain: polled MOSI ring → bridge → models.
                    try { self.drainSPIMirror(); } catch { /* drain never breaks tick */ }
                    // ADC inject + PWM observe: human-speed signals — every
                    // 4th tick is identical in steady state (pots/static
                    // duty converge; see slowPollTick). WDT/PIO/I2C/SPI
                    // stay every-tick (latency-sensitive or already
                    // pending-guarded).
                    self.slowPollTick = (self.slowPollTick + 1) & 0xffff;
                    if ((self.slowPollTick & 3) === 0) {
                        // ADC inject: pot wipers drive RP2040 ADC0-2 (GP26-28).
                        try { self.drivePicoADC(); } catch { /* drain never breaks tick */ }
                        // PWM observe: first enabled slice drives LED models.
                        try { self.pollPicoPWM(); } catch { /* drain never breaks tick */ }
                    }
                    // Watchdog countdown: unfed WDT reboots (no engine tick).
                    try { self.pollPicoWDT(); } catch { /* drain never breaks tick */ }
                    // PIO WS2812 mirror: PIO0 SM0 RX words → NeoPixel frames.
                    try { pollPicoPioNeopixel(self.mod, self.instances); } catch { /* drain never breaks tick */ }
                    // Net leveling: model-driven pins (shift-register
                    // outputs etc.) fan out across component-only nets.
                    try { levelPassiveNets(self.boardId, (self as any).pinToNet, self.instances as any); } catch { /* never breaks tick */ }
                    return s;
                } catch { return 0; }
            },
            drainUartOut(): number[] {
                if (!self.mod) return [];
                const out: number[] = [];
                try {
                    let ch: number; let guard = 0;
                    while ((ch = self.mod._picoemu_read_uart(0)) !== -1 && guard++ < 1024) out.push(ch & 0xff);
                    // REPL prompt sniffing for script injection (MicroPython).
                    // Execution proof = a BARE marker line (echoes carry the
                    // source text, e.g. `>>> print("MP_READY")`, so only
                    // bare lines count — otherwise retries die with the
                    // first echo and a wedged script never recovers).
                    if (self.isMicroPython && out.length > 0) {
                        try {
                            // Consume the WHOLE drain into the exec buffer
                            // (per-drain tail-slicing drops markers when a
                            // 1024-byte drain buries them mid-chunk —
                            // observed: bare MP_READY printed but missed,
                            // spawning a wedging retype).
                            const text = String.fromCharCode(...out);
                            // Reboot gate: the run-start engine reset cuts an
                            // in-flight queue; its leftovers would poison the
                            // fresh REPL. Abandon the stale queue and allow
                            // an immediate clean retype (every run shows
                            // exactly one banner repeat at run start).
                            // Split-proof: banners can straddle two drains,
                            // so match on (carry + text), not text alone.
                            try {
                                (self as any).pyBannerCarry = (((self as any).pyBannerCarry || '') + text).slice(-120);
                            } catch { /* ignore */ }
                            if (String((self as any).pyBannerCarry || '').includes('MicroPython v1.22.1')) {
                                (self as any).pyReboots = (((self as any).pyReboots || 0) + 1);
                                (self as any).pyBannerCarry = '';
                                if (((self as any).pyReboots || 0) > 1) {
                                    self.pyQueuePos = self.pyQueue.length;
                                    self.pyOutputSeen = false;
                                    self.pyLastInjectAt = 0;
                                }
                            }
                            self.pyUartTail = (self.pyUartTail + text).slice(-8);
                            if (self.pyUartTail.endsWith('>>> ')) self.pyPromptSeen = true;
                            self.pyExecBuf = (self.pyExecBuf + text).slice(-600);
                            const lines = self.pyExecBuf.split('\n');
                            for (const ln of lines) {
                                const t = ln.trim().replace(/\r/g, '');
                                if (t === 'MP_READY' || t === 'MP_READY2' || t === 'MP_DRAWN'
                                    || t === 'MP_PIXELS' || t === 'MP_TICK' || t.startsWith('MP_SCAN:')) {
                                    self.pyOutputSeen = true;
                                    break;
                                }
                            }
                        } catch { /* sniffing never breaks drain */ }
                    }
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

    /** Guest clock in MHz for _picoemu_set_clock. Opt-in board attr
     *  `tickMHz` (integer 1–250, mirrors the engine web-UI clock
     *  dropdown) wins; otherwise `fallback` when given, else the arch
     *  default (200 RP2040 / 150 RP2350 — toolchain truth: arduino-cli
     *  6.x builds option-less rpipico at 200MHz and rpipico2 at 150MHz
     *  — first `freq` menu item — and the core reconfigures the PLL to
     *  F_CPU at boot (cores/rp2040/main.cpp:92-114), while engine
     *  timing follows ONLY set_clock (cpu.c timing_config), so the
     *  runner must carry the F_CPU rate). Absent/invalid attr leaves
     *  the default untouched. */
    private resolvePicoClockMHz(fallback?: number): number {
        try {
            const v = Number(String(this.tickMHzOpt || '').trim());
            if (Number.isFinite(v) && v >= 1 && v <= 250) return Math.max(1, Math.floor(v));
        } catch { /* fall through to default */ }
        if (typeof fallback === 'number' && Number.isFinite(fallback)) return fallback;
        return this.arch === PICO_ARCH_M0 ? 200 : 150;
    }

    /** Record + apply the guest clock (see resolvePicoClockMHz). The
     *  engine honors it for guest timing: retired cycles convert to
     *  timer/RTC/TIMER1 microseconds via cycles_per_us and SysTick
     *  counts raw cycles (src/cpu.c timing_tick); the PWM readback
     *  derives sysclk from it (src/pwm.c:182); RV32 CLINT re-latches
     *  (src/picoemu_wasm.c picoemu_set_clock). Load-bearing, not
     *  cosmetic: picoemu_init resets the clock to 1MHz (fast-forward
     *  default), so without this call guest timers would run 200x fast
     *  on M0 (150x on M33).
     *  picoClockMHz doubles as the sim-time divisor below. */
    private applyPicoClock(fallback?: number): void {
        try {
            const mhz = this.resolvePicoClockMHz(fallback);
            this.picoClockMHz = mhz;
            try { console.log('[PicoRunner CRUMB] applyPicoClock mhz=', mhz, 'hasSetClock=', typeof this.mod?._picoemu_set_clock); } catch {}
            try { this.mod?._picoemu_set_clock?.(mhz); } catch { /* older builds */ }
        } catch { /* clock never breaks boot */ }
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
            // MicroPython USB-CDC timing is validated at 125MHz (engine
            // harness proof); the generic 150MHz M33 clock leaves the
            // M33 image silent. An explicit tickMHz attr still wins
            // (opt-in), otherwise the validated 125 stands.
            try { this.applyPicoClock(125); } catch { /* ignore */ }
        } catch (e) {
            console.warn('[PicoRunner] MicroPython base UF2 unavailable:', e);
        }
    }

    private startPythonInject(): void {
        // Chunked exec() injection: the REPL line buffer cannot swallow a
        // 1.1KB one-liner (observed: full echo, zero execution), so the
        // script rides sequential short exec('...') lines sharing __main__
        // globals — imports/i2c state persist across them. Cuts only at
        // blank lines or between zero-indent lines, so try/while blocks
        // never split (generated scripts keep blocks blank-free and small).
        // Single Ctrl-C prefix aborts strays; a cut line is a SyntaxError
        // and the next retry retypes cleanly (self-healing).
        try {
            const script = this.pyScript.replace(/\r\n/g, '\n');
            const chunks = chunkExecLines(script, 150);
            this.pyQueue = `\x03${chunks.map((c) => `exec('${c}')\r\n`).join('')}`;
            this.pyQueuePos = 0;
            this.pyOutputSeen = false;
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
        // 1x-real-time per ARCH clock (M0 200 / M33 150 / tickMHz opt-in):
        // same code on different silicon must advance the same virtual ms.
        // A single flat budget made M33 boards lag M0 boards (~84 vs ~109).
        return Math.floor(deltaMs * 1000 * this.resolvePicoClockMHz() * this.speed);
    }

    /** Board steps per microsecond: active guest clock (200 RP2040 /
     *  150 RP2350 / tickMHz opt-in). Same override shape as F1/F4.
     *  NOTE the simCycleCount domain counts _picoemu_step returns, which
     *  are core-0 *instructions*, not cycles (docs/PICOEMU.md:
     *  "Execute up to N instructions; returns count run";
     *  src/picoemu_wasm.c returns `total`, plus WFI fast-forward chunks
     *  counted in cycle units, so the return even mixes units). This
     *  divisor therefore yields instruction-time (≈ cycle-time: modeled
     *  per-instruction costs average ~1 cycle, see cpu.c
     *  timing_instruction_cycles) — the honest available measure.
     *  NO engine-cycle override: _picoemu_cycle_count reads
     *  global_cycle_count, which advances ONLY while the irq-latency
     *  profiler runs (cpu.c:1610-1611 gated on irq_latency_enabled,
     *  default 0 in devtools.c:925; the runner never starts it), so it
     *  is 0 on every M0/M33 run; on RV32 it counts exactly 1/retired
     *  step, i.e. numerically identical to this domain anyway. Base
     *  instruction-time stands — no fabricated clocks. (Ungated-counter
     *  engine ask: vendor/emulator-hook-specs/pico-emu.md P2.) */
    protected override cyclesPerMicrosecond(): number {
        try {
            const m = Math.floor(Number(this.picoClockMHz) || 0);
            if (m >= 1 && m <= 1000) return m;
        } catch { /* fall through */ }
        return this.arch === PICO_ARCH_M0 ? 200 : 150;
    }

    protected maxBudgetPerTick(): number {
        return 2_500_000;
    }
}
