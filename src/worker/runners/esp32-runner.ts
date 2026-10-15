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
import { createI2CBridge, createSPIBridge, collectI2CSlaveAddresses, levelPassiveNets } from '../bus-bridge.ts';

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
                // NOTE: chipType is always 'ESP32' (the worker's only
                // constructor); the cam preset rides config.board
                // (init('esp32-cam') dies with "Unknown chip" and a
                // silent dead sim — observed live as zero serial).
                await self.sim.init('ESP32', { board: self.board, flashSizeMB: 4, mmuPages: 64, strapValue: 0x13, budget: 2_000_000 }, flash, rom);
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
            // 1-Wire (DS18B20): the engine emulates the sensor once
            // attached (attachOneWire + setOneWireTemp); the component
            // model stays passive (never fed, so no double-drive) and
            // gets rail power from driveEsp32ADC. No per-tick pump needed.
            try {
                for (const inst of this.instances.values()) {
                    const t = String((inst as any)?.type || '').toLowerCase();
                    if (!t.includes('ds18b20')) continue;
                    const gpio = self.oneWireGpio(inst);
                    if (gpio < 0) continue;
                    let temp = 25;
                    try {
                        const a = (inst as any)?.attrs || {};
                        const v = Number(a.temperature ?? a.temp);
                        if (Number.isFinite(v)) temp = v;
                    } catch { /* ignore */ }
                    try { void self.sim?.attachOneWire?.(gpio)?.catch?.(() => {}); } catch { /* ignore */ }
                    try { void (self.sim as any)?.setOneWireTemp?.(gpio, temp)?.catch?.(() => {}); } catch { /* ignore */ }
                    try { self.owPins.add(gpio); } catch { /* ignore */ }
                }
            } catch { /* 1-wire never breaks boot */ }
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
            // ADC inject + PWM observe (1.2.0 taps; no-ops without them).
            try { self.driveEsp32ADC(); } catch { /* never breaks tick */ }
            try { self.pollEsp32PWM(); } catch { /* never breaks tick */ }
            // Net leveling: model-driven pins fan out across
            // component-only nets (engine owns board nets).
            try { levelPassiveNets(self.boardId, (self as any).pinToNet, self.instances as any); } catch { /* never breaks tick */ }
            // 1-Wire pump: pollOneWire drives the sensor state machine
            // (presence + scratchpad); without it the bus stays silent.
            try {
                const t = ((self.owTick || 0) + 1) % 3;
                self.owTick = t;
                if (t === 0 && self.owPins.size > 0 && typeof (self.sim as any)?.pollOneWire === 'function') {
                    for (const pin of self.owPins) {
                        try { void ((self.sim as any).pollOneWire(pin) as Promise<any>)?.catch?.(() => {}); } catch { /* ignore */ }
                    }
                }
            } catch { /* never breaks tick */ }
            // TWAI virtual-peer loopback: periodically offer one standard
            // frame (0x123). Ignored unless firmware installed the TWAI
            // driver (acceptance path); TWAI cells assert its reception.
            try {
                const c = ((self as any).twaiTick || 0) + 1;
                (self as any).twaiTick = c % 200;
                if (c % 200 === 0 && typeof (self.sim as any)?.sendTwaiFrame === 'function') {
                    try { void ((self.sim as any).sendTwaiFrame(0x123, [0xDE, 0xAD, 0xBE, 0xEF]) as Promise<any>)?.catch?.(() => {}); } catch { /* ignore */ }
                }
            } catch { /* never breaks tick */ }
        } catch { /* poll never breaks tick */ }
    }

    /** Drive a GPIO input level (host-driven pin toggle, e.g. buttons). */
    async setGpioInput(pinNumber: number, high: boolean): Promise<void> {
        try { await this.sim?.setPinInput?.(pinNumber, high ? 1 : 0); } catch { /* ignore */ }
    }

    /** ADC inject: ESP32 ADC1 lives on GPIO32-39 (VP=36/VN=39). Wiper
     * voltages ride setAnalogInput(pin, volts); rails power like the
     * F1/Pico paths (boards source no power today). Taps verified
     * against esp32-emu 1.2.0 (CMD 37). */
    private driveEsp32ADC(): void {
        try {
            const sim = this.sim as any;
            if (!sim || typeof sim.setAnalogInput !== 'function') return;
            for (const inst of this.instances.values()) {
                try {
                    if (typeof (inst as any)?.getPinVoltage !== 'function') continue;
                    for (const nm of ['VCC', '1']) {
                        let v = 0;
                        try { v = Number((inst as any).getPinVoltage(nm)) || 0; } catch { continue; }
                        if (v > 0.2) continue;
                        const net = (this as any).pinToNet?.get?.(`${(inst as any)?.id}:${nm}`);
                        if (net === undefined) continue;
                        for (const [node, netId] of (this as any).pinToNet) {
                            if (netId !== net) continue;
                            const sep = node.indexOf(':');
                            if (sep < 0) continue;
                            if (node.slice(0, sep) !== this.boardId) continue;
                            if (!/3V3/i.test(node.slice(sep + 1))) continue;
                            try { (inst as any).setPinVoltage(nm, 3.3); } catch { /* ignore */ }
                            break;
                        }
                    }
                } catch { /* one instance never breaks rails */ }
            }
            for (const [node, netId] of (this as any).pinToNet ?? []) {
                try {
                    const sep = node.indexOf(':');
                    if (sep < 0) continue;
                    if (node.slice(0, sep) !== this.boardId) continue;
                    const gpio = Esp32Runner.adcGpio(node.slice(sep + 1));
                    if (gpio < 0) continue;
                    let volts: number | null = null;
                    for (const [node2, net2] of (this as any).pinToNet) {
                        if (net2 !== netId) continue;
                        const s2 = node2.indexOf(':');
                        if (s2 < 0) continue;
                        if (node2.slice(0, s2) === this.boardId) continue;
                        const inst = this.instances.get(node2.slice(0, s2));
                        const v = Number((inst as any)?.getPinVoltage?.(node2.slice(s2 + 1)));
                        if (Number.isFinite(v)) { volts = v; break; }
                    }
                    if (volts !== null) {
                        try { void sim.setAnalogInput(gpio, volts)?.catch?.(() => {}); } catch { /* ignore */ }
                    }
                } catch { /* one pin never breaks the drain */ }
            }
        } catch { /* ADC never breaks the tick */ }
    }

    private static adcGpio(label: string): number {
        const m = /^(?:GPIO)?(\d{1,2})$/i.exec(String(label || '').trim());
        if (!m) {
            const u = String(label || '').toUpperCase();
            if (u === 'VP') return 36;
            if (u === 'VN') return 39;
            return -1;
        }
        const n = Number(m[1]);
        return n >= 32 && n <= 39 ? n : -1;
    }

    /** Board pin label → GPIO number for the 1-Wire DQ net. */
    private oneWireGpio(inst: any): number {
        try {
            const nets = (this as any).pinToNet as Map<string, number> | undefined;
            if (!nets) return -1;
            for (const [node, netId] of nets) {
                const sep = node.indexOf(':');
                if (sep < 0) continue;
                if (node.slice(0, sep) !== this.boardId) continue;
                const m = /^(?:GPIO)?(\d{1,2})$/i.exec(node.slice(sep + 1));
                if (!m) continue;
                const gpio = Number(m[1]);
                for (const [node2, net2] of nets) {
                    if (net2 !== netId) continue;
                    const s2 = node2.indexOf(':');
                    if (s2 < 0) continue;
                    if (node2.slice(0, s2) !== String(inst?.id)) continue;
                    if (/^(DQ|DATA|IO)$/i.test(node2.slice(s2 + 1))) return gpio;
                }
            }
        } catch { /* ignore */ }
        return -1;
    }

    private espPwmTick = 0;
    private ledcPinCache = new Map<number, number>();
    private owPins = new Set<number>();
    private owTick = 0;

    /** PWM observe: LEDC channels 0-7 via getLedc (duty/freq) + getLedcPin
     * (resolved once per channel, then cached). Strongest active duty
     * drives LED models via onPWM. Resolution is not readable from the
     * taps, so duty normalizes against 8-bit (255) below 256 and 13-bit
     * full-scale above — exact for 8-bit firmware, monotonic otherwise. */
    private pollEsp32PWM(): void {
        try {
            const sim = this.sim as any;
            if (!sim || typeof sim.getLedc !== 'function') return;
            const tick = ((this.espPwmTick || 0) + 1) % 5;
            this.espPwmTick = tick;
            if (tick !== 0) return;
            for (let ch = 0; ch < 8; ch++) {
                try {
                    (sim.getLedc(ch) as Promise<any>).then((st) => {
                        try {
                            const duty = Number(st?.duty) || 0;
                            const freq = Number(st?.freq) || 0;
                            if (duty <= 0 || freq <= 0) return;
                            const cached = this.ledcPinCache.get(ch);
                            if (cached !== undefined) { this.driveEsp32Led(cached, duty, freq); return; }
                            if (typeof sim.getLedcPin !== 'function') return;
                            (sim.getLedcPin(ch) as Promise<any>).then((pin) => {
                                try {
                                    const gpio = Number(pin);
                                    if (!Number.isFinite(gpio) || gpio < 0) return;
                                    this.ledcPinCache.set(ch, gpio);
                                    this.driveEsp32Led(gpio, duty, freq);
                                } catch { /* ignore */ }
                            }).catch(() => {});
                        } catch { /* ignore */ }
                    }).catch(() => {});
                } catch { /* one channel never breaks the poll */ }
            }
        } catch { /* PWM never breaks the tick */ }
    }

    private driveEsp32Led(gpio: number, duty: number, freq: number): void {
        try {
            const duty01 = Math.max(0, Math.min(1, duty > 255 ? duty / 8191 : duty / 255));
            if (duty01 <= 0) return;
            const tag = `GPIO${gpio}`;
            for (const inst of this.instances.values()) {
                try {
                    if (typeof (inst as any)?.onPWM !== 'function') continue;
                    if (typeof (inst as any)?.getPWMPinNames === 'function') continue;
                    let wired = false;
                    try {
                        for (const [node, netId] of (this as any).pinToNet ?? []) {
                            const sep = node.indexOf(':');
                            if (sep < 0) continue;
                            if (node.slice(0, sep) !== this.boardId) continue;
                            if (node.slice(sep + 1).toUpperCase() !== tag) continue;
                            for (const [node2, net2] of (this as any).pinToNet) {
                                if (net2 !== netId) continue;
                                if (node2.slice(0, node2.indexOf(':')) === this.boardId) continue;
                                if (node2.slice(0, node2.indexOf(':')) === (inst as any)?.id) { wired = true; break; }
                            }
                            if (wired) break;
                        }
                    } catch { /* ignore */ }
                    if (!wired) continue;
                    for (const pn of ['A', 'ANODE', '+']) {
                        try { (inst as any).onPWM(pn, { dutyCycle: duty01, frequencyHz: freq }); } catch { /* ignore */ }
                    }
                } catch { /* one instance never breaks pwm */ }
            }
        } catch { /* ignore */ }
    }

    protected budgetForDelta(deltaMs: number): number {
        return Math.floor(deltaMs * 1000 * this.speed);
    }
}
