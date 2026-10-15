/**
 * stm32f1-runner.ts — STM32F103 Blue Pill BoardRunner over stm32f1-emu@3.2.0.
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
                    self.mcu = await STM32F1.create({ chip: self.chip });
                } else if (fw.kind === 'elf') {
                    self.mcu = await STM32F1.fromELF(fw.data as Uint8Array, { chip: self.chip });
                } else if (fw.kind === 'hex') {
                    self.mcu = await STM32F1.fromHex(fw.data as string, { chip: self.chip });
                } else {
                    self.mcu = await STM32F1.fromBin(fw.data as Uint8Array, { chip: self.chip });
                }
                self.mcu.usart1.onData = (b: number) => { txQueue.push(b & 0xff); };
                // Nucleo USART2 (PA2/PA3 ST-Link VCP): same TX queue, tagged
                // uart1 in the monitor via emitTxByte source below. Guarded —
                // older facade builds expose usart1 only.
                try { self.mcu.usart2.onData = (b: number) => { txQueue.push(b & 0xff); }; } catch { /* usart1-only */ }
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
                try { self.mcu?.usart2?.send?.(String.fromCharCode(value & 0xff)); } catch { /* ignore */ }
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
        const led = f1LedFor(this.chip);
        for (const [port, pin] of watch) {
            try {
                const h = this.mcu.gpio.pin(port, pin);
                const u = h.on('change', (high: boolean) => {
                    this.publishGpio(`P${port}${pin}`, !!high);
                    if (port === led.port && pin === led.pin) {
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
