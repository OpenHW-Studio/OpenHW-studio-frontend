/**
 * board.worker.ts — per-board compute worker (SAB-native, one board per Worker).
 *
 * The main simulation worker (simulation.worker.ts) spawns one of these per
 * board at START. Each board worker:
 *   1. Receives the shared state SAB + cmd/evt rings + its boardIdx.
 *   2. Creates exactly ONE runner (AVR / pico / esp32 / stm32f1 / stm32f4)
 *      via createRunnerForBoard — the heavy engine (WASM Xtensa, Emscripten
 *      RP2040, Rust STM32 cores) runs on THIS thread, never the sim worker's.
 *   3. Writes ONLY its own regions: component slots, its pin slice, its
 *      serial TX ring, its debug region, telemetry ring (atomic head).
 *   4. Drains the shared command ring + its own serial RX ring per tick.
 *   5. postMessages lightweight control events (serial bytes for UART route,
 *      state wakeups) to the parent sim worker.
 *
 * UART routing between boards stays on the parent (routeUartByte): this
 * worker emits {type:'uart-tx'} and accepts {type:'uart-rx'} — the single
 * shared SAB carries the bytes; postMessage is only the wakeup.
 *
 * Startup protocol (parent → this worker):
 *   { type:'BOARD_START', boardIdx, boardId, boardType, firmware, pyScript,
 *     components, wires, options:{...runnerOpts, sab, sabOffsets, cmdBuffer,
 *     evtBuffer, sabGeometry, sabBoardSerialBase, sabBoardDebugBase,
 *     sabNumBoards, boardPinMaps, serialBaudRate, speed, ...,
 *     lockstepBarrier:{ sab, ackIdx, quantumMs }} }
 * Phase B barrier (preferred): the shared SAB step/ack cells drive quanta —
 * this worker blocks on the step cell (runBarrierLoop), steps one quantum
 * per new sequence, ACKs its cell. Reports barrier:true in 'ready'.
 * Fallback: {type:'BOARD_STEP', quantumMs, seq} posts (no barrier attached
 * or no Atomics.wait) with a 'step-done' ACK reply.
 * Control: {type:'STOP'} | {type:'SET_SPEED', speed} |
 *   {type:'SERIAL_RX', bytes:number[]} (inter-board UART inject) |
 *   {type:'SERIAL_STR', data:string} (UI serial fan-out) |
 *   {type:'INTERACT_EVT', compId, event} |
 *   {type:'BOARD_STEP', quantumMs, seq} (lockstep tick → ACK step-done) |
 *   {type:'SET_TELEMETRY', enabled, mode} | {type:'FLUSH'} |
 *   {type:'DEBUG_CMD', cmd:'halt'|'resume'|'step'|'watch'|'unwatch'|
 *     'pcbreak'|'pcbreak-clear'|'snapshot'|'readmem', ...} |
 *   {type:'PAUSE'} | {type:'RESUME'}
 * This worker → parent:
 *   {type:'ready', barrier, uart} | {type:'step-done', boardId, seq} (fallback) |
 *   {type:'uart-tx', boardId, value, char, source} (fallback — ring boards
 *   push TX pairs to the transport ring instead) |
 *   {type:'state', state} (runner state snapshots for postRunnerState) |
 *   {type:'interact-done'|'interact-miss'} | {type:'debug-state'} |
 *   {type:'debug-snapshot', boardId, snapshot} |
 *   {type:'debug-mem', boardId, addr, len, mem} |
 *   {type:'error', message}
 */
import { createRunnerForBoard } from './execute';
import type { BoardRunner } from './registries/component-registry.ts';
import { avrInstruction } from 'avr8js';
import { BARRIER_STEP_IDX, barrierTryStep } from './lockstep-barrier.ts';
import {
  bindUartTransportRings,
  uartKindFromSource,
  uartSourceFromKind,
  uartTransportDrain,
  uartTransportPushTx,
} from './uart-transport.ts';
import type { SabSerialRing } from './sab/layout.ts';

let runner: BoardRunner | null = null;
let boardId = '';
let boardIdx = 0;

// UART SAB-ring transport (worker side): TX pushes framed pairs for the
// parent tick-drain; RX drains framed pairs per quantum. Null = postMessage
// fallback (uart-tx posts / SERIAL_RX posts).
let uartTxRing: SabSerialRing | null = null;
let uartRxRing: SabSerialRing | null = null;

// Phase B SAB-Atomics barrier: shared step/ack cells from the parent.
// When attached, the wait-loop below (not BOARD_STEP posts) drives quanta.
let barrierCells: Int32Array | null = null;
let barrierAckIdx = 1;
let barrierQuantumMs = 8;
let barrierStopped = false;

function post(event: any): void {
    try { (self as any).postMessage(event); } catch { /* ignore */ }
}

// UART RX inject shared by the SERIAL_RX postMessage path and the SAB-ring
// drain — identical calls, identical order. (Softserial flavor intentionally
// mirrors the legacy handler: serialRxByteFromSource when present, else
// serialRxByte. No behavior change here, transport only.)
function injectUartRxByte(kind: number, value: number, sourceLabel: string): void {
    try {
        const r = runner as any;
        if (!r) return;
        const v = value & 0xff;
        if (typeof r?.serialRxByteFromSource === 'function') r.serialRxByteFromSource(v, sourceLabel);
        else if (typeof r?.serialRxByte === 'function') r.serialRxByte(v);
    } catch { /* inject never breaks the tick */ }
}

/** Drain the transport RX ring into the engine (called per quantum). */
function drainUartRxRing(): void {
    if (!uartRxRing) return;
    try {
        uartTransportDrain(uartRxRing, (kind, value) => {
            injectUartRxByte(kind, value, uartSourceFromKind(kind));
        });
    } catch { /* drain never breaks the tick */ }
}

// SAB-Atomics wait-loop (Phase B transport). Blocks on the shared step
// cell; each new sequence steps exactly one quantum and ACKs.
//
// CRITICAL: this loop MUST yield to the worker event loop on every
// iteration (awaited setTimeout). A synchronous loop around Atomics.wait
// never unwinds the JS stack, so BOARD_START would never return and all
// inbound control messages (FLUSH/SET_TELEMETRY/INTERACT/SERIAL_RX/STOP)
// would queue forever — observed as: serial perfect (posted synchronously
// from steps) but pins + telemetry dead (FLUSH-driven). Wait slices stay
// short so control lands within ~one quantum.
const barrierYield = () => new Promise<void>((r) => setTimeout(r, 0));
async function runBarrierLoop(): Promise<void> {
    const cells = barrierCells;
    if (!cells) return;
    let last = 0;
    try {
        last = Atomics.load(cells, BARRIER_STEP_IDX);
    } catch { last = 0; }
    for (;;) {
        if (barrierStopped || !runner) return;
        try {
            const next = barrierTryStep(cells, barrierAckIdx, last, (seq) => {
                void seq;
                try { (runner as any)?.stepQuantum?.(barrierQuantumMs); } catch { /* bad quantum never breaks the loop */ }
                // Transport RX drain per quantum (parent-routed inter-board
                // bytes + UI input ride the ring; SERIAL_RX posts are the
                // fallback for unbound boards).
                drainUartRxRing();
            });
            if (next !== last) {
                last = next;
                await barrierYield();
                continue;
            }
        } catch { /* poll never breaks the loop */ }
        try {
            Atomics.wait(cells, BARRIER_STEP_IDX, last, 25);
        } catch {
            return; // blocking wait unavailable: parent falls back to posts
        }
        await barrierYield();
    }
}

self.onmessage = async (e: MessageEvent) => {
    const data = (e as any)?.data || {};

    if (data.type === 'BOARD_START') {
        boardId = String(data.boardId || '');
        boardIdx = Math.max(0, Number(data.boardIdx) || 0);
        const boardType = String(data.boardType || 'openhw-arduino-uno');
        const firmware = typeof data.firmware === 'string' ? data.firmware : '';
        const components = Array.isArray(data.components) ? data.components : [];
        const wires = Array.isArray(data.wires) ? data.wires : [];
        // NOTE: cmdBuffer/evtBuffer are intentionally STRIPPED here. The
        // shared command ring is MPSC (single main-thread writer, single
        // sim-worker reader). If board workers also drained it, every
        // command would be consumed by exactly one random worker. Control
        // fan-out arrives as explicit postMessages below (PAUSE/RESUME/
        // SERIAL_RX/SET_SPEED/INTERACT_*), and board workers emit events via
        // postMessage (parent relays into evtWriter if needed).
        const { cmdBuffer: _cmd, evtBuffer: _evt, ...restOptions } = (data.options || {}) as any;
        void _cmd; void _evt;
        // Phase B serial coherence: this runner's monitor serial travels by
        // postMessage (line-buffered by the parent). The SAB TX ring stays
        // unbound so UI polls don't deliver a second interleaved copy.
        // RX rings stay bound (UI serial input path unchanged).
        const options = { ...restOptions, sabSerialTxDisabled: true, boardId, boardIdx, pyScript: data.pyScript || '' };
        // Phase B barrier attach: SAB-Atomics step cells (shared with the
        // parent scheduler). Presence + wait support negotiated via 'ready'.
        barrierStopped = false;
        barrierCells = null;
        try {
            const lb = (data.options as any)?.lockstepBarrier as any;
            if (lb && lb.sab instanceof SharedArrayBuffer && Number.isFinite(Number(lb.ackIdx))) {
                barrierCells = new Int32Array(lb.sab as SharedArrayBuffer);
                barrierAckIdx = Math.max(1, Number(lb.ackIdx) || 1);
                barrierQuantumMs = Math.max(1, Number(lb.quantumMs) || 8);
            }
        } catch { barrierCells = null; }
        // UART SAB-ring transport attach (worker side of uart-transport.ts).
        // When bound, TX bytes ride the ring (parent tick-drain) instead of
        // per-byte uart-tx posts; RX bytes drain per quantum instead of
        // SERIAL_RX posts. Absent = legacy postMessage paths.
        uartTxRing = null;
        uartRxRing = null;
        try {
            const ut = (data.options as any)?.uartTransport as any;
            if (ut && ut.sab instanceof SharedArrayBuffer
                && Number.isFinite(Number(ut.txOff)) && Number.isFinite(Number(ut.rxOff))) {
                const rings = bindUartTransportRings(
                    ut.sab as SharedArrayBuffer,
                    { txOff: Number(ut.txOff), rxOff: Number(ut.rxOff) },
                );
                uartTxRing = rings.tx;
                uartRxRing = rings.rx;
            }
        } catch { uartTxRing = null; uartRxRing = null; }
        try {
            runner = await createRunnerForBoard(
                boardType,
                firmware,
                components,
                wires,
                // Runner state snapshots (pins/components/telemetry) flow to
                // the parent, which runs postRunnerState (display routing,
                // trace recording, SAB-shrink accounting, main postMessage).
                (stateObj: any) => post({ type: 'state', state: stateObj }),
                // UART TX bytes take a DEDICATED path so the parent can run
                // routeUartByte (monitor + inter-board inject). Runners call
                // options.onByteTransmit per byte from emitTxByte(). Ring
                // transport when bound, uart-tx post fallback otherwise.
                {
                    ...options,
                    onByteTransmit: (tx: any) => {
                        if (uartTxRing) {
                            try {
                                uartTransportPushTx(uartTxRing, uartKindFromSource(tx?.source), Number(tx?.value) || 0);
                            } catch { /* ring push never breaks emit */ }
                            return;
                        }
                        post({ type: 'uart-tx', boardId, value: tx?.value, char: tx?.char, source: tx?.source || 'uart0' });
                    },
                },
            );
            // Phase A lockstep: when the parent drives quanta, hand the loop
            // over immediately (no free-running ticks before the first STEP —
            // own-loop guards make a stray tick a safe no-op regardless).
            try {
                if ((data.options as any)?.lockstep) {
                    try { (runner as any)?.pause?.(); } catch { /* AVR has no pause */ }
                    (runner as any).externalStepping = true;
                    if (!(runner as any).running) (runner as any).running = true;
                }
            } catch { /* ignore */ }
            post({
                type: 'ready', boardId, boardIdx,
                barrier: !!barrierCells && typeof Atomics?.wait === 'function',
                uart: !!uartTxRing && !!uartRxRing,
            });
            // Barrier wait-loop: waits on the shared step cell (worker
            // threads may Atomics.wait); each new sequence steps exactly one
            // quantum and ACKs its cell. Runs async with event-loop yields
            // every iteration so control postMessages keep flowing; control
            // lands within ~one quantum.
            if (barrierCells && typeof Atomics?.wait === 'function') {
                try { void runBarrierLoop(); } catch { /* loop never breaks boot */ }
            }
        } catch (err: any) {
            post({ type: 'error', boardId, message: String(err?.message || err) });
        }
        return;
    }

    if (data.type === 'STOP') {
        barrierStopped = true;
        try {
            if (barrierCells) Atomics.notify(barrierCells, BARRIER_STEP_IDX);
        } catch { /* wakeup best-effort; terminate() follows */ }
        try { runner?.stop?.(); } catch { /* ignore */ }
        runner = null;
        barrierCells = null;
        uartTxRing = null;
        uartRxRing = null;
        return;
    }

    // Phase A lockstep tick (fallback transport): used only when no SAB
    // barrier is attached. Barrier boards step in runBarrierLoop instead —
    // accepting both would double-step quanta.
    if (data.type === 'BOARD_STEP') {
        if (barrierCells) return;
        const seq = Math.max(0, Number(data.seq) || 0);
        try { (runner as any)?.stepQuantum?.(Number(data.quantumMs) || 8); } catch { /* ignore */ }
        drainUartRxRing();
        post({ type: 'step-done', boardId, seq });
        return;
    }

    if (data.type === 'SET_SPEED') {
        try { (runner as any)?.setSpeed?.(Number(data.speed) || 1); } catch { /* ignore */ }
        return;
    }

    // Phase B parity: telemetry + flush fan-out so worker-hosted boards
    // emit the same frames as in-process runners.
    if (data.type === 'SET_TELEMETRY') {
        try { (runner as any)?.setTelemetryEnabled?.(!!data.enabled, String(data.mode || 'detail')); } catch { /* ignore */ }
        return;
    }

    if (data.type === 'FLUSH') {
        try { (runner as any)?.forceEmitState?.(); } catch { /* ignore */ }
        return;
    }

    if (data.type === 'PAUSE') {
        try { (runner as any)?.pause?.(); } catch { /* ignore */ }
        return;
    }

    if (data.type === 'RESUME') {
        try { (runner as any)?.resume?.(); } catch { /* ignore */ }
        return;
    }

    if (data.type === 'SERIAL_RX') {
        // Inter-board UART inject: bytes arrive via the parent's routing
        // decision (routeUartByte). Prefer source-aware entry when present.
        // (Ring-transport boards drain instead; this post is the fallback.)
        const bytes = Array.isArray(data.bytes) ? data.bytes : [];
        const source = String(data.source || 'uart0');
        for (const b of bytes) {
            injectUartRxByte(uartKindFromSource(source), b & 0xff, source);
        }
        return;
    }

    if (data.type === 'SERIAL_STR') {
        // UI serial input fan-out (parent SERIAL_INPUT for this board).
        try {
            const text = String(data.data ?? '');
            if (text) (runner as any)?.serialRx?.(text);
        } catch { /* ignore */ }
        return;
    }

    if (data.type === 'INTERACT_EVT') {
        // Button/knob interaction for a component owned by this board.
        // Runner instances live here. AVR runners additionally need a quick
        // CPU burst + repropagate so firmware observes the event promptly
        // (mirrors the parent's in-process runQuickBurst for single mode).
        try {
            const r = runner as any;
            const inst = r?.instances?.get?.(data.compId);
            if (inst) {
                inst.onEvent(data.event);
                try {
                    if (typeof r?.repropagateAllVoltages === 'function') r.repropagateAllVoltages();
                    if (typeof r?.pollADCChannels === 'function') r.pollADCChannels();
                    const cpu = r?.cpu;
                    if (cpu && typeof cpu.cycles === 'number') {
                        const target = cpu.cycles + 16000;
                        let guard = 0;
                        while (cpu.cycles < target && guard++ < 20000) {
                            try { avrInstruction(cpu); } catch { break; }
                            try { cpu.tick(); } catch { break; }
                        }
                    }
                    const instArray = r?.instances ? Array.from(r.instances.values()) : [];
                    for (const c of instArray) {
                        try { c.update(cpu?.cycles ?? 0, r?.currentWires || [], instArray); } catch { /* ignore */ }
                    }
                } catch { /* burst never breaks interact */ }
                if (typeof r?.forceEmitState === 'function') {
                    r.forceEmitState();
                }
                post({ type: 'interact-done', boardId, compId: data.compId });
            } else {
                post({ type: 'interact-miss', boardId, compId: data.compId });
            }
        } catch (err: any) {
            post({ type: 'error', boardId, message: String(err?.message || err) });
        }
        return;
    }

    if (data.type === 'DEBUG_CMD') {
        // Debug sub-command fan-out (parent DEBUG_* handlers). Runners own
        // their DebugService; the parent's ring records stay authoritative
        // for replay digest (queueStep path below mirrors the fallback).
        const cmd = String(data.cmd || '');
        try {
            const r = runner as any;
            if (cmd === 'halt') {
                try { (r?.debugService as any)?.halt?.(); } catch { /* ignore */ }
                try { r?.pause?.(); } catch { /* ignore */ }
            } else if (cmd === 'resume') {
                try { (r?.debugService as any)?.resume?.(); } catch { /* ignore */ }
                try { r?.resume?.(); } catch { /* ignore */ }
            } else if (cmd === 'reset') {
                try { r?.reset?.(); } catch { /* ignore */ }
            } else if (cmd === 'step') {
                const n = Math.max(1, Number(data.cycles) || 16000);
                try { (r?.debugService as any)?.queueStep?.(n); } catch { /* ignore */ }
                try { r?.stepCycles?.(n); } catch { /* ignore */ }
            } else if (cmd === 'watch') {
                try { r?.addPinWatch?.(String(data.pin || ''), data.expectHigh !== false); } catch { /* ignore */ }
            } else if (cmd === 'unwatch') {
                try { r?.removePinWatch?.(String(data.pin || '')); } catch { /* ignore */ }
            } else if (cmd === 'pcbreak') {
                try { (r?.debugService as any)?.addPcBreakpoint?.(Number(data.pc) >>> 0); } catch { /* ignore */ }
            } else if (cmd === 'pcbreak-clear') {
                try { (r?.debugService as any)?.clearPcBreakpoints?.(); } catch { /* ignore */ }
            }
            if (cmd === 'halt' || cmd === 'resume') {
                post({ type: 'debug-state', boardId, halted: cmd === 'halt' });
            }
            if (cmd === 'step' || data.snapshot) {
                let snap: any = null;
                try { snap = r?.getDebugSnapshot?.() ?? null; } catch { snap = null; }
                post({ type: 'debug-snapshot', boardId, snapshot: snap });
            }
            if (cmd === 'snapshot') {
                let snap: any = null;
                try { snap = r?.getDebugSnapshot?.() ?? null; } catch { snap = null; }
                post({ type: 'debug-snapshot', boardId, snapshot: snap });
            }
            if (cmd === 'readmem') {
                let mem: number[] = [];
                try {
                    const view = r?.readMem?.(Number(data.addr) || 0, Math.max(1, Math.min(256, Number(data.len) || 16)));
                    if (view) mem = Array.from(view as Uint8Array);
                } catch { mem = []; }
                post({ type: 'debug-mem', boardId, addr: Number(data.addr) || 0, len: Number(data.len) || 16, mem });
            }
        } catch { /* debug fan-out never breaks the board worker */ }
        return;
    }
};
