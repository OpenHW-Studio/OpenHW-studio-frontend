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
                const fw = decode();
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
                    if (!((self as any).f4SpiHot > 0) || total <= 512) {
                        const r = self.mcu.execute(total);
                        return Number(r?.instCount ?? total) || 0;
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
                            stepped = Number(r?.instCount ?? chunk) || 0;
                        } catch { break; }
                        done += Math.max(1, stepped);
                    }
                    return done || 0;
                } catch { return 0; }
            },
            drainUartOut(): number[] {
                // Net leveling: model-driven pins fan out across
                // component-only nets (engine owns board nets).
                try { levelPassiveNets(self.boardId, (self as any).pinToNet, self.instances as any); } catch { /* never breaks drain */ }
                // PWM observe via the TIM3 buzzer tap (freq Hz + duty
                // fraction, read from modeled timer regs). Drives LED
                // models speaking onPWM (capability detection, no
                // per-type code).
                try {
                    const buzz = (self.mcu as any)?.buzzer;
                    const duty = Number(buzz?.duty) || 0;
                    const freq = Number(buzz?.freq) || 0;
                    if (duty > 0 && freq > 0) {
                        for (const inst of self.instances.values()) {
                            try {
                                if (typeof (inst as any)?.onPWM !== 'function') continue;
                                if (typeof (inst as any)?.getPWMPinNames === 'function') continue;
                                for (const pn of ['A', 'ANODE', '+']) {
                                    try { (inst as any).onPWM(pn, { dutyCycle: Math.max(0, Math.min(1, duty)), frequencyHz: freq }); } catch { /* ignore */ }
                                }
                            } catch { /* one instance never breaks pwm */ }
                        }
                    }
                } catch { /* PWM observe never breaks the drain */ }
                // Per-tick ADC inject (facade setAdcChannel, raw 12-bit):
                // Disco PA0-7/PB0-1/PC0-5 map to ADC123 channels 0-15.
                // Wiper sources power like the F1 path (boards source no
                // power today): VCC rails on 3V3 nets driven to 3.3V, models
                // divide honestly, firmware analogRead samples it.
                try {
                    const mcu = self.mcu as any;
                    if (mcu && typeof mcu.setAdcChannel === 'function') {
                        const chFor: Record<string, number> = {
                            PA0: 0, PA1: 1, PA2: 2, PA3: 3,
                            PA4: 4, PA5: 5, PA6: 6, PA7: 7,
                            PB0: 8, PB1: 9,
                            PC0: 10, PC1: 11, PC2: 12, PC3: 13,
                            PC4: 14, PC5: 15,
                        };
                        for (const inst of self.instances.values()) {
                            try {
                                if (typeof (inst as any)?.getPinVoltage !== 'function') continue;
                                for (const nm of ['VCC', '1']) {
                                    let v = 0;
                                    try { v = Number((inst as any).getPinVoltage(nm)) || 0; } catch { continue; }
                                    if (v > 0.2) continue;
                                    const net = self.pinToNet.get(`${(inst as any)?.id}:${nm}`);
                                    if (net === undefined) continue;
                                    for (const [node, netId] of self.pinToNet) {
                                        if (netId !== net) continue;
                                        const sep = node.indexOf(':');
                                        if (sep < 0) continue;
                                        if (node.slice(0, sep) !== self.boardId) continue;
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
                                let netId: number | undefined = undefined;
                                for (const [node, netId2] of self.pinToNet) {
                                    const sep = node.indexOf(':');
                                    if (sep < 0) continue;
                                    if (node.slice(0, sep) !== self.boardId) continue;
                                    if (node.slice(sep + 1).toUpperCase() !== pin) continue;
                                    netId = netId2;
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
                                // DAC loopback: no component drives this net,
                                // but it touches a DAC output (PA4=ch1,
                                // PA5=ch2) whose channel is ENABLED
                                // (DAC_CR EN1/EN2) — poll DOR directly every
                                // drain (change events lag hundreds of ms and
                                // miss reset-zero writes). DOR readback IS
                                // the pin value (no analog layer in the
                                // engine), so it sources the ADC like a stiff
                                // driver (cf. ESP32 dacOutputs). Untouched
                                // DACs (EN clear) never drive the net, so
                                // plain analog input on PA4/PA5 is unaffected.
                                if (volts === null && netId !== undefined) {
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
                                            for (const [node3, net3] of self.pinToNet) {
                                                if (net3 !== netId) continue;
                                                const s3 = node3.indexOf(':');
                                                if (s3 < 0) continue;
                                                if (node3.slice(0, s3) !== self.boardId) continue;
                                                const bp = node3.slice(s3 + 1).toUpperCase();
                                                if (bp === 'PA4' && (cr & 0x1)) {
                                                    volts = (d1 & 0xfff) / 4095 * 3.3;
                                                    break;
                                                }
                                                if (bp === 'PA5' && (cr & 0x10000)) {
                                                    volts = (d2 & 0xfff) / 4095 * 3.3;
                                                    break;
                                                }
                                            }
                                        }
                                    } catch { /* DAC bridge never breaks ADC */ }
                                }
                                if (volts !== null) {
                                    try { mcu.setAdcChannel('ADC1', ch, Math.max(0, Math.min(4095, Math.round(volts / 3.3 * 4095)))); } catch { /* ignore */ }
                                }
                            } catch { /* one pin never breaks the drain */ }
                        }
                    }
                } catch { /* ADC inject never breaks the drain */ }
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
