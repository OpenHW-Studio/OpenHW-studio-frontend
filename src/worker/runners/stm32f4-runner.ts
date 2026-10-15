/**
 * stm32f4-runner.ts — STM32F407 Discovery BoardRunner over stm32f4-emu@1.5.0.
 *
 * Engine: `STM32F4` facade via the package entry (`index.mjs`, which injects
 * SVD + WASM bindings — direct `site/stm32f4.js` import throws). One instance
 * per board runner (verified isolated). Firmware: fromELF/fromHex/fromBin.
 * `chip` option selects the F401/F411/F407/F429 table (default stm32f407).
 *
 * UART: `usart1.onData` TX hook (single shared model buffer — only usart1
 * fires, per package docs); `usart1.send`/`uartRx` RX. GPIO: `gpio.pin()`.
 */
import { ArmRunnerBase, importEngine } from './arm-runner-base.ts';
import { AVRRunnerOptions } from '../registries/component-registry.ts';

// F407 USART1: TX=PA9, RX=PA10. Discovery LEDs: PD12–PD15.
const F4_UART_TX = ['PA9', 'A9', 'TX', 'TX0', 'TX1'];
const F4_UART_RX = ['PA10', 'A10', 'RX', 'RX0', 'RX1'];

function b64ToU8(b64: string): Uint8Array {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

export class Stm32f4Runner extends ArmRunnerBase {
    protected uartTxPins = F4_UART_TX;
    protected uartRxPins = F4_UART_RX;
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
        if (typeof (options as any)?.chip === 'string') this.chip = (options as any).chip;
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
                const bindings = bindingsMod?.default ?? bindingsMod;
                if (!STM32F4) {
                    console.warn('[Stm32f4Runner] engine unavailable (test env?) — idle.');
                    return;
                }
                // Fetch SVD + wasm bytes from public/ so the facade never
                // touches the filesystem.
                let svdXml: string | undefined;
                let wasmBytes: Uint8Array | undefined;
                try {
                    const [svdRes, wasmRes] = await Promise.all([
                        fetch('/vendor/stm32f407.svd').catch(() => null),
                        fetch('/wasm/stm32_periph_wasm_bg.wasm').catch(() => null),
                    ]);
                    if (svdRes && svdRes.ok) svdXml = await svdRes.text();
                    if (wasmRes && wasmRes.ok) wasmBytes = new Uint8Array(await wasmRes.arrayBuffer());
                } catch { /* facade falls back to bundled resolution */ }
                // STM32F4._create(opts): opts.bindings defaults null (fine —
                // the emulator inits wasm via bindings.default(wasmInit)),
                // opts.svdXml wins over the node:fs fallback.
                const withAssets: any = { chip: self.chip, bindings };
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
                try { self.mcu?.usart1?.send?.(String.fromCharCode(value & 0xff)); } catch { /* ignore */ }
            },
            getPc(): number {
                try { return Number(self.mcu?.getPc?.()) || 0; } catch { return 0; }
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
        // F407 exposes banks A–K; watch the header-relevant subset.
        const banks = ['A', 'B', 'C', 'D', 'E'];
        for (const bank of banks) {
            for (let pin = 0; pin < 16; pin++) {
                try {
                    const h = this.mcu.gpio.pin(bank, pin);
                    const u = h.on('change', (high: boolean) => {
                        this.publishGpio(`P${bank}${pin}`, !!high);
                    });
                    if (typeof u === 'function') unsubs.push(u);
                } catch { /* skip missing pin */ }
            }
        }
    }

    protected budgetForDelta(deltaMs: number): number {
        return Math.floor(deltaMs * 50000 * this.speed);
    }

    protected maxBudgetPerTick(): number {
        return 1_000_000;
    }
}
