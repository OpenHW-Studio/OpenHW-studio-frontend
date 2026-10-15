/**
 * stm32f1-runner.ts — STM32F103 Blue Pill BoardRunner over stm32f1-emu@3.3.0.
 *
 * Engine: `STM32F1` facade. One instance per board runner (verified
 * isolated).
 *
 * Firmware contract (boardHexMap carries `compiled.hex`):
 *   Arduino `.bin` → backend `bin` artifact = `<sketch>.ino.bin` (raw app
 *   image), raw base64 → fromBin. Verified: boots, Serial.println reaches
 *   usart1.onData. ELF magic `7F 45 4C 46` → fromELF, leading `:` → fromHex.
 *   `chip` option selects the stm32f1-emu builtin table (default
 *   stm32f103c8 Blue Pill; cb/rc/maple_mini/nucleo_f103rb/gd32_* pass
 *   through to createEmulator sizes + IDCODE; board TYPE implies the chip
 *   when the opt is absent).
 *   Per-variant LEDs (c8/cb/rc/gd32→PC13, maple→PB1, nucleo→PA5);
 *   USART2 (PA2/PA3, Nucleo ST-Link VCP) drains alongside USART1.
 *
 * UART: `usart1.onData` TX hook → emit; `usart1.send`/`uartRx` RX. GPIO:
 * `gpio.pin(port, n).on('change')` out → publish; `setInput/setAnalog` in.
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

// Blue Pill USART1: TX=PA9, RX=PA10.
// Board LED map (matches emulator shells + package chip table):
//   c8/cb/rc/gd32_* → PC13, maple_mini → PB1, nucleo_f103rb → PA5.
// USART map: usart1→PA9/PA10 on ALL variants; nucleo ALSO wires USART2
// (PA2/PA3, ST-Link VCP) — runner drains usart1+usart2 TX, RX injects both.
const F1_UART_TX = ['PA9', 'A9', 'TX', 'TX0', 'TX1'];
const F1_UART_RX = ['PA10', 'A10', 'RX', 'RX0', 'RX1'];
const F1_UART2_TX = ['PA2', 'A2', 'TX2'];
const F1_UART2_RX = ['PA3', 'A3', 'RX2'];

function f1LedFor(chip: string): { port: string; pin: number } {
    const c = String(chip || '').toLowerCase();
    if (c.includes('maple')) return { port: 'B', pin: 1 };
    if (c.includes('nucleo')) return { port: 'A', pin: 5 };
    return { port: 'C', pin: 13 };
}

// Board type → package chip key (explicit `chip` opt/attr always wins).
// Matches the 7 emulator shells + legacy bluepill types.
function f1ChipForType(boardType: string): string {
    const t = String(boardType || '').toLowerCase();
    if (t.includes('maple')) return 'maple_mini';
    if (t.includes('nucleo')) return 'nucleo_f103rb';
    if (t.includes('gd32')) {
        if (t.includes('rb')) return 'gd32f103rb';
        if (t.includes('cb')) return 'gd32f103cb';
        return 'gd32f103c8';
    }
    if (t.includes('f103cb') || t.includes('103cb') || (t.includes('cb') && t.includes('103'))) return 'stm32f103cb';
    if (t.includes('f103rc') || t.includes('103rc') || (t.includes('rc') && t.includes('103'))) return 'stm32f103rc';
    return 'stm32f103c8';
}

function b64ToU8(b64: string): Uint8Array {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

/** Board pin label → [PORT letter, pin number] (PA9/A9/9 → [A,9]). */
function portPinFor(pinId: string): [string, number] | [null, -1] {
    const raw = String(pinId || '').toUpperCase();
    let m = raw.match(/^P([A-G])(\d{1,2})$/);
    if (m) return [m[1], Number(m[2])];
    m = raw.match(/^([A-G])(\d{1,2})$/);
    if (m) return [m[1], Number(m[2])];
    return [null, -1];
}

export class Stm32f1Runner extends ArmRunnerBase {
    protected uartTxPins = [...F1_UART_TX, ...F1_UART2_TX];
    protected uartRxPins = [...F1_UART_RX, ...F1_UART2_RX];
    protected engine = this.makeEngine();
    private mcu: any = null;
    private chip: string;

    constructor(
        hexData: string,
        componentsDef: any[],
        wiresDef: any[],
        onStateUpdate: (state: any) => void,
        options: AVRRunnerOptions & { chip?: string } = {},
    ) {
        super(hexData, componentsDef, wiresDef, onStateUpdate, options);
        // Chip map: stm32f1-emu builtin table (flash/RAM/IDCODE) —
        // stm32f103c8 (Blue Pill default), stm32f103cb/maple_mini,
        // stm32f103rc, nucleo_f103rb, gd32f103c8/cb/rb. Attr / option wins;
        // board TYPE implies the chip when no explicit chip is given
        // (openhw-stm32-maple-mini → maple_mini, etc.).
        const optChip = String((options as any)?.chip || '');
        const typeStr = String((options as any)?.boardType || '');
        this.chip = (/^[a-z0-9_+-]+$/i.test(optChip) && optChip ? optChip : f1ChipForType(typeStr)).toLowerCase();
        // Snapshot component attrs for generic bus address resolution (the
        // base doesn't retain componentsDef; bridges read this map).
        try {
            const defs = Array.isArray(componentsDef) ? componentsDef : [];
            this.compAttrById = new Map();
            for (const c of defs) {
                if (c && c.id !== undefined) this.compAttrById.set(String(c.id), c.attrs || {});
            }
        } catch { /* snapshot never breaks construction */ }
        void this.boot('openhw-stm32-bluepill');
    }

    private compAttrById: Map<string, any> = new Map();
    private i2cBridge: I2CBridge | null = null;
    private spiBridge: SPIBridge | null = null;
    private spiLastMs = 0;

    // SoftSerial TX observer — PB7 @ 9600 baud (documented convention, shared
    // with tests/e2e/stm32-softserial.spec.js whose firmware bit-bangs
    // SoftwareSerial soft(PB6, PB7): RX=PB6, TX=PB7). Mirrors the AVRRunner
    // edge decoder (observeSoftSerialTx/processSoftSerialDecode/
    // emitSoftSerialByte/getSoftSerialBitCycles) with one adaptation: engine
    // GPIO change events are batch-quantized, so change events only ARM the
    // observer (with an exact-phase stamp when the engine provides pin-event
    // tcounts — see softSerialArm). All decode comes from sub-bit polling:
    // while armed, stepBudget slices the tick budget into ≤bit/8 instruction
    // steps and samples PB7 after each slice (time base = retired-instruction
    // counter, exact in the engine domain). Bit period self-calibrates from
    // consecutive validated frame starts (Δ/10 for back-to-back bytes), so
    // instruction-vs-cycle skew (CPI≠1) cancels out. Decoded bytes publish
    // on the 'softserial' serial source (same contract as AVR).
    // Timer-ISR latency gate (timFineEngaged/stepTimFine below): timer
    // per-bit ISRs (STM32duino SoftwareSerial = TIMER update IRQ per bit)
    // can only materialize ≤1 ISR per engine batch — a 20K batch stretches
    // each bit to ≥20K instr (proven: 12 edges where 97 belong). While any
    // general-purpose timer runs with its update IRQ armed, the whole tick
    // budget steps in ~2K slices so ISR latency stays ≤0.27 bit.
    private readonly softSerialTxPort = 'B';
    private readonly softSerialTxPinNum = 7;
    private readonly softSerialTxPinId = 'PB7';
    private readonly softSerialBaud = 9600;
    private softSerialClock = 0;
    private softSerialLastAbs = -1;
    private softSerialArmed = false;
    private softSerialLastActivity = 0;
    private softSerialReceiving = false;
    private softSerialStartAt = 0;
    private softSerialSampleAt = 0;
    private softSerialSampleIndex = 0;
    private softSerialCurrentByte = 0;
    private softSerialLastPollHigh = true;
    private softSerialCoarseHigh = true;
    private softSerialBitInstr = 7500;
    private softSerialLastStartAt: number | null = null;
    private softSerialTxHandle: any = null;
    /** Last step slice size (tracks which arm tier is safe; see arm). */
    private lastStepSlice = 20000;
    /** Deferred SoftSerial arm stamp (set in the pin callback, consumed
     * after the clock advance — see softSerialFlushPendingArm). NaN when
     * the engine build omits stamps (legacy tiers apply). */
    private softSerialPendingArm: number | null = null;

    /** Wire engine bus callbacks into the shared bridges (runner-owned, AVR-adapter pattern). */
    private wireBusBridges(): void {
        const mcu = this.mcu;
        if (!mcu) return;
        try {
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
            // I2C: one callback set per bus (addresses route inside the
            // adapter by first-ACK-wins). Default Wire = I2C1 on all F1
            // variants; Wire1/I2C2 later (documented gap).
            const addrs = collectI2CSlaveAddresses(bridgeCtx);
            if (addrs.length > 0 && mcu.i2c1) {
                this.i2cBridge = createI2CBridge(bridgeCtx);
                const br = this.i2cBridge;
                // Read-mode inference: the engine's start event carries the
                // 7-bit address only (direction stripped), but sensor reads
                // arrive as write-pointer + repeated START with no STOP
                // between. Track bus idle: a START on a non-idle bus is the
                // read phase (the I2cDevice repeated-start path drains the
                // pending pointer write and prefills the read queue).
                let busIdle = true;
                // Bounded early prefill (first-byte + BTF-tail fix):
                //  - write drain (pointer known): PEEK the model register
                //    image (pure onI2CReadRequest — no model stream
                //    disturbance) and arm the engine queue BEFORE the next
                //    batch executes. Adjacent-batch reads then consume model
                //    bytes instead of sink zeros (observed: prefilled 0x55
                //    never reached DR on the first read phase). NOTE: peeking
                //    via br.read() here would be WRONG — the model's stream
                //    only rebuilds at read-START, so write-phase reads serve
                //    stale leftovers (the UT=0x55FF shape).
                //  - read-START drain: clearRx + re-sync the same bounded
                //    burst from the rebuilt model stream (pointer may have
                //    moved within the flush; drain order is chronological).
                //  - STOP / write-START drain: clearRx — no stale leftovers
                //    to poison the next transfer's address-phase preload
                //    (observed: stale bytes wedge the following N=6 BTF
                //    tail into a timeout, n=0).
                //  - top-up while a read is active: keep ~BURST outstanding
                //    so the engine's BTF heuristic (arms when queue ≤3)
                //    tracks the HAL tail. A 32-deep burst over-prefills and
                //    the tail never arms (proven: 4/6 bytes then stall to
                //    timeout). Same-batch write+read stays unservable
                //    reactively (documented engine limitation); HAL
                //    flag-polling spans batches in practice.
                let readActive = false;
                let injected = 0;   // bytes injected since last clear
                let readEvents = 0; // I2cRead events drained since last clear
                let lastAddr = 0;
                let pointerBytes: number[] = [];
                const BURST = 4;
                const hasClear = typeof mcu.i2c1.clearRx === 'function';
                // Pure model peek (no stream disturbance): first claimant in
                // bridge order (insertion order) offering onI2CReadRequest.
                const peekModel = (addr7: number, pointer: number, count: number): number[] => {
                    try {
                        for (const inst of this.instances.values()) {
                            if (typeof (inst as any)?.onI2CStart !== 'function') continue;
                            if (typeof (inst as any)?.onI2CReadRequest !== 'function') continue;
                            const id = String((inst as any)?.id || '');
                            const attrs = this.compAttrById?.get(id) || {};
                            const cands = [
                                (inst as any)?.i2cAddr,
                                typeof (inst as any)?.getI2CAddress === 'function' ? (inst as any).getI2CAddress() : NaN,
                                attrs?.address, attrs?.i2cAddress, attrs?.addr,
                            ];
                            let match = false;
                            for (const c of cands) {
                                const v = Number(c);
                                if (!Number.isFinite(v)) continue;
                                match = ((v & 0x7f) === (addr7 & 0x7f));
                                break;
                            }
                            if (!match) continue;
                            const data = (inst as any).onI2CReadRequest(pointer & 0xff, count) || [];
                            return (Array.isArray(data) ? data : []).slice(0, count).map((b) => Number(b) & 0xff);
                        }
                    } catch { /* peek never breaks the bus */ }
                    return [];
                };
                const safeClear = () => {
                    if (!hasClear) return;
                    try { mcu.i2c1.clearRx(); } catch { /* ignore */ }
                    injected = 0; readEvents = 0;
                };
                const topUp = () => {
                    try {
                        // -1: the address-phase preload stages one byte
                        // silently (no I2cRead event for it).
                        let outstanding = injected - readEvents - 1;
                        if (outstanding < 0) outstanding = 0;
                        while (outstanding < BURST) {
                            mcu.i2c1.injectRx([br.read() & 0xff]);
                            injected++; outstanding++;
                        }
                    } catch { /* prefill never breaks the bus */ }
                };
                const armBurst = () => {
                    try {
                        safeClear();
                        topUp();
                    } catch { /* prefill never breaks the bus */ }
                };
                try { mcu.i2c1.onStart = (addr: number) => { try {
                    const readPhase = !busIdle;
                    br.start(Number(addr) & 0x7f, readPhase);
                    busIdle = false;
                    lastAddr = Number(addr) & 0x7f;
                    if (!readPhase) {
                        // Write phase: kill previous leftovers, stay out of
                        // the model's stream (it rebuilds at read-START).
                        readActive = false;
                        pointerBytes = [];
                        safeClear();
                    } else if (hasClear) {
                        readActive = true;
                        armBurst();
                    } else {
                        // Legacy facade without clearRx: unbounded prefill
                        // (BTF-tail caveat applies).
                        readActive = true;
                        try {
                            const burst: number[] = [];
                            for (let i = 0; i < 32; i++) burst.push(br.read() & 0xff);
                            try { mcu.i2c1.injectRx(burst); } catch { /* ignore */ }
                        } catch { /* prefill never breaks start */ }
                    }
                } catch { /* ignore */ } }; } catch { /* ignore */ }
                try { mcu.i2c1.onWrite = (byte: number) => { try {
                    br.write(Number(byte) & 0xff);
                    // Early arm from the just-drained pointer: the read half
                    // usually executes in a later batch, so this lands first.
                    // PEEK (pure compute) — never br.read() here, the model
                    // stream only rebuilds at read-START.
                    if (!readActive && hasClear) {
                        pointerBytes.push(Number(byte) & 0xff);
                        if (pointerBytes.length >= 1) {
                            const peek = peekModel(lastAddr, pointerBytes[0], BURST);
                            if (peek.length > 0) {
                                try {
                                    safeClear();
                                    mcu.i2c1.injectRx(peek);
                                    injected = peek.length;
                                } catch { /* prefill never breaks the bus */ }
                            }
                        }
                    }
                } catch { /* ignore */ } }; } catch { /* ignore */ }
                try {
                    // NOTE: the engine's _read() calls onRead but IGNORES
                    // its return value — the MCU consumes the pre-queued
                    // injectRx FIFO. Count consumption and top the bounded
                    // burst back up (direct wasm call, lands before the next
                    // batch executes); the bridge serves the model register
                    // stream (pointer was set in the write phase).
                    mcu.i2c1.onRead = () => {
                        try {
                            readEvents++;
                            if (readActive && hasClear) topUp();
                            return 0xff;
                        } catch { return 0xff; }
                    };
                } catch { /* ignore */ }
                try { mcu.i2c1.onStop = () => { try {
                    br.stop(); busIdle = true; readActive = false;
                    safeClear();
                } catch { /* ignore */ } }; } catch { /* ignore */ }
            }
            // SPI: per-DR-write transfers grouped by 2ms sim gaps (mirrors
            // AVR's framing); MISO responses queue immediately (timing
            // validated live by the MFRC522 discriminator cells).
            const hasSpi = (() => {
                try {
                    for (const inst of this.instances.values()) {
                        if (typeof (inst as any)?.onSPIByte === 'function'
                            || typeof (inst as any)?.onSPIByteExchange === 'function') return true;
                    }
                } catch { /* ignore */ }
                return false;
            })();
            if (hasSpi && mcu.spi1) {
                this.spiBridge = createSPIBridge(bridgeCtx);
                const br = this.spiBridge;
                const self = this;
                try {
                    mcu.spi1.onTransfer = (ch: number, tx: number[], _rx: number[]) => {
                        void ch; void _rx;
                        try {
                            // Core-CS pre-publish: transfer callbacks fire
                            // DURING execute() while GPIO change events
                            // dispatch after it, so model CS reads stale HIGH
                            // mid-transfer (assert lands late and wipes the
                            // accumulated frame). Sample the FRESH core level
                            // per slave CS net and publish ahead of the bytes:
                            // assert(empty, harmless) → bytes → late LOW
                            // dedup-skipped → late HIGH closes the frame.
                            try {
                                for (const inst of self.instances.values()) {
                                    if (typeof (inst as any)?.onSPIByte !== 'function'
                                        && typeof (inst as any)?.onSPIByteExchange !== 'function') continue;
                                    const pins = (inst as any)?.pins || {};
                                    for (const nm of Object.keys(pins)) {
                                        if (!/^(cs|ss|ssel|nss|cs_n|nce|sda|ce)$/i.test(nm)) continue;
                                        const net = self.pinToNet.get(`${(inst as any)?.id}:${nm}`);
                                        if (net === undefined) continue;
                                        for (const [node, netId] of self.pinToNet) {
                                            if (netId !== net) continue;
                                            const sep = node.indexOf(':');
                                            if (sep < 0) continue;
                                            if (node.slice(0, sep) !== self.boardId) continue;
                                            const [port, n] = portPinFor(node.slice(sep + 1));
                                            if (!port) continue;
                                            let coreHigh: boolean | null = null;
                                            try {
                                                const r = (self.mcu as any)?.gpio?.pin?.(port, n)?.read?.();
                                                if (typeof r === 'boolean') coreHigh = r;
                                                else if (typeof r === 'number') coreHigh = r !== 0;
                                            } catch { /* ignore */ }
                                            if (coreHigh === null) continue;
                                            const cur = (self.pinStates as any)?.[node.slice(sep + 1)];
                                            if (cur !== !!coreHigh) {
                                                try { (self as any).publishGpio(node.slice(sep + 1), !!coreHigh); } catch { /* ignore */ }
                                            }
                                        }
                                    }
                                }
                            } catch { /* pre-publish never breaks transfer */ }
                            const nowMs = self.getSimulatedTimeMs();
                            // 2ms sim gap closes + posts the previous frame
                            // (mirrors AVR's idle framing), starting fresh.
                            if (nowMs - self.spiLastMs > 2.0) {
                                try { br.frame(true); } catch { /* ignore */ }
                            }
                            self.spiLastMs = nowMs;
                            const resps: number[] = [];
                            const arr = Array.isArray(tx) ? tx : [tx];
                            for (let i = 0; i < arr.length; i++) {
                                resps.push(br.exchange(Number(arr[i]) & 0xff, i) & 0xff);
                            }
                            try { mcu.spi1.injectMiso(resps); } catch { /* older builds */ }
                        } catch { /* transfer never breaks the tick */ }
                    };
                } catch { /* ignore */ }
            }
        } catch { /* bridge wiring never breaks boot */ }
    }

    private makeEngine() {
        const self = this;
        const txQueue: number[] = [];
        const gpioUnsubs: Array<() => void> = [];
        return {
            async loadFirmware(firmware: string, _boardType: string) {
                // Browser-safe: vendored facade under public/vendor (the
                // package exports map + node:fs use break bundlers).
                const engineMod: any = await importEngine(
                    'stm32f1-emu/pkg/stm32f1.js',
                    '/vendor/board-engines/stm32f1-emu/pkg/stm32f1.js',
                );
                const { STM32F1 } = engineMod ?? {};
                if (!STM32F1) {
                    console.warn('[Stm32f1Runner] engine unavailable (test env?) — idle.');
                    return;
                }
                const s = String(firmware || '').trim();
                const decode = (): { kind: 'elf' | 'hex' | 'bin'; data: Uint8Array | string } | null => {
                    if (!s) return null;
                    if (s.startsWith('ELFBASE64:')) return { kind: 'elf', data: b64ToU8(s.slice('ELFBASE64:'.length)) };
                    if (s.startsWith('UF2BASE64:')) return null; // F1 has no UF2 path
                    if (s.startsWith(':')) return { kind: 'hex', data: s };
                    try {
                        const raw = b64ToU8(s);
                        if (raw.length > 4 && raw[0] === 0x7f && raw[1] === 0x45 && raw[2] === 0x4c && raw[3] === 0x46) {
                            return { kind: 'elf', data: raw };
                        }
                        return { kind: 'bin', data: raw };
                    } catch { return null; }
                };
                const fw = decode();
                // Virtual I2C devices (runner-owned bridge foundation): data
                // callbacks (onWrite) only flow with a device attached, so
                // attach the package's virtual devices at the owned slave
                // addresses — OLED pairs get i2c_oled, everything else an
                // i2c_eeprom ACK-sink. Our onStart/onWrite/onStop callbacks
                // observe alongside and feed the real component models
                // (AVR-adapter pattern, zero component patches).
                let extDevices: any = undefined;
                try {
                    const seen = new Set<number>();
                    const oledAddrs: number[] = [];
                    const sinkAddrs: number[] = [];
                    for (const inst of self.instances.values()) {
                        if (typeof (inst as any)?.onI2CStart !== 'function') continue;
                        const id = String((inst as any)?.id || '');
                        const attrs = self.compAttrById?.get(id) || {};
                        const cands = [
                            (inst as any)?.i2cAddr,
                            typeof (inst as any)?.getI2CAddress === 'function' ? (inst as any).getI2CAddress() : NaN,
                            attrs?.address, attrs?.i2cAddress, attrs?.addr,
                        ];
                        for (const c of cands) {
                            const v = Number(c);
                            if (!Number.isFinite(v)) continue;
                            const addr = v & 0x7f;
                            if (seen.has(addr)) break;
                            seen.add(addr);
                            const type = String((inst as any)?.type || '').toLowerCase();
                            if (type.includes('ssd1306') || type.includes('oled')) oledAddrs.push(addr);
                            else sinkAddrs.push(addr);
                            break;
                        }
                    }
                    if (oledAddrs.length > 0 || sinkAddrs.length > 0) {
                        extDevices = {};
                        if (oledAddrs.length > 0) {
                            extDevices.i2c_oled = oledAddrs.slice(0, 4).map((address) => ({
                                peripheral: 'I2C1', address, width: 128, height: 64,
                            }));
                        }
                        if (sinkAddrs.length > 0) {
                            extDevices.i2c_eeprom = sinkAddrs.slice(0, 4).map((address) => ({
                                peripheral: 'I2C1', address, data: new Uint8Array(1024),
                            }));
                        }
                    }
                } catch { /* devices never break boot */ }
                const mkOpts = () => extDevices ? { chip: self.chip, ext_devices: extDevices } : { chip: self.chip };
                if (!fw) {
                    self.mcu = await STM32F1.create(mkOpts());
                } else if (fw.kind === 'elf') {
                    self.mcu = await STM32F1.fromELF(fw.data as Uint8Array, mkOpts());
                } else if (fw.kind === 'hex') {
                    self.mcu = await STM32F1.fromHex(fw.data as string, mkOpts());
                } else {
                    self.mcu = await STM32F1.fromBin(fw.data as Uint8Array, mkOpts());
                }
                self.mcu.usart1.onData = (b: number) => { txQueue.push(b & 0xff); };
                // Nucleo USART2 (PA2/PA3 ST-Link VCP): same TX queue, tagged
                // uart1 in the monitor via emitTxByte source below. Guarded —
                // older facade builds expose usart1 only.
                try { self.mcu.usart2.onData = (b: number) => { txQueue.push(b & 0xff); }; } catch { /* usart1-only */ }
                self.hookGpio(gpioUnsubs);
                // I2C/SPI bridges (runner-owned; no-ops without matching
                // peripherals or engine callbacks).
                try { self.wireBusBridges(); } catch { /* bridges never break boot */ }
            },
            stepBudget(budget: number): number {
                if (!self.mcu) return 0;
                try {
                    // Chunked coarse execute: 20K-instr chunks (the engine's
                    // native batch size — zero extra core pressure) with a
                    // scheduler drain + GPIO poll + fine-gate check between
                    // chunks. A single 1M execute starves step-domain chains
                    // for a whole tick (proven: DHT ACK stretched ~6ms, bits
                    // collapse) and can't notice a mid-tick WAKE (the DHT
                    // fine gate only re-evaluates per tick). 20K chunks bound
                    // scheduler lag to ~280us; a WAKE mid-tick flips to
                    // stepDhtFine for the remainder (512-instr slices for
                    // the 55us sensor-response window). ~50 FFI/tick — far
                    // from the 800+ starvation zone (see NOTE below).
                    // NOTE: small quanta were tried for MISO/RX timing
                    // (512-1024 inst slices) but starve the core (800+
                    // FFI calls/tick); single coarse execute + START
                    // prefill is the correct architecture instead.
                    // (20K chunks preserve it: same native batches, only the
                    // JS drain/poll runs between them.)
                    const n = Math.max(1, Math.floor(budget));
                    // SoftSerial TX observe: while armed, slice the budget
                    // into sub-bit steps and poll PB7 after each (the
                    // change-event path only arms — see softSerial fields).
                    if (self.softSerialArmed) return self.stepSoftSerialFine(n);
                    // Timer-ISR latency gate: a running update-IRQ timer
                    // needs sub-bit ISR latency (see timFineEngaged).
                    if (self.timFineEngaged()) return self.stepTimFine(n);
                    // DHT bit-slot gate: while a DHT-22 transaction is
                    // active, 20K batches quantize the 28/70µs data slots
                    // and the model's ACK schedule; slice + drain mid-tick
                    // (see dhtFineEngaged/stepDhtFine).
                    if (self.dhtFineEngaged()) return self.stepDhtFine(n);
                    self.lastStepSlice = 20000;
                    let coarseTotal = 0;
                    let remaining = n;
                    while (remaining > 0) {
                        const c = Math.min(20000, remaining);
                        let r: any = null;
                        try { r = self.mcu.execute(c); } catch { break; }
                        // Delta contract (see retiredDelta): the facade
                        // reports cumulative instCount; the base adds our
                        // return to simCycleCount, so accumulate retired.
                        coarseTotal += self.retiredDelta(Number(r?.instCount), c);
                        try { self.softSerialFlushPendingArm(); } catch { /* ignore */ }
                        try { self.drainDueCallbacks(); } catch { /* scheduler never breaks the tick */ }
                        try { self.pollGpioBidirectional(); } catch { /* poll never breaks the tick */ }
                        remaining -= c;
                        if (r?.stopped) break;
                        // Mid-tick WAKE: a DHT edge landed in this chunk —
                        // hand the remainder to fine slicing now instead of
                        // waiting for the next tick (the 55us ACK window
                        // cannot survive a coarse remainder).
                        try {
                            if (remaining > 0 && self.dhtFineEngaged()) {
                                try { self.stepDhtFine(remaining); } catch { /* ignore */ }
                                remaining = 0;
                                break;
                            }
                        } catch { /* gate never breaks stepping */ }
                    }
                    return Math.max(1, Math.floor(coarseTotal));
                } catch { return 0; }
            },
            drainUartOut(): number[] {
                // Net leveling: model-driven pins (shift-register outputs
                // etc.) fan out across component-only nets (engine owns
                // board nets).
                try { levelPassiveNets(self.boardId, (self as any).pinToNet, self.instances as any); } catch { /* never breaks drain */ }
                // Per-tick SPI idle flush (runs every base tick): closes a
                // frame whose last byte is older than the 2ms sim gap even
                // when setup-only traffic never triggers another transfer
                // or the real CS deassert never dispatches. See bus-bridge
                // idleFlush (single-slave synth-close, multi-slave safe).
                try {
                    const br = self.spiBridge as any;
                    if (br && typeof br.idleFlush === 'function') {
                        let nowMs = 0;
                        try { nowMs = self.getSimulatedTimeMs(); } catch { nowMs = 0; }
                        br.idleFlush(nowMs);
                    }
                } catch { /* flush never breaks the drain */ }
                // Per-tick ADC inject (3.3.0 ADC class): drive wired analog
                // voltages into ADC1 channels (PA0-7→ch0-7, PB0→8, PB1→9).
                // Pot wipers/sensors own the line here; firmware analogRead
                // samples it. No-op without ADC pins or engine support.
                try {
                    const adc = (self.mcu as any)?.adc1;
                    if (adc && typeof adc.setVoltage === 'function') {
                        const chFor: Record<string, number> = {
                            PA0: 0, PA1: 1, PA2: 2, PA3: 3,
                            PA4: 4, PA5: 5, PA6: 6, PA7: 7,
                            PB0: 8, PB1: 9,
                        };
                        for (const [pin, ch] of Object.entries(chFor)) {
                            try {
                                let volts: number | null = null;
                                for (const [node, netId] of self.pinToNet) {
                                    const sep = node.indexOf(':');
                                    if (sep < 0) continue;
                                    if (node.slice(0, sep) !== self.boardId) continue;
                                    if (node.slice(sep + 1).toUpperCase() !== pin) continue;
                                    for (const [node2, net2] of self.pinToNet) {
                                        if (net2 !== netId) continue;
                                        const s2 = node2.indexOf(':');
                                        if (s2 < 0) continue;
                                        if (node2.slice(0, s2) === self.boardId) continue;
                                        const inst = self.instances.get(node2.slice(0, s2));
                                        const v = Number((inst as any)?.getPinVoltage?.(node2.slice(s2 + 1)));
                                        if (Number.isFinite(v)) { volts = v; break; }
                                    }
                                    break;
                                }
                                if (volts !== null) {
                                    try { adc.setVoltage(ch, Math.max(0, Math.min(3300, volts * 1000))); } catch { /* ignore */ }
                                }
                            } catch { /* one pin never breaks the drain */ }
                        }
                        // Rail power for wiper sources (pots/dividers/servos):
                        // board power pins source no voltage today, so a pot
                        // wiper sits at 0V. Power VCC/5V rails (only) when the
                        // pin reads ~0 and its net touches a matching board
                        // rail pin — the model then divides honestly.
                        try {
                            const railSpecs: Array<{ pins: string[]; pat: RegExp; volts: number }> = [
                                { pins: ['VCC', 'vcc', 'VIN', 'vin', '1'], pat: /3V3/i, volts: 3.3 },
                                { pins: ['V+', 'VCC5', 'vcc5'], pat: /^5V$/i, volts: 5.0 },
                            ];
                            for (const inst of self.instances.values()) {
                                try {
                                    if (typeof (inst as any)?.getPinVoltage !== 'function'
                                        || typeof (inst as any)?.setPinVoltage !== 'function') continue;
                                    for (const spec of railSpecs) {
                                        for (const nm of spec.pins) {
                                            let v = 0;
                                            try { v = Number((inst as any).getPinVoltage(nm)) || 0; } catch { continue; }
                                            if (v > 0.2) continue;
                                            const net = self.pinToNet.get(`${(inst as any)?.id}:${nm}`);
                                            if (net === undefined) continue;
                                            let boardRail = false;
                                            for (const [node, netId] of self.pinToNet) {
                                                if (netId !== net) continue;
                                                const sep = node.indexOf(':');
                                                if (sep < 0) continue;
                                                if (node.slice(0, sep) !== self.boardId) continue;
                                                if (spec.pat.test(node.slice(sep + 1))) { boardRail = true; break; }
                                            }
                                            if (!boardRail) continue;
                                            try { (inst as any).setPinVoltage(nm, spec.volts); } catch { /* ignore */ }
                                        }
                                    }
                                } catch { /* one instance never breaks rails */ }
                            }
                        } catch { /* rails never break the drain */ }
                        // PWM observe (3.3.0 TIM class): first enabled TIM in
                        // servo range (40-60Hz) drives wired servo PWM pins
                        // via onPWMSignal (measured freq/duty, no faking).
                        try {
                            const mcu = self.mcu as any;
                            if (mcu) {
                                // Generalized: strongest duty across TIM1-7 drives
                                // LED models via onPWM({dutyCycle}) — no edge
                                // timing (GPIO batches + wall dilation make
                                // width measurement unreliable); the LED's
                                // cycle window holds brightness while polls
                                // land. Servos keep the bit-bang path below.
                                let best = 0;
                                let bestFreq = 0;
                                for (let n = 1; n <= 7; n++) {
                                    const tim = mcu[`tim${n}`];
                                    if (!tim || typeof tim.enabled !== 'function') continue;
                                    let en = false;
                                    try { en = !!tim.enabled(); } catch { continue; }
                                    if (!en) continue;
                                    let freq = 0;
                                    try { freq = Number(tim.frequency()) || 0; } catch { /* ignore */ }
                                    for (let ch = 0; ch < 4; ch++) {
                                        try {
                                            const d = Number(tim.duty(ch));
                                            if (Number.isFinite(d) && d > best) { best = d; bestFreq = freq; }
                                        } catch { /* ignore */ }
                                    }
                                }
                                if (best > 0) {
                                    const duty01 = Math.max(0, Math.min(1, best / 100));
                                    for (const inst of self.instances.values()) {
                                        try {
                                            if (typeof (inst as any)?.onPWM !== 'function') continue;
                                            if (typeof (inst as any)?.getPWMPinNames === 'function') continue;
                                            for (const pn of ['A', 'ANODE', '+']) {
                                                try { (inst as any).onPWM(pn, { dutyCycle: duty01, frequencyHz: bestFreq }); } catch { /* ignore */ }
                                            }
                                        } catch { /* one instance never breaks pwm */ }
                                    }
                                }
                            }
                        } catch { /* PWM observe never breaks the drain */ }
                    }
                } catch { /* ADC inject never breaks the drain */ }
                if (!txQueue.length) return [];
                return txQueue.splice(0, Math.min(txQueue.length, 1024));
            },
            injectUartByte(value: number) {
                try { self.mcu?.usart1?.send?.(String.fromCharCode(value & 0xff)); } catch { /* ignore */ }
                try { self.mcu?.usart2?.send?.(String.fromCharCode(value & 0xff)); } catch { /* ignore */ }
            },
            getPc(): number {
                try { return Number(self.mcu?.getPc?.()) || 0; } catch { return 0; }
            },
            // Input injection for the base bidirectional poll: buttons and
            // sensors drive wired pins into the core. Package API:
            // gpio.pin(port, n).setInput(bool) / setAnalog(volts).
            setGpioInput(pinId: string, high: boolean): void {
                try {
                    const [port, n] = portPinFor(pinId);
                    if (!port) return;
                    self.mcu?.gpio?.pin?.(port, n)?.setInput?.(!!high);
                } catch { /* ignore */ }
            },
            readAnalog(ref: string): number {
                void ref;
                return NaN; // ADC inject is setAnalog (volts) — no read path.
            },
            close(): void {
                try { gpioUnsubs.forEach((u) => { try { u(); } catch { /* ignore */ } }); } catch { /* ignore */ }
                try { self.mcu?.close?.(); } catch { /* ignore */ }
                try { self.softSerialDisarm(); } catch { /* ignore */ }
                try { self.softSerialTxHandle = null; } catch { /* ignore */ }
                self.mcu = null;
            },
            resetEngine(): void {
                // Facade reset() recreates the emulator; fire-and-forget.
                // SoftSerial observer rebases (retired counter zeroes).
                try { self.softSerialDisarm(); } catch { /* ignore */ }
                try { self.softSerialLastAbs = -1; } catch { /* ignore */ }
                try { void self.mcu?.reset?.(); } catch { /* ignore */ }
            },
        };
    }

    private hookGpio(unsubs: Array<() => void>): void {
        if (!this.mcu?.gpio) return;
        // Watch the pins the Blue Pill exposes; publish changes into SAB.
        const watch: Array<[string, number]> = [];        for (const n of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) watch.push(['A', n]);
        for (const n of [0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) watch.push(['B', n]);
        for (const n of [13, 14, 15]) watch.push(['C', n]);
        const led = f1LedFor(this.chip);
        for (const [port, pin] of watch) {
            try {
                const h = this.mcu.gpio.pin(port, pin);
                const u = h.on('change', (high: boolean, tcount?: number) => {
                    this.publishGpio(`P${port}${pin}`, !!high);
                    // SoftSerial TX arm (decode itself is poll-driven while
                    // armed — see softSerial fields): a driven falling edge
                    // on PB7 while idle means a start bit began somewhere in
                    // the last engine batch; arm and resync on the next
                    // validated frame. Coarse level tracks for edge sense.
                    // With engine pin-event stamps the fall carries its exact
                    // instruction count → exact-phase arm (no hunt).
                    try {
                        if (`P${port}${pin}` === this.softSerialTxPinId) {
                            const wasHigh = this.softSerialCoarseHigh;
                            this.softSerialCoarseHigh = !!high;
                            // Defer the arm past the clock advance (see
                            // softSerialFlushPendingArm): the callback fires
                            // inside the engine step, a full slice before
                            // the observer clock accounts for it — arming
                            // here would back-date from a stale clock.
                            if (!this.softSerialArmed && wasHigh && !high
                                && this.softSerialPendingArm === null) {
                                this.softSerialPendingArm = Number(tcount);
                            }
                        }
                    } catch { /* observer never breaks gpio */ }
                    if (port === led.port && pin === led.pin) {
                        try { (this.instances.get(this.boardId) as any)?.setState?.({ builtInLed: !!high }); } catch { /* ignore */ }
                    }
                });
                if (typeof u === 'function') unsubs.push(u);
            } catch { /* skip missing pin */ }
        }
    }

    // ── SoftSerial TX observer (PB7 @ 9600, 'softserial' source) ──────
    // AVR-mirror decode (start-bit edge → mid-bit samples → stop validate)
    // in the retired-instruction time domain. Change events only arm (batch
    // quantization); softSerialPoll does the timed sampling on sub-bit
    // slices driven by stepSoftSerialFine.

    /** Retired-instruction clock advance from a facade absolute counter. */
    private softSerialAdvanceClock(abs: number): void {        const a = Math.floor(Number(abs));
        if (!Number.isFinite(a) || a < 0) return;
        if (this.softSerialLastAbs < 0 || a < this.softSerialLastAbs) {
            // First sighting, or emulator recreated under us (reset zeroes
            // the counter): rebase without advancing.
            this.softSerialLastAbs = a;
            return;
        }
        const d = a - this.softSerialLastAbs;
        if (d > 0) {
            this.softSerialClock += d;
            this.softSerialLastAbs = a;
        }
    }

    /** Facade absolute → per-call delta. execute()/step() report the
     * cumulative retired count (probed: 1000 then 2000 for two
     * execute(1000)s), but the base runLoop's `simCycleCount += steps`
     * contract is DELTA (pico/retro return deltas; retro says so
     * explicitly). Returning the absolute inflated simCycleCount
     * quadratically and broke every step-domain delay (observed: DHT
     * wakeUs 18M us, 7/9 reads nan). Same rebase rule as
     * softSerialAdvanceClock, so the softserial clock is untouched —
     * only the value returned to the base changes. */
    private retiredDelta(abs: number, fallback: number): number {
        const a = Math.floor(Number(abs));
        if (Number.isFinite(a) && a >= 0 && this.softSerialLastAbs >= 0 && a >= this.softSerialLastAbs) {
            const d = a - this.softSerialLastAbs;
            if (d > 0) this.softSerialClock += d;
            this.softSerialLastAbs = a;
            return Math.max(1, d);
        }
        try { this.softSerialAdvanceClock(a); } catch { /* ignore */ }
        return Math.max(1, Math.floor(Number(fallback)) || 1);
    }
    private softSerialSysclkHz(): number {
        try {
            const hz = Number((this.mcu as any)?._emu?.rccSysclkHz?.());
            if (Number.isFinite(hz) && hz >= 1_000_000 && hz <= 100_000_000) return hz;
        } catch { /* fall through to default */ }
        return 72_000_000;
    }

    private softSerialNominalBit(): number {
        return Math.max(64, Math.floor(this.softSerialSysclkHz() / Math.max(300, this.softSerialBaud)));
    }

    private softSerialArm(edgeCount?: number): void {
        if (!this.mcu) return;
        this.softSerialArmed = true;
        this.softSerialReceiving = false;
        this.softSerialSampleIndex = 0;
        this.softSerialCurrentByte = 0;
        this.softSerialLastActivity = this.softSerialClock;
        // Fresh nominal period each arming (clock tree may still be coming
        // up at first traffic); consecutive-start calibration refines it.
        try { this.softSerialBitInstr = this.softSerialNominalBit(); } catch { /* keep last */ }
        try {
            this.softSerialTxHandle = this.mcu?.gpio?.pin?.(this.softSerialTxPort, this.softSerialTxPinNum) || null;
        } catch { this.softSerialTxHandle = null; }
        const bit = Math.max(64, this.softSerialBitInstr | 0);
        const startNow = (startRel: number) => {
            this.softSerialLastPollHigh = false;
            this.softSerialLastActivity = startRel;
            this.softSerialLastStartAt = null;
            this.softSerialReceiving = true;
            this.softSerialCurrentByte = 0;
            this.softSerialSampleIndex = 0;
            this.softSerialStartAt = startRel;
            this.softSerialSampleAt = startRel + Math.max(64, this.softSerialBitInstr | 0) * 1.5;
        };
        const t = Math.floor(Number(edgeCount));
        if (Number.isFinite(t) && t >= 0) {
            // Tier 1 — stamped fall (engine pin-event tcount): measure the
            // edge age in the ENGINE domain (instructionCountNow — the
            // facade instCount skips IRQ-handler instructions, so mixing
            // domains drifts under interrupt load) and receive this byte
            // immediately at true phase. Batch-drain quantization alone
            // shifts every frame (proven: first start t=11300 armed at
            // clock=40000 → permanent hunt). The age guard (one chunk +
            // margin) rejects stale/foreign stamps; older engine builds
            // omit the stamp (tcount undefined → NaN → skip).
            let wNow = NaN;
            try {
                const v = (this.mcu as any)?._emu?.instructionCountNow?.();
                wNow = typeof v === 'bigint' ? Number(v) : Math.floor(Number(v));
            } catch { /* ignore */ }
            if (Number.isFinite(wNow)) {
                const age = wNow - t;
                if (age >= -1024 && age <= 24000) {
                    startNow(this.softSerialClock - Math.max(0, age));
                    return;
                }
            }
        }
        // Tier 2 — fine-slice arm (TIM-gated or armed stepping): the arming
        // fall fired at most one slice ago, so back-date half a slice and
        // receive immediately (error ≤0.14 nominal bit — inside margin).
        if (this.lastStepSlice <= 4096) {
            startNow(this.softSerialClock - Math.floor(this.lastStepSlice / 2));
            return;
        }
        // Tier 3 — legacy coarse arm: the fall is up to a full batch old;
        // back-dating would exceed margin, so init the level and hunt the
        // next fall (previous behavior, unchanged).
        try {
            const lv = this.softSerialTxHandle?.read?.();
            if (lv === 0 || lv === 1) this.softSerialLastPollHigh = lv === 1;
        } catch { /* level init is best-effort */ }
    }

    private softSerialDisarm(): void {
        this.softSerialArmed = false;
        this.softSerialReceiving = false;
        this.softSerialSampleIndex = 0;
        this.softSerialCurrentByte = 0;
        this.softSerialPendingArm = null;
    }

    /**
     * Consume a deferred pin-change arm after the observer clock has
     * accounted for the slice containing the edge (call sites: every step
     * loop right after the clock advance, plus the coarse path). Arming
     * inside the pin callback itself would align against a stale clock
     * (one slice behind), shifting every frame by up to a slice.
     */
    private softSerialFlushPendingArm(): void {
        if (this.softSerialArmed) { this.softSerialPendingArm = null; return; }
        const t = this.softSerialPendingArm;
        this.softSerialPendingArm = null;
        if (t === null || t === undefined) return;
        try { this.softSerialArm(t); } catch { /* arm never breaks stepping */ }
    }

    private softSerialEmitByte(value: number): void {
        // Same contract as AVRRunner.emitSoftSerialByte: 'softserial' source.
        try { this.emitTxByte(value & 0xff, 'softserial'); } catch { /* ignore */ }
    }

    /**
     * Timer-IRQ fine-step gate: true while any general-purpose timer runs
     * with its update IRQ armed (CR1.CEN && DIER.UIE on TIM2/3/4). Polled
     * once per tick (6 peripheral reads); timer per-bit ISRs need sub-bit
     * delivery latency that 20K batches cannot give (see the field comment).
     * No-op without the low-level emulator handle.
     */
    private timFineEngaged(): boolean {
        try {
            const emu = (this.mcu as any)?._emu;
            if (!emu || typeof emu.periphRead !== 'function') return false;
            for (const base of [0x40000000, 0x40000400, 0x40000800]) {
                let cr1 = 0, dier = 0;
                try { cr1 = emu.periphRead(base, 4) >>> 0; } catch { continue; }
                if ((cr1 & 1) === 0) continue;
                try { dier = emu.periphRead(base + 0x0c, 4) >>> 0; } catch { continue; }
                if ((dier & 1) !== 0) return true;
            }
        } catch { /* gate never breaks stepping */ }
        return false;
    }

    /**
     * Fine stepping for timer-IRQ firmware: fixed ~2K slices (ISR latency
     * ≤0.27 nominal 9600-baud bit) with the same retired-counter clock
     * advance as the coarse path. No polling — the SoftSerial observer (or
     * any pin watcher) still arms off change events; the slices just make
     * those events and the underlying ISR delivery timely. Returns the
     * retired delta (see retiredDelta).
     */
    private stepTimFine(budget: number): number {
        const mcu = this.mcu;
        if (!mcu) return 0;
        let remaining = Math.max(1, Math.floor(budget));
        const slice = 2048;
        let guard = 0;
        const maxSlices = 2048;
        let total = 0;
        this.lastStepSlice = slice;
        while (remaining > 0 && guard++ < maxSlices) {
            const s = Math.min(slice, remaining);
            let r: any = null;
            try { r = mcu.step(s); } catch { break; }
            total += this.retiredDelta(Number(r?.instCount), s);
            try { this.softSerialFlushPendingArm(); } catch { /* ignore */ }
            // A mid-tick arm must poll for the REST of this tick too —
            // otherwise the arming byte's samples collapse into one stale
            // catch-up read at the next tick (proven: bits 0-4 sampled from
            // a single level → garbage first byte, self-sync only after).
            if (this.softSerialArmed) {
                try { this.softSerialPoll(); } catch { /* poll never breaks stepping */ }
            }
            remaining -= s;
            if (r?.stopped) break;
        }
        if (remaining > 0 && guard >= maxSlices) {
            // Degenerate (giant budget): finish coarse so the sim cannot
            // stall; timer latency degrades for this tick only.
            try {
                const r3 = mcu.execute(remaining);
                total += this.retiredDelta(Number(r3?.instCount), remaining);
            } catch { /* ignore */ }
        }
        return Math.max(1, Math.floor(total));
    }

    /** Fine-grained stepping while armed: sub-bit slices + PB7 poll.
     * Returns the retired delta (see retiredDelta). */
    private stepSoftSerialFine(budget: number): number {
        const mcu = this.mcu;
        if (!mcu) { try { this.softSerialDisarm(); } catch { /* ignore */ } return 0; }
        let remaining = Math.max(1, Math.floor(budget));
        // Sub-bit slices (~bit/8 retired instructions) with sane clamps:
        // too fine starves the core (see stepBudget NOTE), too coarse
        // misses edges. Calibration shrinks the slice as bitInstr settles.
        const bit = Math.max(64, this.softSerialBitInstr | 0);
        const slice = Math.max(256, Math.min(4096, Math.floor(bit / 8)));
        this.lastStepSlice = slice;
        let guard = 0;
        const maxSlices = 4096;
        let total = 0;
        while (remaining > 0 && guard++ < maxSlices) {
            const s = Math.min(slice, remaining);
            let r: any = null;
            try { r = mcu.step(s); } catch { break; }
            total += this.retiredDelta(Number(r?.instCount), s);
            remaining -= s;
            try { this.softSerialPoll(); } catch { /* poll never breaks stepping */ }
            try { this.softSerialFlushPendingArm(); } catch { /* ignore */ }
            if (r?.stopped) break;
            if (!this.softSerialArmed) {
                // Disarmed mid-budget (idle timeout): run the rest coarse.
                if (remaining > 0) {
                    try {
                        const r2 = mcu.execute(remaining);
                        total += this.retiredDelta(Number(r2?.instCount), remaining);
                    } catch { /* ignore */ }
                    remaining = 0;
                }
                break;
            }
        }
        if (remaining > 0 && guard >= maxSlices) {
            // Degenerate (giant budget vs tiny slice): finish coarse so the
            // sim cannot stall; decode may gap for this tick only.
            try {
                const r3 = mcu.execute(remaining);
                total += this.retiredDelta(Number(r3?.instCount), remaining);
            } catch { /* ignore */ }
        }
        return Math.max(1, Math.floor(total));
    }

    // ---- DHT-22 bit-slot fine stepping (DHT agent handoff) ----
    /** Board steps per microsecond: F1 sysclk (engine RCC, default 72M). */
    protected override cyclesPerMicrosecond(): number {
        try {
            return Math.max(1, Math.floor(this.softSerialSysclkHz() / 1_000_000));
        } catch { return 72; }
    }

    /** True while any DHT-22 component has an active transaction
     * (WAKE negotiation, ACK, or bit send). The model exposes
     * isTransactionActive(); anything else never engages. */
    private dhtFineEngaged(): boolean {
        try {
            for (const inst of this.instances.values()) {
                try {
                    if (typeof (inst as any)?.isTransactionActive === 'function'
                        && (inst as any).isTransactionActive()) return true;
                } catch { /* keep scanning */ }
            }
        } catch { /* gate never breaks stepping */ }
        return false;
    }

    /** Fine stepping for DHT transactions: 512-instr slices (~7µs at
     * 72MHz) with per-slice scheduler drain + GPIO poll, so release
     * detection and the model's 30/50/80µs ACK schedule meet the
     * firmware's CYCCNT bit reads in the same slot instead of
     * quantizing to whole-tick (~400K).
     * Counter discipline: the facade's execute() reports the ABSOLUTE
     * retired count, so derive per-slice deltas (same rebase rule as
     * softSerialAdvanceClock) — simCycleCount advances in real
     * instructions, the domain the DHT scheduler and firmware CYCCNT
     * share. Already advanced per-slice below, so return ~0: the base
     * runLoop's `simCycleCount += steps` then adds only its +1 floor
     * instead of double-counting the budget. */
    private stepDhtFine(budget: number): number {
        const mcu = this.mcu;
        if (!mcu) return 0;
        let remaining = Math.max(1, Math.floor(budget));
        // 512-instr slices (~7us at 72MHz): release detection and every
        // model edge land within 7us of target. Proven by sweep: sensor
        // lag 28us shifts the decode (12.00/25.00), per-edge jitter 28us
        // kills it (nan); lag<=7us + jitter<=7us decodes 24.00/50.00
        // deterministically. FFI cost (~800 slices/tick) applies only
        // while a transaction is active (~15 sim-ms per 2 sim-s).
        const slice = 512;
        let guard = 0;
        const maxSlices = 4096;
        this.lastStepSlice = slice;
        while (remaining > 0 && guard++ < maxSlices) {
            const s = Math.min(slice, remaining);
            let r: any = null;
            try { r = mcu.execute(s); } catch { break; }
            // Delta discipline (see retiredDelta): the facade reports a
            // cumulative count — derive retired-this-slice so the
            // scheduler domain matches firmware CYCCNT 1:1.
            const d = this.retiredDelta(Number(r?.instCount), s);
            try { this.simCycleCount += Math.max(1, Math.floor(d)); } catch { /* ignore */ }
            try { this.softSerialFlushPendingArm(); } catch { /* ignore */ }
            try { this.drainDueCallbacks(); } catch { /* scheduler never breaks the tick */ }
            try { this.pollGpioBidirectional(); } catch { /* poll never breaks the tick */ }
            remaining -= s;
            if (r?.stopped) break;
        }
        if (remaining > 0 && guard >= maxSlices) {
            try {
                const r3 = mcu.execute(remaining);
                this.retiredDelta(Number(r3?.instCount), remaining);
            } catch { /* ignore */ }
        }
        return 0;
    }

    /**
     * Base poll + release detection for bidirectional one-wire nets.
     * The engine's gpio change hooks fire on OUTPUT writes only, so a
     * firmware release to INPUT_PULLUP (DHT wake release → pull-up HIGH)
     * never publishes — the model would wait in WAKE_WAIT forever
     * (proven: edges=1). dhtPollInput() detects the release via the
     * GPIO MODE bits and emulates the pull-up the engine omits. Runs
     * every tick via the base runLoop and every slice via stepDhtFine;
     * same-level dedup keeps it a no-op when nothing moved.
     */
    protected override pollGpioBidirectional(): void {
        try { super.pollGpioBidirectional(); } catch { /* never break the tick */ }
        try { this.dhtPollInput(); } catch { /* poll never breaks the tick */ }
    }

    /** Sample readInput() on board pins netted to a one-wire model and
     * publish edges the output-only change hooks miss (see above).
     * MODE-aware bus policy (RM0008 §9.2): the facade's readInput()
     * resolves external drive else 0 — the internal pull-up is NOT
     * modeled (probed: CNF=10/ODR=1 reads 0 undriven). So while the
     * firmware holds the pin as OUTPUT, hooks own the line (skip
     * injection — output wins); once firmware releases to INPUT, the
     * runner IS the pull-up: push HIGH while the model idles, or the
     * model's driven level while it drives (_drivingBus), and publish
     * changes so the model sees release + ACK edges. Without this the
     * wake release never arrives (proven: edges=1, WAKE_WAIT). */
    private dhtPollInput(): void {
        if (!this.mcu) return;
        for (const [id, inst] of this.instances) {
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
                const net = this.pinToNet.get(`${id}:${cPin}`);
                if (net === undefined) continue;
                for (const [node, netId] of this.pinToNet) {
                    if (netId !== net) continue;
                    const sep = node.indexOf(':');
                    if (sep < 0) continue;
                    if (node.slice(0, sep) !== this.boardId) continue;
                    const bPin = node.slice(sep + 1);
                    const [port, n] = portPinFor(bPin);
                    if (!port || n < 0) continue;
                    // MODE==00 (input) → firmware released the bus.
                    let inputMode = false;
                    try {
                        const emu = (this.mcu as any)?._emu;
                        if (emu && typeof emu.periphRead === 'function') {
                            const base = 0x40010800 + (port.charCodeAt(0) - 65) * 0x400;
                            const cr = emu.periphRead(base + (n < 8 ? 0x00 : 0x04), 4) >>> 0;
                            const shift = (n < 8 ? n : n - 8) * 4;
                            inputMode = ((cr >>> shift) & 0x3) === 0;
                        }
                    } catch { continue; }
                    if (!inputMode) continue; // OUTPUT: hooks own it
                    const high = modelDriving ? modelHigh : true; // idle pull-up
                    try { this.engine.setGpioInput?.(bPin, high); } catch { /* ignore */ }
                    if (this.pinStates[bPin] !== !!high) {
                        try { this.publishGpio(bPin, !!high); } catch { /* ignore */ }
                    }
                }
            }
        }
    }

    private softSerialPollLevel(): boolean | null {
        try {
            if (!this.softSerialTxHandle && this.mcu) {
                try { this.softSerialTxHandle = this.mcu?.gpio?.pin?.(this.softSerialTxPort, this.softSerialTxPinNum) || null; } catch { /* ignore */ }
            }
            const lv = this.softSerialTxHandle?.read?.();
            if (lv === 0) return false;
            if (lv === 1) return true;
            return null;
        } catch { return null; }
    }

    /** Timed sampling on the instruction clock (AVR processSoftSerialDecode). */
    private softSerialPoll(): void {
        if (!this.softSerialArmed) return;
        const bit = Math.max(64, this.softSerialBitInstr | 0);
        const now = this.softSerialClock;
        const lv = this.softSerialPollLevel();
        if (lv === null) {
            // Dead pin read: only the idle timeout can release us.
            if (now - this.softSerialLastActivity > bit * 10 * 25) {
                try { this.softSerialDisarm(); } catch { /* ignore */ }
            }
            return;
        }
        const prev = this.softSerialLastPollHigh;
        if (lv !== prev) {
            this.softSerialLastPollHigh = lv;
            this.softSerialLastActivity = now;
        }
        // Idle timeout: ~25 byte-times without an edge → back to coarse.
        if (now - this.softSerialLastActivity > bit * 10 * 25) {
            try { this.softSerialDisarm(); } catch { /* ignore */ }
            return;
        }
        if (!this.softSerialReceiving) {
            // Candidate start on falling edge. Validated by the stop bit
            // below; false starts (mid-frame falls) are rejected there and
            // resync on the next fall.
            if (prev && !lv) {
                // Live calibration: back-to-back bytes start exactly 10
                // bits apart; refine the period from the measured delta so
                // instruction-vs-cycle skew cancels out. Window is TIGHT
                // around 10 CURRENT bits (not nominal): transmitters with
                // an inter-byte gap (STM32duino SoftwareSerial leaves ~1
                // idle bit: starts land ~11 bits apart) must NOT calibrate
                // — d/10 would lock 10% high and every later byte shifts
                // (proven runaway: 82K spacing → est 8227 → all garbage).
                if (this.softSerialLastStartAt !== null) {
                    const d = now - this.softSerialLastStartAt;
                    const b0 = Math.max(64, this.softSerialBitInstr | 0);
                    if (d > b0 * 9.7 && d < b0 * 10.3) {
                        const est = d / 10;
                        const nom = this.softSerialNominalBit();
                        const lo = Math.max(64, Math.floor(nom / 4));
                        const hi = Math.ceil(nom * 4);
                        this.softSerialBitInstr = Math.max(lo, Math.min(hi, Math.round(est)));
                    }
                }
                this.softSerialReceiving = true;
                this.softSerialCurrentByte = 0;
                this.softSerialSampleIndex = 0;
                this.softSerialStartAt = now;
                const b2 = Math.max(64, this.softSerialBitInstr | 0);
                this.softSerialSampleAt = now + b2 * 1.5;
            }
            return;
        }
        // Receiving: sample data bits at mid-bit (AVR: start+1.5B .. 8.5B),
        // then validate the stop bit at start+9.5B. Polls land ≤1 slice past
        // each sample point, so the current level reads the sampled bit
        // (same lastLevel semantics as AVR's processSoftSerialDecode).
        const b3 = Math.max(64, this.softSerialBitInstr | 0);
        let iter = 0;
        while (this.softSerialReceiving && now >= this.softSerialSampleAt && iter++ < 12) {
            if (this.softSerialSampleIndex < 8) {
                if (lv) this.softSerialCurrentByte |= (1 << this.softSerialSampleIndex);
                this.softSerialSampleIndex += 1;
                this.softSerialSampleAt = this.softSerialStartAt + b3 * (1.5 + this.softSerialSampleIndex);
                continue;
            }
            // Stop bit: valid frame when the line is HIGH (AVR parity).
            if (lv) {
                try { this.softSerialEmitByte(this.softSerialCurrentByte); } catch { /* ignore */ }
                this.softSerialLastStartAt = this.softSerialStartAt;
            }
            this.softSerialReceiving = false;
            this.softSerialSampleIndex = 0;
            this.softSerialCurrentByte = 0;
        }
    }

    protected budgetForDelta(deltaMs: number): number {
        // F1 bench: adaptive 20K/50K batches; ~50K inst/ms keeps UI smooth.
        return Math.floor(deltaMs * 50000 * this.speed);
    }

    protected maxBudgetPerTick(): number {
        return 1_000_000;
    }
}
