/**
 * stm32f4-runner.ts — STM32F407 Discovery BoardRunner over stm32f4-emu@1.5.0.
 *
 * Engine: `STM32F4` facade via the package entry (`index.mjs`, which injects
 * SVD + WASM bindings — direct `site/stm32f4.js` import throws). One instance
 * per board runner (verified isolated).
 *
 * Firmware contract (boardHexMap carries `compiled.hex`):
 *   Arduino `.bin` → backend `bin` artifact = `<sketch>.ino.bin` (raw app
 *   image), raw base64 → fromBin. Verified live 2026-10-03 on ALL F4 boards
 *   (Disco F407VG + F401 + F429 serial needles green): uartAddr per board
 *   (Disco USART2 0x40004400, others USART1) + enable_irqs:true, matching
 *   the package's own site/test_arduino_boards.mjs harness.
 * `chip` option selects the F401/F411/F407/F407VE/F429 table (default
 *   stm32f407 Discovery; board TYPE implies the chip when the opt is absent).
 *   Per-chip LEDs follow the package BOARD_LED map (401/411→PC13,
 *   407→PD12, 407ve→PA6, 429→PG13); per-chip SVD is fetched from
 *   public/vendor (vendored this change).
 *
 * UART: TX capture is GLOBAL in the package (get_uart_output → usart1._emit
 * regardless of port — verified: usart2.onData never fires, usart1.onData
 * carries Disco USART2 bytes). RX inject targets the board's own port
 * (usart2.send on Disco F407, usart1.send elsewhere) via uart_addr.
 * GPIO: `gpio.pin()`.
 */
import { ArmRunnerBase, importEngine } from './arm-runner-base.ts';
import { AVRRunnerOptions } from '../registries/component-registry.ts';
import {
  collectI2CSlaveAddresses,
  createI2CBridge,
  createSPIBridge,
  levelPassiveNets,
  type I2CBridge,
  type SPIBridge,
} from '../bus-bridge.ts';

// F4 UART map (package docs/boards/*.md + site/test_arduino_boards.mjs):
// Arduino `Serial` follows the core variant files per board —
//   BlackPill F401/F411 + Black F407VE/ZE + F429-Disco → USART1 (PA9/PA10)
//   Nucleo F401RE/F411RE + Disco F407VG                 → USART2 (PA2/PA3)
// TX capture is GLOBAL (get_uart_output → usart1._emit, package model
// limit), so the monitor hook stays usart1.onData on ALL boards; RX inject
// must target the board's own USART base (usart2.send on Disco, else
// usart1.send). USART bases are SVD-verified in the package.
const F4_UART_TX = ['PA9', 'A9', 'TX', 'TX0', 'TX1'];
const F4_UART_RX = ['PA10', 'A10', 'RX', 'RX0', 'RX1'];
const F4_UART2_TX = ['PA2', 'A2', 'TX2'];
const F4_UART2_RX = ['PA3', 'A3', 'RX2'];

// Board LED map (package site/boards.js BOARD_LED — matches emulator shells):
//   stm32f401/stm32f411 → PC13, stm32f407 → PD12, stm32f407ve → PA6,
//   stm32f429 → PG13.
function f4SerialUsart(chip: string): 1 | 2 {
    // Only the plain-Discovery F407 build uses USART2; every other F4
    // board (F401/F411/F407VE/F429) uses USART1.
    return String(chip || '').toLowerCase() === 'stm32f407' ? 2 : 1;
}

function f4LedFor(chip: string): { bank: string; pin: number } {
    const c = String(chip || '').toLowerCase();
    if (c.includes('429')) return { bank: 'G', pin: 13 };
    if (c.includes('407ve') || c.includes('407ze')) return { bank: 'A', pin: 6 };
    if (c.includes('401') || c.includes('411')) return { bank: 'C', pin: 13 };
    return { bank: 'D', pin: 12 };
}

// Board type → package chip key (explicit `chip` opt/attr always wins).
// Matches the 4 new emulator shells + legacy openhw-stm32f4 (F407 default).
function f4ChipForType(boardType: string): string {
    const t = String(boardType || '').toLowerCase();
    if (t.includes('429')) return 'stm32f429';
    if (t.includes('407ve') || t.includes('407ze') || t.includes('f407ve')) return 'stm32f407ve';
    if (t.includes('401')) return 'stm32f401';
    if (t.includes('411')) return 'stm32f411';
    if (t.includes('407')) return 'stm32f407';
    return 'stm32f407';
}

// Package SVD asset per chip (vendored under public/vendor + public root).
function f4SvdFor(chip: string): string {
    const c = String(chip || '').toLowerCase();
    if (c.includes('401')) return 'stm32f401.svd';
    if (c.includes('411')) return 'stm32f411.svd';
    if (c.includes('429')) return 'stm32f429.svd';
    return 'stm32f407.svd'; // f407 + f407ve share the F407 SVD
}

// DCMI cell pattern: 4x4 grayscale bytes 0x10..0x1F (all nonzero so
// every pixel lights the sink; sum 0x178 is the guest-side needle).
function f4DcmiPattern(): Uint8Array {
    const out = new Uint8Array(16);
    for (let i = 0; i < 16; i++) out[i] = 0x10 + i;
    return out;
}

// QSPI cell image: 32x16 RGB565 gradient, R5=x, G6=y*4, B5=x+y.
// Regenerated identically for bind + verify + sink push.
function f4QspiImage(): Uint8Array {
    const W = 32, H = 16;
    const out = new Uint8Array(W * H * 2);
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const v = (((x & 0x1f) << 11) | (((y * 4) & 0x3f) << 5) | ((x + y) & 0x1f)) & 0xffff;
            out[(y * W + x) * 2] = v & 0xff;
            out[(y * W + x) * 2 + 1] = (v >> 8) & 0xff;
        }
    }
    return out;
}

function f4Rgb565ToPacked(lo: number, hi: number): number {
    const v = ((lo & 0xff) | ((hi & 0xff) << 8)) & 0xffff;
    const r5 = (v >> 11) & 0x1f, g6 = (v >> 5) & 0x3f, b5 = v & 0x1f;
    return ((((r5 << 3) | (r5 >> 2)) << 16) | (((g6 << 2) | (g6 >> 4)) << 8) | ((b5 << 3) | (b5 >> 2))) >>> 0;
}

function b64ToU8(b64: string): Uint8Array {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

export class Stm32f4Runner extends ArmRunnerBase {
    // UART pin candidates depend on the board's Serial USART: Disco F407
    // wires PA2/PA3 (USART2) as the monitor pair, all other F4 boards use
    // PA9/PA10 (USART1). Set per instance in the constructor below.
    protected uartTxPins: string[] = F4_UART_TX;
    protected uartRxPins: string[] = F4_UART_RX;
    protected engine = this.makeEngine();
    private mcu: any = null;
    private chip = 'stm32f407';
    private compAttrById: Map<string, any> = new Map();

    /** Generic slave address of one instance (same chain as the collector). */
    private busAddrOf(inst: any): number {
        try {
            const id = String(inst?.id || '');
            const attrs = this.compAttrById.get(id) || {};
            const cands = [
                inst?.i2cAddr,
                typeof inst?.getI2CAddress === 'function' ? inst.getI2CAddress() : NaN,
                attrs?.address, attrs?.i2cAddress, attrs?.addr,
            ];
            for (const c of cands) {
                const v = Number(c);
                if (Number.isFinite(v)) return v & 0x7f;
            }
        } catch { /* ignore */ }
        return -1;
    }

    /** Snapshot component attrs for generic bus address resolution. */
    private snapshotCompAttrs(componentsDef: any[]): void {        try {
            const defs = Array.isArray(componentsDef) ? componentsDef : [];
            this.compAttrById = new Map();
            for (const c of defs) {
                if (c && c.id !== undefined) this.compAttrById.set(String(c.id), c.attrs || {});
            }
        } catch { /* snapshot never breaks construction */ }
    }

    /** Build F4 I2C/SPI device specs into withAssets (called pre-create). */
    private buildBusSpecs(withAssets: any): void {
        const bridgeCtx = {
            boardId: this.boardId,
            onStateUpdate: (msg: any) => { try { this.onStateUpdate(msg); } catch { /* ignore */ } },
            getSimTimeMs: () => { try { return this.getSimulatedTimeMs(); } catch { return 0; } },
            instances: this.instances,
            compAttrById: this.compAttrById,
            pinToNet: this.pinToNet,
            boardPinLevel: (pin: string) => {
                try {
                    const v = (this.pinStates as any)?.[pin];
                    return typeof v === 'boolean' ? v : null;
                } catch { return null; }
            },
        };
        const addrs = collectI2CSlaveAddresses(bridgeCtx);
        if (addrs.length > 0) {
            const br = createI2CBridge(bridgeCtx);
            withAssets.i2c = addrs.slice(0, 8).map((a) => ({
                peripheral: 'I2C1',
                address: a,
                onStart: () => { try { br.start(a, false); } catch { /* ignore */ } },
                onWrite: (b: number) => { try { br.write(Number(b) & 0xff); } catch { /* ignore */ } },
                onRead: () => { try { return [br.read() & 0xff]; } catch { return [0xff]; } },
                onStop: () => { try { br.stop(); } catch { /* ignore */ } },
            }));
            // Virtual slaves (bus progress): the core stalls transactions
            // with no device attached, so attach the package's own devices
            // at the owned addresses — OLED pairs get oled, everything else
            // a regfile ACK-sink. Observer specs above feed the real
            // component models (AVR-adapter pattern, zero patches).
            try {
                const oled = addrs.filter((a) => {
                    for (const inst of this.instances.values()) {
                        const t = String((inst as any)?.type || '').toLowerCase();
                        if ((t.includes('ssd1306') || t.includes('oled')) && this.busAddrOf(inst) === a) return true;
                    }
                    return false;
                });
                const sinks = addrs.filter((a) => !oled.includes(a));
                const ext = (withAssets.ext_devices && typeof withAssets.ext_devices === 'object')
                    ? withAssets.ext_devices : {};
                if (oled.length > 0) {
                    ext.oled = { i2c: 'I2C1', addr: oled[0] };
                }
                if (sinks.length > 0) {
                    ext.regfile = sinks.slice(0, 4).map((address) => ({
                        peripheral: 'I2C1', address, size: 256, init: [],
                    }));
                }
                withAssets.ext_devices = ext;
            } catch { /* devices never break boot */ }
        }
        let hasSpi = false;
        try {
            for (const inst of this.instances.values()) {
                if (typeof (inst as any)?.onSPIByte === 'function'
                    || typeof (inst as any)?.onSPIByteExchange === 'function') { hasSpi = true; break; }
            }
        } catch { /* ignore */ }
        // SD card in SPI mode: the engine answers synchronously via its
        // model-side device (ext_devices.spi_sd — the JS tap round-trip is
        // structurally one transfer late for CMD17 block reads). Attach the
        // model here (taps snapshot at init) and suppress the JS-side MISO
        // reply below (the bridge still feeds the component model so its
        // telemetry stays live; its bytes never reach the wire).
        // 16384 blocks = 8MB so CSD capacity decodes valid for SdFat init.
        try {
            for (const inst of this.instances.values()) {
                const t = String((inst as any)?.type || '').toLowerCase();
                if (t !== 'openhw-sd-card' && !t.includes('sd_card') && !t.includes('-sd')) continue;
                // CS net → board pin label (same discovery as the SPI
                // bridge below; the model gates on it like real silicon).
                let sdCs: string | null = null;
                try {
                    const pins: string[] = [];
                    try {
                        const p = (inst as any)?.pins;
                        if (p && typeof p === 'object') pins.push(...Object.keys(p));
                    } catch { /* ignore */ }
                    const cands = pins.filter((p) => /^(CS|CSN|NSS|SS|STE)$/i.test(String(p || '').trim()));
                    for (const cp of [...cands, 'CS']) {
                        try {
                            const net = (this as any).pinToNet?.get?.(`${(inst as any)?.id}:${cp}`);
                            if (net === undefined) continue;
                            for (const [node, netId] of (this as any).pinToNet) {
                                if (netId !== net) continue;
                                const sep = node.indexOf(':');
                                if (sep < 0) continue;
                                if (node.slice(0, sep) !== this.boardId) continue;
                                sdCs = node.slice(sep + 1).toUpperCase();
                                break;
                            }
                        } catch { /* ignore */ }
                        if (sdCs) break;
                    }
                } catch { /* discovery never breaks boot */ }
                const ext = (withAssets.ext_devices && typeof withAssets.ext_devices === 'object')
                    ? withAssets.ext_devices : {};
                if (!ext.spi_sd) ext.spi_sd = [{ peripheral: 'SPI1', blocks: 8192, cs: sdCs || 'PA4' }];
                // FS image seed (prebuilt FAT16, HELLO.TXT): turns the
                // block device into a mountable volume for FS-level cells.
                try {
                    const img = (this as any).sdImageBytes;
                    if (img && img.length > 0 && (ext.spi_sd as any[])[0]) {
                        (ext.spi_sd as any[])[0].data = img;
                    }
                } catch { /* seed never breaks boot */ }
                withAssets.ext_devices = ext;
                // Wanted (not yet confirmed): loadFirmware confirms the
                // export exists and flips sdModelLive; onByte skips the
                // JS reply only then. Unconfirmed (old bytes) keeps the
                // legacy JS path — degraded reads, never a silent hang.
                (this as any).sdModelWanted = true;
                break;
            }
        } catch { /* sd attach never breaks boot */ }
        // TIM3 buzzer tap for PWM observe (PA6 = TIM3_CH1; the engine's
        // buzzer device reads freq/duty from the modeled timer regs —
        // CCR1, so channel-1 pins). Polled in drainUartOut into onPWM.
        // Read-only (no model writes); inert when firmware never enables
        // the timer.
        try {
            for (const inst of this.instances.values()) {
                if (typeof (inst as any)?.onPWM !== 'function') continue;
                if (typeof (inst as any)?.getPWMPinNames === 'function') continue;
                const ext = (withAssets.ext_devices && typeof withAssets.ext_devices === 'object')
                    ? withAssets.ext_devices : {};
                if (!ext.buzzer) ext.buzzer = { tim: 'TIM3' };
                withAssets.ext_devices = ext;
                break;
            }
        } catch { /* buzzer never breaks boot */ }
        if (hasSpi) {
            const br = createSPIBridge(bridgeCtx);
            let lastMs = -1e9;
            // CS discovery (generic): the engine only frames transfers
            // between CS edges (parseSpi needs the assert to enter the
            // transfer; without cs the byte stream is dropped). Trace the
            // SPI peripheral model's CS pin net to the board pin label.
            let csPin: string | null = null;
            try {
                for (const inst of this.instances.values()) {
                    if (typeof (inst as any)?.onSPIByte !== 'function'
                        && typeof (inst as any)?.onSPIByteExchange !== 'function') continue;
                    const pins: string[] = [];
                    try {
                        const def = (this as any).compAttrById?.get?.(String((inst as any)?.id));
                        void def;
                    } catch { /* ignore */ }
                    try {
                        const p = (inst as any)?.pins;
                        if (p && typeof p === 'object') pins.push(...Object.keys(p));
                    } catch { /* ignore */ }
                    const cands = pins.filter((p) => /^(CS|CSN|NSS|SS|STE)$/i.test(String(p || '').trim()));
                    for (const cp of [...cands, 'CS']) {
                        try {
                            const net = (this as any).pinToNet?.get?.(`${(inst as any)?.id}:${cp}`);
                            if (net === undefined) continue;
                            for (const [node, netId] of (this as any).pinToNet) {
                                if (netId !== net) continue;
                                const sep = node.indexOf(':');
                                if (sep < 0) continue;
                                if (node.slice(0, sep) !== this.boardId) continue;
                                csPin = node.slice(sep + 1).toUpperCase();
                                break;
                            }
                        } catch { /* ignore */ }
                        if (csPin) break;
                    }
                    if (csPin) break;
                }
            } catch { /* discovery never breaks boot */ }
            withAssets.spi = [{
                peripheral: 'SPI1',
                ...(csPin ? { cs: csPin } : {}),
                onTransfer: (_ch: string, _tx: number[], _rx: number[]) => {
                    // Frame close only: bytes already flowed per-byte
                    // through onByte below (single feed, no doubling).
                    void _ch; void _tx; void _rx;
                    try {
                        const nowMs = this.getSimulatedTimeMs();
                        if (nowMs - lastMs > 2.0) { try { br.frame(true); } catch { /* ignore */ } }
                        lastMs = nowMs;
                    } catch { /* transfer never breaks the tick */ }
                },
                onByte: (ch: string, byte: number, respond: (b: number) => void) => {
                    void ch;
                    // Full-duplex per byte: bridge feeds the model and the
                    // model's MISO response clocks back to the master.
                    // Also arms small-quanta stepping (see stepBudget) so
                    // drains interleave mid-transaction for MISO timing.
                    // Model-owned SD bypass: the engine's spi_sd answers
                    // synchronously in-transfer; a JS respond() would land
                    // one transfer late and poison the next transaction,
                    // so the bridge feeds telemetry only (no reply).
                    // Gated on confirmed attach (sdModelLive) — unconfirmed
                    // keeps the legacy JS path (degraded, never a hang).
                    try { (this as any).f4SpiHot = 4; } catch { /* ignore */ }
                    try {
                        const r = br.exchange(Number(byte) & 0xff, 0);
                        const live = (this as any).sdModelLive === true
                            && (this as any).sdModelWanted === true;
                        if (!live) { try { respond(r & 0xff); } catch { /* ignore */ } }
                    } catch { /* byte never breaks the tick */ }
                },
            }];
        }
    }

    /** FSMC BANK1 8080-device handler (create-time tap): decodes RS
     *  from offset bit 17, collects post-RAMWR pixels (cap 64), answers
     *  RDDID reads with 0x9341. Read answers are pushed in event order. */
    private fsmcHandler(events: any, push: any): void {
        try {
            const st: any = ((this as any).f4Fsmc = (this as any).f4Fsmc || { lastCmd: -1, pixels: [] as number[], pushed: false });
            // Events arrive as a flat [hdr, value] word stream — a plain
            // Array or a Uint32Array from the wasm bindgen edge.
            let ev: number[];
            try {
                ev = Array.isArray(events) ? (events as number[]) : Array.from((events || []) as ArrayLike<number>);
            } catch { ev = []; }
            const answers: number[] = [];
            for (let i = 0; i + 1 < ev.length; i += 2) {
                const hdr = Number(ev[i]) >>> 0;
                const val = Number(ev[i + 1]) & 0xffff;
                const write = ((hdr >>> 31) & 1) === 1;
                const off = hdr & 0x3fffffff;
                if (write) {
                    if (off & (1 << 17)) {
                        if (st.lastCmd === 0x2c && st.pixels.length < 64) st.pixels.push(val);
                    } else {
                        st.lastCmd = val;
                    }
                } else {
                    answers.push(st.lastCmd === 0x04 ? 0x9341 : 0x0000);
                }
            }
            if (answers.length && typeof push === 'function') {
                try { push(answers); } catch { /* ignore */ }
            }
        } catch { /* handler never breaks stepping */ }
    }

    // ---- F4 one-wire (DHT22/DS18B20) fine stepping (P4 port) ----
    // Port of the F1 dhtFineEngaged/stepDhtFine/dhtPollInput design
    // (stm32f1-runner.ts 1068-1180 + 1246-1310), adapted: F4 GPIOA base
    // is 0x40020000 (+port*0x400), direction from MODER @+0x00 (2
    // bits/pin; output iff field != 00); periphRead exists on the F4
    // facade; accounting mirrors the SPI-hot 512-instr slices. Additive;
    // idle cost is one instance scan per tick when no DHT is present.
    /** Board steps per microsecond: F4 core clock per chip. */
    protected override cyclesPerMicrosecond(): number {
        try {
            const c = String((this as any).chip || '').toLowerCase();
            if (c.includes('429')) return 180;
            if (c.includes('401')) return 84;
            if (c.includes('411')) return 100;
            return 168;
        } catch { return 168; }
    }

    /** True while any DHT-22 component has an active transaction
     * (WAKE negotiation, ACK, or bit send). The model exposes
     * isTransactionActive(); anything else never engages. */
    private dhtFineEngaged(): boolean {
        try {
            // Per-boot presence cache (f4DhtPresent): no one-wire model on
            // the board means no transaction can ever be active — skip the
            // instance scan (this gate also runs per SPI-hot slice).
            if ((this as any).f4DhtPresent === false) return false;
            for (const inst of this.instances.values()) {
                try {
                    if (typeof (inst as any)?.isTransactionActive === 'function'
                        && (inst as any).isTransactionActive()) return true;
                } catch { /* keep scanning */ }
            }
        } catch { /* gate never breaks stepping */ }
        return false;
    }

    /** True while any one-wire model is on the board (even idle).
     * Gates coarse chunking for mid-tick WAKE detection; the fine gate
     * above decides slicing. */
    private dhtPresent(): boolean {
        try {
            const cached = (this as any).f4DhtPresent;
            if (cached === true) return true;
            if (cached === false) return false;
        } catch { /* fall through to the live scan */ }
        try {
            for (const inst of this.instances.values()) {
                try {
                    if (typeof (inst as any)?.isTransactionActive === 'function') return true;
                } catch { /* keep scanning */ }
            }
        } catch { /* gate never breaks stepping */ }
        return false;
    }

    /** Fine stepping for DHT transactions: 512-instr slices with
     * per-slice scheduler drain + GPIO poll, so release detection and
     * the model's ACK schedule meet the firmware's bit reads in the
     * same slot instead of quantizing to whole-tick batches.
     * Discipline mirrors F1 (retiredDelta): the facade reports the
     * CUMULATIVE instCount (verified in the vendored engine —
     * emulator.js accumulates `instCount += c`, zeroed only on reset),
     * so derive per-slice deltas via f4Delta; advance simCycleCount
     * per slice so the scheduler domain matches firmware timing 1:1,
     * then return ~0 so the base runLoop adds only its +1 floor
     * instead of double-counting the budget. */
    private stepDhtFine(budget: number): number {
        const mcu = (this as any).mcu;
        if (!mcu) return 0;
        let remaining = Math.max(1, Math.floor(budget));
        const slice = 512;
        let guard = 0;
        const maxSlices = 4096;
        while (remaining > 0 && guard++ < maxSlices) {
            const s = Math.min(slice, remaining);
            let r: any = null;
            try { r = mcu.execute(s); } catch { break; }
            // Delta discipline (see f4Delta): instCount is cumulative —
            // adding it raw per slice would inflate simCycleCount
            // quadratically and break every step-domain delay.
            const d = this.f4Delta(Number(r?.instCount), s);
            try { (this as any).simCycleCount += d; } catch { /* ignore */ }
            try { (this as any).drainDueCallbacks(); } catch { /* scheduler never breaks the tick */ }
            try { (this as any).pollGpioBidirectional(); } catch { /* poll never breaks the tick */ }
            remaining -= s;
            if (r?.stopped) break;
        }
        if (remaining > 0 && guard >= maxSlices) {
            // Unreachable in practice (budgets cap at 1M < 4096 slices);
            // still difference through f4Delta so the rebase cursor stays
            // continuous (F1 fallback parity — no simCycleCount add there).
            try {
                const r3 = mcu.execute(remaining);
                this.f4Delta(Number(r3?.instCount), remaining);
            } catch { /* ignore */ }
        }
        return 0;
    }

    /**
     * Base poll + release detection for bidirectional one-wire nets.
     * The engine's gpio change hooks fire on OUTPUT writes only, so a
     * firmware release to INPUT (DHT wake release → pull-up HIGH)
     * never publishes — the model would wait in WAKE_WAIT forever.
     * dhtPollInput() detects the release via the MODER bits and
     * emulates the pull-up the engine omits. Runs every tick via the
     * base runLoop and every slice via stepDhtFine; same-level dedup
     * keeps it a no-op when nothing moved.
     */
    protected override pollGpioBidirectional(): void {
        try { super.pollGpioBidirectional(); } catch { /* never break the tick */ }
        try { this.dhtPollInput(); } catch { /* poll never breaks the tick */ }
    }

    /** GPIO MODER bit for a board pin (RM0090 §GPIO_MODER): true when
     * the firmware drives the pin as an output (field != 00). Null when
     * unreadable — callers treat null as unknown. */
    private gpioPinIsOutput(pinId: string): boolean | null {
        try {
            const raw = String(pinId || '').toUpperCase();
            const m = raw.match(/^P?([A-K])(\d{1,2})$/);
            if (!m) return null;
            const port = m[1], n = Number(m[2]);
            const emu = (this as any).mcu;
            if (!emu || typeof emu.periphRead !== 'function') return null;
            const base = 0x40020000 + (port.charCodeAt(0) - 65) * 0x400;
            const moder = emu.periphRead(base + 0x00, 4) >>> 0;
            return ((moder >>> (n * 2)) & 0x3) !== 0;
        } catch { return null; }
    }

    /** Sample one-wire model drive on board pins netted to it and
     * publish edges the output-only change hooks miss (see above).
     * MODE-aware bus policy: while the firmware holds the pin as
     * OUTPUT, hooks own the line (skip injection — output wins); once
     * firmware releases to INPUT, the runner IS the pull-up: push HIGH
     * while the model idles, or the model's driven level while it
     * drives (_drivingBus), and publish changes so the model sees
     * release + ACK edges. */
    private dhtPollInput(): void {
        if (!(this as any).mcu) return;
        // No one-wire model on this boot: the scan below would find
        // nothing — return on the cached flag (one property read).
        if ((this as any).f4DhtPresent === false) return;
        for (const [id, inst] of (this as any).instances) {
            let bidi = false;
            try { bidi = typeof (inst as any)?.isTransactionActive === 'function'; } catch { bidi = false; }
            if (!bidi) continue;
            let modelDriving = false;
            let modelHigh = true;
            try {
                modelDriving = !!(inst as any)?._drivingBus;
                const lv = Number((inst as any)?._lastDrivenVoltage);
                if (Number.isFinite(lv)) modelHigh = lv > 1.8;
            } catch { /* fall through to pull-up */ }
            for (const cPin of ['DATA', 'SDA']) {
                const net = (this as any).pinToNet.get(`${id}:${cPin}`);
                if (net === undefined) continue;
                for (const [node, netId] of (this as any).pinToNet) {
                    if (netId !== net) continue;
                    const sep = node.indexOf(':');
                    if (sep < 0) continue;
                    if (node.slice(0, sep) !== (this as any).boardId) continue;
                    const bPin = node.slice(sep + 1);
                    const raw = String(bPin || '').toUpperCase();
                    const mm = raw.match(/^P?([A-K])(\d{1,2})$/);
                    if (!mm) continue;
                    // MODER == 00 (input) → firmware released the bus.
                    let inputMode = false;
                    try {
                        const emu = (this as any).mcu;
                        if (emu && typeof emu.periphRead === 'function') {
                            const base = 0x40020000 + (mm[1].charCodeAt(0) - 65) * 0x400;
                            const moder = emu.periphRead(base + 0x00, 4) >>> 0;
                            inputMode = (((moder >>> (Number(mm[2]) * 2)) & 0x3) === 0);
                        }
                    } catch { continue; }
                    if (!inputMode) continue; // OUTPUT: hooks own it
                    const high = modelDriving ? modelHigh : true; // idle pull-up
                    try { (this as any).engine.setGpioInput?.(bPin, high); } catch { /* ignore */ }
                    if ((this as any).pinStates[bPin] !== !!high) {
                        try { (this as any).publishGpio(bPin, !!high); } catch { /* ignore */ }
                    }
                }
            }
        }
    }

    /** F4 delta contract: the facade reports CUMULATIVE instCount (zeroed
     *  only on reset), so every execute() return must be differenced before
     *  it reaches the base simCycleCount — otherwise the pace pill climbs
     *  without bound. Same discipline as F1 retiredDelta. */
    private f4LastAbs = -1;
    private f4Delta(abs: number, fallback: number): number {
        const a = Math.floor(Number(abs));
        const fb = Math.max(1, Math.floor(Number(fallback)) || 1);
        if (Number.isFinite(a) && a >= 0 && this.f4LastAbs >= 0 && a >= this.f4LastAbs) {
            const d = a - this.f4LastAbs;
            this.f4LastAbs = a;
            return Math.max(1, d);
        }
        if (Number.isFinite(a) && a >= 0) this.f4LastAbs = a;
        return fb;
    }

    /** Per-boot cached component ref (built in loadFirmware next to the
     *  ADC cache): drains must not scan the instance map every 8ms.
     *  Falls back to a live scan when the cache is absent (pre-boot),
     *  so the resolved sink is identical either way. */
    private f4Sink(kind: 'ltdc' | 'usb'): any {
        try {
            const s = (this as any).f4Sinks;
            if (s && s[kind] !== undefined) return s[kind] || null;
        } catch { /* fall through to the live scan */ }
        try {
            for (const inst of this.instances.values()) {
                try {
                    const t = String((inst as any)?.type || '').toLowerCase();
                    if (kind === 'ltdc' && t === 'openhw-ltdc-display') return inst;
                    if (kind === 'usb' && t === 'openhw-usb-device') return inst;
                } catch { /* ignore */ }
            }
        } catch { /* ignore */ }
        return null;
    }

    /** Per-boot cached PWM listener list (same predicates as the former
     *  per-drain scan): instances are static per boot, so the drain only
     *  walks the listeners instead of every instance. */
    private f4PwmListeners(): any[] {
        try {
            const cached = (this as any).f4PwmInsts;
            if (Array.isArray(cached)) return cached;
        } catch { /* fall through to the live scan */ }
        const out: any[] = [];
        try {
            for (const inst of this.instances.values()) {
                try {
                    if (typeof (inst as any)?.onPWM !== 'function') continue;
                    if (typeof (inst as any)?.getPWMPinNames === 'function') continue;
                    out.push(inst);
                } catch { /* ignore */ }
            }
        } catch { /* ignore */ }
        return out;
    }

    /** Per-boot ADC net cache: nets never change mid-run, so resolve the
     *  board-pin nets + off-board drivers + rail targets + 3V3 nets once
     *  instead of scanning pinToNet (O(N²) string slicing) on every 8ms
     *  drain. Rebuilt every loadFirmware; the drain below only walks it. */
    private buildAdcCache(): void {
        try {
            const pins = ['PA0', 'PA1', 'PA2', 'PA3', 'PA4', 'PA5', 'PA6', 'PA7',
                'PB0', 'PB1', 'PC0', 'PC1', 'PC2', 'PC3', 'PC4', 'PC5'];
            const chFor: Record<string, number> = {
                PA0: 0, PA1: 1, PA2: 2, PA3: 3, PA4: 4, PA5: 5, PA6: 6, PA7: 7,
                PB0: 8, PB1: 9, PC0: 10, PC1: 11, PC2: 12, PC3: 13, PC4: 14, PC5: 15,
            };
            const boardNetOf = new Map<string, number | undefined>();
            const boardPinsOnNet = new Map<number, Set<string>>();
            const driversOnNet = new Map<number, Array<{ inst: any; pin: string }>>();
            const netsWith3V3 = new Set<number>();
            for (const pin of pins) boardNetOf.set(pin, undefined);
            for (const [node, netId] of (this.pinToNet as Map<string, number>)) {
                try {
                    const sep = node.indexOf(':');
                    if (sep < 0) continue;
                    const id = node.slice(0, sep);
                    const pn = node.slice(sep + 1);
                    const up = pn.toUpperCase();
                    if (id === this.boardId) {
                        if (boardNetOf.has(up)) boardNetOf.set(up, netId);
                        let set = boardPinsOnNet.get(netId);
                        if (!set) { set = new Set(); boardPinsOnNet.set(netId, set); }
                        set.add(up);
                        if (/3V3/i.test(pn)) netsWith3V3.add(netId);
                    } else {
                        const inst = this.instances.get(id);
                        if (!inst) continue;
                        let arr = driversOnNet.get(netId);
                        if (!arr) { arr = []; driversOnNet.set(netId, arr); }
                        arr.push({ inst, pin: pn });
                    }
                } catch { /* one node never breaks the cache */ }
            }
            const pinRecs = pins.map((pin) => ({ pin, ch: chFor[pin], netId: boardNetOf.get(pin) }));
            const rails: Array<{ inst: any; nm: string; netId: number | undefined }> = [];
            for (const inst of this.instances.values()) {
                try {
                    if (typeof (inst as any)?.getPinVoltage !== 'function') continue;
                    for (const nm of ['VCC', '1']) {
                        try {
                            const key = `${(inst as any)?.id}:${nm}`;
                            rails.push({ inst, nm, netId: (this.pinToNet as Map<string, number>).get(key) });
                        } catch { /* ignore */ }
                    }
                } catch { /* ignore */ }
            }
            (this as any).f4AdcCache = { pins: pinRecs, driversOnNet, boardPinsOnNet, netsWith3V3, rails };
        } catch { try { (this as any).f4AdcCache = null; } catch { /* ignore */ } }
    }

    constructor(
        hexData: string,
        componentsDef: any[],
        wiresDef: any[],
        onStateUpdate: (state: any) => void,
        options: AVRRunnerOptions & { chip?: string } = {},
    ) {
        super(hexData, componentsDef, wiresDef, onStateUpdate, options);
        // Chip map: F401/F411/F407/F407VE/F429 package table (default
        // stm32f407 Discovery). Attr / option wins; board TYPE implies the
        // chip when absent (openhw-stm32f429 → stm32f429, …).
        const optChip = String((options as any)?.chip || '');
        const typeStr = String((options as any)?.boardType || '');
        this.chip = (/^[a-z0-9_+-]+$/i.test(optChip) && optChip ? optChip : f4ChipForType(typeStr)).toLowerCase();
        if (f4SerialUsart(this.chip) === 2) {
            this.uartTxPins = [...F4_UART2_TX, ...F4_UART_TX];
            this.uartRxPins = [...F4_UART2_RX, ...F4_UART_RX];
        }
        try { this.snapshotCompAttrs(componentsDef); } catch { /* never breaks construction */ }
        void this.boot('openhw-stm32f4');
    }

    private makeEngine() {
        const self = this;
        const txQueue: number[] = [];
        const gpioUnsubs: Array<() => void> = [];
        return {
            async loadFirmware(firmware: string, _boardType: string) {
                // Browser-safe: vendored facade under public/vendor (the
                // package entry uses node:fs; the worker can't bundle it).
                // importEngine resolves the STM32F1-style subpath when the
                // bundler allows it, else the /vendor URL at runtime.
                const engineMod: any = await importEngine(
                    'stm32f4-emu/site/stm32f4.js',
                    '/vendor/board-engines/stm32f4-emu/site/stm32f4.js',
                );
                const bindingsMod: any = await importEngine(
                    'stm32f4-emu/site/vendor/stm32_periph_wasm.js',
                    '/vendor/board-engines/stm32f4-emu/site/vendor/stm32_periph_wasm.js',
                );
                const { STM32F4 } = engineMod ?? {};
                // Bindings: the wasm-bindgen glue is a NAMESPACE import
                // (`import * as bindings`, like cli.mjs/index.mjs) — NOT
                // .default (that's just the __wbg_init fn; init_svd lives on
                // the namespace and only materializes after init).
                const bindings = bindingsMod;
                // Model-side SD handshake: confirm the export exists on the
                // served bundle before onByte suppresses JS replies (old
                // bytes without it would hang the core on RXNE forever).
                try { (self as any).sdModelWanted = false;
                    (self as any).sdModelLive =
                        typeof (bindingsMod as any)?.add_spi_sd_card === 'function';
                } catch { try { (self as any).sdModelLive = false; } catch { /* ignore */ } }
                if (!STM32F4) {
                    console.warn('[Stm32f4Runner] engine unavailable (test env?) — idle.');
                    return;
                }
                // Fetch SVD + wasm bytes from public/ so the facade never
                // touches the filesystem. SVD is per-chip (vendored 401/407/
                // 411/429; 407ve shares the 407 SVD); the root copy is the
                // F407 fallback when the per-chip asset is missing.
                let svdXml: string | undefined;
                let wasmBytes: Uint8Array | undefined;
                const svdName = f4SvdFor(self.chip);
                try {
                    const [svdRes, wasmRes] = await Promise.all([
                        fetch(`/vendor/board-engines/stm32f4-emu/site/vendor/${svdName}`).catch(() => null),
                        fetch('/wasm/stm32_periph_wasm_bg.wasm').catch(() => null),
                    ]);
                    let res = svdRes && svdRes.ok ? svdRes : null;
                    if (!res) {
                        try { const fb = await fetch(`/vendor/${svdName}`).catch(() => null); if (fb && fb.ok) res = fb; } catch { /* ignore */ }
                    }
                    if (!res) {
                        try { const fb = await fetch('/vendor/stm32f407.svd').catch(() => null); if (fb && fb.ok) res = fb; } catch { /* ignore */ }
                    }
                    if (res) svdXml = await res.text();
                    if (wasmRes && wasmRes.ok) wasmBytes = new Uint8Array(await wasmRes.arrayBuffer());
                } catch { /* facade falls back to bundled resolution */ }
                // STM32F4._create(opts): opts.bindings defaults null (fine —
                // the emulator inits wasm via bindings.default(wasmInit)),
                // opts.svdXml wins over the node:fs fallback.
                // uartAddr (package site/emulator.js opt, default USART1
                // 0x40011000): Arduino Serial on Disco F407VG is USART2
                // (0x40004400, package site/app.js + test_arduino_boards.mjs).
                // Passing it makes uart_rx_byte injection (sendUart /
                // Serial RX in the monitor) hit the firmware's own port;
                // TX capture stays global (get_uart_output → usart1.onData).
                // enable_irqs (package opt, default false): REQUIRED for
                // Arduino Serial TX to reach the shared buffer at all —
                // probed live in the source repo: without it gotLen=0 even
                // with the right uartAddr; with it HELLO_F4A flows (matches
                // the package's own test_arduino_boards.mjs which passes
                // enable_irqs:true for every Arduino board row).
                const withAssets: any = {
                    chip: self.chip, bindings,
                    uart_addr: f4SerialUsart(self.chip) === 2 ? 0x40004400 : 0x40011000,
                    enable_irqs: true,
                };
                // SDIO card bind (native SDIO cell): board attr sdio=true
                // (or block count) binds an erased card image AFTER init
                // (silicon boots slot-empty by default — never bind
                // unconditionally). Mirrors the facade sdioBlocks sugar.
                try {
                    const battrs = self.compAttrById?.get?.(self.boardId) || {};
                    const sd = (battrs as any)?.sdio;
                    const n = sd === true ? 16 : Math.floor(Number(sd) || 0);
                    if (n > 0) withAssets.sdioBlocks = Math.min(1024, n);
                } catch { /* card bind never breaks boot */ }
                if (svdXml) withAssets.svdXml = svdXml;
                if (wasmBytes) withAssets.wasmInit = wasmBytes;
                // SD FAT image: fetch the prebuilt FAT16 image when an SD
                // card is on the bus (buildBusSpecs attaches spi_sd with
                // cfg.data). Read-only FS cell asserts the preset file.
                try {
                    let wantSd = false;
                    try {
                        for (const inst of self.instances.values()) {
                            const t = String((inst as any)?.type || '').toLowerCase();
                            if (t === 'openhw-sd-card' || t.includes('sd_card') || t.includes('-sd')) { wantSd = true; break; }
                        }
                    } catch { /* ignore */ }
                    if (wantSd) {
                        const r = await fetch('/firmware/sd/fat16.img').catch(() => null);
                        if (r && r.ok) {
                            (self as any).sdImageBytes = new Uint8Array(await r.arrayBuffer());
                        }
                    }
                } catch { /* sd image never breaks boot */ }
                // I2C/SPI device specs (runner-owned bridges via
                // bus-bridge.ts, AVR-adapter pattern). One spec per owned
                // slave address on the default bus (Wire=I2C1,
                // SPI displays typically SPI1); the core routes each
                // transaction to its address-matched spec queue.
                try {
                    self.buildBusSpecs(withAssets);
                } catch { /* bridges never break boot */ }
                // Display-cell observation binds (DCMI/QSPI/FSMC): an
                // openhw-ltdc-display sink with a `cell` attr selects which
                // engine source feeds it. All three binds are create-time
                // (same rule as the package SPI/FSMC taps + the
                // qspiImage/cameraFrame sugars) and idle when no sink asks.
                // Per-boot cell state resets here (drains only run post-boot).
                try {
                    delete (self as any).f4Dcmi; delete (self as any).f4Qspi;
                    delete (self as any).f4Fsmc; delete (self as any).f4SaiDone; delete (self as any).f4SaiAcc;
                    delete (self as any).f4TickDiv; delete (self as any).f4TickRaw; delete (self as any).f4TickApplied;
                    delete (self as any).f4LastAbs;
                    delete (self as any).f4Sinks; delete (self as any).f4PwmInsts; delete (self as any).f4DhtPresent;
                    delete (self as any).f4SaiTick;
                    delete (self as any).f4NeedsLevel; delete (self as any).f4AdcLast; delete (self as any).f4DrainCount;
                    let cell = '';
                    for (const inst of self.instances.values()) {
                        try {
                            if (String((inst as any)?.type || '').toLowerCase() === 'openhw-ltdc-display') {
                                cell = String((self.compAttrById?.get?.((inst as any)?.id) as any)?.cell || '').toLowerCase();
                                break;
                            }
                        } catch { /* ignore */ }
                    }
                    (self as any).f4Cell = cell;
                    if (cell === 'dcmi') {
                        withAssets.cameraFrame = { width: 4, height: 4, pixels: f4DcmiPattern() };
                    } else if (cell === 'qspi') {
                        withAssets.qspiImage = f4QspiImage();
                    } else if (cell === 'fsmc') {
                        const ed: any = (withAssets.ext_devices = withAssets.ext_devices || {});
                        const devs: any[] = (ed.fsmcDevices = ed.fsmcDevices || []);
                        devs.push({
                            bank: 0,
                            handler: (events: any, push: any) => {
                                try { self.fsmcHandler(events, push); } catch { /* ignore */ }
                            },
                        });
                    }
                    // SAI speaker ring: observation plumbing only (no silicon
                    // state), always on — the drain side only looks when the
                    // capture FIFO is non-empty, so idle cost is one status
                    // read per drain.
                    try {
                        const ed2: any = (withAssets.ext_devices = withAssets.ext_devices || {});
                        if (ed2.speaker === undefined) ed2.speaker = true;
                    } catch { /* ignore */ }
                    // Sink refs: instances are static per boot — resolve once
                    // so drains never scan the instance map (LTDC + USB +
                    // cell sinks, PWM listeners, one-wire presence).
                    try {
                        let ltdcSink: any = null, usbSink: any = null;
                        const pwmInsts: any[] = [];
                        let dhtPresent = false;
                        for (const inst of self.instances.values()) {
                            try {
                                const t = String((inst as any)?.type || '').toLowerCase();
                                if (t === 'openhw-ltdc-display' && !ltdcSink) ltdcSink = inst;
                                else if (t === 'openhw-usb-device' && !usbSink) usbSink = inst;
                                try {
                                    if (typeof (inst as any)?.onPWM === 'function'
                                        && typeof (inst as any)?.getPWMPinNames !== 'function') pwmInsts.push(inst);
                                } catch { /* ignore */ }
                                try {
                                    if (typeof (inst as any)?.isTransactionActive === 'function') dhtPresent = true;
                                } catch { /* ignore */ }
                            } catch { /* ignore */ }
                        }
                        (self as any).f4Sinks = { ltdc: ltdcSink, usb: usbSink };
                        (self as any).f4PwmInsts = pwmInsts;
                        (self as any).f4DhtPresent = dhtPresent;
                    } catch { /* ignore */ }
                    // ADC net cache: nets are static per boot — resolve once
                    // here so the 8ms drain never scans pinToNet.
                    try { self.buildAdcCache(); } catch { /* cache never breaks boot */ }
                    // Leveling gate: levelPassiveNets is a proven no-op when
                    // no component-only net has a voltage-capable member
                    // (every actionable net touches the board, where the
                    // engine owns the levels). Nets + members are static per
                    // boot, so resolve once and skip the per-drain
                    // O(pinToNet) regroup when there is nothing to level.
                    // Fail-open (true) — the gate only ever SKIPS a no-op.
                    try {
                        let need = false;
                        const seen = new Map<number, { board: boolean; cap: boolean }>();
                        for (const [node, netId] of ((self as any).pinToNet as Map<string, number>)) {
                            let e = seen.get(netId);
                            if (!e) { e = { board: false, cap: false }; seen.set(netId, e); }
                            const sep = node.indexOf(':');
                            if (sep < 0) continue;
                            if (node.slice(0, sep) === (self as any).boardId) { e.board = true; continue; }
                            try {
                                const inst = (self as any).instances.get(node.slice(0, sep));
                                if (inst && typeof (inst as any)?.getPinVoltage === 'function'
                                    && typeof (inst as any)?.setPinVoltage === 'function') e.cap = true;
                            } catch { /* one node never breaks the gate */ }
                        }
                        for (const e of seen.values()) {
                            if (!e.board && e.cap) { need = true; break; }
                        }
                        (self as any).f4NeedsLevel = need;
                    } catch { try { (self as any).f4NeedsLevel = true; } catch { /* ignore */ } }
                } catch { /* display binds never break boot */ }
                const s = String(firmware || '').trim();
                const decode = (): { kind: 'elf' | 'hex' | 'bin'; data: Uint8Array | string } | null => {
                    if (!s) return null;
                    if (s.startsWith('ELFBASE64:')) return { kind: 'elf', data: b64ToU8(s.slice('ELFBASE64:'.length)) };
                    if (s.startsWith('UF2BASE64:')) return null;
                    if (s.startsWith(':')) return { kind: 'hex', data: s };
                    try {
                        const raw = b64ToU8(s);
                        if (raw.length > 4 && raw[0] === 0x7f && raw[1] === 0x45 && raw[2] === 0x4c && raw[3] === 0x46) {
                            return { kind: 'elf', data: raw };
                        }
                        return { kind: 'bin', data: raw };
                    } catch { return null; }
                };
                const fw0 = decode();
                // FIXEDBIN: sentinel (board `firmware` attr URL, e.g. the
                // USB CDC image): fetch the curated image and boot it as a
                // raw app image. Same first-firmware-wins rule as the
                // micro:bit path; Arduino compile is bypassed main-thread.
                let fw = fw0;
                if (!fw && s.startsWith('FIXEDBIN:')) {
                    try {
                        const url = s.slice('FIXEDBIN:'.length).trim();
                        const r = await fetch(url).catch(() => null);
                        if (r && r.ok) fw = { kind: 'bin', data: new Uint8Array(await r.arrayBuffer()) };
                    } catch { /* falls through to empty boot */ }
                }
                if (!fw) {
                    self.mcu = await STM32F4._create(withAssets);
                } else if (fw.kind === 'elf') {
                    self.mcu = await STM32F4.fromELF(fw.data as Uint8Array, withAssets);
                } else if (fw.kind === 'hex') {
                    self.mcu = await STM32F4.fromHex(fw.data as string, withAssets);
                } else {
                    self.mcu = await STM32F4.fromBin(fw.data as Uint8Array, withAssets);
                }
                try { self.mcu.usart1.onData = (b: number) => { txQueue.push(b & 0xff); }; } catch { /* ignore */ }
                // Disco F407 Serial = USART2: the package TX tap is global
                // (feeds usart1._emit regardless of port), so usart1.onData
                // already carries Disco bytes too. Hook usart2 as well for
                // forward-compat; RX inject below targets the board's port.
                try { self.mcu.usart2.onData = (b: number) => { txQueue.push(b & 0xff); }; } catch { /* usart1-only */ }
                self.hookGpio(gpioUnsubs);
            },
            stepBudget(budget: number): number {
                if (!self.mcu) return 0;
                try {
                    // Adaptive quanta for SPI MISO timing: the engine pops
                    // the MISO queue DURING the transfer but our model
                    // responses only land via post-drain onByte pushes. One
                    // coarse execute() per tick starves every read (whole
                    // transactions complete before the first push). While
                    // SPI traffic flows, step in small slices so drains
                    // interleave mid-transaction (few-bytes lag, inside the
                    // SD R1/R7 scan windows); otherwise full budget.
                    const total = Math.max(1, Math.floor(budget));
                    // DHT bit-slot gate (P4): while a DHT-22 transaction
                    // is active, coarse batches quantize the 28/70us data
                    // slots — slice + drain mid-tick (see stepDhtFine).
                    try {
                        if ((self as any).dhtFineEngaged?.()) return (self as any).stepDhtFine(total);
                    } catch { /* gate never breaks stepping */ }
                    if (!((self as any).f4SpiHot > 0) || total <= 512) {
                        // Coarse path with mid-tick WAKE handoff when a
                        // one-wire model is on the board: a single coarse
                        // execute would collapse the WAKE LOW duration
                        // (both edges land in one tick with one stamp).
                        // Chunk into 20K native batches and flip to fine
                        // slicing the moment the model engages. Fast path
                        // (no DHT on board) stays a single execute.
                        let hasDht = false;
                        try { hasDht = !!(self as any).dhtPresent?.(); } catch { hasDht = false; }
                        if (!hasDht) {
                            const r = self.mcu.execute(total);
                            return self.f4Delta(Number(r?.instCount), total);
                        }
                        let coarseDone = 0;
                        let remaining = total;
                        while (remaining > 0) {
                            const c = Math.min(20000, remaining);
                            let r: any = null;
                            try { r = self.mcu.execute(c); } catch { break; }
                            coarseDone += self.f4Delta(Number(r?.instCount), c);
                            remaining -= c;
                            if (r?.stopped) break;
                            try {
                                if (remaining > 0 && (self as any).dhtFineEngaged?.()) {
                                    try { (self as any).stepDhtFine(remaining); } catch { /* ignore */ }
                                    remaining = 0;
                                    break;
                                }
                            } catch { /* gate never breaks stepping */ }
                        }
                        return coarseDone || 0;
                    }
                    (self as any).f4SpiHot--;
                    let done = 0;
                    let guarded = 0;
                    while (done < total && guarded < 2048) {
                        guarded++;
                        const chunk = Math.min(512, total - done);
                        let stepped = 0;
                        try {
                            const r = self.mcu.execute(chunk);
                            stepped = self.f4Delta(Number(r?.instCount), chunk);
                        } catch { break; }
                        done += Math.max(1, stepped);
                        // Mid-tick WAKE: a DHT edge landed in this slice —
                        // hand the remainder to fine slicing now instead of
                        // waiting for the next tick.
                        try {
                            if ((done < total) && (self as any).dhtFineEngaged?.()) {
                                try { (self as any).stepDhtFine(total - done); } catch { /* ignore */ }
                                break;
                            }
                        } catch { /* gate never breaks stepping */ }
                    }
                    return done || 0;
                } catch { return 0; }
            },
            drainUartOut(): number[] {
                // Net leveling: model-driven pins fan out across
                // component-only nets (engine owns board nets). Per-boot
                // gate (f4NeedsLevel, resolved in loadFirmware): a boot with
                // no actionable net skips the per-drain O(pinToNet) regroup —
                // the call is a proven no-op there. Fail-open while undefined.
                try {
                    if ((self as any).f4NeedsLevel !== false) {
                        levelPassiveNets(self.boardId, (self as any).pinToNet, self.instances as any);
                    }
                } catch { /* never breaks drain */ }
                // Drain counter for rare-event poll cadences below (pwrMode:
                // F1 f1PwrTick parity — every 8th drain, ~64ms wall).
                try { (self as any).f4DrainCount = (Number((self as any).f4DrainCount) || 0) + 1; } catch { /* ignore */ }
                // Clock preset (virtual time compression): board attr tickMHz
                // (e.g. 24/42/84 on a 168MHz chip) divides the guest SysTick
                // reload so virtual milliseconds cost fewer host instructions.
                // LOAD rewrite alone is not enough — the model latches the
                // period on CSR writes — so the guest CSR value is rewritten
                // verbatim to re-latch. Re-applies when the guest reconfigures
                // (LOAD returns to a full-clock value); the divided value is
                // remembered (f4TickApplied) so our own write is never
                // re-divided on the next drain. Guest baud/timer
                // prescalers are untouched (untimed in our models); PWM freq
                // telemetry is rescaled below. Default off (div=1).
                // Presets per chip (virtual-MHz ask → divider): 429@180 →
                // 90/60/45/36/30 (div 2/3/4/5/6); 407@168 → 84/56/42/28/24/21
                // (div 2/3/4/6/7/8); 401@84 → 42/28/21/14 (div 2/3/4/6);
                // 411@100 → 50/25/20 (div 2/4/5). Any want in (0, chipMHz)
                // works (div = round(chipMHz/want)); div clamps at 32 — past
                // that the SysTick storm costs more ISR-entry host time than
                // the compression saves. Default off (div=1).
                // NOTE: DWT/micros() busy-loops still assume the full clock —
                // do not combine tickMHz with microsecond-critical firmware.
                try {
                    let div = Number((self as any).f4TickDiv) || 0;
                    if (!div) {
                        const chipMHz = /429/.test(self.chip) ? 180 : (/401/.test(self.chip) ? 84 : (/411/.test(self.chip) ? 100 : 168));
                        const battrs = self.compAttrById?.get?.(self.boardId) || {};
                        const want = Math.floor(Number((battrs as any)?.tickMHz) || 0);
                        div = (want > 0 && want < chipMHz) ? Math.min(32, Math.max(1, Math.round(chipMHz / want))) : 1;
                        (self as any).f4TickDiv = div;
                    }
                    if (div > 1) {
                        const emu = (self.mcu as any);
                        if (emu && typeof emu.periphRead === 'function' && typeof emu.periphWrite === 'function') {
                            let csr = 0, load = 0;
                            try { csr = emu.periphRead(0xE000E010, 4) >>> 0; load = emu.periphRead(0xE000E014, 4) >>> 0; } catch { csr = 0; load = 0; }
                            const lastRaw = Number((self as any).f4TickRaw) || 0;
                            const lastApplied = Number((self as any).f4TickApplied) || 0;
                            // lastApplied is the value this divider wrote: without
                            // it the next drain would read back its own divided
                            // LOAD (read-your-writes regs) and divide AGAIN —
                            // runaway until LOAD <= div. A genuinely new guest
                            // LOAD differs from both cursors, so reconfig still
                            // re-applies exactly once.
                            if ((csr & 1) && load > div && load !== lastRaw && load !== lastApplied) {
                                const divided = Math.max(1, Math.floor(load / div));
                                (self as any).f4TickRaw = load;
                                (self as any).f4TickApplied = divided;
                                try {
                                    emu.periphWrite(0xE000E014, 4, divided);
                                    emu.periphWrite(0xE000E010, 4, csr >>> 0);
                                    const tag = `F4CLK:div=${div} `;
                                    for (let i = 0; i < tag.length; i++) {
                                        try { (self as any).emitTxByte(tag.charCodeAt(i), 'f4clk'); } catch { break; }
                                    }
                                } catch { /* ignore */ }
                            }
                        }
                    }
                } catch { /* clock preset never breaks the drain */ }
                // PWM observe via the TIM3 buzzer tap (freq Hz + duty
                // fraction, read from modeled timer regs). Drives LED
                // models speaking onPWM (capability detection, no
                // per-type code).
                try {
                    const buzz = (self.mcu as any)?.buzzer;
                    const duty = Number(buzz?.duty) || 0;
                    const freq = Number(buzz?.freq) || 0;
                    // Clock preset rescales wall-true frequencies: the timer
                    // regs still describe full-clock ticks.
                    const tdiv = Number((self as any).f4TickDiv) || 1;
                    const freqTrue = tdiv > 1 ? freq / tdiv : freq;
                    if (duty > 0 && freqTrue > 0) {
                        // Listeners resolved once per boot (f4PwmInsts) —
                        // same capability filter, no per-drain map scan.
                        for (const inst of self.f4PwmListeners()) {
                            try {
                                if (typeof (inst as any)?.onPWM !== 'function') continue;
                                if (typeof (inst as any)?.getPWMPinNames === 'function') continue;
                                for (const pn of ['A', 'ANODE', '+']) {
                                    try { (inst as any).onPWM(pn, { dutyCycle: Math.max(0, Math.min(1, duty)), frequencyHz: freqTrue }); } catch { /* ignore */ }
                                }
                            } catch { /* one instance never breaks pwm */ }
                        }
                    }
                } catch { /* PWM observe never breaks the drain */ }
                // Per-tick ADC inject (facade setAdcChannel, raw 12-bit):
                // Disco PA0-7/PB0-1/PC0-5 map to ADC123 channels 0-15.
                // Nets are resolved once per boot (buildAdcCache) — the drain
                // only walks the cache, no pinToNet scans in the hot loop.
                try {
                    const mcu = self.mcu as any;
                    const cache = (self as any).f4AdcCache as any;
                    if (mcu && typeof mcu.setAdcChannel === 'function' && cache) {
                        for (const rt of cache.rails as Array<{ inst: any; nm: string; netId: number | undefined }>) {
                            try {
                                let v = 0;
                                try { v = Number(rt.inst?.getPinVoltage?.(rt.nm)) || 0; } catch { continue; }
                                if (v > 0.2) continue;
                                if (rt.netId === undefined) continue;
                                if ((cache.netsWith3V3 as Set<number>).has(rt.netId)) {
                                    try { rt.inst?.setPinVoltage?.(rt.nm, 3.3); } catch { /* ignore */ }
                                }
                            } catch { /* one rail never breaks the drain */ }
                        }
                        for (const rec of cache.pins as Array<{ pin: string; ch: number; netId: number | undefined }>) {
                            try {
                                let volts: number | null = null;
                                if (rec.netId !== undefined) {
                                    const dr = (cache.driversOnNet as Map<number, Array<{ inst: any; pin: string }>>).get(rec.netId);
                                    if (dr) {
                                        for (const d of dr) {
                                            try {
                                                const v = Number(d.inst?.getPinVoltage?.(d.pin));
                                                if (Number.isFinite(v)) { volts = v; break; }
                                            } catch { /* ignore */ }
                                        }
                                    }
                                    // DAC loopback: no component drives this net,
                                    // but it touches a DAC output (PA4=ch1,
                                    // PA5=ch2) whose channel is ENABLED — poll
                                    // DOR directly (change events lag and miss
                                    // reset-zero writes). Untouched DACs (EN
                                    // clear) never drive the net.
                                    if (volts === null) {
                                        const bp = (cache.boardPinsOnNet as Map<number, Set<string>>).get(rec.netId);
                                        if (bp && (bp.has('PA4') || bp.has('PA5'))) {
                                            try {
                                                const emu = (self.mcu as any);
                                                let cr = 0, d1 = 0, d2 = 0, ok = false;
                                                try {
                                                    if (emu && typeof emu.periphRead === 'function') {
                                                        cr = emu.periphRead(0x40007400, 4) >>> 0;
                                                        d1 = emu.periphRead(0x4000742c, 4) >>> 0;
                                                        d2 = emu.periphRead(0x40007430, 4) >>> 0;
                                                        ok = true;
                                                    }
                                                } catch { ok = false; }
                                                if (ok) {
                                                    if (bp.has('PA4') && (cr & 0x1)) volts = (d1 & 0xfff) / 4095 * 3.3;
                                                    else if (bp.has('PA5') && (cr & 0x10000)) volts = (d2 & 0xfff) / 4095 * 3.3;
                                                }
                                            } catch { /* DAC bridge never breaks ADC */ }
                                        }
                                    }
                                }
                                if (volts !== null) {
                                    // Change-dedup: the override table is a pure
                                    // value latch (engine lib.rs
                                    // adc_set_channel_value → adc_set_override,
                                    // no side effects), so rewriting an identical
                                    // quantized value only burns a string-crossing
                                    // FFI. Guest reads see the same value either
                                    // way; idle pots cost zero crossings.
                                    try {
                                        const q = Math.max(0, Math.min(4095, Math.round(volts / 3.3 * 4095)));
                                        const last = (self as any).f4AdcLast as Record<number, number> | undefined;
                                        if (!last || last[rec.ch] !== q) {
                                            mcu.setAdcChannel('ADC1', rec.ch, q);
                                            try {
                                                const m = (last || ((self as any).f4AdcLast = {})) as Record<number, number>;
                                                m[rec.ch] = q;
                                            } catch { /* cache never breaks adc */ }
                                        }
                                    } catch { /* ignore */ }
                                }
                            } catch { /* one pin never breaks the drain */ }
                        }
                    }
                } catch { /* ADC inject never breaks the drain */ }
                // LTDC scanout push (F429 TFT cell): when an
                // openhw-ltdc-display sink is on the board, snapshot
                // Display.ltdc() (geometry + guest-RAM pixels), convert to
                // packed 0xRRGGBB, push on change (~5fps throttle; hash
                // first so idle frames cost one snapshot, not a convert).
                try {
                    // Sink ref resolved once per boot (f4Sinks) — no
                    // per-drain instance scan; identical object either way.
                    const sink: any = self.f4Sink('ltdc');
                    const disp = (self.mcu as any)?.display;
                    if (sink && disp && typeof disp.ltdc === 'function') {
                        const now = Date.now();
                        if (now - Number((self as any).f4LtdcLast || 0) > 200) {
                            (self as any).f4LtdcLast = now;
                            let fr: any = null;
                            try { fr = disp.ltdc(); } catch { fr = null; }
                            if (fr && Number(fr.w) > 0 && Number(fr.h) > 0 && fr.fb) {
                                const W = Math.floor(Number(fr.w));
                                const H = Math.floor(Number(fr.h));
                                if (W > 0 && H > 0 && W * H <= 64 * 1024) {
                                    const raw = fr.fb as Uint8Array;
                                    let hsh = (W * 31 + H) | 0;
                                    const step = 64;
                                    for (let i = 0; i < raw.length; i += step) hsh = ((hsh * 33) ^ raw[i]) | 0;
                                    if (hsh !== Number((self as any).f4LtdcHash)) {
                                        (self as any).f4LtdcHash = hsh;
                                        const n = W * H;
                                        const px = new Array(n);
                                        if (String(fr.pf || '').toUpperCase().startsWith('RGB565')) {
                                            for (let i = 0; i < n; i++) {
                                                const v = (raw[i * 2] | (raw[i * 2 + 1] << 8)) & 0xffff;
                                                const r5 = (v >> 11) & 0x1f, g6 = (v >> 5) & 0x3f, b5 = v & 0x1f;
                                                px[i] = ((((r5 << 3) | (r5 >> 2)) << 16) | (((g6 << 2) | (g6 >> 4)) << 8) | ((b5 << 3) | (b5 >> 2))) >>> 0;
                                            }
                                        } else {
                                            for (let i = 0; i < n; i++) {
                                                px[i] = ((raw[i * 4 + 2] << 16) | (raw[i * 4 + 1] << 8) | raw[i * 4]) >>> 0;
                                            }
                                        }
                                        try { (sink as any).onRgbFrame?.(W, H, px); } catch { /* frame never breaks drain */ }
                                    }
                                }
                            }
                        }
                    }
                } catch { /* LTDC push never breaks the drain */ }
                // USB OTG_FS host (CDC cell): when an openhw-usb-device
                // sink is on the board, play host against the guest device
                // stack — bus reset, enumeration, CDC line coding, bulk
                // echo (the engine-side test_usb.mjs sequence, driven
                // incrementally: one inject or status poll per drain; the
                // guest runs between drains). Reports link state + echo
                // bytes to the sink and emits USB_ markers into the serial
                // stream. Idle cost when idle: one instanceof scan.
                try {
                    // Same per-boot sink ref as the LTDC push above.
                    const usink: any = self.f4Sink('usb');
                    const mcu: any = self.mcu;
                    if (usink && mcu && typeof mcu.usbInjectSetup === 'function') {
                        const st: any = ((self as any).f4Usb = (self as any).f4Usb || { phase: 'init', waits: 0, rx: 0, echo: '', link: '' });
                        try {
                            let chunk = '';
                            const qlen = Math.min(txQueue.length, 1024);
                            for (let i = 0; i < qlen; i++) chunk += String.fromCharCode(txQueue[i] & 0xff);
                            if (chunk) st.uart = (String(st.uart || '') + chunk).slice(-8000);
                        } catch { /* markers are best-effort */ }
                        const uart: string = String(st.uart || '');
                        const say = (line: string) => {
                            try {
                                const tag = line + '\n';
                                for (let i = 0; i < tag.length; i++) {
                                    try { (self as any).emitTxByte(tag.charCodeAt(i), 'usbhost'); } catch { break; }
                                }
                            } catch { /* ignore */ }
                        };
                        const report = (link: string) => {
                            try {
                                if (st.link !== link || st.repRx !== st.rx || st.repEcho !== st.echo) {
                                    st.link = link; st.repRx = st.rx; st.repEcho = st.echo;
                                    (usink as any).onUsbState?.(link, st.rx, st.echo);
                                }
                            } catch { /* ignore */ }
                        };
                        const fail = (msg: string) => { st.phase = 'dead'; try { say('USB_HOST:FAIL ' + msg); } catch { /* ignore */ } };
                        const takeIn = (ep: number): number[] | string | null => {
                            try {
                                const status = Number(mcu.usbInStatus(ep)) || 0;
                                if (status === 2) return 'STALL';
                                if (status === 1) return Array.from(mcu.usbTakeIn(ep) || []) as number[];
                            } catch { /* ignore */ }
                            return null;
                        };
                        const outZlp = (ep: number) => { try { mcu.usbInjectOut(ep, []); } catch { /* ignore */ } };
                        const eq = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
                        const HELLO = [72, 101, 108, 108, 111, 85, 83, 66];
                        const WORLD = [87, 111, 114, 108, 100, 33, 33, 33];
                        const bump = () => { st.waits = Number(st.waits || 0) + 1; return Number(st.waits) > 3000; };
                        report(uart.includes('USB enum done') ? 'enumerated' : (st.phase === 'init' || st.phase === 'waitRst' ? 'init' : 'reset'));
                        switch (st.phase) {
                            case 'init':
                                if (uart.includes('USB init done')) {
                                    try { mcu.usbReset(); } catch { /* ignore */ }
                                    say('USB_HOST:reset');
                                    st.phase = 'waitRst'; st.waits = 0;
                                } else if (bump()) fail('no init marker');
                                break;
                            case 'waitRst':
                                if (uart.includes('USBRST')) {
                                    try { mcu.usbEnumerated(); } catch { /* ignore */ }
                                    st.phase = 'setupDev'; st.waits = 0;
                                } else if (bump()) fail('no USBRST');
                                break;
                            case 'setupDev':
                                try { mcu.usbInjectSetup([0x80, 0x06, 0x00, 0x01, 0x00, 0x00, 0x40, 0x00]); } catch { fail('setup inject'); break; }
                                st.phase = 'takeDev'; st.waits = 0;
                                break;
                            case 'takeDev': {
                                const r = takeIn(0);
                                if (r === 'STALL') fail('STALL on device desc');
                                else if (Array.isArray(r)) {
                                    if (r[1] !== 1 || r.length < 18) fail('bad device desc');
                                    else { outZlp(0); st.phase = 'setupCfg'; st.waits = 0; }
                                } else if (bump()) fail('device desc timeout');
                                break;
                            }
                            case 'setupCfg':
                                try { mcu.usbInjectSetup([0x80, 0x06, 0x00, 0x02, 0x00, 0x00, 0xFF, 0x00]); } catch { fail('setup inject'); break; }
                                st.phase = 'takeCfg'; st.waits = 0;
                                break;
                            case 'takeCfg': {
                                const r = takeIn(0);
                                if (r === 'STALL') fail('STALL on config desc');
                                else if (Array.isArray(r)) {
                                    const total = (r[2] | (r[3] << 8)) >>> 0;
                                    if (r[1] !== 2 || total !== 67 || r.length !== 67 || r[4] !== 2) fail('bad config desc');
                                    else { outZlp(0); st.phase = 'setupLang'; st.waits = 0; }
                                } else if (bump()) fail('config desc timeout');
                                break;
                            }
                            case 'setupLang':
                                try { mcu.usbInjectSetup([0x80, 0x06, 0x00, 0x03, 0x00, 0x00, 0xFF, 0x00]); } catch { fail('setup inject'); break; }
                                st.phase = 'takeLang'; st.waits = 0;
                                break;
                            case 'takeLang': {
                                const r = takeIn(0);
                                if (r === 'STALL') fail('STALL on lang string');
                                else if (Array.isArray(r)) {
                                    if (!eq(r.slice(0, 4), [4, 3, 9, 4])) fail('bad lang string');
                                    else { outZlp(0); st.phase = 'setupStall'; st.waits = 0; }
                                } else if (bump()) fail('lang string timeout');
                                break;
                            }
                            case 'setupStall':
                                try { mcu.usbInjectSetup([0x80, 0x06, 0x09, 0x03, 0x00, 0x00, 0xFF, 0x00]); } catch { fail('setup inject'); break; }
                                st.phase = 'waitStall'; st.waits = 0;
                                break;
                            case 'waitStall': {
                                let s0 = 0;
                                try { s0 = Number(mcu.usbInStatus(0)) || 0; } catch { s0 = 0; }
                                if (s0 === 2) { st.phase = 'waitStallClear'; st.waits = 0; }
                                else if (bump()) fail('no STALL on missing string');
                                break;
                            }
                            case 'waitStallClear': {
                                let si = 0, so = 0;
                                try { si = Number(mcu.usbInStatus(0)) || 0; so = Number(mcu.usbOutStatus(0)) || 0; } catch { /* ignore */ }
                                if (uart.includes('USB stall clear') && si !== 2 && so !== 2) { st.phase = 'setupAddr'; st.waits = 0; }
                                else if (bump()) fail('STALL stuck');
                                break;
                            }
                            case 'setupAddr':
                                try { mcu.usbInjectSetup([0x00, 0x05, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00]); } catch { fail('setup inject'); break; }
                                st.phase = 'takeAddr'; st.waits = 0;
                                break;
                            case 'takeAddr': {
                                const r = takeIn(0);
                                if (Array.isArray(r)) {
                                    if (r.length !== 0) fail('SET_ADDRESS should ZLP');
                                    else { st.phase = 'setupCfg1'; st.waits = 0; }
                                } else if (bump()) fail('SET_ADDRESS timeout');
                                break;
                            }
                            case 'setupCfg1':
                                try { mcu.usbInjectSetup([0x00, 0x09, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00]); } catch { fail('setup inject'); break; }
                                st.phase = 'takeCfg1'; st.waits = 0;
                                break;
                            case 'takeCfg1': {
                                const r = takeIn(0);
                                if (Array.isArray(r)) {
                                    if (r.length !== 0) fail('SET_CONFIGURATION should ZLP');
                                    else { st.phase = 'setupLine'; st.waits = 0; }
                                } else if (bump()) fail('SET_CONFIGURATION timeout');
                                break;
                            }
                            case 'setupLine':
                                try { mcu.usbInjectSetup([0x21, 0x22, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00]); } catch { fail('setup inject'); break; }
                                st.phase = 'takeLine'; st.waits = 0;
                                break;
                            case 'takeLine': {
                                const r = takeIn(0);
                                if (Array.isArray(r)) {
                                    if (r.length !== 0) fail('SET_LINE_STATE should ZLP');
                                    else {
                                        try {
                                            mcu.usbInjectSetup([0x21, 0x20, 0, 0, 7, 0, 0, 0]);
                                            mcu.usbInjectOut(0, [0x00, 0xC2, 0x01, 0x00, 0x00, 0x00, 0x08]);
                                        } catch { fail('line coding inject'); break; }
                                        st.phase = 'takeLineData'; st.waits = 0;
                                    }
                                } else if (bump()) fail('SET_LINE_STATE timeout');
                                break;
                            }
                            case 'takeLineData': {
                                const r = takeIn(0);
                                if (Array.isArray(r)) {
                                    if (r.length !== 0) fail('SET_LINE_CODING status should ZLP');
                                    else { st.phase = 'echo1'; st.waits = 0; }
                                } else if (bump()) fail('SET_LINE_CODING timeout');
                                break;
                            }
                            case 'echo1':
                                try { mcu.usbInjectOut(1, HELLO); } catch { fail('bulk inject'); break; }
                                st.phase = 'takeEcho1'; st.waits = 0;
                                break;
                            case 'takeEcho1': {
                                const r = takeIn(1);
                                if (r === 'STALL') fail('STALL on EP1');
                                else if (Array.isArray(r)) {
                                    if (!eq(r, HELLO)) fail('echo1 mismatch');
                                    else { st.rx = Number(st.rx || 0) + 8; st.echo = 'HelloUSB'; st.phase = 'echo2'; st.waits = 0; }
                                } else if (bump()) fail('echo1 timeout');
                                break;
                            }
                            case 'echo2':
                                try { mcu.usbInjectOut(1, WORLD); } catch { fail('bulk inject'); break; }
                                st.phase = 'takeEcho2'; st.waits = 0;
                                break;
                            case 'takeEcho2': {
                                const r = takeIn(1);
                                if (r === 'STALL') fail('STALL on EP1');
                                else if (Array.isArray(r)) {
                                    if (!eq(r, WORLD)) fail('echo2 mismatch');
                                    else {
                                        st.rx = Number(st.rx || 0) + 8; st.echo = 'HelloUSB World!!!';
                                        say('USB_ECHO:PASS HelloUSB World!!!');
                                        st.phase = 'waitDone'; st.waits = 0;
                                    }
                                } else if (bump()) fail('echo2 timeout');
                                break;
                            }
                            case 'waitDone':
                                if (uart.includes('USB done')) { say('USB_HOST:PASS'); st.phase = 'done'; }
                                else if (bump()) fail('no USB done');
                                break;
                            default:
                                break; // done / dead: silent
                        }
                        report(uart.includes('USB enum done') ? 'enumerated' : (st.phase === 'init' || st.phase === 'waitRst' ? 'init' : 'reset'));
                    }
                } catch { /* USB host never breaks the drain */ }
                // Display-cell drains (DCMI/QSPI/FSMC/SAI): host-side proof
                // for the cell bound at load. Each fires once per boot.
                try {
                    const cell = String((self as any).f4Cell || '');
                    // Display sink for the bound cell (per-boot ref).
                    const sink: any = (cell === 'dcmi' || cell === 'qspi' || cell === 'fsmc')
                        ? self.f4Sink('ltdc') : null;
                    const say = (line: string) => {
                        try {
                            const tag = line + '\n';
                            for (let i = 0; i < tag.length; i++) {
                                try { (self as any).emitTxByte(tag.charCodeAt(i), 'f4cell'); } catch { break; }
                            }
                        } catch { /* ignore */ }
                    };
                    // DCMI: the fed sensor pattern (known at bind) as
                    // grayscale RGB. The guest proves the capture path
                    // (sensor -> FIFO -> DR) via its serial sum; the sink
                    // proves the same bytes reach human eyes.
                    if (sink && cell === 'dcmi' && !(self as any).f4Dcmi) {
                        (self as any).f4Dcmi = true;
                        const pat = f4DcmiPattern();
                        const px = new Array(16);
                        for (let i = 0; i < 16; i++) {
                            const g = pat[i] & 0xff;
                            px[i] = ((g << 16) | (g << 8) | g) >>> 0;
                        }
                        try { (sink as any).onRgbFrame?.(4, 4, px); } catch { /* ignore */ }
                        say('DCMI_SRC:PASS 4x4');
                    }
                    // QSPI: verify the full bound image through the AHB mmap
                    // window, then show it. The guest proves the indirect +
                    // mmap paths via its serial compare; the runner proves
                    // every word independently of guest serial.
                    if (sink && cell === 'qspi' && !(self as any).f4Qspi) {
                        let live = false;
                        try { live = !!(self.mcu as any)?.qspiMmapLive?.(); } catch { live = false; }
                        if (live) {
                            const img = f4QspiImage();
                            let ok = true;
                            const px = new Array(32 * 16);
                            for (let w = 0; w < 256; w++) {
                                let got = 0;
                                try { got = Number((self.mcu as any).qspiMmapRead(w * 4)) >>> 0; } catch { ok = false; break; }
                                const exp = (img[w * 4] | (img[w * 4 + 1] << 8) | (img[w * 4 + 2] << 16) | (img[w * 4 + 3] << 24)) >>> 0;
                                if (got !== exp) { ok = false; break; }
                                px[w * 2] = f4Rgb565ToPacked(img[w * 4], img[w * 4 + 1]);
                                px[w * 2 + 1] = f4Rgb565ToPacked(img[w * 4 + 2], img[w * 4 + 3]);
                            }
                            if (ok) {
                                (self as any).f4Qspi = true;
                                try { (sink as any).onRgbFrame?.(32, 16, px); } catch { /* ignore */ }
                                say('QSPI_MMAP:PASS 256');
                            } else {
                                say('QSPI_MMAP:FAIL');
                                (self as any).f4Qspi = true;
                            }
                        }
                    }
                    // FSMC: the 8080 handler collected post-RAMWR pixels;
                    // show the 8x8 burst once 64 words land.
                    if (sink && cell === 'fsmc') {
                        const fst: any = (self as any).f4Fsmc;
                        if (fst && fst.pixels && fst.pixels.length >= 64 && !fst.pushed) {
                            fst.pushed = true;
                            const px = new Array(64);
                            for (let i = 0; i < 64; i++) {
                                const v = Number(fst.pixels[i]) & 0xffff;
                                px[i] = f4Rgb565ToPacked(v & 0xff, (v >> 8) & 0xff);
                            }
                            try { (sink as any).onRgbFrame?.(8, 8, px); } catch { /* ignore */ }
                            say('FSMC_PX:64');
                        }
                    }
                    // SAI audio-bus loopback (narrow claim: guest SAI_A_DR
                    // writes land in the shared capture FIFO — no SAI
                    // frame/slot/clock behavior exists in the model). The
                    // model FIFO drains into the speaker ring per step, so
                    // accumulate ring samples across drains (gating on the
                    // model FIFO level races the per-step drain and never
                    // fires). The FIFO cannot be faked by guest serial, so
                    // matching samples are independent proof.
                    if (!(self as any).f4SaiDone) {
                        const acc: number[] = ((self as any).f4SaiAcc = (self as any).f4SaiAcc || []);
                        if (acc.length < 16) {
                            // Cadence: takeSpeakerSamples is a wasm→JS copy
                            // every drain, but the capture FIFO persists in
                            // the model — polling every 4th drain (~32ms)
                            // accumulates the same samples in the same order
                            // (guest writes 16 per ~3s; no ring pressure).
                            const saiTick = (Number((self as any).f4SaiTick) || 0) + 1;
                            (self as any).f4SaiTick = saiTick;
                            if (saiTick % 4 === 1) {
                                try {
                                    const samples: ArrayLike<number> = (self.mcu as any)?.takeSpeakerSamples?.() || [];
                                    for (let i = 0; i < samples.length && acc.length < 16; i++) {
                                        acc.push(Math.round(Number((samples as any)[i]) * 32768));
                                    }
                                } catch { /* ignore */ }
                            }
                        }
                        if (acc.length >= 16) {
                            (self as any).f4SaiDone = true;
                            let sum = 0;
                            for (let i = 0; i < 16; i++) sum += acc[i];
                            say('SAI_CAP:16:' + sum);
                        }
                    }
                } catch { /* display drains never break the drain */ }
                // System-cell markers (sys specs): arm host-observed
                // event callbacks once + poll power-mode on change.
                // Additive; silent when unused.
                try {
                    const mcuS: any = self.mcu as any;
                    const say = (line: string) => {
                        try {
                            const tag = line + '\n';
                            for (let i = 0; i < tag.length; i++) {
                                try { (self as any).emitTxByte(tag.charCodeAt(i), 'f4sys'); } catch { break; }
                            }
                        } catch { /* ignore */ }
                    };
                    try {
                        if (mcuS && !((self as any).f4SysWired)) {
                            (self as any).f4SysWired = true;
                            try { mcuS.onDmaTc = (c: number, s: number) => { try { say('F4DMA_TC:' + c + ':' + s); } catch { /* ignore */ } }; } catch { /* ignore */ }
                            try { mcuS.onWdogReset = (w: number) => { try { say('F4WDOG_RST:' + w); } catch { /* ignore */ } }; } catch { /* ignore */ }
                            try { mcuS.onRtcAlarm = (a: number) => { try { say('F4RTC_ALARM:' + a); } catch { /* ignore */ } }; } catch { /* ignore */ }
                            try { mcuS.onExtiEdge = (l: number) => { try { say('F4EXTI_EDGE:' + l); } catch { /* ignore */ } }; } catch { /* ignore */ }
                            try { mcuS.onItmByte = (p: number, b: number) => { try { (self as any).emitTxByte(Number(b) & 0xff, 'f4itm'); } catch { /* ignore */ } }; } catch { /* ignore */ }
                        }
                    } catch { /* wiring never breaks the drain */ }
                    // Rare-event cadence (F1 f1PwrTick parity): PWR_CR is
                    // firmware-static for whole runs — one MMIO FFI every 8th
                    // drain (~64ms wall) reports the same transitions with
                    // 1/8th the crossings. First drain always samples so the
                    // initial mode marker never waits. Marker sequence
                    // otherwise unchanged.
                    try {
                        const dc = (Number((self as any).f4DrainCount) || 0);
                        if (dc === 1 || dc % 8 === 0) {
                            const pm = (mcuS && typeof mcuS.pwrMode === 'function') ? Number(mcuS.pwrMode()) : -1;
                            if (pm >= 0 && pm !== Number((self as any).f4PwrLast ?? 0)) { (self as any).f4PwrLast = pm; say('F4PWR_MODE:' + pm); }
                        }
                    } catch { /* ignore */ }
                } catch { /* f4sys markers never break the drain */ }
                if (!txQueue.length) return [];
                return txQueue.splice(0, Math.min(txQueue.length, 1024));
            },
            injectUartByte(value: number) {
                // RX goes to the board's own Serial port: usart2 on plain
                // Disco F407, usart1 everywhere else (mirrors uart_addr).
                const ch = String.fromCharCode(value & 0xff);
                try {
                    if (f4SerialUsart(self.chip) === 2) self.mcu?.usart2?.send?.(ch);
                    else self.mcu?.usart1?.send?.(ch);
                } catch { /* ignore */ }
            },
            getPc(): number {
                try { return Number(self.mcu?.getPc?.()) || 0; } catch { return 0; }
            },
            // Input injection for the base bidirectional poll. Package API:
            // gpio.pin(bank, n).setInput(bool) (index.d.ts).
            setGpioInput(pinId: string, high: boolean): void {
                try {
                    const raw = String(pinId || '').toUpperCase();
                    const m = raw.match(/^P?([A-K])(\d{1,2})$/);
                    if (!m) return;
                    self.mcu?.gpio?.pin?.(m[1], Number(m[2]))?.setInput?.(!!high);
                } catch { /* ignore */ }
            },
            readAnalog(_ref: string): number {
                return NaN; // no ADC read path on the facade.
            },
            close(): void {
                try { gpioUnsubs.forEach((u) => { try { u(); } catch { /* ignore */ } }); } catch { /* ignore */ }
                try { self.mcu?.close?.(); } catch { /* ignore */ }
                self.mcu = null;
            },
            resetEngine(): void {
                try { self.mcu?.reset?.(); } catch { /* ignore */ }
            },
        };
    }

    private hookGpio(unsubs: Array<() => void>): void {
        if (!this.mcu?.gpio) return;
        // F407 exposes banks A–K; F401/F411 A–F; F429 A–K. Watch the
        // header-relevant subset; per-chip LED (BOARD_LED map) drives state.
        const banks = ['A', 'B', 'C', 'D', 'E'];
        const led = f4LedFor(this.chip);
        for (const bank of banks) {
            for (let pin = 0; pin < 16; pin++) {
                try {
                    const h = this.mcu.gpio.pin(bank, pin);
                    const u = h.on('change', (high: boolean) => {
                        this.publishGpio(`P${bank}${pin}`, !!high);
                        if (bank === led.bank && pin === led.pin) {
                            try { (this.instances.get(this.boardId) as any)?.setState?.({ builtInLed: !!high }); } catch { /* ignore */ }
                        }
                    });
                    if (typeof u === 'function') unsubs.push(u);
                } catch { /* skip missing pin */ }
            }
        }
        // F429 PG13 lives outside the A–E subset — watch it explicitly.
        if (led.bank === 'G') {
            try {
                const h = this.mcu.gpio.pin('G', 13);
                const u = h.on('change', (high: boolean) => {
                    this.publishGpio('PG13', !!high);
                    try { (this.instances.get(this.boardId) as any)?.setState?.({ builtInLed: !!high }); } catch { /* ignore */ }
                });
                if (typeof u === 'function') unsubs.push(u);
            } catch { /* skip missing pin */ }
        }
    }

    protected budgetForDelta(deltaMs: number): number {
        return Math.floor(deltaMs * 50000 * this.speed);
    }

    protected maxBudgetPerTick(): number {
        return 1_000_000;
    }
}
