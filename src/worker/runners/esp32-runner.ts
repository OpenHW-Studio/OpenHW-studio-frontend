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
import { armEsp32I2sTx, pollEsp32I2sTx } from './esp32-i2s-pump.ts';
import { wireEsp32CameraTap, pollEsp32CameraTap } from './esp32-camera-pump.ts';

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
    // MicroPython REPL inject (mirrors PicoRunner.startPythonInject):
    // chunked exec() lines over UART, paced per pump on the `>>> ` prompt.
    private pyScript = '';
    private pyQueue = '';
    private pyQueuePos = 0;
    private pyPromptSeen = false;
    private pyInjectAttempts = 0;
    private pyOutputSeen = false;
    private pyUartTail = '';
    // Virtual-time epoch (see getSimulatedTimeMs below): folded forward
    // on engine reset so reported time stays monotonic; last-good cache
    // backs the engine-dead fallback.
    private simTimeEpochMs = 0;
    private simTimeLastMs = 0;

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
        try { this.pyScript = String((options as any)?.pyScript || ''); } catch { this.pyScript = ''; }
        // Snapshot component attrs (board tickMHz for the clock preset).
        // Mirrors the F1/F4 snapshotCompAttrs discipline: runners must see
        // menu-set attrs at boot, not construction-stale empties.
        try {
            for (const c of (componentsDef || [])) {
                if (c && c.id !== undefined) this.compAttrById.set(String(c.id), (c as any).attrs || {});
            }
        } catch { /* snapshot never breaks construction */ }
        void this.boot(this.board === 'esp32-cam' ? 'openhw-esp32-cam' : 'openhw-esp32');
    }

    /** Split a MicroPython script into short exec('...') payload lines
     * (same contract as PicoRunner.chunkExecLines: cuts only at blank
     * lines or between zero-indent lines so blocks never split). */
    private static chunkExecLines(script: string, maxChars: number): string[] {
        const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
        const lines = String(script || '').split('\n');
        const paras: string[][] = [];
        let cur: string[] = [];
        const push = () => { if (cur.length) paras.push(cur); cur = []; };
        for (const ln of lines) {
            if (ln.trim() === '') { push(); continue; }
            cur.push(ln);
        }
        push();
        const out: string[] = [];
        for (const para of paras) {
            let buf: string[] = [];
            const flush = () => { if (buf.length) { out.push(esc(buf.join('\n'))); buf = []; } };
            for (const ln of para) {
                buf.push(ln);
                const hasIndent = buf.some((l) => /^\s/.test(l));
                if (!hasIndent && buf.join('\n').length >= maxChars) flush();
            }
            flush();
        }
        return out.filter((s) => s.length > 0);
    }

    /** Build the paced REPL queue: Ctrl-C prefix + exec() chunks sharing
     * __main__ globals (imports/I2C state persist across them). */
    private startPythonInject(): void {
        try {
            const script = this.pyScript.replace(/\r\n/g, '\n');
            const chunks = Esp32Runner.chunkExecLines(script, 150);
            this.pyQueue = `\x03${chunks.map((c) => `exec('${c}')\r\n`).join('')}`;
            this.pyQueuePos = 0;
            this.pyOutputSeen = false;
        } catch { /* retry next pump */ }
    }

    /** Paced MP inject, called from the wall pump (50ms cadence): arm on
     * the `>>> ` prompt (3 attempts max), then 16 chars/pump so the REPL
     * line buffer never overruns. No-op without a script. */
    private pumpPythonInject(): void {
        try {
            if (!this.isMicroPython || !this.pyScript.trim()) return;
            if (this.pyPromptSeen && this.pyInjectAttempts < 3 && !this.pyOutputSeen
                && this.pyQueuePos >= this.pyQueue.length) {
                this.startPythonInject();
                this.pyInjectAttempts++;
            }
            if (this.pyQueuePos < this.pyQueue.length && this.sim) {
                // 48 chars/pump: exec() lines stay short (REPL-safe) while
                // the ~1.1KB script drains in ~1.2s instead of ~3.5s.
                // Uint8Array (NOT string): the proxy's string path uses
                // node Buffer.from, which throws in the browser bundle and
                // silently wedges the drain (caught below, pos never moves).
                const chunk = this.pyQueue.slice(this.pyQueuePos, this.pyQueuePos + 48);
                try {
                    if (typeof this.sim.sendUart === 'function') {
                        this.sim.sendUart(new TextEncoder().encode(chunk));
                    } else return;
                } catch { return; }
                this.pyQueuePos += chunk.length;
            }
        } catch { /* inject never breaks the pump */ }
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
                self.sim._onUART = (b: number) => {
                    txQueue.push(b & 0xff);
                    // REPL prompt sniff at arrival: the drain cadence only
                    // observes whatever txQueue holds, so watch the bytes
                    // where they land.
                    try {
                        if (self.isMicroPython) {
                            self.pyUartTail = (self.pyUartTail + String.fromCharCode(b & 0xff)).slice(-24);
                            if (self.pyUartTail.endsWith('>>> ')) self.pyPromptSeen = true;
                        }
                    } catch { /* sniff never breaks RX */ }
                };
                self.sim._onError = (e: any) => console.error('[Esp32Runner]', e);
                // Board preset: 'esp32-cam' applies ESP32_CAM_DEFAULTS
                // (4MB flash + 4MB PSRAM) via applyBoardPreset semantics;
                // explicit sizes below always win (package contract).
                const isCam = self.board === 'esp32-cam';
                // NOTE: chipType is always 'ESP32' (the worker's only
                // constructor); the cam preset rides config.board
                // (init('esp32-cam') dies with "Unknown chip" and a
                // silent dead sim — observed live as zero serial).
                // wasmBinary rides the init config: worker-entry resolves
                // it via config.wasmBinary FIRST and only falls back to a
                // relative-URL fetch (404 under /vendor/) when absent — the
                // old loadWasm-after-init call never existed on the proxy
                // and the bytes were silently dropped (blank engine).
                // Clock preset (virtual time compression): board attr tickMHz
                // (160 Full / 80 / 40) rides init config cpuFrequency — the
                // engine scales virtual nanos by native/target, so lower
                // clocks cost fewer host cycles per virtual ms. Default off
                // (omitted → native). Marker for evidence.
                let espTickDiv = 1;
                try {
                    const battrs = self.compAttrById?.get?.(self.boardId) || {};
                    const want = Math.floor(Number((battrs as any)?.tickMHz) || 0);
                    if (want > 0 && want < 160) {
                        espTickDiv = Math.max(1, Math.round(160 / want));
                        try {
                            const tag = `ESP32CLK:div=${espTickDiv} `;
                            for (let i = 0; i < tag.length; i++) txQueue.push(tag.charCodeAt(i) & 0xff);
                        } catch { /* ignore */ }
                    }
                } catch { /* ignore */ }
                await self.sim.init('ESP32', { board: self.board, flashSizeMB: 4, mmuPages: 64, strapValue: 0x13, budget: 5_000_000, wasmBinary, ...(espTickDiv > 1 ? { cpuFrequency: Math.max(1, Math.round(160 / espTickDiv)) } : {}) }, flash, rom);
                // MMU mapping: init already seeds the identity map
                // (mmuTablePro[p] = p, Pro+App) twice — in applyBasicSetup
                // and again after loadWasm+reset (worker-entry.js). Do NOT
                // call seedMMU(0) here: CMD_SEED_MMU writes a ROTATED map
                // (Pro[0..3] = [1,2,3,0], worker-entry.js:8012) which
                // mis-maps the second-stage bootloader's first cache
                // reads — partitions @0x8000 land on app bytes @0x18000 —
                // so the bootloader stalls at its entry 0x400805b4 and the
                // app never loads (verified: 0x400805b4 is the bootloader
                // image entry_addr in every local .ino.bootloader.bin, not
                // the app entry at 0x40081xxx). Identity is what the proven
                // paths use (test-boot.mjs, worker acceptance cells).

                // NOTE: sim.loadWasm does not exist on the SAB proxy (init
                // already loads + resets with the wasmBinary riding config);
                // the old guarded call here was dead code (typeof check
                // always false). Removed.
                // Tap attach BEFORE run(): every attach CMD carries its own
                // RESP handshake and serializes through the live commandLoop,
                // but run() is fire-and-forget (no handshake). Posting run()
                // first lets the very next attach overwrite SAB_CMD before
                // the loop's first exchange() — RUN is lost forever and the
                // engine idles with total UART silence (observed: READY
                // without RUN on I2C/1-Wire/SPI cells). Attaches first, RUN
                // last: by the time RUN posts, the loop is pumping and
                // consumes it within microseconds.
                try { self.wireBusTaps(); } catch { /* taps never break boot */ }
                self.sim.run();
                // Proof-of-life wait: RUN is the ONLY handshake-less CMD
                // (every other proxy call spins for RESP; run/stop just
                // store+notify). SAB_CMD holds ONE slot, so any CMD posted
                // before the engine's next exchange() overwrites a pending
                // RUN — and the pump below posts its first poll CMDs within
                // microseconds of RUN (observed: READY without RUN even
                // with attaches first). Post NOTHING here until the core
                // provably runs (retired instructions via the debug SAB, or
                // UART bytes via pollUart — a pure shared-memory read, no
                // CMD). Bounded 10s; on timeout re-post RUN once and carry
                // on (the pump watchdog below nets the residue).
                try {
                    const t0 = Date.now();
                    let alive = false;
                    while (Date.now() - t0 < 10000) {
                        try { self.sim.pollUart(); } catch { /* ignore */ }
                        let inst = 0;
                        try { inst = Number((self.sim as any)?.instTotal) || 0; } catch { inst = 0; }
                        if (inst > 0) { alive = true; break; }
                        try { if (txQueue.length > 0) { alive = true; break; } } catch { /* ignore */ }
                        await new Promise((r) => setTimeout(r, 50));
                    }
                    if (!alive) { try { self.sim.run(); } catch { /* ignore */ } }
                } catch { /* wait never breaks boot */ }
                try { (self as any).bootWdT0 = Date.now(); (self as any).bootWdDone = false; } catch { /* ignore */ }
                // Poll pump: SimulatorWorker needs pollUart() calls to move
                // bytes from the WASM ring into _onUART. Reschedules
                // unconditionally while the sim lives (NOT gated on
                // base `running`: this pump first runs inside loadFirmware,
                // before boot() flips running — gating on it killed the
                // chain on its first call and MicroPython inject never ran).
                const pump = () => {
                    if (!self.sim) return;
                    try { self.sim.pollUart(); } catch { /* ignore */ }
                    try { self.pollBusTaps(); } catch { /* ignore */ }
                    try { self.pumpPythonInject(); } catch { /* inject never breaks the pump */ }
                    // Boot watchdog: RUN is fire-and-forget, so a lost RUN
                    // (see above) would idle silently for the whole window.
                    // If the core retired zero instructions after 20s wall,
                    // the engine provably never started — re-post RUN once
                    // (attaches persist; no reset needed). Disarms on first
                    // UART flow (txQueue observed here) or first retired
                    // instruction.
                    try {
                        const w = (self as any);
                        if (!w.bootWdDone) {
                            let uartFlow = false;
                            try { uartFlow = (txQueue.length > 0); } catch { uartFlow = false; }
                            if (uartFlow) { w.bootWdDone = true; }
                            else if (Date.now() - Number(w.bootWdT0 || Date.now()) > 20000) {
                                let inst = -1;
                                try { inst = Number((self.sim as any)?.instTotal); } catch { inst = -1; }
                                if (Number.isFinite(inst) && inst <= 0) {
                                    try { self.sim.run(); } catch { /* ignore */ }
                                    try { console.log('[Esp32Runner] boot watchdog re-posted RUN (core idle 20s)'); } catch { /* ignore */ }
                                }
                                w.bootWdDone = true;
                            }
                        }
                    } catch { /* watchdog never breaks the pump */ }
                    try { setTimeout(pump, 50); } catch { /* ignore */ }
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
                const stash = (((self as any).hostSerialStash as number[] | undefined) || []);
                if (!txQueue.length && stash.length === 0) return [];
                // Host-observed evidence lines (TWAI-TX/RMT-TX pumps below)
                // ride the serial needle with a HOST_ prefix so cells assert
                // engine-observed facts — never firmware self-report.
                const drained = txQueue.splice(0, Math.min(txQueue.length, 1024));
                if (stash.length > 0) {
                    try {
                        drained.push(...stash.splice(0, Math.max(0, 1024 - drained.length)));
                    } catch { /* stash never breaks the drain */ }
                }
                // MicroPython REPL sniff: `>>> ` prompt arms injection;
                // fresh output after a full drain means the script ran.
                try {
                    if (self.isMicroPython) {
                        let s = '';
                        for (let i = 0; i < drained.length; i++) s += String.fromCharCode(drained[i] & 0xff);
                        self.pyUartTail = (self.pyUartTail + s).slice(-24);
                        if (self.pyUartTail.endsWith('>>> ')) self.pyPromptSeen = true;
                        if (self.pyQueue.length > 0 && self.pyQueuePos >= self.pyQueue.length && s.length > 0) {
                            self.pyOutputSeen = true;
                        }
                    }
                } catch { /* sniff never breaks the drain */ }
                return drained;
            },
            injectUartByte(value: number, _source?: string) {
                try {
                    // Uint8Array (NOT string): see pumpPythonInject — the
                    // proxy string path uses node Buffer (throws in browser).
                    const ch = new Uint8Array([value & 0xff]);
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
                    const n = parseInt(String(pinId || '').replace(/^(GPIO|GP|D)/i, ''), 10);
                    if (!Number.isFinite(n)) return;
                    // 1-Wire nets are owned by the engine's synchronous FFI
                    // model (attachOneWire + pollOneWire): it answers
                    // presence + data bits cycle-exactly inside the core.
                    // The component model decodes bus traffic a full tick
                    // late, so its tick-quantized LOW drives (presence/data
                    // pulses at the wrong wall instant) must never reach the
                    // engine pin — a stale LOW over a data-1 HIGH corrupts
                    // the bit and the Dallas CRC fails. LOW pushes are
                    // dropped here (single choke point, covers the input
                    // half and the model's _driveBoardPin pushes); HIGH
                    // pushes pass through: they are the idle pull-up the
                    // Dallas reset() waits for before pulsing (it bails
                    // with "no presence" on an idle-LOW wire), and the FFI
                    // read override (presence/serving) wins over stimulus
                    // whenever the sensor actively drives.
                    try { if (!high && (self as any).owPins?.has?.(n)) return; } catch { /* ignore */ }
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
                // Engine virtual clock restarts at 0 — fold current time
                // into the epoch so getSimulatedTimeMs() stays monotonic
                // (base simCycleCount never resets either). Assigned (not
                // inferred from later reads) so torn SAB reads can't
                // inflate it.
                try { self.simTimeEpochMs = self.getSimulatedTimeMs(); } catch { /* ignore */ }
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
                // Per-byte DC replay map (see spiDcPlanFor): which board
                // GPIOs carry each SPI slave's DC/CS nets. Built once here
                // (nets are constructor-fixed).
                try { self.buildSpiDcMap(); } catch { /* dc map never breaks boot */ }
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
            // DHT22 over RMT (esp32-emu RMT tap): the engine answers
            // synchronously per byte for register-style sensors, but DHT22
            // is a µs bit-bang protocol the slow engine cannot meet in
            // wall time — so firmware drives it with the RMT peripheral
            // (hardware-timed start pulse + capture) and the host plays
            // the sensor: preload the 42-word response on every channel
            // (pending = delivers on the next RX_EN arm) + re-inject on
            // every newly captured start pulse (pump below). Words encode
            // the component model's live T/H at 1MHz ticks (div-80
            // firmware). rmt_data_t packing mirrors RmtTap.item.
            try {
                for (const inst of this.instances.values()) {
                    const t = String((inst as any)?.type || '').toLowerCase();
                    if (!t.includes('dht')) continue;
                    const words = self.dhtRmtWords(inst);
                    if (!words) continue;
                    for (let ch = 0; ch < 8; ch++) {
                        try { void (self.sim as any)?.injectRmtRx?.(ch, words)?.catch?.(() => {}); } catch { /* ignore */ }
                    }
                    try { (self as any).rmtDhtArmed = true; } catch { /* ignore */ }
                    try { (self as any).rmtDhtStarts = 0; } catch { /* ignore */ }
                }
            } catch { /* rmt-dht never breaks boot */ }
            try { armEsp32I2sTx(self.sim); } catch { /* i2s never breaks boot */ }
            try { wireEsp32CameraTap(self.sim); } catch { /* camera tap never breaks boot */ }
            // RMT-TX IR observer: arm guest→host capture (the DHT
            // re-inject path is untouched; the observer yields while
            // rmtDhtArmed — pollRmtTx drains, two pollers would steal
            // each other's windows).
            for (let ch = 0; ch < 2; ch++) {
                try { void (self.sim as any)?.armRmtTx?.(ch)?.catch?.(() => {}); } catch { /* ignore */ }
            }
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
            // Feed order (blocking SAB round-trips queue .then callbacks in
            // call order): GPIO edges MUST publish before this round's MOSI
            // bytes reach the models. Display models sample DC per byte at
            // feed time; with SPI polled first, every setup-phase byte was
            // fed while DC still read LOW — commands only, zero data bytes
            // ingested (observed: writeCount/fillPercent/ramPointer ≡ 0 on
            // TFT/LCD/EPD while DC-less MAX7219 works). GPIO block first.
            if (typeof self.sim?.pollGpioChanges === 'function') {
                try {
                    (self.sim.pollGpioChanges() as Promise<Array<{ pin: number; level: number }>>).then((edges) => {
                        try {
                            if (!Array.isArray(edges)) return;
                            // Stash this round's edges (board gpio + level, in
                            // firmware order) for the SPI DC replay below:
                            // the SPI .then callbacks queue after this one,
                            // so the stash is always the current round's.
                            // Overwritten per round (never consumed across
                            // rounds); SPI drains with no edges use carryDC.
                            try {
                                const arr: Array<{ gpio: number; high: boolean }> = [];
                                for (const e of edges) {
                                    if (!e || !Number.isFinite(Number((e as any)?.pin))) continue;
                                    arr.push({ gpio: Number((e as any).pin), high: !!Number((e as any)?.level) });
                                }
                                (self as any).spiEdgeStash = arr;
                            } catch { /* stash never breaks poll */ }
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
            if (this.spiBridge && typeof self.sim?.pollSpiTx === 'function') {
                // User buses are 2/HSPI and 3/VSPI; poll both (+0/1 harmless).
                for (const bus of [2, 3]) {
                    try {
                        (self.sim.pollSpiTx(bus) as Promise<number[]>).then((mosi) => {
                            try {
                                const br = self.spiBridge;
                                if (!br || !Array.isArray(mosi) || mosi.length === 0) return;
                                // Per-byte DC replay (see spiDcPlanFor): pin
                                // levels publish per round (end state), but
                                // display models sample DC per byte — µs
                                // toggles inside a round would otherwise all
                                // read the round-final level and command/data
                                // framing collapses (observed: currentCommand
                                // stuck at 0x11, 0 data bytes ingested).
                                let plan: boolean[] | null = null;
                                try { plan = self.spiDcPlanFor(mosi.length); } catch { plan = null; }
                                let idx = 0;
                                for (const b of mosi) {
                                    try {
                                        if (plan) self.spiApplyDc(!!plan[idx]);
                                    } catch { /* dc never breaks feed */ }
                                    try { br.exchange(Number(b) & 0xff, idx); } catch { /* ignore */ }
                                    idx++;
                                }
                                try { br.frame(true); } catch { /* ignore */ }
                            } catch { /* feed never breaks poll */ }
                        }).catch(() => {});
                    } catch { /* ignore */ }
                }
            }
            // ADC inject + PWM observe (1.2.0 taps; no-ops without them).
            try { self.driveEsp32ADC(); } catch { /* never breaks tick */ }
            try { self.driveEsp32Touch(); } catch { /* never breaks tick */ }
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
                // TWAI-TX observer: the virtual peer captures NORMAL-mode
                // guest transmits (getTwaiTx). New frames ride the serial
                // needle as HOST_TWAI_TX so the TX cell asserts
                // engine-observed — never firmware self-report.
                if (c % 20 === 0 && typeof (self.sim as any)?.getTwaiTx === 'function') {
                    try {
                        ((self.sim as any).getTwaiTx() as Promise<any>).then((f) => {
                            try {
                                if (!f || !Number.isFinite(Number(f.count))) return;
                                const seen = Number((self as any).twaiTxSeen || 0);
                                if (Number(f.count) <= seen) return;
                                (self as any).twaiTxSeen = Number(f.count);
                                const data = Array.isArray(f.data) ? f.data : [];
                                const line = `HOST_TWAI_TX:id=${Number(f.id)}${f.ext ? 'x' : ''},dlc=${Number(f.dlc)},b0=${data.length ? Number(data[0]) : -1}\n`;
                                const st = ((((self as any).hostSerialStash as number[] | undefined) || ((self as any).hostSerialStash = [])) as number[]);
                                for (let i = 0; i < line.length && st.length < 4096; i++) st.push(line.charCodeAt(i) & 0xff);
                            } catch { /* observer never breaks tick */ }
                        }).catch(() => {});
                    } catch { /* ignore */ }
                }
            } catch { /* never breaks tick */ }
            // RMT-DHT pump: re-inject sensor response per captured start.
            try { self.pollRmtDht(); } catch { /* never breaks tick */ }
            // RMT-TX IR observer (guest→host NEC/raw capture).
            try { self.pollRmtTxHost(); } catch { /* never breaks tick */ }
            try { pollEsp32I2sTx(self.sim, self.instances); } catch { /* never breaks tick */ }
            try { pollEsp32CameraTap(self.sim); } catch { /* never breaks tick */ }
        } catch { /* poll never breaks tick */ }
    }

    /** Drive a GPIO input level (host-driven pin toggle, e.g. buttons). */
    async setGpioInput(pinNumber: number, high: boolean): Promise<void> {
        try { await this.sim?.setPinInput?.(pinNumber, high ? 1 : 0); } catch { /* ignore */ }
    }

    /** Firmware-driven output cache, fed by the pollGpioChanges edge pump
     * above (keys are the reported `GPIO<n>` labels; lookups normalize
     * across all ESP32 label forms). Declared (was an implicit dynamic
     * prop): backs output-wins below. */
    private gpioOutCache = new Map<string, boolean>();

    /** Board pin label → GPIO number across the ESP32 label zoo (GPIO<n>,
     * GP<n>, D<n>, bare <n>); -1 for rails/aliases that are not GPIO. */
    private static gpioNum(label: string): number {
        try {
            const m = /^(?:GPIO|GP|D)?(\d{1,2})$/i.exec(String(label || '').trim());
            if (!m) return -1;
            const n = Number(m[1]);
            return (Number.isInteger(n) && n >= 0 && n <= 39) ? n : -1;
        } catch { return -1; }
    }

    /** Alias expansion for ESP32 nets: the base only links GPIO↔GP and
     * D↔bare, but shells wire short labels (`esp1:21`) while engine edges
     * arrive as `GPIO21` — without the full cross-product the component
     * fan-out misses every short-label net (observed: TFT/LCD/EPD DC+CS+RST
     * never delivered, writeCount/fillPercent/ramPointer all zero while
     * MOSI bytes flow fine). Adds GPIO<n>↔GP<n>↔D<n>↔<n>. */
    protected override getPinAliases(pinId: string): string[] {
        const out = new Set<string>();
        try {
            for (const a of super.getPinAliases(pinId)) out.add(a);
        } catch { out.add(String(pinId || '').toUpperCase()); }
        try {
            const n = Esp32Runner.gpioNum(pinId);
            if (n >= 0) {
                out.add(String(n)); out.add(`D${n}`); out.add(`GPIO${n}`); out.add(`GP${n}`);
            }
        } catch { /* aliases never break lookup */ }
        return Array.from(out);
    }

    /** Board-to-board GPIO fan-out (mirrors the F1 override): after the
     * normal component publish, forward the driven level into same-net
     * board pins the firmware does NOT drive as outputs. The base has no
     * board→board propagation, so a GPIO12→GPIO13 loopback wire is
     * electrically dead without this (observed: EXTI ISR + PCNT counts
     * pinned at 0 while static gpio-in reads fine). Output-vs-output is a
     * short — firmware-driven targets (edge cache) are skipped. */
    protected override publishGpio(pinId: string, isHigh: boolean, analogV?: number): void {
        try { super.publishGpio(pinId, isHigh, analogV); } catch { /* never break propagation */ }
        try {
            const src = Esp32Runner.gpioNum(pinId);
            if (src < 0) return;
            let net: number | undefined;
            for (const cand of [`${this.boardId}:${src}`, `${this.boardId}:D${src}`, `${this.boardId}:GPIO${src}`, `${this.boardId}:GP${src}`]) {
                const v = this.pinToNet.get(cand);
                if (v !== undefined) { net = v; break; }
            }
            if (net === undefined) return;
            const srcKeys = new Set([String(src), `D${src}`, `GPIO${src}`, `GP${src}`]);
            for (const [node, netId] of (this as any).pinToNet) {
                if (netId !== net) continue;
                const sep = node.indexOf(':');
                if (sep < 0) continue;
                if (node.slice(0, sep) !== this.boardId) continue;
                const bPin = node.slice(sep + 1);
                if (!bPin || srcKeys.has(bPin.toUpperCase())) continue;
                const tgt = Esp32Runner.gpioNum(bPin);
                if (tgt < 0) continue;
                try {
                    let driven = false;
                    for (const k of [`GPIO${tgt}`, `GP${tgt}`, `${tgt}`, `D${tgt}`]) {
                        if (this.gpioOutCache.has(k.toUpperCase())) { driven = true; break; }
                    }
                    if (driven) continue; // firmware drives it: output wins
                } catch { /* unknown drive: source wins */ }
                try { this.engine.setGpioInput?.(bPin, !!isHigh); } catch { /* ignore */ }
            }
        } catch { /* board fan-out never breaks the tick */ }
    }

    /** Non-consuming output probe for the base bidirectional poll: pins the
     * firmware drives (edge cache) report driving:true so the input half
     * skips them (output wins) instead of pushing the lagging
     * component-side voltage back over a firmware output (the pico
     * `_set_gpio` latch-clear hazard, ESP32 flavor). Rails keep working:
     * undriven pins return null (legacy push path). */
    public peekGpioOut(pinId: string): { level: number; driving: boolean } | null {
        try {
            const n = Esp32Runner.gpioNum(pinId);
            if (n < 0) return null;
            for (const k of [`GPIO${n}`, `GP${n}`, `${n}`, `D${n}`]) {
                const ku = k.toUpperCase();
                if (this.gpioOutCache.has(ku)) {
                    return { level: this.gpioOutCache.get(ku) ? 1 : 0, driving: true };
                }
            }
        } catch { /* ignore */ }
        return null;
    }

    /** SPI DC/CS net map for the per-byte DC replay (built in wireBusTaps;
     * nets are constructor-fixed). One entry per SPI-slave instance that
     * exposes a DC pin (TFT/LCD/EPD); DC-less slaves (MAX7219/SD) need no
     * replay and are skipped. */
    private spiDcEntries: Array<{ inst: any; dcGpios: Set<number>; csGpios: Set<number> }> = [];

    private buildSpiDcMap(): void {
        try {
            const list: Array<{ inst: any; dcGpios: Set<number>; csGpios: Set<number> }> = [];
            for (const inst of this.instances.values()) {
                try {
                    const hasByte = typeof (inst as any)?.onSPIByte === 'function';
                    const hasXchg = typeof (inst as any)?.onSPIByteExchange === 'function';
                    if (!hasByte && !hasXchg) continue;
                    if (!(inst as any)?.pins?.['DC']) continue;
                    let csName = 'CS';
                    try {
                        if (typeof (inst as any)?.getCSPinName === 'function') {
                            csName = String((inst as any).getCSPinName()) || 'CS';
                        }
                    } catch { csName = 'CS'; }
                    const nets = (this as any).pinToNet as Map<string, number> | undefined;
                    if (!nets) continue;
                    const dcNet = nets.get(`${(inst as any)?.id}:DC`);
                    if (dcNet === undefined) continue;
                    const csNet = nets.get(`${(inst as any)?.id}:${csName}`);
                    const dcGpios = new Set<number>();
                    const csGpios = new Set<number>();
                    for (const [node, netId] of nets) {
                        try {
                            const sep = node.indexOf(':');
                            if (sep < 0) continue;
                            if (node.slice(0, sep) !== this.boardId) continue;
                            const g = Esp32Runner.gpioNum(node.slice(sep + 1));
                            if (g < 0) continue;
                            if (netId === dcNet) dcGpios.add(g);
                            if (csNet !== undefined && netId === csNet) csGpios.add(g);
                        } catch { /* ignore */ }
                    }
                    if (dcGpios.size > 0) list.push({ inst, dcGpios, csGpios });
                } catch { /* one instance never breaks mapping */ }
            }
            this.spiDcEntries = list;
        } catch { /* dc map never breaks boot */ }
    }

    /** Per-byte DC plan for one SPI drain: replay the round's edge order so
     * each byte pairs with the DC level of its own CS assertion (drivers
     * set DC immediately before asserting CS — same round, exact order).
     * Single-DC-entry only (all ESP32 cells); multi/zero entries return
     * null (legacy: model samples the latched round-final level). The
     * carry seeds rounds with no DC edge (burst continuation). */
    private spiDcPlanFor(count: number): boolean[] | null {
        try {
            const entries = this.spiDcEntries || [];
            if (entries.length !== 1 || count <= 0) return null;
            const ent = entries[0];
            const stash = (((this as any).spiEdgeStash as Array<{ gpio: number; high: boolean }> | undefined) || []);
            let dc = (this as any).spiDcCarry === true;
            const groups: boolean[] = [];
            for (const e of stash) {
                try {
                    if (ent.dcGpios.has(Number(e.gpio))) dc = !!e.high;
                    if (ent.csGpios.has(Number(e.gpio)) && !e.high) groups.push(dc);
                } catch { /* one edge never breaks the plan */ }
            }
            (this as any).spiDcCarry = dc;
            if (groups.length === 0) return new Array(count).fill(dc);
            if (groups.length === 1) return new Array(count).fill(groups[0]);
            const out: boolean[] = [];
            for (let i = 0; i < count; i++) out.push(!!groups[Math.min(i, groups.length - 1)]);
            return out;
        } catch { return null; }
    }

    /** Apply one replayed DC level to the mapped slave: pin voltage (what
     * TFT/LCD sample per byte) + pin-change event (what ePaper's dcHigh
     * field tracks). Change-gated: consecutive same-level bytes cost one
     * guarded setPinVoltage (self-no-op on same value). */
    private spiApplyDc(high: boolean): void {
        try {
            const entries = this.spiDcEntries || [];
            if (entries.length !== 1) return;
            if ((this as any).spiDcApplied === !!high) return;
            (this as any).spiDcApplied = !!high;
            const ent = entries[0];
            const v = high ? 3.3 : 0;
            try { (ent.inst as any)?.setPinVoltage?.('DC', v); } catch { /* ignore */ }
            try {
                const pins = (ent.inst as any)?.pins;
                if (pins && pins['DC']) { pins['DC'].isHigh = !!high; pins['DC'].voltage = v; }
            } catch { /* ignore */ }
            try { (ent.inst as any)?.onPinStateChange?.('DC', !!high, Math.floor(this.simCycleCount || 0)); } catch { /* ignore */ }
        } catch { /* dc never breaks feed */ }
    }

    /** Touch drive: host-driven counts from wired switch/button nets
     * (model truth, same philosophy as driveEsp32ADC — there is no
     * touch component model). Pads T0..T9 = GPIO
     * 4/0/2/15/13/12/14/27/33/32; engine reads low when touched
     * (untouched default ~1000, worker-entry.js onTouchRead). Touch
     * pins with no component on their net are skipped (engine default
     * stands). Throttled to every 10th tick (SAB round-trip). */
    private driveEsp32Touch(): void {
        try {
            const sim = this.sim as any;
            if (!sim || typeof sim.setTouchInput !== 'function') return;
            const c = (((this as any).touchTick || 0) + 1) % 10;
            (this as any).touchTick = c;
            if (c !== 0) return;
            const pads: Array<[number, number]> = [[0, 4], [1, 0], [2, 2], [3, 15], [4, 13], [5, 12], [6, 14], [7, 27], [8, 33], [9, 32]];
            const nets = (this as any).pinToNet as Map<string, number> | undefined;
            if (!nets) return;
            for (const [pad, gpio] of pads) {
                try {
                    let netId: number | undefined;
                    for (const [node, net] of nets) {
                        const sep = node.indexOf(':');
                        if (sep < 0) continue;
                        if (node.slice(0, sep) !== this.boardId) continue;
                        const pin = node.slice(sep + 1).toUpperCase();
                        if (pin !== `GPIO${gpio}` && pin !== `${gpio}`) continue;
                        netId = net;
                        break;
                    }
                    if (netId === undefined) continue;
                    let maxV = -1;
                    let anyModel = false;
                    for (const [node2, net2] of nets) {
                        if (net2 !== netId) continue;
                        const s2 = node2.indexOf(':');
                        if (s2 < 0) continue;
                        if (node2.slice(0, s2) === this.boardId) continue;
                        const inst = this.instances.get(node2.slice(0, s2));
                        if (!inst || typeof (inst as any)?.getPinVoltage !== 'function') continue;
                        anyModel = true;
                        const v = Number((inst as any).getPinVoltage(node2.slice(s2 + 1)));
                        if (Number.isFinite(v) && v > maxV) maxV = v;
                    }
                    // MNA switches (slide-switch et al.) never publish pin
                    // voltages (getMnaStamps-only, solved off-runner), so the
                    // scan above always reads 0V for them. Resolve the wiper
                    // through the switch position instead: value "1" = wiper
                    // (pin 2) follows pin 3, "0" follows pin 1; the followed
                    // net reads HIGH off a board high rail, LOW off ground.
                    // Unknown follow → engine default stands.
                    try {
                        const sw = this.mnaSwitchWiperVolts(netId);
                        if (sw !== null) { anyModel = true; maxV = sw; }
                    } catch { /* switch resolve never breaks drive */ }
                    if (!anyModel) continue;
                    try { void sim.setTouchInput(pad, maxV > 1.0 ? 10 : 1000)?.catch?.(() => {}); } catch { /* ignore */ }
                } catch { /* one pad never breaks the drive */ }
            }
        } catch { /* touch never breaks the tick */ }
    }

    /** Wiper voltage through an MNA switch (slide-switch shape: pins 1/2/3,
     * wiper = 2; value "1" follows pin 3, "0" follows pin 1). Returns the
     * followed net's rail level (3.3 on a board high rail, 0 on ground) or
     * null when no switch wiper is on this net or the follow is unknowable.
     * Nets are constructor-fixed; the switch position reads live state. */
    private mnaSwitchWiperVolts(netId: number): number | null {
        try {
            const nets = (this as any).pinToNet as Map<string, number> | undefined;
            if (!nets) return null;
            for (const [node, net] of nets) {
                try {
                    if (net !== netId) continue;
                    const sep = node.indexOf(':');
                    if (sep < 0) continue;
                    const compId = node.slice(0, sep);
                    if (compId === this.boardId) continue;
                    if (node.slice(sep + 1) !== '2') continue;
                    const inst = this.instances.get(compId);
                    if (!inst || typeof (inst as any)?.getMnaStamps !== 'function') continue;
                    let val = '';
                    try { val = String((inst as any)?.state?.value ?? (inst as any)?.attrs?.value ?? ''); } catch { val = ''; }
                    const followPin = (val === '1' || val === '1.0') ? '3' : '1';
                    const followNet = nets.get(`${compId}:${followPin}`);
                    if (followNet === undefined) return null;
                    let high = false;
                    let low = false;
                    for (const [node2, net2] of nets) {
                        if (net2 !== followNet) continue;
                        const s2 = node2.indexOf(':');
                        if (s2 < 0) continue;
                        if (node2.slice(0, s2) !== this.boardId) continue;
                        const p = node2.slice(s2 + 1).toUpperCase();
                        if (/^(3V3|3\.3V|5V|VCC)([._]?\d*)?$/.test(p)) high = true;
                        else if (/^(GND|AGND)([._]?\d*)?$/.test(p)) low = true;
                    }
                    if (high) return 3.3;
                    if (low) return 0;
                    return null;
                } catch { /* one node never breaks resolve */ }
            }
        } catch { /* ignore */ }
        return null;
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
        // ADC1: 32-39. ADC2 (0/2/4/12-15/25-27) has no DevKit cell, but
        // the CAM shell exposes 0/2/4/12-15 — inject those identically
        // (WiFi stays off in e2e, so ADC2 reads valid).
        if (n >= 32 && n <= 39) return n;
        if (n === 0 || n === 2 || n === 4 || (n >= 12 && n <= 15) || (n >= 25 && n <= 27)) return n;
        return -1;
    }

    /** DHT22 RMT response words (42 u32, 1MHz ticks) from the component
     * model's live T/H. Header (80µs low + 80µs high) + 40 bits MSB-first
     * (50µs low + 27/70µs high) + terminator. Matches the engine RMT-DHT
     * harness shape (their test-worker-rmt-dht.mjs). */
    private dhtRmtWords(inst: any): number[] | null {
        try {
            let temp = 24.0;
            let hum = 50.0;
            try {
                const st = (inst as any)?.state || {};
                const at = (inst as any)?.attrs || {};
                const tv = Number(st.temperature ?? at.temperature ?? at.temp ?? 24.0);
                const hv = Number(st.humidity ?? at.humidity ?? at.hum ?? 50.0);
                if (Number.isFinite(tv)) temp = tv;
                if (Number.isFinite(hv)) hum = hv;
            } catch { /* defaults */ }
            const item = (d0: number, l0: number, d1: number, l1: number): number =>
                ((((d1 & 0x7fff) << 16) | ((l1 ? 1 : 0) << 31) | (d0 & 0x7fff) | ((l0 ? 1 : 0) << 15)) >>> 0);
            let t10 = Math.round(temp * 10);
            if (t10 < 0) t10 = (0x10000 + t10) & 0xffff;
            const h10 = Math.round(hum * 10) & 0xffff;
            const bytes = [(h10 >> 8) & 0xff, h10 & 0xff, (t10 >> 8) & 0xff, t10 & 0xff, 0];
            bytes[4] = (bytes[0] + bytes[1] + bytes[2] + bytes[3]) & 0xff;
            const words: number[] = [item(80, 0, 80, 1)];
            for (const b of bytes) {
                for (let i = 7; i >= 0; i--) {
                    words.push(item(50, 0, ((b >> i) & 1) ? 70 : 27, 1));
                }
            }
            words.push(0);
            return words;
        } catch { return null; }
    }

    /** RMT-DHT pump: re-inject the response on every newly captured DHT
     * start pulse (1100µs low + 30µs high at 1MHz). Preload at boot covers
     * the first transaction; this covers loop re-reads. */
    private pollRmtDht(): void {
        try {
            const self = this as any;
            if (!self.rmtDhtArmed) return;
            if (typeof self.sim?.pollRmtTx !== 'function') return;
            const c = ((self.rmtDhtTick || 0) + 1) % 20;
            self.rmtDhtTick = c;
            if (c !== 0) return;
            let p: any = null;
            try { p = self.sim.pollRmtTx(); } catch { /* ignore */ }
            if (!p || typeof (p as any).then !== 'function') return;
            (p as Promise<Array<{ ch: number; items: number[]; tickHz: number }>>).then((res) => {
                try {
                    let starts = 0;
                    for (const r of res || []) {
                        for (const w of r.items || []) {
                            const ww = w >>> 0;
                            const d0 = ww & 0x7fff; const l0 = (ww >>> 15) & 1;
                            const d1 = (ww >>> 16) & 0x7fff; const l1 = (ww >>> 31) & 1;
                            if (d0 === 1100 && l0 === 0 && d1 === 30 && l1 === 1) starts++;
                        }
                    }
                    if (starts > 0) {
                        const answered = Number(self.rmtDhtStarts || 0);
                        // pollRmtTx drains, so recount from zero each window:
                        // re-inject whenever a fresh start appears.
                        void answered;
                        for (const inst of self.instances.values()) {
                            const t = String((inst as any)?.type || '').toLowerCase();
                            if (!t.includes('dht')) continue;
                            const words = self.dhtRmtWords(inst);
                            if (!words) continue;
                            for (let ch = 0; ch < 8; ch++) {
                                try { void self.sim?.injectRmtRx?.(ch, words)?.catch?.(() => {}); } catch { /* ignore */ }
                            }
                            break;
                        }
                        self.rmtDhtStarts = (Number(self.rmtDhtStarts || 0) + starts) | 0;
                    }
                } catch { /* pump never breaks tick */ }
            }).catch(() => {});
        } catch { /* never breaks tick */ }
    }

    /** RMT-TX IR observer (guest→host NEC/raw capture). Yields whenever
     * the DHT cell owns RMT (pollRmtTx drains — two pollers would steal
     * each other's windows). Non-empty captures ride the serial needle
     * as HOST_RMT_TX. Same res shape as the proven DHT pump above. */
    private pollRmtTxHost(): void {
        try {
            const self = this as any;
            if (self.rmtDhtArmed) return;
            if (typeof self.sim?.pollRmtTx !== 'function') return;
            const c = ((self.rmtHostTick || 0) + 1) % 20;
            self.rmtHostTick = c;
            if (c !== 0) return;
            let p: any = null;
            try { p = self.sim.pollRmtTx(); } catch { /* ignore */ }
            if (!p || typeof (p as any).then !== 'function') return;
            (p as Promise<Array<{ ch: number; items: number[]; tickHz: number }>>).then((res) => {
                try {
                    for (const r of res || []) {
                        const items = (r as any)?.items;
                        if (!Array.isArray(items) || items.length < 2) continue;
                        let nonZero = false;
                        for (const w of items) { if ((w >>> 0) !== 0) { nonZero = true; break; } }
                        if (!nonZero) continue;
                        const line = `HOST_RMT_TX:ch=${Number((r as any)?.ch || 0)},words=${items.length},first=${(items[0] >>> 0).toString(16)}\n`;
                        const st = ((((self as any).hostSerialStash as number[] | undefined) || ((self as any).hostSerialStash = [])) as number[]);
                        for (let i = 0; i < line.length && st.length < 4096; i++) st.push(line.charCodeAt(i) & 0xff);
                    }
                } catch { /* observer never breaks tick */ }
            }).catch(() => {});
        } catch { /* never breaks tick */ }
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

    /** Honest virtual time from the engine's own clock (`sim.nanos`:
     * SAB_SLOT_NANOS_LO/HI = chip.cycles @160MHz × cpuFrequency scale,
     * incl. idle fast-forward; synchronous Atomics read, safe per tick).
     * Replaces the base budget-domain simCycleCount/16 divisor, which
     * measured wall-requested budget (stepBudget echoes the request for
     * this free-running core), not executed engine time. Consumers:
     * SPI idleFlush gaps + bridge lane timestamps (self-consistent same
     * domain), pace pill (now true engine pace). simCycleCount itself is
     * untouched — scheduler stamps (_scheduleBoardCycles/_boardCyclesNow/
     * publishGpio) stay in the budget domain; no _boardCyclesPerUs
     * consumers exist outside the base, so nothing else can observe the
     * domain split. Epoch (folded in resetEngine above) keeps monotonicity
     * across pressResetButton; fallback freezes at last-good instead of
     * mixing in budget-domain time. */
    protected getSimulatedTimeMs(): number {
        try {
            const raw = Number((this.sim as any)?.nanos);
            if (Number.isFinite(raw) && raw >= 0) {
                const ms = Math.floor(this.simTimeEpochMs + raw / 1e6);
                this.simTimeLastMs = ms;
                return ms;
            }
        } catch { /* keep last-good */ }
        try { return Math.floor(this.simTimeLastMs) || 0; } catch { return 0; }
    }
}
