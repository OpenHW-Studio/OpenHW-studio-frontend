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
 *     sabNumBoards, boardPinMaps, serialBaudRate, speed, ...} }
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
 *   {type:'ready'} | {type:'step-done', boardId, seq} | {type:'uart-tx', boardId, value, char, source} |
 *   {type:'state', state} (runner state snapshots for postRunnerState) |
 *   {type:'interact-done'|'interact-miss'} | {type:'debug-state'} |
 *   {type:'debug-snapshot', boardId, snapshot} |
 *   {type:'debug-mem', boardId, addr, len, mem} |
 *   {type:'error', message}
 */
import { createRunnerForBoard } from './execute';
import type { BoardRunner } from './registries/component-registry.ts';
import { avrInstruction } from 'avr8js';

let runner: BoardRunner | null = null;
let boardId = '';
let boardIdx = 0;

function post(event: any): void {
    try { (self as any).postMessage(event); } catch { /* ignore */ }
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
                // options.onByteTransmit per byte from emitTxByte().
                { ...options, onByteTransmit: (tx: any) => post({ type: 'uart-tx', boardId, value: tx?.value, char: tx?.char, source: tx?.source || 'uart0' }) },
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
            post({ type: 'ready', boardId, boardIdx });
        } catch (err: any) {
            post({ type: 'error', boardId, message: String(err?.message || err) });
        }
        return;
    }

    if (data.type === 'STOP') {
        try { runner?.stop?.(); } catch { /* ignore */ }
        runner = null;
        return;
    }

    // Phase A lockstep tick: advance one scheduler quantum. The ACK
    // (step-done with the quantum seq) lets the parent bound skew; delivery
    // jitter is sub-millisecond vs the 8ms quantum. True SAB-Atomics barrier
    // waits are future tuning — the no-burst chain already bounds skew.
    if (data.type === 'BOARD_STEP') {
        const seq = Math.max(0, Number(data.seq) || 0);
        try { (runner as any)?.stepQuantum?.(Number(data.quantumMs) || 8); } catch { /* ignore */ }
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
        const bytes = Array.isArray(data.bytes) ? data.bytes : [];
        const source = String(data.source || 'uart0');
        for (const b of bytes) {
            try {
                const r = runner as any;
                if (typeof r?.serialRxByteFromSource === 'function') r.serialRxByteFromSource(b & 0xff, source);
                else if (typeof r?.serialRxByte === 'function') r.serialRxByte(b & 0xff);
            } catch { /* ignore */ }
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
