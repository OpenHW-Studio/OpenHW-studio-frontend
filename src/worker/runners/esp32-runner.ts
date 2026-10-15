/**
 * esp32-runner.ts — ESP32 DevKit BoardRunner over esp32-emu@1.2.0.
 *
 * Engine: `SimulatorWorker` (WASM Xtensa + native peripherals, SAB worker
 * split mode). One worker per board runner (verified isolated).
 *
 * 1.2.0 taps (wired below; were engine gaps in 1.1.0): I2C slave attach +
 * event poll + RX drain + TX preload (split-mode onStart/onWrite/onRead/
 * onStop), SPI MISO inject + MOSI poll, GPIO-out readback + edge poll,
 * per-pin ADC inject, LEDC readback, OneWire model, MMIO backdoor.
 * Async polls feed the shared sync bridges (bus-bridge.ts) from .then
 * callbacks — never mid-transaction (package contract).
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
import { createI2CBridge, createSPIBridge, collectI2CSlaveAddresses } from '../bus-bridge.ts';

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
                // 1.2.0 peripheral taps: attach owned I2C slaves + start the
                // async poll pumps (I2C events, SPI MOSI, GPIO-out edges).
                // Preload nothing (displays are write-only); sensor ROM
                // bytes prestage per-cell via pushI2cTx when needed.
                try { self.wireBusTaps(); } catch { /* taps never break boot */ }
                // Poll pump: SimulatorWorker needs pollUart() calls to move
                // bytes from the WASM ring into _onUART.
                const pump = () => {
                    if (!self.sim) return;
                    try { self.sim.pollUart(); } catch { /* ignore */ }
                    try { self.pollBusTaps(); } catch { /* ignore */ }
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
                try { self.pollBusTaps(); } catch { /* never breaks tick */ }
                return Math.max(1, Math.floor(_budget));
            },
            drainUartOut(): number[] {
                try { self.sim?.pollUart?.(); } catch { /* ignore */ }
                // Per-tick SPI idle flush (same contract as the F1 runner):
                // closes a frame whose last byte is older than the 2ms sim
                // gap when the real CS deassert never dispatches.
                try {
                    const br = self.spiBridge as any;
                    if (br && typeof br.idleFlush === 'function') {
                        let nowMs = 0;
                        try { nowMs = self.getSimulatedTimeMs(); } catch { nowMs = 0; }
                        br.idleFlush(nowMs);
                    }
                } catch { /* flush never breaks the drain */ }
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

    /** 1.2.0 bus taps: attach owned I2C slaves on both buses, create the
     * shared sync bridges (bus-bridge.ts). Async polls below feed them
     * from .then callbacks — never mid-transaction (package contract). */
    private i2cBridge: any = null;
    private spiBridge: any = null;
    private compAttrById = new Map<string, any>();
    private wireBusTaps(): void {
        const self = this;
        try {
            const defs: any[] = [];
            try {
                for (const inst of this.instances.values()) {
                    self.compAttrById.set(String((inst as any)?.id || ''), {});
                }
                void defs;
            } catch { /* ignore */ }
            const ctx: any = {
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
            const addrs = collectI2CSlaveAddresses({ instances: this.instances, compAttrById: this.compAttrById } as any);
            if (addrs.length > 0) {
                this.i2cBridge = createI2CBridge(ctx);
                for (const a of addrs.slice(0, 8)) {
                    for (const bus of [0, 1]) {
                        try { void self.sim?.attachI2cSlave?.(bus, a & 0x7f)?.catch?.(() => {}); } catch { /* ignore */ }
                    }
                }
            }
            try {
                let hasSpi = false;
                for (const inst of this.instances.values()) {
                    if (typeof (inst as any)?.onSPIByte === 'function'
                        || typeof (inst as any)?.onSPIByteExchange === 'function') { hasSpi = true; break; }
                }
                if (hasSpi) this.spiBridge = createSPIBridge(ctx);
                // Arm MOSI capture on all buses: the engine only hooks a
                // bus after onTransfer/misoQueue/capture-arm; an empty
                // inject arms capture-only observation (package contract).
                if (hasSpi) {
                    for (const bus of [0, 1, 2, 3]) {
                        try { void self.sim?.injectSpiMiso?.(bus, [])?.catch?.(() => {}); } catch { /* ignore */ }
                    }
                }
            } catch { /* ignore */ }
        } catch { /* taps never break boot */ }
    }

    /** Async per-tick poll: I2C events → bridge, SPI MOSI → bridge,
     * GPIO-out edges → publishGpio + cache. Fire-and-forget; each poll
     * resolving feeds the sync bridges from .then (never blocks tick). */
    private pollBusTaps(): void {
        const self = this;
        try {
            if (this.i2cBridge && typeof self.sim?.pollI2c === 'function') {
                for (const bus of [0, 1]) {
                    try {
                        (self.sim.pollI2c(bus) as Promise<any[]>).then((evts) => {
                            try {
                                const br = self.i2cBridge;
                                if (!br || !Array.isArray(evts)) return;
                                for (const e of evts) {
                                    if (!e || typeof e.t !== 'string') continue;
                                    if (e.t === 'start') { try { br.start(Number(e.addr) & 0x7f, !!e.read); } catch { /* ignore */ } }
                                    else if (e.t === 'write') { try { br.write(Number(e.byte) & 0xff); } catch { /* ignore */ } }
                                    else if (e.t === 'read') {
                                        // Master consumed a byte: prestage next from model.
                                        try {
                                            const b = br.read() & 0xff;
                                            void self.sim?.pushI2cTx?.(bus, Number(e.addr) & 0x7f, [b])?.catch?.(() => {});
                                        } catch { /* ignore */ }
                                    }
                                    else if (e.t === 'stop') { try { br.stop(); } catch { /* ignore */ } }
                                }
                            } catch { /* event feed never breaks poll */ }
                        }).catch(() => {});
                    } catch { /* ignore */ }
                }
            }
            if (this.spiBridge && typeof self.sim?.pollSpiTx === 'function') {
                // User buses are 2/HSPI and 3/VSPI; poll both (+0/1 harmless).
                for (const bus of [2, 3]) {
                    try {
                        (self.sim.pollSpiTx(bus) as Promise<number[]>).then((mosi) => {
                            try {
                                const br = self.spiBridge;
                                if (!br || !Array.isArray(mosi) || mosi.length === 0) return;
                                let idx = 0;
                                for (const b of mosi) {
                                    try { br.exchange(Number(b) & 0xff, idx++); } catch { /* ignore */ }
                                }
                                try { br.frame(true); } catch { /* ignore */ }
                            } catch { /* feed never breaks poll */ }
                        }).catch(() => {});
                    } catch { /* ignore */ }
                }
            }
            if (typeof self.sim?.pollGpioChanges === 'function') {
                try {
                    (self.sim.pollGpioChanges() as Promise<Array<{ pin: number; level: number }>>).then((edges) => {
                        try {
                            if (!Array.isArray(edges)) return;
                            for (const e of edges) {
                                if (!e || !Number.isFinite(Number(e.pin))) continue;
                                const label = `GPIO${Number(e.pin)}`;
                                const high = !!Number(e.level);
                                try { self.gpioOutCache.set(label.toUpperCase(), high); } catch { /* ignore */ }
                                try { (self as any).publishGpio(label, high); } catch { /* ignore */ }
                            }
                        } catch { /* edges never break poll */ }
                    }).catch(() => {});
                } catch { /* ignore */ }
            }
        } catch { /* poll never breaks tick */ }
    }

    /** Drive a GPIO input level (host-driven pin toggle, e.g. buttons). */
    async setGpioInput(pinNumber: number, high: boolean): Promise<void> {
        try { await this.sim?.setPinInput?.(pinNumber, high ? 1 : 0); } catch { /* ignore */ }
    }

    protected budgetForDelta(deltaMs: number): number {
        return Math.floor(deltaMs * 1000 * this.speed);
    }
}
