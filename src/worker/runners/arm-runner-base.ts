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
    LOGIC_REGISTRY,
    COMPONENT_PINS,
    getUnifiedComponentSyncState,
    collectComponentTelemetry,
    collectNeopixelShutdownStates,
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

/**
 * importEngine — resolve a board engine module in both worlds:
 *  1. Bundler path (node_modules, works in vitest + vite build).
 *     NOTE: esp32-emu/stm32f1-emu/stm32f4-emu exports maps only expose ".",
 *     so deep paths throw ERR_PACKAGE_PATH_NOT_EXPORTED in Node — the
 *     switch below only lists specs that actually resolve; the rest go
 *     straight to the /vendor fallback.
 *  2. Runtime fallback (`/vendor/...` absolute URL, works in the deployed
 *     app where node_modules isn't served but public/ is). Under vitest,
 *     /vendor URLs can't resolve (public/ isn't served) — so swallow that
 *     failure and return null instead of an unhandled rejection. Runners
 *     treat null as "engine unavailable" and stay idle-but-constructed.
 */
export async function importEngine(bundlerSpec: string, vendorUrl: string): Promise<any> {
    if (bundlerSpec === 'pico-emu/picoemu.wasm.js') {
        try {
            return await import('pico-emu/picoemu.wasm.js');
        } catch { /* fall through to vendor */ }
    }
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
}

export abstract class ArmRunnerBase implements BoardRunner {
    cpu: any = null;
    boardId: string;
    instances: Map<string, BaseComponent> = new Map();
    running = false;
    solverMode: 'logic' = 'logic';
    debugService: DebugService | null = null;

    protected currentWires: any[] = [];
    protected speed = 1.0;
    protected serialBaudRate = 9600;
    protected lastTime = 0;
    protected timer: any = null;
    protected pinStates: Record<string, boolean> = {};
    protected statusIntervalEmitCount = 0;
    protected abstract engine: ArmEngineHooks;
    protected abstract uartTxPins: string[];
    protected abstract uartRxPins: string[];

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
    }

    /** Async boot: load firmware, then start the tick timer. Subclasses call after super(). */
    protected async boot(boardType: string): Promise<void> {
        await this.engine.loadFirmware(this.hexData, boardType);
        this.running = true;
        this.lastTime = performance.now();
        this.runLoop();
    }

    // ── Engine tick ──────────────────────────────────────────────
    private runLoop = () => {
        if (!this.running) return;
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
                            this.timer = setTimeout(this.runLoop, 8);
                            return;
                        }
                    }
                }
            } catch { /* ring drain never breaks the tick */ }

            const now = performance.now();
            const deltaMs = Math.max(0, now - this.lastTime);
            this.lastTime = now;
            // Budget scales with wall time × speed, capped so a stalled tab
            // can't burst the engine. Baselines per core clock (see runners).
            const budget = Math.min(this.budgetForDelta(deltaMs), this.maxBudgetPerTick());
            if (budget > 0 && !this.engine.isHalted?.()) {
                this.engine.stepBudget(budget);
            }
            // TX drain → serial path (SAB ring + postMessage callback).
            const out = this.engine.drainUartOut();
            for (const b of out) this.emitTxByte(b & 0xff, 'uart0');
            // Peripheral instances tick (animation/state only — engines own pins).
            for (const inst of this.instances.values()) {
                try { inst.update(0, this.currentWires, this.instances as any); } catch { /* never break tick */ }
            }
        } catch (e) {
            console.error(`[${this.boardId}] tick error:`, e);
        }
        this.timer = setTimeout(this.runLoop, this.tickIntervalMs());
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
        try { (this.sabSerialTx as any)?.pushByte(value & 0xff); } catch { /* ignore */ }
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

    setTelemetryEnabled(_enabled: boolean): void { /* per-component flags ride instances */ }

    getRichTelemetrySnapshot(_options: any = {}): any {
        return { boardId: this.boardId, pins: { ...this.pinStates }, components: [] };
    }

    getSimulatedTimeMs(): number {
        return performance.now();
    }

    forceEmitState(): void {
        const msg: any = { type: 'state', boardId: this.boardId, pins: { ...this.pinStates }, components: [] };
        for (const inst of this.instances.values()) {
            try {
                const syncState = getUnifiedComponentSyncState(inst);
                msg.components.push({ id: inst.id, type: inst.type, state: syncState, ...collectComponentTelemetry(inst, undefined, undefined) });
                if (this.sabWriter && (inst as any).sabSlot >= 0) {
                    try {
                        const ui = typeof (inst as any).uiState === 'function' ? (inst as any).uiState() : null;
                        const f = ui?.f ? Object.values(ui.f).map(Number) : [];
                        const i = ui?.i ? Object.values(ui.i).map(Number) : [];
                        this.sabWriter.writeSlot((inst as any).sabSlot, (inst as any).stateVersion || 0, sabKindForType(inst.type), 0, f as number[], i as number[]);
                    } catch { /* SAB write never breaks sim */ }
                }
            } catch { /* never break emit */ }
        }
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
            if (Number.isFinite(txOff) && txOff > 0) this.sabSerialTx = new SabSerialRing(this.sab as SharedArrayBuffer, txOff);
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
                    this.sabSerialTx = new SabSerialRing(this.sab as SharedArrayBuffer, tx);
                }
                if (Number.isFinite(debugBase) && debugBase > 0 && (!nBoards || bi < nBoards)) {
                    this.sabDebugWriter = new SabDebugWriter(this.sab as SharedArrayBuffer, debugBase + bi * 24);
                }
            } catch { /* keep legacy bindings */ }
            const maps = (options as any)?.boardPinMaps;
            const myMap = Array.isArray(maps) ? maps.find((m: any) => String(m?.boardId) === String(this.boardId)) || maps[0] : null;
            const pins = myMap && Array.isArray(myMap.pins) ? myMap.pins : [];
            pins.forEach((p: any, i: number) => { this.sabPinIndex.set(String(p), i); });
            const cmdBuf = (options as any).cmdBuffer as SharedArrayBuffer | undefined;
            const evtBuf = (options as any).evtBuffer as SharedArrayBuffer | undefined;
            if (cmdBuf) this.cmdReader = new SabCommandReader(cmdBuf);
            if (evtBuf) this.evtWriter = new SabEventWriter(evtBuf);
            if (this.cmdReader || this.evtWriter) {
                this.debugService = new DebugService(this.sab as SharedArrayBuffer, { ...this.sabOffsets }, this.evtWriter);
            }
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
                this.instances.set(cDef.id, inst);
            } catch { /* skip bad component */ }
        }
    }

    /** Publish one GPIO output level into pinStates + SAB pin bitfield. */
    protected publishGpio(pinId: string, isHigh: boolean, analogV?: number): void {
        this.pinStates[pinId] = !!isHigh;
        try {
            const idx = this.sabPinIndex;
            const bit = idx?.get(String(pinId)) ?? idx?.get(String(pinId).replace(/^D/i, '')) ?? idx?.get(`D${pinId}`);
            if (typeof bit === 'number') {
                this.sabPinWriter?.writeDigital(bit, !!isHigh);
                this.sabPinWriter?.writeAnalog(bit, Number.isFinite(analogV as number) ? (analogV as number) : (isHigh ? 3.3 : 0.0));
            }
        } catch { /* pin publish never breaks propagation */ }
        const boardInst = this.instances.get(this.boardId);
        try { boardInst?.onPinStateChange(pinId, !!isHigh, 0); } catch { /* ignore */ }
    }
}
