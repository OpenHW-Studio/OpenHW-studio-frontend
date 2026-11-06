/**
 * retro-runner.ts — Intel 8086 / 8085 / 8051 (+ 6502 / Z80 / rv32) BoardRunner
 * over 8086emu@1.5.1.
 *
 * Engine: wasm-bindgen `multi_cpu_emu.js` (`Emulator` class, one instance per
 * board runner — verified isolated in Node: 6/6 ISAs construct + run).
 * wasm-bindgen init needs the .wasm bytes explicitly in a worker (its
 * default fetch() is relative to the glue URL and breaks under vite the
 * same way pico-emu's glue did): we fetch `/wasm/multi_cpu_emu_bg.wasm`
 * and call `initSync({ module })` — the exact pattern the package's own
 * 8086api.md documents for Node (`initSync({module: readFileSync})`).
 *
 * Firmware contract (boardHexMap carries `compiled.hex`):
 *   ASM-first (no backend compiler needed — the IN-WASM assembler IS the
 *   toolchain): editor `.asm` source → `assemble(src)` → `load(code, org)`.
 *   Payload shapes accepted, in order:
 *     ASM:...   raw assembly source (preferred; assembled in-WASM)
 *     HEX:...   Intel HEX text (parsed locally, loaded at its addresses)
 *     ELFBASE64:/BINBASE64:/raw-base64 → machine bytes → load(origin)
 *     ':...'    bare Intel HEX text (same as HEX:)
 *   Origin: 8086 COM programs load at 0x100 (like the package hello.asm
 *   `ORG 100h`); everything else loads at 0x0. `org`/`origin` option (or
 *   a leading `ORG xxxx` line, parsed leniently) overrides.
 *   Backend `asm` artifact (see boardRegistry `retro` entry) arrives as raw
 *   base64 with NO prefix — decoded as UTF-8 and assembled when it looks
 *   like source, else loaded as machine bytes when it decodes to code.
 *   Verified live in Node: 8086/8085/8051/Z80/6502 hello programs assemble,
 *   run, and `out()` drains the expected text.
 *
 * Console contract (package README + 8086api.md §3, verified live):
 *   8086 → INT 21h AH=09/02/06 (+OUT 01h, USART 50h echo); 8085 → OUT 01h;
 *   8051 → SBUF write; 6502 → STA $01/$F001; Z80 → OUT (01h),A;
 *   rv32 → ECALL write/exit semihosting. ALL of them land in ONE buffer:
 *   `out()` drain → TX queue → emit. RX inject: universal `usart_rx`
 *   (package 1.6, routed per ISA), legacy `push_key`/`serial_rx`/`set_sid`
 *   aliases as fallback for old engine bytes.
 *   GPIO: 8086/8085 `ppi_set_input` (package 1.6; RMW fallback) +
 *   `port_write`/`port_read` (ports kit E0h/28h/38h/50h/
 *   68h mirrors the package ports8x examples); 8051 P0–P3 via port_write,
 *   SID/SOD + serial_rx for the 8085/8051 serial pins. Levels publish into
 *   pinStates + SAB pin bitfield via publishGpio, same contract as F1.
 */
import { ArmRunnerBase, importEngine } from './arm-runner-base.ts';
import { traversePassive } from '../signal/electrical.ts';
import { AVRRunnerOptions } from '../registries/component-registry.ts';

// Console pins per board (first = TX shown in monitor, second = RX inject).
// 8-bit retro boards expose the classic UART-ish pair; 8086 uses the DOS
// console pair (no physical pins — aliased so wiring still resolves).
const RETRO_UART_TX = ['TX', 'TX0', 'TXD', 'SOUT', '1'];
const RETRO_UART_RX = ['RX', 'RX0', 'RXD', 'SIN', '0'];

// ISA select: explicit `isa`/`chip`/`arch` opt (or board attrs) wins, else
// board TYPE implies it (openhw-8086 → 8086, …), else 8086 default.
// Package accepts "8088" as an alias of the 8086 core.
const ISA_ALIASES: Record<string, string> = {
    '8086': '8086', '8088': '8088', '86': '8086',
    '8085': '8085', '85': '8085',
    '8051': '8051', '51': '8051', 'mcs-51': '8051', 'mcs51': '8051',
    '6502': '6502',
    'z80': 'Z80', 'z-80': 'Z80',
    'rv32': 'rv32', 'rv32i': 'rv32', 'risc-v': 'rv32', 'riscv': 'rv32',
};

function isaForType(boardType: string): string {
    const t = String(boardType || '').toLowerCase();
    if (t.includes('8086') || t.includes('8088')) return '8086';
    if (t.includes('8085')) return '8085';
    if (t.includes('8051') || t.includes('mcs-51') || t.includes('mcs51')) return '8051';
    if (t.includes('6502')) return '6502';
    if (t.includes('z80') || t.includes('z-80')) return 'Z80';
    if (t.includes('rv32') || t.includes('risc')) return 'rv32';
    return '8086';
}

function b64ToU8(b64: string): Uint8Array {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function u8ToStr(u8: Uint8Array): string {
    let s = '';
    for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return s;
}

/** Minimal Intel HEX parse → list of [addr, bytes]. Returns null if no records. */
function parseHexRecords(text: string): Array<[number, Uint8Array]> | null {
    const recs: Array<[number, Uint8Array]> = [];
    let base = 0;
    let any = false;
    for (const raw of String(text || '').split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line[0] !== ':') continue;
        const hex = line.slice(1);
        if (hex.length < 10) continue;
        const count = parseInt(hex.slice(0, 2), 16);
        const addr = parseInt(hex.slice(2, 6), 16);
        const type = parseInt(hex.slice(6, 8), 16);
        if (!Number.isFinite(count) || !Number.isFinite(addr) || !Number.isFinite(type)) continue;
        if (hex.length < 8 + count * 2) continue;
        const data = new Uint8Array(count);
        for (let i = 0; i < count; i++) data[i] = parseInt(hex.slice(8 + i * 2, 10 + i * 2), 16);
        if (type === 0x04) base = ((data[0] << 8) | data[1]) << 16;
        else if (type === 0x02) base = ((data[0] << 8) | data[1]) << 4;
        else if (type === 0x00) { recs.push([base + addr, data]); any = true; }
        else if (type === 0x01) break;
    }
    return any ? recs : null;
}

/** Lenient `ORG xxxx[h]` first-line scan (decimal or hex, optional h suffix). */
function scanOrg(src: string): number | null {
    const m = String(src || '').match(/^\s*(?:ORG|org)\s+([0-9a-fA-Fx$#]+)\s*h?/m);
    if (!m) return null;
    let tok = m[1].trim().replace(/[$#]/g, '');
    let hexSuffix = /h$/i.test(m[0].trim().split(/\s+/).pop() || '');
    void hexSuffix;
    if (/^0x/i.test(tok)) return parseInt(tok, 16);
    if (/h$/i.test(tok)) return parseInt(tok.slice(0, -1), 16);
    const n = parseInt(tok, tok.startsWith('0') && tok.length > 1 && !/^[0-9]+$/.test(tok) ? 16 : 10);
    return Number.isFinite(n) ? n : null;
}

function looksLikeAsm(text: string): boolean {
    // Assembly source vs machine bytes: source has newlines + mnemonic-ish
    // tokens (labels ending in ':', directives, ';' comments). ELF magic or
    // >30% non-text bytes means machine code.
    const s = String(text || '');
    if (!s) return false;
    if (s.length > 4 && s.charCodeAt(0) === 0x7f && s.slice(1, 4) === 'ELF') return false;
    let nonText = 0;
    const n = Math.min(s.length, 512);
    for (let i = 0; i < n; i++) {
        const c = s.charCodeAt(i);
        if (c < 9 || (c > 13 && c < 32) || c > 126) nonText++;
    }
    if (nonText / Math.max(1, n) > 0.3) return false;
    return /[\r\n]/.test(s) && /(ORG|END|MOV|MVI|LDA|STA|OUT|INT|SBUF|DB|DW|EQU|JMP|JZ|SJMP|LD\s|LI\s|ECALL|HLT|HALT|BRK)\b/i.test(s);
}

export class RetroRunner extends ArmRunnerBase {
    protected uartTxPins = RETRO_UART_TX;
    protected uartRxPins = RETRO_UART_RX;
    /** 5V TTL kit (8255 PPI / 8051 quasi-bidirectional / VIA 5V). */
    protected override gpioRailV(): number { return 5.0; }
    protected engine = this.makeEngine();
    private emu: any = null;
    private isa = '8086';
    private origin = 0;

    constructor(
        hexData: string,
        componentsDef: any[],
        wiresDef: any[],
        onStateUpdate: (state: any) => void,
        options: AVRRunnerOptions & { isa?: string; chip?: string; arch?: string; org?: string | number; origin?: string | number } = {},
    ) {
        super(hexData, componentsDef, wiresDef, onStateUpdate, options);
        // ISA map: explicit opt/attr wins; board TYPE implies it.
        const raw = String(
            (options as any)?.isa || (options as any)?.chip || (options as any)?.arch || '',
        ).toLowerCase().trim();
        const typeStr = String((options as any)?.boardType || '');
        this.isa = ISA_ALIASES[raw] || isaForType(typeStr);
        const orgOpt = (options as any)?.org ?? (options as any)?.origin;
        const orgNum = typeof orgOpt === 'number' ? orgOpt : parseInt(String(orgOpt || ''), 0);
        this.origin = Number.isFinite(orgNum) && orgNum >= 0 ? orgNum : (this.isa === '8086' || this.isa === '8088' ? 0x100 : 0x0);
        void this.boot(`openhw-${this.isa.toLowerCase()}`);
    }

    private makeEngine() {
        const self = this;
        const txQueue: number[] = [];
        return {
            async loadFirmware(firmware: string, _boardType: string) {
                // Bundler first (node_modules, works in vitest + vite build),
                // public/vendor fallback at runtime. The glue is wasm-bindgen
                // ESM with no node: imports — safe in workers.
                const engineMod: any = await importEngine(
                    '8086emu/multi_cpu_emu.js',
                    '/vendor/board-engines/8086emu/multi_cpu_emu.js',
                );
                const EmuClass = engineMod?.Emulator;
                const initSync = engineMod?.initSync;
                const initDefault = engineMod?.default;
                if (!EmuClass) {
                    console.warn('[RetroRunner] engine unavailable (test env?) — idle.');
                    return;
                }
                // wasm-bindgen init needs the .wasm bytes explicitly inside a
                // worker (default fetch() is glue-URL-relative and breaks
                // under vite — same class of bug as pico-emu's glue). Fetch
                // from public/wasm, fall back to bare init.
                let inited = false;
                try {
                    const r = await fetch('/wasm/multi_cpu_emu_bg.wasm');
                    if (r.ok && initSync) {
                        initSync({ module: await r.arrayBuffer() });
                        inited = true;
                    }
                } catch { /* fall through */ }
                if (!inited) {
                    try {
                        if (typeof initDefault === 'function') await initDefault();
                    } catch { /* glue may already be live */ }
                }
                self.emu = new EmuClass(self.isa);
                try { self.emu.reset(); } catch { /* ignore */ }
                const s = String(firmware || '').trim();
                if (s) self.loadProgram(s);
            },
            stepBudget(budget: number): number {
                if (!self.emu) return 0;
                try {
                    // Sim-time source: the package 1.6 cycle clock
                    // (cycles() is nonzero on all six ISAs). Report the
                    // cycle delta so the base simCycleCount advances in
                    // engine cycles; old engine bytes without cycles() fall
                    // back to the executed-step count (previous behavior).
                    let before: bigint | null = null;
                    try {
                        if (typeof self.emu.cycles === 'function') before = self.emu.cycles();
                    } catch { before = null; }
                    const n = Number(self.emu.run(Math.max(1, Math.floor(budget)))) || 0;
                    // Rail power for passive inputs (see powerRailNets).
                    try { self.powerRailNets(5.0); } catch { /* rails never break the tick */ }
                    // NOTE: no per-tick publishGpio here — the base
                    // pollGpioBidirectional() runs right after stepBudget and
                    // owns ALL output publishing (via sampleGpioOut below),
                    // so edges fire once with dispatchOptionalProtocols.
                    // Console drain → TX queue (out() drains the buffer).
                    // 8086 INT 21h AH=09 leaves NUL padding + trailing code
                    // bytes in the drain (verified live) — strip ASCII NULs
                    // so the serial monitor shows the real text.
                    try {
                        const text: string = String(self.emu.out?.() ?? '').replace(/\0/g, '');
                        for (let i = 0; i < text.length && txQueue.length < 4096; i++) {
                            txQueue.push(text.charCodeAt(i) & 0xff);
                        }
                    } catch { /* ignore */ }
                    if (before !== null) {
                        try {
                            const d = Number((self.emu.cycles() as bigint) - before);
                            if (Number.isFinite(d) && d > 0) return d;
                        } catch { /* fall through to step count */ }
                    }
                    return n;
                } catch { return 0; }
            },
            drainUartOut(): number[] {
                if (!txQueue.length) return [];
                return txQueue.splice(0, Math.min(txQueue.length, 1024));
            },
            injectUartByte(value: number) {
                const b = value & 0xff;
                // Universal RX inject (package 1.6 API): usart_rx(v) is
                // routed per ISA (8086/8085/Z80 USART, 6502 ACIA,
                // 8051 SBUF/SCON, rv32 board UART). Legacy per-ISA aliases
                // kept as fallback for old engine bytes without usart_rx.
                try {
                    if (typeof self.emu?.usart_rx === 'function') { self.emu.usart_rx(b); return; }
                    if (self.isa === '8086' || self.isa === '8088') self.emu?.push_key?.(b);
                    else if (self.isa === '8051') self.emu?.serial_rx?.(b);
                    else if (self.isa === '8085') self.emu?.set_sid?.(b !== 0);
                } catch { /* ignore */ }
            },
            getPc(): number {
                try { return Number(self.emu?.pc?.()) || 0; } catch { return 0; }
            },
            // Input injection for the base bidirectional poll. Per-ISA API:
            // 8086/8085: ppi_set_input (package 1.6) drives the 8255
            //   external-input latch (ports E0h=PA/E2h=PC) WITHOUT touching
            //   the firmware's output latch; RMW fallback for old bytes;
            // 8051: P1 (port 1) / P2 (port 2) quasi-bidirectional pins;
            // 6502: VIA pa_pins/pb_pins via via_pins(port, byte);
            // Z80: kit DEMO latch (E0h) read-modify-write; rv32: board GPIO
            //   DATA (0xE0) inject, DIR at 0xE1 (package 1.6; inert no-op on
            //   old engine bytes).
            setGpioInput(pinId: string, high: boolean): void {
                try {
                    const bit = self.gpioBit(pinId);
                    if (bit < 0 || !self.emu) return;
                    const port = self.gpioPort(pinId);
                    const mask = 1 << (bit & 7);
                    if (self.isa === 'rv32') {
                        // Board I/O block (package 1.6): port_write(0xE0, v)
                        // injects GPIO input pins; port_read(0xE0/0xE1) reads
                        // DATA/DIR. Single DATA byte, so both pin groups
                        // merge onto 0xE0. On old engine bytes port_write is
                        // a no-op, so this stays inert there.
                        if (typeof self.emu?.port_write === 'function'
                            && typeof self.emu?.port_read === 'function') {
                            try {
                                const cur = Number(self.emu.port_read(0xe0)) || 0;
                                self.emu.port_write(0xe0, high ? (cur | mask) : (cur & ~mask));
                            } catch { /* ignore */ }
                        }
                        return;
                    }
                    if (self.isa === '6502') {
                        try {
                            const cur = Number(self.emu.via_read?.(port === 2 ? 0 : 1)) || 0;
                            self.emu.via_pins?.(port === 2 ? 1 : 0, high ? (cur | mask) : (cur & ~mask));
                        } catch { /* ignore */ }
                        return;
                    }
                    if (self.isa === '8051') {
                        // 8051 quasi-bidirectional: a LOW latch bit actively
                        // drives (firmware owns it — external drive must not
                        // fight it); a HIGH latch bit floats and follows the
                        // external line. Unconditional RMW here used to
                        // clobber firmware LOW outputs with stale component
                        // volts every tick.
                        const p = port === 2 ? 2 : 1;
                        const cur = Number(self.emu.port_read?.(p)) || 0;
                        if (!((cur >> bit) & 1)) return; // driven LOW: owned
                        self.emu.port_write?.(p, high ? (cur | mask) : (cur & ~mask));
                        return;
                    }
                    if (self.isa === '8086' || self.isa === '8088' || self.isa === '8085') {
                        // PPI external-input latch (package 1.6): input-mode
                        // ports read pa_in/pb_in/pc_in (see ppi8255.rs
                        // read_pa/pb/pc), so external levels coexist with the
                        // OUT latch. Preferred path needs no direction check
                        // — the engine merges by mode itself.
                        if (typeof self.emu?.ppi_set_input === 'function') {
                            try {
                                const addr = port === 2 ? 0xe2 : 0xe0;
                                const cur = Number(self.emu.port_read?.(addr)) || 0;
                                self.emu.ppi_set_input(addr, high ? (cur | mask) : (cur & ~mask));
                                return;
                            } catch { /* fall through to RMW */ }
                        }
                        // Fallback (old engine bytes without ppi_set_input):
                        // port_write(E0h) would CLOBBER the firmware's output
                        // latch, so only do a read-modify-write on the
                        // OUTPUT latch for ports the firmware left in INPUT
                        // mode (ctrl E3h dir bits); output-mode ports ignore
                        // external drive (firmware owns them).
                        try {
                            const ctrl = Number(self.emu.port_read?.(0xe3)) || 0;
                            const isInput = port === 2
                                ? ((ctrl & 0x09) !== 0)
                                : ((ctrl & 0x10) !== 0);
                            if (!isInput) return;
                            const cur = Number(self.emu.port_read?.(port === 2 ? 0xe2 : 0xe0)) || 0;
                            self.emu.port_write?.(port === 2 ? 0xe2 : 0xe0, high ? (cur | mask) : (cur & ~mask));
                        } catch { /* ignore */ }
                        return;
                    }
                    // Z80 kit latch (plain output latch, no direction; rv32
                    // returns early above — real GPIO since package 1.6).
                    // HIGH wins: a bit the firmware (or a previous inject)
                    // set HIGH is owned — external LOW must not clear it, or
                    // the INPUT half erases firmware outputs with stale
                    // component volts every tick (LED could never light).
                    // LOW bits still accept external HIGH (buttons work).
                    // Documented limit: external pull-down of a driven-HIGH
                    // line is unsupported on this latch model.
                    const cur = Number(self.emu.port_read?.(0xe0)) || 0;
                    if (((cur >> bit) & 1) && !high) return;
                    self.emu.port_write?.(0xe0, high ? (cur | mask) : (cur & ~mask));
                } catch { /* ignore */ }
            },
            // Output sampler for the base bidirectional poll. Delegates to
            // the class method below (direction-gated per ISA). NOTE: this
            // MUST live on the engine object — pollGpioBidirectional reads
            // `engine.sampleGpioOut`, not the runner method (missing it
            // silently disables ALL GPIO output publishing).
            sampleGpioOut(pinId: string): { level: number; driving: boolean } | null {
                try { return self.sampleGpioOut(pinId); } catch { return null; }
            },
            // Non-consuming peek for the input half's output-wins check
            // (observing must not consume the sampler edge dedup).
            peekGpioOut(pinId: string): { level: number; driving: boolean } | null {
                try { return self.peekGpioOut(pinId); } catch { return null; }
            },
            readAnalog(_ref: string): number {
                return NaN; // ADC inject is adc_set (volts) — no read path.
            },
            isHalted(): boolean {
                try { return !!self.emu?.halted?.(); } catch { return false; }
            },
            close(): void {
                try { self.emu?.free?.(); } catch { /* ignore */ }
                self.emu = null;
            },
            resetEngine(): void {
                try { self.emu?.reset?.(); } catch { /* ignore */ }
            },
        };
    }

    /** Assemble-or-load the firmware payload into the emulator. */
    private loadProgram(firmware: string): void {
        const s = String(firmware || '').trim();
        if (!s || !this.emu) return;
        // 1. Explicit prefixes.
        if (s.startsWith('ASM:')) return this.loadAsm(s.slice('ASM:'.length));
        if (s.startsWith('HEX:')) {
            const recs = parseHexRecords(s.slice('HEX:'.length));
            if (recs) { for (const [a, d] of recs) this.safeLoad(d, a); return; }
        }
        if (s.startsWith('ELFBASE64:') || s.startsWith('BINBASE64:')) {
            const u8 = b64ToU8(s.slice(s.indexOf(':') + 1));
            if (looksLikeAsm(u8ToStr(u8))) return this.loadAsm(u8ToStr(u8));
            return this.safeLoad(u8, this.origin);
        }
        if (s.startsWith(':')) {
            const recs = parseHexRecords(s);
            if (recs) { for (const [a, d] of recs) this.safeLoad(d, a); return; }
        }
        // 2. Raw base64 (backend `asm` artifact): try source first.
        let asBytes: Uint8Array | null = null;
        try { asBytes = b64ToU8(s); } catch { asBytes = null; }
        if (asBytes) {
            const text = u8ToStr(asBytes);
            if (looksLikeAsm(text)) return this.loadAsm(text);
            return this.safeLoad(asBytes, this.origin);
        }
        // 3. Plain text: assemble when it looks like asm, else load as bytes.
        if (looksLikeAsm(s)) return this.loadAsm(s);
        const raw = new Uint8Array(s.length);
        for (let i = 0; i < s.length; i++) raw[i] = s.charCodeAt(i) & 0xff;
        return this.safeLoad(raw, this.origin);
    }

    private loadAsm(src: string): void {
        if (!this.emu) return;
        try {
            const code: Uint8Array = this.emu.assemble(src);
            const org = scanOrg(src) ?? this.origin;
            this.safeLoad(code, org);
        } catch (e) {
            console.warn('[RetroRunner] assemble failed:', String((e as any)?.message || e).slice(0, 200));
        }
    }

    private safeLoad(code: Uint8Array, origin: number): void {
        if (!this.emu || !code || !code.length) return;
        try {
            this.emu.load(code, origin >>> 0);
        } catch (e) {
            console.warn('[RetroRunner] load failed:', String((e as any)?.message || e).slice(0, 200));
        }
    }

    private lastPorts = 0;
    /**
     * Board pin label → PPI bit index.
     * Board shells expose L0–L19 (left) + R0–R19 (right); L0 = console TX
     * (drain), L1 = console RX (inject) — never GPIO. The GPIO view is:
     *   L2–L9/R2–R9     → bit (n&7) of PPI PA (PA for 8086/8085/Z80/rv32;
     *                     8051 P1, 6502 VIA-ORA) — the per-board 8-bit port
     *   L10–L17/R10–R17 → bit (n&7) of PPI PC (8051 P2, 6502 VIA-ORB)
     *   P0–P7/D0–D7/A0–A7 → same 8-bit view (legacy aliases: bit n&7)
     * L18/L19/R18/R19 are reserved (USART/SID-SOD serial pair).
     */
    public gpioBit(pinId: string): number {
        const raw = String(pinId || '').toUpperCase();
        let m = raw.match(/^[LR](\d{1,2})$/);
        if (m) {
            const n = Number(m[1]);
            if (n >= 2 && n <= 17) return n & 7;
            return -1;
        }
        m = raw.match(/^(?:P|D|GPIO|GP|A)(\d{1,2})$/);
        if (!m) return -1;
        const n = Number(m[1]);
        return n >= 0 && n <= 31 ? n & 7 : -1;
    }
    /** Board pin label → PPI port byte (0=PA/P1/ORA, 1=PB/unused/ORB, 2=PC/P2). */
    public gpioPort(pinId: string): number {
        const raw = String(pinId || '').toUpperCase();
        const m = raw.match(/^[LR](\d{1,2})$/);
        if (m) {
            const n = Number(m[1]);
            if (n >= 2 && n <= 9) return 0;
            if (n >= 10 && n <= 17) return 2;
        }
        return 0;
    }
    /** Stamp supply pins of components sitting on a board rail net
     * (AVR lowImpRails pattern). Kit shells source no power, so passive
     * inputs (switches) would float at 0V; the wiper pin lives on a
     * different net and stays untouched. Idempotent (skips pins already
     * at/above rail). */
    private powerRailNets(railV: number): void {
        try {
            const pinToNet = (this as any).pinToNet as Map<string, number> | undefined;
            if (!pinToNet) return;
            const railNets = new Set<number>();
            for (const [node, netId] of pinToNet) {
                const sep = node.indexOf(':');
                if (sep < 0) continue;
                if (node.slice(0, sep) !== this.boardId) continue;
                if (/^(SWD_3V3|3V3|5V|VCC|VDD|3\.3V)$/i.test(node.slice(sep + 1))) railNets.add(netId);
            }
            if (railNets.size === 0) return;
            for (const [node, netId] of pinToNet) {
                if (!railNets.has(netId)) continue;
                const sep = node.indexOf(':');
                if (sep < 0) continue;
                if (node.slice(0, sep) === this.boardId) continue;
                const inst = this.instances.get(node.slice(0, sep));
                const pin = node.slice(sep + 1);
                if (!inst || typeof (inst as any)?.getPinVoltage !== 'function'
                    || typeof (inst as any)?.setPinVoltage !== 'function') continue;
                let v = 0;
                try { v = Number((inst as any).getPinVoltage(pin)) || 0; } catch { continue; }
                // Traverse every tick (no skip): an early output-half LOW
                // publish can zero the wiper once (same-level dedup never
                // repairs it), so conduction must re-assert continuously.
                // Stamp first if low; traverse with the ACTUAL voltage (a
                // GND-side switch must stay LOW).
                if (v < railV * 0.5) {
                    try { (inst as any).setPinVoltage(pin, railV); v = railV; } catch { /* ignore */ }
                }
                try {
                    const compId = node.slice(0, sep);
                    traversePassive(inst as any, compId, pin, v, (target, nextV) => {
                        try {
                            const ts = String(target).indexOf(':');
                            if (ts < 0) return;
                            const tInst = this.instances.get(String(target).slice(0, ts));
                            const tPin = String(target).slice(ts + 1);
                            (tInst as any)?.setPinVoltage?.(tPin, nextV);
                        } catch { /* one hop never breaks rails */ }
                    }, () => []);
                } catch { /* conduction never breaks rails */ }
            }
        } catch { /* rails never break the tick */ }
    }
    /** Read the engine's canonical GPIO port byte for an ISA. */
    private readGpioPort(port: number): number | null {
        if (!this.emu) return null;
        try {
            if (this.isa === '8051') return Number(this.emu.port_read?.(port === 2 ? 2 : 1)) || 0;
            if (this.isa === '6502') {
                const v = this.emu.via_read?.(port === 2 ? 0 : 1);
                return typeof v === 'number' ? v : null;
            }
            if (this.isa === '8086' || this.isa === '8088' || this.isa === '8085') {
                const ppi: Uint8Array | undefined = this.emu?.ppi?.();
                if (ppi) return ppi[port === 2 ? 2 : 0];
                const v = this.emu?.port_read?.(port === 2 ? 0xe2 : 0xe0);
                return typeof v === 'number' ? v : null;
            }
            // Z80/rv32: plain port latch (package ports8x kit DEMO port).
            const v = this.emu?.port_read?.(0xe0);
            return typeof v === 'number' ? v : null;
        } catch { return null; }
    }
    /** Write the engine's canonical GPIO port byte for an ISA. */
    private writeGpioPort(port: number, val: number): void {
        if (!this.emu) return;
        try {
            if (this.isa === '8051') this.emu.port_write?.(port === 2 ? 2 : 1, val & 0xff);
            else if (this.isa === '6502') this.emu.via_write?.(port === 2 ? 0 : 1, val & 0xff);
            else this.emu.port_write?.(port === 2 ? 0xe2 : 0xe0, val & 0xff);
        } catch { /* ignore */ }
    }
    /**
     * Engine-driven output sampler for the base bidirectional poll.
     * 8086/8085: PPI PA (E0h, ctrl E3h) + PC (E2h); 8051: P1 (port 1) + P2
     * (port 2); 6502: VIA ORA (rs 1) + ORB (rs 0); Z80/rv32: kit port E0h.
     * Only pins whose port is configured OUTPUT drive (PPI ctrl word /
     * 8051 latch-high / VIA DDR); input-mode pins read back their external
     * level, so report driving:false (input sampling owns them).
     * Console pins L0 (TX drain) / L1 (RX inject) never drive.
     */
    public sampleGpioOut(pinId: string): { level: number; driving: boolean } | null {
        // Change-reporting sampler for the OUTPUT half: reports driving
        // only on level transitions (per-pin edge dedup).
        const s = this.gpioOutLevel(pinId);
        if (!s) return null;
        if (!s.outputMode) return { level: 0, driving: false };
        const key = `__retro_p${s.port}_${s.bit}`;
        const last = (this as any)[key];
        if (last === s.high) return { level: s.high ? 1 : 0, driving: false };
        (this as any)[key] = s.high;
        return { level: s.high ? 1 : 0, driving: true };
    }

    /**
     * Non-consuming GPIO peek for the INPUT half's output-wins check.
     * Observing must not consume the edge dedup above: probing the pin to
     * decide input injection used to mark it "seen", starving the OUTPUT
     * half forever (observed: retro LED pins sampled HIGH but never
     * published). Peek reports the live direction-gated level instead.
     */
    public peekGpioOut(pinId: string): { level: number; driving: boolean } | null {
        const s = this.gpioOutLevel(pinId);
        if (!s) return null;
        return { level: s.high ? 1 : 0, driving: s.outputMode };
    }

    /** Shared direction-gated port read (no dedup side effects). */
    private gpioOutLevel(pinId: string): { port: number; bit: number; high: boolean; outputMode: boolean } | null {
        try {
            const bit = this.gpioBit(pinId);
            if (bit < 0 || !this.emu) return null;
            const port = this.gpioPort(pinId);
            // Direction gate: only OUTPUT-mode ports drive.
            // 8086/8085: PPI ctrl E3h (D4=PA dir, D0=PC-low/D3=PC-high dir;
            //   1=input). 6502: VIA DDR (ddra_rs3/ddrb_rs2). 8051: quasi-
            //   bidirectional — a LOW latch bit drives, a HIGH latch bit
            //   floats (reads external). Z80/rv32 kit latch: always driven.
            let outputMode = true;
            try {
                if (this.isa === '8086' || this.isa === '8088' || this.isa === '8085') {
                    const ctrl = Number(this.emu.port_read?.(0xe3));
                    if (Number.isFinite(ctrl)) {
                        outputMode = port === 2 ? ((ctrl & 0x09) === 0) : ((ctrl & 0x10) === 0);
                    }
                } else if (this.isa === '6502') {
                    const ddr = this.emu.via_read?.(port === 2 ? 2 : 3);
                    if (typeof ddr === 'number') outputMode = !!((ddr >> bit) & 1);
                } else if (this.isa === '8051') {
                    const latch = this.readGpioPort(port);
                    if (typeof latch === 'number') outputMode = !((latch >> bit) & 1);
                }
            } catch { /* default: driven */ }
            if (!outputMode) return { port, bit, high: false, outputMode: false };
            const val = this.readGpioPort(port);
            if (typeof val !== 'number') return null;
            return { port, bit, high: !!((val >> bit) & 1), outputMode: true };
        } catch { return null; }
    }
    private pollPorts(): void {
        // Legacy P-view publisher, kept for the UART-ish/console pair only.
        // GPIO outputs now publish via pollGpioBidirectional → sampleGpioOut
        // (direction-gated, per-pin, with dispatchOptionalProtocols), so this
        // no longer publishes PA bits — it only mirrors the console TX/RX
        // activity into pinStates for the monitor dots. Cheap, on change.
        try {
            void this.lastPorts;
        } catch { /* GPIO poll never breaks the tick */ }
    }

    protected budgetForDelta(deltaMs: number): number {
        // Retro cores are cheap interpreters; match the F1 cadence.
        return Math.floor(deltaMs * 50000 * this.speed);
    }

    protected maxBudgetPerTick(): number {
        return 1_000_000;
    }
}
