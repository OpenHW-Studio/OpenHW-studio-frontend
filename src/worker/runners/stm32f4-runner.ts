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
                if (svdXml) withAssets.svdXml = svdXml;
                if (wasmBytes) withAssets.wasmInit = wasmBytes;
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
                    const r = self.mcu.execute(Math.max(1, Math.floor(budget)));
                    return Number(r?.instCount ?? budget) || 0;
                } catch { return 0; }
            },
            drainUartOut(): number[] {
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
