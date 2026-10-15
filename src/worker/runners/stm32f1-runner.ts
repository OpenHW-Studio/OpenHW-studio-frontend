/**
 * stm32f1-runner.ts — STM32F103 Blue Pill BoardRunner over stm32f1-emu@3.2.0.
 *
 * Engine: `STM32F1` facade. One instance per board runner (verified
 * isolated). Firmware: auto-detect — ELF magic `7F 45 4C 46` → fromELF,
 * leading `:` → fromHex, else raw bin → fromBin.
 *
 * UART: `usart1.onData` TX hook → emit; `usart1.send`/`uartRx` RX. GPIO:
 * `gpio.pin(port, n).on('change')` out → publish; `setInput/setAnalog` in.
 */
import { ArmRunnerBase, importEngine } from './arm-runner-base.ts';
import { AVRRunnerOptions } from '../registries/component-registry.ts';

// Blue Pill USART1: TX=PA9, RX=PA10. LED: PC13.
const F1_UART_TX = ['PA9', 'A9', 'TX', 'TX0', 'TX1'];
const F1_UART_RX = ['PA10', 'A10', 'RX', 'RX0', 'RX1'];

function b64ToU8(b64: string): Uint8Array {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

export class Stm32f1Runner extends ArmRunnerBase {
    protected uartTxPins = F1_UART_TX;
    protected uartRxPins = F1_UART_RX;
    protected engine = this.makeEngine();
    private mcu: any = null;

    constructor(
        hexData: string,
        componentsDef: any[],
        wiresDef: any[],
        onStateUpdate: (state: any) => void,
        options: AVRRunnerOptions = {},
    ) {
        super(hexData, componentsDef, wiresDef, onStateUpdate, options);
        void this.boot('openhw-stm32-bluepill');
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
                if (!fw) {
                    self.mcu = await STM32F1.create();
                } else if (fw.kind === 'elf') {
                    self.mcu = await STM32F1.fromELF(fw.data as Uint8Array);
                } else if (fw.kind === 'hex') {
                    self.mcu = await STM32F1.fromHex(fw.data as string);
                } else {
                    self.mcu = await STM32F1.fromBin(fw.data as Uint8Array);
                }
                self.mcu.usart1.onData = (b: number) => { txQueue.push(b & 0xff); };
                self.hookGpio(gpioUnsubs);
            },
            stepBudget(budget: number): number {
                if (!self.mcu) return 0;
                try {
                    const r = self.mcu.execute(Math.max(1, Math.floor(budget)));
                    return Number(r?.instCount ?? r?.totalSteps ?? budget) || 0;
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
                // Facade reset() recreates the emulator; fire-and-forget.
                try { void self.mcu?.reset?.(); } catch { /* ignore */ }
            },
        };
    }

    private hookGpio(unsubs: Array<() => void>): void {
        if (!this.mcu?.gpio) return;
        // Watch the pins the Blue Pill exposes; publish changes into SAB.
        const watch: Array<[string, number]> = [];
        for (const n of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) watch.push(['A', n]);
        for (const n of [0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) watch.push(['B', n]);
        for (const n of [13, 14, 15]) watch.push(['C', n]);
        for (const [port, pin] of watch) {
            try {
                const h = this.mcu.gpio.pin(port, pin);
                const u = h.on('change', (high: boolean) => {
                    this.publishGpio(`P${port}${pin}`, !!high);
                    if (port === 'C' && pin === 13) {
                        try { (this.instances.get(this.boardId) as any)?.setState?.({ builtInLed: !!high }); } catch { /* ignore */ }
                    }
                });
                if (typeof u === 'function') unsubs.push(u);
            } catch { /* skip missing pin */ }
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
