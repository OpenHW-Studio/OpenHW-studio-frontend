/**
 * arm-runner-base.ts — shared BoardRunner scaffold for the 4 ARM board packages.
 *
 * Each board (pico/esp32/stm32f1/stm32f4) has its own thin runner file that
 * subclasses this base and fills in 4 hooks: loadFirmware, stepBudget,
 * drainUartOut, injectUartByte. Everything else — BoardRunner control plane,
 * SAB writers (pin bitfield, serial TX ring, state slots, telemetry ring),
 * peripheral instances, pause/resume/stop/reset — lives here once.
 *
 * Tick model (shared loop shape, mirrors AVRRunner.runLoop):
 *   drain SAB RX ring →inject→ CPU budget → drain TX → instances.update →
 *   emit state. DebugService/SAB writers ride the same hooks on every driver.
 *
 * Threading: runners execute EITHER in-process (legacy: constructed directly
 * by simulation.worker) OR one-per-board inside board.worker.ts compute
 * workers. The engine instance always belongs to the constructing thread —
 * engines are verified isolated per instance (pico 2×Module, stm32f1/4 2×
 * create, esp32 2×SimulatorWorker). Inter-board UART rides the parent
 * simulation.worker's routeUartByte + serialRxByteFromSource path — no new
 * control plane. The shared SAB carries pin/serial/state/telemetry; engines
 * never touch the SAB directly (only this base does).
 */
import { BaseComponent } from '@openhw/emulator';
import {
    BoardRunner,
    AVRRunnerOptions,
    ConnectedComponentPin,
    LOGIC_REGISTRY,
    COMPONENT_PINS,
    getUnifiedComponentSyncState,
    collectComponentTelemetry,
    collectNeopixelShutdownStates,
    getInternalBridgesForComponent,
    collectConnectedComponentPins,
    invokeOptional,
} from '../registries/component-registry.ts';
import {
    SabStateWriter,
    SabCommandReader,
    SabEventWriter,
    SabPinWriter,
    SabDebugWriter,
    SabSerialRing,
    sabKindForType,
} from '../sab/layout.ts';
import { DebugService } from '../debug/service.ts';
import { SabTransport } from '../hal/transport.ts';
import type { SimTransport } from '../hal/types.ts';

/**
 * importEngine — resolve a board engine module in both worlds:
 *  1. Bundler path (node_modules, works in vitest + vite build AND vite
 *     dev — bare-specifier imports are pre-bundled, so the package "exports"
 *     map is honored: use the "." root or an exports-listed subpath only.
 *     Deep paths (./pkg/..., ./site/...) throw ERR_PACKAGE_PATH_NOT_EXPORTED
 *     and fall through to the vendor URL.)
 *  2. Runtime fallback (`/vendor/...` absolute URL, works in the deployed
 *     app where node_modules isn't served but public/ is). Under vitest,
 *     /vendor URLs can't resolve (public/ isn't served) — so swallow that
 *     failure and return null instead of an unhandled rejection. Runners
 *     treat null as "engine unavailable" and stay idle-but-constructed.
 *     NOTE: vite dev REFUSES ?import on public-dir files, and blob-URLs
 *     break the facades' relative imports (./emulator.js, wasm) — so the
 *     vendor fallback is DEPLOY-ONLY. In vite dev the bundler path must win;
 *     if it doesn't, the runner stays idle (honest warning, no silent HTML).
 */
export async function importEngine(bundlerSpec: string, vendorUrl: string): Promise<any> {
    try {
        switch (bundlerSpec) {
            case 'pico-emu/picoemu.wasm.js':
                return await import('pico-emu/picoemu.wasm.js');
            case '../engines/pico-emu-fork/picoemu.wasm.js':
                // OpenHW-studio fork (jsmirror SDD) for I2C runs. Committed
                // under src so vite bundles it like any worker module; the
                // .wasm twin is fetched explicitly by the runner (bytes win
                // over locateFile), so no relative-URL fragility.
                return await import('../engines/pico-emu-fork/picoemu.wasm.js');
            case 'stm32f1-emu/pkg/stm32f1.js':
                return await import('stm32f1-emu');
            case 'stm32f1-emu/pkg/emulator.js':
                return await import('stm32f1-emu/emulator');
            case 'stm32f4-emu/site/stm32f4.js':
                return await import('stm32f4-emu/stm32f4');
            case 'stm32f4-emu/site/vendor/stm32_periph_wasm.js':
                return await import('stm32f4-emu/vendor');
            case 'esp32-emu/dist/sab/worker-proxy.js':
                // Vendor-first in every env: the proxy spawns
                // ./worker-entry.js relatively, and the npm copy carries a
                // static node:crypto import (1.2.0 partition-table) that
                // vite externalizes for browsers. The /vendor mirror has
                // the stub patch (custom-CSV partitions unsupported in
                // browser; default merged-bin boot never hits it).
                try {
                    return await import(/* @vite-ignore */ vendorUrl);
                } catch { /* fall through to bundler */ }
                return await import('esp32-emu/dist/sab/worker-proxy.js');
            case '8086emu/multi_cpu_emu.js':
                // wasm-bindgen ESM, no node: imports — safe in workers.
                return await import('8086emu/multi_cpu_emu.js');
            default:
                return await import(/* @vite-ignore */ bundlerSpec);
        }
    } catch { /* fall through to vendor */ }
    // Deployed app only: node_modules isn't served, public/ is. The
    // facades' relative imports resolve against the /vendor/ URL, which
    // works because the whole package dir is mirrored there.
    try {
        return await import(/* @vite-ignore */ vendorUrl);
    } catch {
        return null;
    }
}

export interface ArmEngineHooks {    /** Load firmware (hexData string per board format) into a fresh engine. */
    loadFirmware(firmware: string, boardType: string): Promise<void> | void;
    /** Run an instruction budget; return executed count. */
    stepBudget(budget: number): number;
    /** Drain bytes the firmware transmitted since last tick. */
    drainUartOut(): number[];
    /** Inject one RX byte (host/UI or inter-board UART). */
    injectUartByte(value: number, source?: string): void;
    /** Optional: engine PC for debug snapshots. */
    getPc?(): number;
    /** Optional: halted flag. */
    isHalted?(): boolean;
    /** Optional: tear down engine resources. */
    close?(): void;
    /** Optional: reset engine to reset vector. */
    resetEngine?(): void;
    /**
     * Optional: sample one engine-driven GPIO output level. Return
     * `{ level: 0|1, driving: boolean }` — `driving:false` (or null/throw)
     * means "not driven by firmware" and the line keeps whatever the
     * external circuit (buttons, sensors, pull-ups) says. Engines that
     * already push changes via hooks (stm32 gpio.on('change')) omit this.
     */
    sampleGpioOut?(pinId: string): { level: number; driving: boolean } | null;
    /**
     * Optional: force one engine-side GPIO input level (0|1). Used when a
     * wired component (button press, sensor) drives a pin the firmware
     * reads. Engines without input injection omit this (RX-only pins).
     */
    setGpioInput?(pinId: string, high: boolean): void;
    /**
     * Optional: sample one engine ADC channel in volts. Return NaN/null
     * when the channel is unmodeled. `ref` selects the pin label.
     */
    readAnalog?(ref: string): number;
}

export abstract class ArmRunnerBase implements BoardRunner {
    cpu: any = null;
    boardId: string;
    instances: Map<string, BaseComponent> = new Map();
    running = false;
    // Phase A lockstep: when true, the runner never self-schedules —
    // a scheduler drives fixed quanta via stepQuantum() instead.
    externalStepping: boolean = false;
    solverMode: 'logic' = 'logic';
    debugService: DebugService | null = null;

    protected currentWires: any[] = [];
    protected speed = 1.0;
    protected serialBaudRate = 9600;
    protected lastTime = 0;
    /** Monotonic executed-step counter fed to inst.update() as cpuCycles. */
    protected simCycleCount = 0;
    protected timer: any = null;
    protected pinStates: Record<string, boolean> = {};
    protected statusIntervalEmitCount = 0;
    protected abstract engine: ArmEngineHooks;
    protected abstract uartTxPins: string[];
    protected abstract uartRxPins: string[];
    // Netlist (same role as AVRRunner.buildNetlist): wire adjacency +
    // internal bridges so GPIO levels fan out to every connected component
    // (LEDs, buttons, sensors, I2C/SPI/UART protocol handlers, …).
    protected pinToNet: Map<string, number> = new Map();
    protected protocolEndpointsCache = new Map<string, ConnectedComponentPin[]>();

    protected readonly onStateUpdate: (state: any) => void;
    protected readonly onByteTransmitCb?: (payload: { boardId: string; value: number; char: string; source?: string }) => void;

    protected sab: SharedArrayBuffer | null = null;
    protected sabOffsets: Record<string, number> = {};
    protected sabWriter: SabStateWriter | null = null;
    protected sabPinWriter: SabPinWriter | null = null;
    protected sabDebugWriter: SabDebugWriter | null = null;
    protected sabSerialTx: SabSerialRing | null = null;
    protected sabSerialRx: SabSerialRing | null = null;
    protected sabPinIndex: Map<string, number> = new Map();
    protected cmdReader: SabCommandReader | null = null;
    protected evtWriter: SabEventWriter | null = null;
    /**
     * Transport facade over the bound SAB writers (plan §5.4/§11.5).
     * All publish paths go through here; raw SAB primitives stay only on
     * read paths (RX drain, command reader, debug service) until Phase 2
     * completes. Null when SAB is absent (message fallback needs no writer).
     */
    protected transport: SimTransport | null = null;

    constructor(
        protected hexData: string,
        componentsDef: any[],
        wiresDef: any[],
        onStateUpdate: (state: any) => void,
        options: AVRRunnerOptions = {},
    ) {
        this.currentWires = wiresDef || [];
        this.onStateUpdate = onStateUpdate;
        this.onByteTransmitCb = options.onByteTransmit;
        this.speed = options.speed ?? 1.0;
        this.boardId = options.boardId || (componentsDef || [])[0]?.id || 'board_0';
        this.setSerialBaudRate(options.serialBaudRate ?? 9600);
        this.attachSab(options);
        this.instantiateComponents(componentsDef || []);
        this.buildNetlist();
        // Apply START telemetry flags at construction (plan §5.5): the
        // enable message can race worker creation, so every run starts
        // with the postamble's intent already applied; later
        // SET_COMPONENT_TELEMETRY still toggles via setTelemetryEnabled.
        try {
            const o = options as any;
            if (o && typeof o.telemetryEnabled === 'boolean') {
                this.setTelemetryEnabled(
                    !!o.telemetryEnabled,
                    typeof o.telemetryMode === 'string' ? o.telemetryMode : undefined,
                    o.telemetryWatchedParams && typeof o.telemetryWatchedParams === 'object'
                        ? o.telemetryWatchedParams : undefined,
                    !!(o.deepSilicon ?? o.deepSiliconEnabled),
                );
            }
        } catch { /* telemetry defaults stand */ }
    }

    /** Async boot: load firmware, then start the tick timer. Subclasses call after super(). */
    protected async boot(boardType: string): Promise<void> {
        await this.engine.loadFirmware(this.hexData, boardType);
        this.running = true;
        this.lastTime = performance.now();
        this.runLoop();
    }

    // ── Engine tick ──────────────────────────────────────────────
    private runLoop = (virtualDeltaMs?: number) => {
        if (!this.running) return;
        // Lockstep guard: externally-stepped runners ignore wall-driven
        // ticks (a pending setTimeout may still fire once after handoff).
        if (this.externalStepping && virtualDeltaMs === undefined) return;
        try {
            // SAB RX ring: UI bytes → engine.
            try {
                const rx = this.sabSerialRx;
                if (rx && typeof (rx as any).drain === 'function') {
                    const bytes = (rx as any).drain(256);
                    for (const b of bytes) this.serialRxByte(b & 0xff);
                }
            } catch { /* RX drain never breaks the tick */ }
            // HALT support (debug service).
            try {
                if (this.cmdReader && this.debugService) {
                    this.debugService.drainCommands(this.cmdReader, 0);
                    if (this.debugService.isHalted()) {
                        const budget = this.debugService.takeStepBudget(0);
                        if (budget <= 0) {
                            this.lastTime = performance.now();
                            if (!this.externalStepping) this.timer = setTimeout(this.runLoop, 8);
                            return;
                        }
                    }
                }
            } catch { /* ring drain never breaks the tick */ }

            const now = performance.now();
            const deltaMs = virtualDeltaMs !== undefined ? virtualDeltaMs : Math.max(0, now - this.lastTime);
            this.lastTime = now;
            // Budget scales with wall time × speed, capped so a stalled tab
            // can't burst the engine. Baselines per core clock (see runners).
            const budget = Math.min(this.budgetForDelta(deltaMs), this.maxBudgetPerTick());
            if (budget > 0 && !this.engine.isHalted?.()) {
                let steps = 0;
                try { steps = Number(this.engine.stepBudget(budget)) || 0; } catch { steps = 0; }
                // Monotonic step counter for component update()/getSyncState()
                // duty-cycle tracking (LEDs, etc.). AVR passes cpu.cycles;
                // ARM/retro engines have no cycle counter, so accumulate
                // executed steps (falls back to budget when engines report 0,
                // e.g. halted cores still tick peripherals/animations).
                this.simCycleCount += Math.max(1, Math.floor(steps)) || Math.max(1, Math.floor(budget));
            } else {
                this.simCycleCount += 1;
            }
            // TX drain → serial path (SAB ring + postMessage callback).
            const out = this.engine.drainUartOut();
            for (const b of out) this.emitTxByte(b & 0xff, 'uart0');
            // Step-counted callbacks (_scheduleBoardCycles service): due
            // callbacks fire in FIFO order right after the engine advanced,
            // so component timing tracks simulated steps, not wall clocks.
            try {
                const due: Array<() => void> = [];
                this.schedQueue = this.schedQueue.filter((item) => {
                    if (item.target <= this.simCycleCount) { due.push(item.cb); return false; }
                    return true;
                });
                for (const cb of due) {
                    try { cb(); } catch { /* never break tick */ }
                }
            } catch { /* scheduler never breaks tick */ }
            // Bidirectional GPIO: sample external inputs (buttons, sensors,
            // pull-ups) into the engine, then publish engine-driven outputs
            // back out. Push-model engines (stm32 on('change') hooks) already
            // published during stepBudget; the poll here is a no-op for them
            // (sampleGpioOut absent) and the source of truth for poll-model
            // engines (pico/esp32/retro) that only expose a whole-port read.
            this.pollGpioBidirectional();
            // Peripheral instances tick. Pass the monotonic step counter
            // (NOT 0): components derive duty cycles / PWM windows from
            // cpuCycle deltas (e.g. LED getSyncState duty = illum/total).
            // A constant 0 freezes every duty tracker at illuminated:false.
            for (const inst of this.instances.values()) {
                try { inst.update(this.simCycleCount, this.currentWires, this.instances as any); } catch { /* never break tick */ }
            }
        } catch (e) {
            console.error(`[${this.boardId}] tick error:`, e);
        }
        if (!this.externalStepping) this.timer = setTimeout(this.runLoop, this.tickIntervalMs());
    };

    /**
     * Lockstep tick (Phase A multi-board): advance a fixed sim-time quantum
     * with no wall reads and no timer reschedule. Budgets derive from the
     * virtual delta exactly like wall time. Single-board path never calls
     * this (own runLoop, untouched).
     */
    public stepQuantum = (simMs: number): void => {
        try {
            if (!this.running) return;
            this.runLoop(Math.max(0.5, Number(simMs) || 8));
        } catch { /* scheduler tick never breaks the loop */ }
    };

    protected budgetForDelta(deltaMs: number): number {
        // Default: ~ core instructions per ms × speed. Subclasses override
        // with their core clock (e.g. pico 133MHz → too fast; use measured
        // sustainable budget instead — see pico-runner).
        return Math.floor(deltaMs * 1000 * this.speed);
    }

    protected maxBudgetPerTick(): number {
        return 2_500_000;
    }

    protected tickIntervalMs(): number {
        return 8;
    }

    // ── Serial ───────────────────────────────────────────────────
    protected emitTxByte(value: number, source: string): void {
        const char = String.fromCharCode(value);
        try { this.transport?.publishSerial(this.boardId, [value & 0xff], source); } catch { /* ignore */ }
        if (this.onByteTransmitCb) {
            this.onByteTransmitCb({ boardId: this.boardId, value, char, source });
        } else {
            this.onStateUpdate({ type: 'serial', data: char, value, boardId: this.boardId, source });
        }
    }

    serialRx(data: string): void {
        for (let i = 0; i < data.length; i++) this.serialRxByte(data.charCodeAt(i));
    }

    serialRxByte(value: number): void {
        try { this.engine.injectUartByte(value & 0xff, 'uart0'); } catch { /* ignore */ }
    }

    serialRxByteFromSource(value: number, source?: string): void {
        try { this.engine.injectUartByte(value & 0xff, source || 'uart0'); } catch { /* ignore */ }
    }

    softSerialRxByte(value: number): void {
        this.serialRxByte(value);
    }

    setSerialBaudRate(baud: number): void {
        const parsed = Number(baud);
        if (!Number.isFinite(parsed)) return;
        this.serialBaudRate = Math.max(300, Math.min(2000000, Math.floor(parsed)));
    }

    getSerialBaudRate(): number {
        return this.serialBaudRate;
    }

    // ── Control plane ────────────────────────────────────────────
    setSpeed(speed: number): void {
        const s = Number(speed);
        if (Number.isFinite(s) && s > 0) this.speed = s;
    }

    setSolverMode(_mode: 'logic'): void {
        this.solverMode = 'logic';
    }

    setTelemetryEnabled(enabled: boolean, mode?: string, watchedParamsMap?: Record<string, string[]>, deepSilicon?: boolean): void {
        // Real per-instance application (mirrors AVRRunner): the previous
        // no-op meant ARM-family telemetry was state-only forever.
        try {
            for (const inst of this.instances.values()) {
                (inst as any).telemetryEnabled = !!enabled;
                if (typeof mode === 'string' && mode) (inst as any).telemetryMode = mode;
                try {
                    (inst as any).telemetryWatchedParams =
                        (watchedParamsMap && watchedParamsMap[(inst as any).id]) || ['all'];
                } catch { (inst as any).telemetryWatchedParams = ['all']; }
                (inst as any).deepSiliconEnabled = !!deepSilicon;
            }
        } catch { /* telemetry flags never break construction */ }
    }

    getRichTelemetrySnapshot(_options: any = {}): any {
        return { boardId: this.boardId, pins: { ...this.pinStates }, components: [] };
    }

    getSimulatedTimeMs(): number {
        return performance.now();
    }

    forceEmitState(): void {
        const msg: any = { type: 'state', boardId: this.boardId, pins: { ...this.pinStates }, components: [] };
        const slotFrames: Array<{ id: string; slot: number; version: number; kind: number; f: number[]; i: number[] }> = [];
        for (const inst of this.instances.values()) {
            try {
                const syncState = getUnifiedComponentSyncState(inst);
                msg.components.push({ id: inst.id, type: inst.type, state: syncState, ...collectComponentTelemetry(inst, undefined, undefined) });
                if ((inst as any).sabSlot >= 0) {
                    try {
                        const ui = typeof (inst as any).uiState === 'function' ? (inst as any).uiState() : null;
                        const f = ui?.f ? Object.values(ui.f).map(Number) : [];
                        const i = ui?.i ? Object.values(ui.i).map(Number) : [];
                        slotFrames.push({
                            id: inst.id, slot: (inst as any).sabSlot,
                            version: (inst as any).stateVersion || 0,
                            kind: sabKindForType(inst.type), f, i,
                        });
                    } catch { /* SAB write never breaks sim */ }
                }
            } catch { /* never break emit */ }
        }
        try { this.transport?.publishComponentSlots(slotFrames); } catch { /* never break emit */ }
        msg._emitSeq = ++this.statusIntervalEmitCount;
        msg._emitTime = performance.now();
        msg.simTimeMs = this.getSimulatedTimeMs();
        this.onStateUpdate(msg);
    }

    pause(): void {
        this.running = false;
        if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    }

    resume(): void {
        if (!this.running) {
            this.running = true;
            this.lastTime = performance.now();
            this.runLoop();
        }
    }

    stepCycles(n: number): number {
        try { return this.engine.stepBudget(Math.min(Math.max(1, Math.floor(n)), 1000000)); }
        catch { return 0; }
    }

    getDebugSnapshot(): any {
        let pc = 0;
        try { pc = Number(this.engine.getPc?.()) || 0; } catch { /* ignore */ }
        const snap: any = { halted: false, pc: pc >>> 0, boardId: this.boardId };
        try { (this as any).sabDebugWriter?.write(snap); } catch { /* ignore */ }
        return snap;
    }

    stop(): void {
        this.running = false;
        if (this.timer) { clearTimeout(this.timer); this.timer = null; }
        try { collectNeopixelShutdownStates(this.instances); } catch { /* ignore */ }
        try { this.engine.close?.(); } catch { /* ignore */ }
    }

    reset(): void {
        try { this.engine.resetEngine?.(); } catch { /* ignore */ }
    }

    // ── SAB attach (same shape as AVRRunner + v2 per-board regions) ──
    // boardIdx selects this runner's OWN serial pair + debug region from
    // the shared SAB (options.sabBoardSerialBase / sabBoardDebugBase).
    // Falls back to the legacy shared offsets (board 0) when absent.
    private attachSab(options: AVRRunnerOptions & { boardIdx?: number }): void {
        this.sab = (options as any).sab || null;
        const rawOffsets = (options as any).sabOffsets || {};
        this.sabOffsets = {};
        for (const key of Object.keys(rawOffsets)) {
            const v = Number(rawOffsets[key]);
            this.sabOffsets[key] = Number.isFinite(v) && v >= 64 ? Math.floor(v / 64) : (Number.isFinite(v) ? v : 0);
        }
        // Board pin list is SAB-INDEPENDENT: the GPIO bidirectional poll
        // iterates it every tick, including in postMessage-fallback mode
        // (no SAB, e.g. dev without COOP/COEP). Resolve from boardPinMaps
        // when present, else from COMPONENT_PINS (manifest truth).
        try {
            const maps = (options as any)?.boardPinMaps;
            const myMap = Array.isArray(maps) ? maps.find((m: any) => String(m?.boardId) === String(this.boardId)) || maps[0] : null;
            let pins: string[] = myMap && Array.isArray(myMap.pins) ? myMap.pins.map((p: any) => String(p)) : [];
            if (!pins.length) {
                const fb = (COMPONENT_PINS as any)[String((options as any)?.boardType || '')];
                if (Array.isArray(fb)) pins = fb.map((p: any) => String(p?.id ?? p));
            }
            pins.forEach((p: any, i: number) => { this.sabPinIndex.set(String(p), i); });
            try {
                this.boardPinList = pins.map((p: any) => String(p));
            } catch { this.boardPinList = []; }
        } catch { /* board pin list stays empty → poll no-op */ }
        if (!this.sab) return;
        try {
            this.sabWriter = new SabStateWriter(this.sab as SharedArrayBuffer);
            const pinWriter = new SabPinWriter(this.sab as SharedArrayBuffer);
            const geo = (options as any)?.sabGeometry as any;
            if (geo && Number(geo.pinBitWords) > 0) {
                pinWriter.bindGeometry(Number(geo.pinBitWords), Number(geo.analogBase));
                this.sabPinWriter = pinWriter;
            }
            const dbgOff = Number((options as any)?.sabDebugOffset);
            if (Number.isFinite(dbgOff) && dbgOff > 0) this.sabDebugWriter = new SabDebugWriter(this.sab as SharedArrayBuffer, dbgOff);
            const rxOff = Number((options as any)?.sabSerialRxOffset);
            const txOff = Number((options as any)?.sabSerialTxOffset);
            if (Number.isFinite(rxOff) && rxOff > 0) this.sabSerialRx = new SabSerialRing(this.sab as SharedArrayBuffer, rxOff);
            // Phase B: worker-hosted runners emit serial via postMessage
            // (single coherent channel); SAB TX stays unbound so the UI poll
            // doesn't deliver every byte a second time. RX untouched.
            const txDisabled = !!(options as any)?.sabSerialTxDisabled;
            if (!txDisabled && Number.isFinite(txOff) && txOff > 0) this.sabSerialTx = new SabSerialRing(this.sab as SharedArrayBuffer, txOff);
            // v2 per-board override: rebind serial + debug to this board's
            // own regions so engines never share head/tail words. Stride
            // math mirrors boardSerialOffsets()/boardDebugOffset() in
            // sab/layout.ts (inlined: no extra import in the tick path).
            try {
                const bi = Math.max(0, Number((options as any)?.boardIdx) || 0);
                const serialBase = Number((options as any)?.sabBoardSerialBase);
                const debugBase = Number((options as any)?.sabBoardDebugBase);
                const nBoards = Number((options as any)?.sabNumBoards) || 0;
                if (Number.isFinite(serialBase) && serialBase > 0 && (!nBoards || bi < nBoards)) {
                    // SAB_BOARD_SERIAL_STRIDE_B = (8 + 4096) * 2; keep in sync.
                    const stride = (8 + 4096) * 2;
                    const rx = serialBase + bi * stride;
                    const tx = rx + 8 + 4096;
                    this.sabSerialRx = new SabSerialRing(this.sab as SharedArrayBuffer, rx);
                    // TX unbound for worker-hosted runners (see above); the
                    // per-board RX rebind always applies (UI input path).
                    if (!txDisabled) {
                        this.sabSerialTx = new SabSerialRing(this.sab as SharedArrayBuffer, tx);
                    }
                }
                if (Number.isFinite(debugBase) && debugBase > 0 && (!nBoards || bi < nBoards)) {
                    this.sabDebugWriter = new SabDebugWriter(this.sab as SharedArrayBuffer, debugBase + bi * 24);
                }
            } catch { /* keep legacy bindings */ }
            const cmdBuf = (options as any).cmdBuffer as SharedArrayBuffer | undefined;
            const evtBuf = (options as any).evtBuffer as SharedArrayBuffer | undefined;
            if (cmdBuf) this.cmdReader = new SabCommandReader(cmdBuf);
            if (evtBuf) this.evtWriter = new SabEventWriter(evtBuf);
            if (this.cmdReader || this.evtWriter) {
                this.debugService = new DebugService(this.sab as SharedArrayBuffer, { ...this.sabOffsets }, this.evtWriter);
            }
            // Transport facade (plan §5.4): publish paths go through here
            // from now on. Same writers, same order, same values — behavior
            // identical to the direct calls above; the indirection is the
            // point (runners stop knowing SAB primitives).
            try {
                this.transport = new SabTransport({
                    buffer: this.sab as SharedArrayBuffer,
                    pinIndex: this.sabPinIndex,
                    pinWriter: this.sabPinWriter || undefined,
                    stateWriter: this.sabWriter || undefined,
                    serialTx: this.sabSerialTx || undefined,
                    evtWriter: this.evtWriter || undefined,
                    cmdReader: this.cmdReader || undefined,
                    railVoltage: this.gpioRailV(),
                    clock: () => performance.now(),
                });
            } catch { this.transport = null; }
        } catch { /* writers stay null → postMessage paths */ }
    }

    private instantiateComponents(componentsDef: any[]): void {
        for (const cDef of componentsDef) {
            const LogicClass = (LOGIC_REGISTRY as any)[cDef.type];
            if (!LogicClass) continue;
            try {
                const manifestPins = (LogicClass as any)?.manifest?.pins || (cDef as any)?.pins || (COMPONENT_PINS as any)[cDef.type] || [{ id: 'GND' }];
                const inst = new LogicClass(cDef.id, { type: cDef.type, attrs: cDef.attrs || {}, pins: manifestPins });
                const slot = this.sabOffsets[cDef.id];
                inst.sabSlot = Number.isFinite(Number(slot)) ? Number(slot) : -1;
                if (cDef.attrs) inst.state = { ...inst.state, ...cDef.attrs };
                // Runner-agnostic board-drive service (plan §5.3): component
                // → engine input injection without board-type branches.
                // Engines without input injection simply ignore the call.
                if (!(inst as any)._driveBoardPin) {
                    (inst as any)._driveBoardPin = (boardPin: string, isHigh: boolean) => {
                        try { this.engine.setGpioInput?.(String(boardPin), !!isHigh); } catch { /* ignore */ }
                    };
                }
                // Runner-agnostic clock + net services (plan §5.3).
                if (!(inst as any)._scheduleBoardCycles) {
                    (inst as any)._scheduleBoardCycles = (cb: () => void, delayCycles: number) => {
                        try {
                            const d = Math.max(0, Math.floor(Number(delayCycles) || 0));
                            this.schedQueue.push({ target: this.simCycleCount + d, cb });
                        } catch { /* ignore */ }
                    };
                }
                if (!(inst as any)._boardCyclesNow) {
                    (inst as any)._boardCyclesNow = () => this.simCycleCount;
                }
                if (!(inst as any)._boardNetOf) {
                    (inst as any)._boardNetOf = (componentPin: string): string | null => {
                        try { return this.boardPinForComponentPin(cDef.id, componentPin); } catch { return null; }
                    };
                }
                this.instances.set(cDef.id, inst);
            } catch { /* skip bad component */ }
        }
    }

    /** Publish one GPIO output level into pinStates + SAB pin bitfield,
     * then fan out to every connected component pin (same contract as
     * AVRRunner.propagateBoardPin: voltage + isHigh + onPinStateChange).
     * Retro boards are 5V TTL (8086/8085/8051/6502/Z80/rv32 kit); ARM
     * boards are 3.3V CMOS. LEDs need ≥1.5V over drop and burn out >4V
     * without a series resistor, so the rail voltage matters. */
    protected publishGpio(pinId: string, isHigh: boolean, analogV?: number): void {
        // Same-level dedup: transfer callbacks fire during execute() while
        // GPIO change events dispatch after it, so a stale assert arriving
        // late would wipe an already-accumulated SPI frame (observed: F1
        // MAX7219 10 bytes then late assert → empty frame). Identical
        // re-delivery is semantically a no-op — skip it (analogV-carrying
        // calls always fan out).
        if (!Number.isFinite(analogV as number) && this.pinStates[pinId] === !!isHigh) return;
        this.pinStates[pinId] = !!isHigh;
        const railV = this.gpioRailV();
        try {
            this.transport?.publishPins(
                this.boardId,
                { [pinId]: !!isHigh },
                Number.isFinite(analogV as number) ? { [pinId]: analogV as number } : undefined,
            );
        } catch { /* pin publish never breaks propagation */ }
        const boardInst = this.instances.get(this.boardId);
        try { boardInst?.onPinStateChange(pinId, !!isHigh, 0); } catch { /* ignore */ }
        // Component fan-out: LEDs light, buttons/sensors react, protocol
        // handlers (I2C/SPI/UART/PWM/OneWire) get their signal callbacks.
        const voltage = isHigh ? railV : 0.0;
        for (const endpoint of this.getProtocolEndpointsForPin(pinId)) {
            try {
                endpoint.inst.setPinVoltage(endpoint.pinId, voltage);
                if ((endpoint.inst as any).pins?.[endpoint.pinId]) {
                    (endpoint.inst as any).pins[endpoint.pinId].isHigh = !!isHigh;
                    (endpoint.inst as any).pins[endpoint.pinId].voltage = voltage;
                }
                endpoint.inst.onPinStateChange(endpoint.pinId, !!isHigh, 0);
            } catch { /* one bad component never breaks the fan-out */ }
        }
    }

    /** Logic rail for publishGpio fan-out voltage. Retro TTL kit = 5V,
     * everything else (AVR 5V excepted — AVR has its own runner) = 3.3V.
     * Overridden per runner family via board-type sniff (no extra option). */
    protected gpioRailV(): number {
        return 3.3;
    }

    /** Board-pin aliases for netlist lookup (D13/13, GPIOx/GPx, PA9/A9…). */
    protected getPinAliases(pinId: string): string[] {
        const raw = String(pinId || '').toUpperCase();
        const out = new Set<string>([raw]);
        if (/^D\d+$/.test(raw)) out.add(raw.slice(1));
        else if (/^\d+$/.test(raw)) out.add(`D${raw}`);
        if (/^GPIO\d+$/.test(raw)) out.add(raw.replace(/^GPIO/, 'GP'));
        if (/^GP\d+$/.test(raw)) out.add(raw.replace(/^GP/, 'GPIO'));
        if (/^PA\d+$/.test(raw) || /^PB\d+$/.test(raw) || /^PC\d+$/.test(raw) || /^PD\d+$/.test(raw)) {
            out.add(raw.slice(1)); // PA9 → A9
        }
        // Retro boards (8086/8085/8051/6502/Z80/rv32): shells expose
        // L0–L19/R0–R19; L0 = console TX, L1 = console RX (never GPIO).
        // GPIO view: Ln/Rn (2<=n<=17) → bit (n&7); L2–L9 = port-0 byte
        // (PA/P1/ORA), L10–L17 = port-2 byte (PC/P2/ORB). Legacy Pn/Dn/An
        // labels alias the same bits. So Pn aliases every Ln/Rn with
        // (n&7)==b, and Ln aliases Pn plus its same-bit siblings:
        //   P2 ↔ L2/R2/L10/R10; L2 ↔ P2/L10/R2/R10; L10 ↔ P2/L2/R2/R10.
        // L0/L1/L18/L19/R18/R19 are console/serial — no GPIO aliases.
        const lr = raw.match(/^[LR](\d{1,2})$/);
        if (lr) {
            const n = Number(lr[1]);
            if (n >= 2 && n <= 17) {
                const b = n & 7;
                out.add(`P${b}`);
                const sib = n <= 9 ? n + 8 : n - 8;
                const side = raw[0];
                const other = side === 'L' ? 'R' : 'L';
                out.add(`${side}${sib}`); out.add(`${other}${n}`); out.add(`${other}${sib}`);
            }
        } else {
            const pm = raw.match(/^(?:P|D|GPIO|GP|A)(\d{1,2})$/);
            if (pm) {
                // Every L/R pin whose bit (n&7) matches is the same net.
                const b = Number(pm[1]) & 7;
                for (let n = 2; n <= 17; n++) {
                    if ((n & 7) === b) { out.add(`L${n}`); out.add(`R${n}`); }
                }
            }
        }
        // GND variants (GND/GND_1/GND.1…) share one net; 5V/VCC likewise.
        if (raw === 'GND' || /^GND[._]?\d*$/.test(raw)) {
            out.add('GND'); out.add('GND_1'); out.add('GND.1');
        }
        if (raw === '5V' || raw === 'VCC') { out.add('5V'); out.add('VCC'); }
        if (raw === '3V3' || raw === '3.3V') out.add('3V3');
        return Array.from(out);
    }

    protected getProtocolEndpointsForPin(pinId: string): ConnectedComponentPin[] {
        const key = String(pinId || '').toUpperCase();
        const cached = this.protocolEndpointsCache.get(key);
        if (cached) return cached;
        const endpoints = collectConnectedComponentPins(
            this.boardId,
            this.getPinAliases(key),
            this.currentWires,
            this.instances,
        );
        this.protocolEndpointsCache.set(key, endpoints);
        return endpoints;
    }

    /** Build the wire+bridge netlist (mirrors AVRRunner.buildNetlist). */
    protected buildNetlist(): void {
        this.protocolEndpointsCache.clear();
        const adj = new Map<string, string[]>();
        const addEdge = (a: string, b: string) => {
            if (!adj.has(a)) adj.set(a, []);
            if (!adj.has(b)) adj.set(b, []);
            adj.get(a)!.push(b);
            adj.get(b)!.push(a);
        };
        for (const wire of this.currentWires) {
            if (wire?.from && wire?.to) addEdge(String(wire.from), String(wire.to));
        }
        for (const [id, inst] of this.instances) {
            for (const bridge of getInternalBridgesForComponent(id, inst.type)) {
                addEdge(bridge[0], bridge[1]);
            }
        }
        const visited = new Set<string>();
        let currentNet = 0;
        for (const startNode of adj.keys()) {
            if (visited.has(startNode)) continue;
            const queue = [startNode];
            visited.add(startNode);
            while (queue.length > 0) {
                const node = queue.shift()!;
                this.pinToNet.set(node, currentNet);
                const parts = node.split(':');
                if (parts.length === 2) {
                    const compId = parts[0];
                    const pId = parts[1];
                    const upper = pId.toUpperCase();
                    if (!pId.startsWith('D') && !pId.startsWith('A') && /^\d+$/.test(pId)) {
                        this.pinToNet.set(`${compId}:D${pId}`, currentNet);
                    } else if (pId.startsWith('D')) {
                        this.pinToNet.set(`${compId}:${pId.substring(1)}`, currentNet);
                    }
                    if (/^GPIO\d+$/.test(upper)) {
                        this.pinToNet.set(`${compId}:${upper.replace(/^GPIO/, 'GP')}`, currentNet);
                    } else if (/^GP\d+$/.test(upper)) {
                        this.pinToNet.set(`${compId}:${upper.replace(/^GP/, 'GPIO')}`, currentNet);
                    }
                    if (upper === 'GND' || /^GND[._]?\d*$/.test(upper)) {
                        this.pinToNet.set(`${compId}:GND`, currentNet);
                    }
                    if (upper === '5V' || upper === 'VCC') {
                        this.pinToNet.set(`${compId}:5V`, currentNet);
                        this.pinToNet.set(`${compId}:VCC`, currentNet);
                    }
                    if (upper === '3V3' || upper === '3.3V') {
                        this.pinToNet.set(`${compId}:3V3`, currentNet);
                    }
                }
                for (const neighbor of adj.get(node) || []) {
                    if (!visited.has(neighbor)) {
                        visited.add(neighbor);
                        queue.push(neighbor);
                    }
                }
            }
            currentNet++;
        }
    }

    /** Dispatch optional protocol callbacks for a pin edge (PWM/OneWire…). */
    protected dispatchOptionalProtocols(pinId: string, isHigh: boolean): void {
        for (const endpoint of this.getProtocolEndpointsForPin(pinId)) {
            try {
                invokeOptional(endpoint.inst as any, ['onPWM', 'onPwm', 'onPWMSignal'], [endpoint.pinId, { boardPin: pinId, isHigh }]);
            } catch { /* ignore */ }
        }
        // OneWire bit-bang decode rides the same edge (AVR parity):
        // DS18B20 needs onOneWireReset (≥360µs low) + onOneWireWriteBit /
        // onOneWireSlot (1–120µs low). Wall-clock approximation — engines
        // don't expose cycle counters, so timing uses performance.now().
        // Only fires when a OneWire-capable endpoint is actually wired.
        try {
            this.dispatchOptionalOneWire(pinId, isHigh);
        } catch { /* ignore */ }
    }

    private oneWireState = new Map<string, { lowStartMs: number | null; highStartMs: number | null }>();

    private dispatchOptionalOneWire(pinId: string, isHigh: boolean): void {
        const key = String(pinId || '').toUpperCase();
        let state = this.oneWireState.get(key);
        if (!state) {
            state = { lowStartMs: null, highStartMs: null };
            this.oneWireState.set(key, state);
        }
        const nowMs = performance.now();
        const endpoints = this.getProtocolEndpointsForPin(pinId);
        const hasOneWire = endpoints.some((e: any) => {
            const inst = e?.inst as any;
            return inst && (typeof inst.onOneWireReset === 'function' || typeof inst.onOnewireReset === 'function'
                || typeof inst.onOneWireWriteBit === 'function' || typeof inst.onOnewireWriteBit === 'function'
                || typeof inst.onOneWireSlot === 'function' || typeof inst.onOnewireSlot === 'function'
                || typeof inst.onPulseLow === 'function' || typeof inst.onDigitalPulseLow === 'function'
                || typeof inst.onOneWirePulseLow === 'function' || typeof inst.onPulseHigh === 'function'
                || typeof inst.onDigitalPulseHigh === 'function' || typeof inst.onOneWirePulseHigh === 'function');
        });
        if (!hasOneWire) {
            if (isHigh) { state.lowStartMs = null; state.highStartMs = nowMs; }
            else { state.highStartMs = null; state.lowStartMs = nowMs; }
            return;
        }
        if (!isHigh) {
            if (state.highStartMs != null) {
                const highUs = Math.max(0, (nowMs - state.highStartMs) * 1000);
                if (highUs > 0) {
                    const meta = { protocol: 'pulse', boardPin: key, pulseUs: highUs, highUs, edge: 'falling' };
                    for (const endpoint of endpoints) {
                        invokeOptional(endpoint.inst as any, ['onPulseHigh', 'onDigitalPulseHigh', 'onOneWirePulseHigh'], [endpoint.pinId, meta]);
                    }
                }
            }
            state.highStartMs = null;
            state.lowStartMs = nowMs;
            return;
        }
        if (state.lowStartMs == null) return;
        const lowUs = Math.max(0, (nowMs - state.lowStartMs) * 1000);
        state.lowStartMs = null;
        state.highStartMs = nowMs;
        if (lowUs > 0) {
            const meta = { protocol: 'pulse', boardPin: key, pulseUs: lowUs, lowUs, edge: 'rising' };
            for (const endpoint of endpoints) {
                invokeOptional(endpoint.inst as any, ['onPulseLow', 'onDigitalPulseLow', 'onOneWirePulseLow'], [endpoint.pinId, meta]);
            }
        }
        if (lowUs >= 360) {
            const meta = { protocol: 'onewire', boardPin: key, pulseUs: lowUs, kind: 'reset' };
            for (const endpoint of endpoints) {
                invokeOptional(endpoint.inst as any, ['onOneWireReset', 'onOnewireReset'], [endpoint.pinId, meta]);
            }
            return;
        }
        if (lowUs >= 1 && lowUs <= 120) {
            const bit = lowUs < 20 ? 1 : 0;
            const meta = { protocol: 'onewire', boardPin: key, pulseUs: lowUs, kind: 'slot', bit };
            for (const endpoint of endpoints) {
                invokeOptional(endpoint.inst as any, ['onOneWireWriteBit', 'onOnewireWriteBit'], [endpoint.pinId, bit, meta]);
                invokeOptional(endpoint.inst as any, ['onOneWireSlot', 'onOnewireSlot'], [endpoint.pinId, meta]);
            }
        }
    }

    /**
     * Bidirectional GPIO poll (runs every tick, after stepBudget):
     *  1. INPUT: read each wired non-board pin's driven voltage and push it
     *     into the engine (setGpioInput when available). Buttons/sensors own
     *     the line here — publishGpio is NOT called for input-driven levels.
     *  2. OUTPUT: ask the engine for each board pin it drives
     *     (sampleGpioOut) and publishGpio on change (LEDs, protocol pins,
     *     dispatchOptionalProtocols for PWM/OneWire edges).
     * Engines with neither hook (pure push-model, e.g. stm32 change hooks)
     * skip both halves silently.
     */
    protected pollGpioBidirectional(): void {
        // Sampler resolution: engine hook wins; fall back to a runner-class
        // method of the same name (a missing engine hook used to silently
        // disable ALL GPIO publishing — never again). Resolved FIRST so the
        // input half can ask it whether the engine drives a pin: engines
        // whose input injection unconditionally overwrites the pin level
        // (proven: pico-emu `_set_gpio` clears the SIO OUT latch) must not
        // be fed the lagging component-side voltage of a net the engine
        // itself drives — output wins, exactly like real hardware.
        const sampler: ((pinId: string) => { level: number; driving: boolean } | null) | null =
            typeof this.engine.sampleGpioOut === 'function'
                ? (pinId: string) => { try { return this.engine.sampleGpioOut!(pinId); } catch { return null; } }
                : (typeof (this as any).sampleGpioOut === 'function'
                    ? (pinId: string) => { try { return (this as any).sampleGpioOut(pinId); } catch { return null; } }
                    : null);
        // Non-consuming peek for the INPUT half below: probing a pin to
        // decide input injection must not consume change dedup owned by
        // the sampler (observed starving retro GPIO output publishing).
        // Engines without peek keep the legacy shared-sampler behavior.
        const peeker: ((pinId: string) => { level: number; driving: boolean } | null) | null =
            typeof (this.engine as any)?.peekGpioOut === 'function'
                ? (pinId: string) => { try { return (this.engine as any).peekGpioOut!(pinId); } catch { return null; } }
                : (typeof (this as any).peekGpioOut === 'function'
                    ? (pinId: string) => { try { return (this as any).peekGpioOut(pinId); } catch { return null; } }
                    : sampler);
        if (!sampler && typeof this.engine.setGpioInput !== 'function') return;
        // INPUT half: external components driving nets the board reads.
        // Skipped per-pin when the engine drives that pin (output wins).
        if (typeof this.engine.setGpioInput === 'function') {
            try {
                const seen = new Set<string>();
                for (const wire of this.currentWires) {
                    for (const end of [wire?.from, wire?.to]) {
                        if (!end || typeof end !== 'string') continue;
                        const [compId, pinId] = end.split(':');
                        if (!compId || !pinId || compId === this.boardId) continue;
                        if (seen.has(end)) continue;
                        seen.add(end);
                        const inst = this.instances.get(compId);
                        if (!inst || typeof (inst as any).getPinVoltage !== 'function') continue;
                        let voltage = 0;
                        try { voltage = Number((inst as any).getPinVoltage(pinId)) || 0; } catch { continue; }
                        // Find the board pin on the same net.
                        const net = this.pinToNet.get(end);
                        if (net === undefined) continue;
                        for (const [node, netId] of this.pinToNet) {
                            if (netId !== net) continue;
                            const [bId, bPin] = node.split(':');
                            if (bId !== this.boardId || !bPin) continue;
                            try {
                                if (peeker) {
                                    const s = peeker(bPin);
                                    if (s && s.driving) break; // engine drives: output wins
                                }
                            } catch { /* sampler failure never blocks input */ }
                            try { this.engine.setGpioInput!(bPin, voltage > 0.5); } catch { /* ignore */ }
                            break;
                        }
                    }
                }
            } catch { /* input sampling never breaks the tick */ }
        }
        // OUTPUT half: engine-driven levels → publishGpio on change.
        if (!sampler) return;
        try {
            const boardMap = this.boardPinMap();
            const published = new Set<string>();
            for (const pinId of boardMap) {
                let sample: { level: number; driving: boolean } | null = null;
                try { sample = sampler(pinId); } catch { sample = null; }
                if (!sample || !sample.driving) continue;
                const high = !!sample.level;
                // Retro alias guard: Ln/Rn and Pn are the SAME electrical
                // net (see getPinAliases). Publishing both would double-fire
                // edges into the component; publish the first label only.
                const netKey = this.netKeyForPin(pinId);
                if (published.has(netKey)) continue;
                published.add(netKey);
                if (this.pinStates[pinId] === high && this.pinStatesInit.has(pinId)) continue;
                this.pinStatesInit.add(pinId);
                this.publishGpio(pinId, high);
                try { this.dispatchOptionalProtocols(pinId, high); } catch { /* ignore */ }
            }
        } catch { /* output poll never breaks the tick */ }
    }

    /** Board pins worth polling (manifest order; cached per runner). */
    private pinPollCache: string[] | null = null;
    private pinStatesInit = new Set<string>();
    private boardPinList: string[] = [];
    /** Step-counted callback queue backing _scheduleBoardCycles. */
    private schedQueue: Array<{ target: number; cb: () => void }> = [];

    /**
     * Board-side pin label sharing a net with one of a component's pins
     * (backs the _boardNetOf bus service). Returns the bare pin label.
     */
    protected boardPinForComponentPin(compId: string, componentPin: string): string | null {
        const net = this.pinToNet.get(`${compId}:${componentPin}`);
        if (net === undefined) return null;
        for (const [node, netId] of this.pinToNet) {
            if (netId !== net) continue;
            const [bId, bPin] = node.split(':');
            if (bId === this.boardId && bPin) return bPin;
        }
        return null;
    }

    /** Net identity for the alias guard: board pins aliasing to the same
     * net (Ln/Rn ↔ Pn on retro, Dx ↔ x on AVR-likes) share one key. */
    private netKeyForPin(pinId: string): string {
        const raw = String(pinId || '').toUpperCase();
        const lr = raw.match(/^[LR](\d{1,2})$/);
        if (lr) {
            const n = Number(lr[1]);
            if (n >= 2 && n <= 17) return `RETRO_P${n & 7}`;
        }
        const pm = raw.match(/^P([0-7])$/);
        if (pm) return `RETRO_P${pm[1]}`;
        return `PIN:${raw}`;
    }

    protected boardPinMap(): string[] {
        if (this.pinPollCache) return this.pinPollCache;
        try {
            const pins = Array.isArray(this.boardPinList) ? this.boardPinList : [];
            this.pinPollCache = pins.map(String).filter((p) => p && !/^(GND|5V|3V3|VIN|VBUS|VSYS|VCC|AGND|VBAT|RESET|RST|RUN|3V3_EN|ADC_VREF|SWD|SWCLK|SWDIO)/i.test(p));
        } catch {
            this.pinPollCache = [];
        }
        return this.pinPollCache;
    }
}
