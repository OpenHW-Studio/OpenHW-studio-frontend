/**
 * pico-runner.ts — Raspberry Pi Pico (RP2040) BoardRunner over pico-emu@1.0.3.
 *
 * Engine: Emscripten `picoemu.wasm.js` (`_picoemu_*`). One Module instance per
 * board runner (verified isolated). Firmware: UF2 (`_picoemu_load_uf2`) for
 * arduino-pico sketches; MicroPython: bundled `micropython_rp2040.uf2` base
 * image + user `main.py` injected over the REPL.
 *
 * UART: `_write_uart` RX, `_read_uart(0)` TX drain. GPIO: `_set_gpio` in,
 * `_get_gpio_out` out, published into pinStates + SAB pin bitfield.
 * WiFi/BLE/Ethernet (`_wifi_enable`, `_w5500_*`, `_bt_hci_*`) deferred —
 * see info/gapPico.md.
 */
import { ArmRunnerBase, importEngine } from './arm-runner-base.ts';
import { AVRRunnerOptions } from '../registries/component-registry.ts';

const PICO_UART_TX = ['GP0', 'GPIO0', '0', 'D0', 'TX', 'TX0'];
const PICO_UART_RX = ['GP1', 'GPIO1', '1', 'D1', 'RX', 'RX0'];
const MICROPYTHON_BASE_URL = '/firmware/micropython_rp2040.uf2';

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

    constructor(
        hexData: string,
        componentsDef: any[],
        wiresDef: any[],
        onStateUpdate: (state: any) => void,
        options: AVRRunnerOptions & { pyScript?: string } = {},
    ) {
        super(hexData, componentsDef, wiresDef, onStateUpdate, options);
        this.pyScript = String((options as any)?.pyScript || '');
        void this.boot('openhw-pico');
    }

    private makeEngine() {
        const self = this;
        return {
            async loadFirmware(firmware: string, _boardType: string) {
                // Engine loader: bundler first (node_modules, works in
                // vitest + vite build), public/vendor fallback at runtime
                // (workers serving the built app resolve /vendor/...).
                const engineMod: any = await importEngine(
                    'pico-emu/picoemu.wasm.js',
                    '/vendor/board-engines/pico-emu/picoemu.wasm.js',
                );
                const PicoemuModule = engineMod?.default;
                if (!PicoemuModule) {
                    console.warn('[PicoRunner] engine unavailable (test env?) — idle.');
                    return;
                }
                let wasmBinary: ArrayBuffer | undefined;
                try {
                    const r = await fetch('/wasm/picoemu.wasm.wasm');
                    if (r.ok) wasmBinary = await r.arrayBuffer();
                } catch { /* glue falls back to its own URL */ }
                self.mod = await (PicoemuModule as any)({
                    print: () => {}, printErr: () => {},
                    ...(wasmBinary ? { wasmBinary } : {}),
                });
                self.mod._picoemu_init(0); // arch 0 = RP2040
                self.mod._picoemu_set_clock(125);
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
                    self.pollGpio();
                    // After MicroPython REPL is up, inject the user script once.
                    if (self.isMicroPython && !self.pyInjected && self.pyScript.trim()) {
                        self.tryInjectPython();
                    }
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
            close(): void { self.mod = null; },
            resetEngine(): void {
                try { self.mod?._picoemu_reset?.(); } catch { /* ignore */ }
            },
        };
    }

    private loadImage(u8: Uint8Array): void {
        const looksUf2 = u8.length >= 512 && u8[0] === 0x55 && u8[1] === 0x46 && u8[2] === 0x44 && u8[3] === 0x32; // 'UF2\n' magic-ish
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
            const res = await fetch(MICROPYTHON_BASE_URL);
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
    private pollGpio(): void {
        try {
            const out = Number(this.mod?._picoemu_get_gpio_out?.()) || 0;
            const changed = (out ^ this.lastGpioOut) >>> 0;
            if (!changed) return;
            this.lastGpioOut = out;
            for (let pin = 0; pin < 29; pin++) {
                if ((changed >> pin) & 1) {
                    this.publishGpio(`GP${pin}`, !!((out >> pin) & 1));
                }
            }
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
