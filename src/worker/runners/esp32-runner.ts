/**
 * esp32-runner.ts — ESP32 DevKit BoardRunner over esp32-emu@1.1.0.
 *
 * Engine: `SimulatorWorker` (WASM Xtensa + native peripherals). One worker
 * per board runner (verified isolated).
 *
 * Firmware contract (boardHexMap carries `compiled.hex`):
 *   Arduino `.bin` → backend `bin` artifact = `<sketch>.ino.merged.bin`
 *   (full 4MB flash image: bootloader@0x1000 + partitions@0x8000 +
 *   app@0x10000), raw base64, flashed at offset 0. Verified: boots to
 *   setup()/loop(), Serial.println reaches _onUART.
 *   MicroPython image → offset 0x1000 (`esptool write_flash 0x1000` rule).
 *
 * UART: `_onUART` TX hook → emit; `sendUart` RX (string). GPIO: `setPinInput`.
 * Board preset: `board:'esp32-cam'` (component attr or option) selects the
 * AI-Thinker ESP32-CAM preset (4MB flash + 4MB PSRAM); default is DevKit.
 * WiFi/BLE/Ethernet deferred — see info/gapEsp32.md.
 */
import { ArmRunnerBase, importEngine } from './arm-runner-base.ts';
import { AVRRunnerOptions } from '../registries/component-registry.ts';

const ESP32_UART_TX = ['1', 'D1', 'TX', 'TX0', 'GPIO1'];
const ESP32_UART_RX = ['3', 'D3', 'RX', 'RX0', 'GPIO3'];
const MICROPYTHON_BASE_URL = '/firmware/micropython_esp32.bin';

function b64ToU8(b64: string): Uint8Array {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

export class Esp32Runner extends ArmRunnerBase {
    protected uartTxPins = ESP32_UART_TX;
    protected uartRxPins = ESP32_UART_RX;
    protected engine = this.makeEngine();
    private sim: any = null;
    private isMicroPython = false;
    private board: string;

    constructor(
        hexData: string,
        componentsDef: any[],
        wiresDef: any[],
        onStateUpdate: (state: any) => void,
        options: AVRRunnerOptions & { pyScript?: string; board?: string } = {},
    ) {
        super(hexData, componentsDef, wiresDef, onStateUpdate, options);
        // ESP32-CAM uses the esp32-cam board preset (4MB flash + 4MB PSRAM);
        // plain DevKit uses 'esp32'. Attr / option wins, type fallback.
        const optBoard = String((options as any)?.board || '').toLowerCase();
        const compBoard = String(
            (componentsDef || []).find((c: any) => String(c?.id) === String((options as any)?.boardId))?.type || '',
        ).toLowerCase();
        this.board = optBoard.includes('cam') || compBoard.includes('cam') ? 'esp32-cam' : 'esp32';
        void this.boot(this.board === 'esp32-cam' ? 'openhw-esp32-cam' : 'openhw-esp32');
    }

    private makeEngine() {
        const self = this;
        const txQueue: number[] = [];
        return {
            async loadFirmware(firmware: string, _boardType: string) {
                // Browser-safe import: the package root pulls node:crypto
                // (partition-table) which Vite externalizes for browsers, and
                // the package exports map only exposes ".". Lazy-load the
                // vendored SAB worker-proxy (public/vendor mirror of the
                // package file; its worker-entry.js is patched to stub the
                // node:crypto MD5 — custom-CSV partitions only) and hand it
                // the engine wasm + ROM fetched from public/.
                const engineMod: any = await importEngine(
                    'esp32-emu/dist/sab/worker-proxy.js',
                    '/vendor/board-engines/esp32-emu/dist/sab/worker-proxy.js',
                );
                const { SimulatorWorker } = engineMod ?? {};
                if (!SimulatorWorker) {
                    console.warn('[Esp32Runner] engine unavailable (test env?) — idle.');
                    return;
                }
                let wasmBinary: Uint8Array | null = null;
                let rom: Uint8Array | null = null;
                try {
                    const [w, r] = await Promise.all([
                        fetch('/wasm/esp_engine_wasm.wasm'),
                        fetch('/firmware/esp32-v3-rom.bin'),
                    ]);
                    if (w.ok) wasmBinary = new Uint8Array(await w.arrayBuffer());
                    if (r.ok) rom = new Uint8Array(await r.arrayBuffer());
                } catch { /* worker falls back to bundled resolution */ }
                const flash = new Uint8Array(4 * 1024 * 1024).fill(0xff);
                const s = String(firmware || '').trim();
                if (s) {
                    const isBin = !s.startsWith('UF2BASE64:') && !s.startsWith('ELFBASE64:') && !s.startsWith(':');
                    void isBin;
                    // Backend `bin` artifacts arrive as raw base64 (no prefix).
                    const raw = s.startsWith('UF2BASE64:') || s.startsWith('ELFBASE64:')
                        ? s.slice(s.indexOf(':') + 1) : s;
                    try {
                        const img = b64ToU8(raw);
                        flash.set(img.subarray(0, flash.length), 0);
                    } catch { /* boot ROM only */ }
                } else {
                    // No Arduino image: try MicroPython base image.
                    try {
                        const res = await fetch(MICROPYTHON_BASE_URL);
                        if (res.ok) {
                            const img = new Uint8Array(await res.arrayBuffer());
                            flash.set(img.subarray(0, flash.length), 0x1000);
                            self.isMicroPython = true;
                        }
                    } catch { /* boot ROM only */ }
                }
                self.sim = new SimulatorWorker();
                self.sim._onUART = (b: number) => { txQueue.push(b & 0xff); };
                self.sim._onError = (e: any) => console.error('[Esp32Runner]', e);
                // Board preset: 'esp32-cam' applies ESP32_CAM_DEFAULTS
                // (4MB flash + 4MB PSRAM) via applyBoardPreset semantics;
                // explicit sizes below always win (package contract).
                const isCam = self.board === 'esp32-cam';
                await self.sim.init(isCam ? 'esp32-cam' : 'ESP32', { flashSizeMB: 4, mmuPages: 64, strapValue: 0x13, budget: 2_000_000 }, flash, rom);
                try {
                    if (wasmBinary && typeof self.sim.loadWasm === 'function') {
                        await self.sim.loadWasm(wasmBinary);
                    }
                } catch (e) { console.warn('[Esp32Runner] loadWasm failed:', e); }
                self.sim.run();
                // Poll pump: SimulatorWorker needs pollUart() calls to move
                // bytes from the WASM ring into _onUART.
                const pump = () => {
                    if (!self.sim) return;
                    try { self.sim.pollUart(); } catch { /* ignore */ }
                    if (self.running) setTimeout(pump, 50);
                };
                pump();
            },
            stepBudget(_budget: number): number {
                // Free-running core: run() advances on its own cadence; the
                // budget tick only keeps peripheral instances + TX flowing.
                // Return nonzero so stepCycles() reports progress.
                // NOTE: no per-tick publishGpio here — the base
                // pollGpioBidirectional() owns output publishing via
                // sampleGpioOut below, so edges fire once.
                try { self.pollGpio(); } catch { /* never breaks tick */ }
                return Math.max(1, Math.floor(_budget));
            },
            drainUartOut(): number[] {
                try { self.sim?.pollUart?.(); } catch { /* ignore */ }
                if (!txQueue.length) return [];
                return txQueue.splice(0, Math.min(txQueue.length, 1024));
            },
            injectUartByte(value: number, _source?: string) {
                try {
                    const ch = String.fromCharCode(value & 0xff);
                    if (typeof self.sim?.sendUart === 'function') self.sim.sendUart(ch);
                } catch { /* ignore */ }
            },
            getPc(): number {
                try { return Number(self.sim?.pc) || 0; } catch { return 0; }
            },
            // Output sampler for the base bidirectional poll. The SAB
            // proxy has NO GPIO-output readback (setPinInput is input-only;
            // index.d.ts exposes no getPinLevel/onGpio — verified 2026-10).
            // Return null (no poll-model output) so wired components keep
            // whatever the rest of the net says; document as engine gap.
            sampleGpioOut(_pinId: string): { level: number; driving: boolean } | null {
                void _pinId;
                return null;
            },
            // Input injection for the base bidirectional poll. Package API:
            // sim.setPinInput(pinNumber, level) (index.d.ts) — async.
            setGpioInput(pinId: string, high: boolean): void {
                try {
                    const n = parseInt(String(pinId || '').replace(/^(GPIO|D)/i, ''), 10);
                    if (!Number.isFinite(n)) return;
                    void self.sim?.setPinInput?.(n, high ? 1 : 0);
                } catch { /* ignore */ }
            },
            readAnalog(_ref: string): number {
                return NaN; // no ADC read path on the facade.
            },
            isHalted(): boolean {
                try { return !!self.sim?.stuck; } catch { return false; }
            },
            close(): void {
                try { self.sim?.terminate?.(); } catch { /* ignore */ }
                self.sim = null;
            },
            resetEngine(): void {
                try { self.sim?.pressResetButton?.(); } catch { /* ignore */ }
            },
        };
    }

    /** Poll pump for the (input-only) GPIO path: no output readback
     * exists on the SAB proxy, so nothing to mirror here. Kept as
     * a named hook for forward-compat (engine gap, not a silent
     * no-op — see sampleGpioOut above). */
    private pollGpio(): void { /* engine has no GPIO-output readback */ }

    /** Drive a GPIO input level (host-driven pin toggle, e.g. buttons). */
    async setGpioInput(pinNumber: number, high: boolean): Promise<void> {
        try { await this.sim?.setPinInput?.(pinNumber, high ? 1 : 0); } catch { /* ignore */ }
    }

    protected budgetForDelta(deltaMs: number): number {
        return Math.floor(deltaMs * 1000 * this.speed);
    }
}
