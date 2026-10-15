// cache bust 1
if (typeof window === 'undefined') {
    (self as any).window = self;
    (self as any).document = {
        createElement: () => ({ style: {} }),
        getElementsByTagName: () => [],
        createTextNode: () => ({}),
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => { },
        removeEventListener: () => { },
    };
}
(self as any).$RefreshReg$ = () => { };
(self as any).$RefreshSig$ = () => () => (type: any) => type;

import { BoardRunner, createRunnerForBoard, LOGIC_REGISTRY, COMPONENT_PINS, buildFatFsImage, buildLittleFsImage } from './execute';
import { avrInstruction } from 'avr8js';
import { BaseComponent } from '@openhw/emulator';
import {
    setRealMetrics
} from './registries/component-registry';
import {
    isProgrammableBoardType,
    resolveUartRoute,
    areBoardsSoftSerialConnected,
} from './protocol-routing.js';
import { SabCommandReader, SabEventWriter, SabDisplayWriter } from './sab/layout.ts';
import { DebugService } from './debug/service.ts';
import { AgentRecorder } from '../agent/recorder.js';

// Agent trace recorder (§11 R2): watch-scoped, cycle-stamped, tapped at
// runner onStateUpdate (pre-v2 transport). Schema-stable; v2 re-points at
// the SAB telemetry ring without changing the event shape.
const agentRecorder = new AgentRecorder();

// Command/event rings (§10.4): shared at START. Worker owns the reader +
// debug service; runners get per-board instances bound to the same buffers.
// Absent buffers → postMessage control path unchanged (fallback).
let sabCmdReader: SabCommandReader | null = null;
let sabEvtWriter: SabEventWriter | null = null;
let sabDebugService: DebugService | null = null;
// Display descriptors (§10.4): worker-level writer bound at START from the
// full-map geometry. Slot-oriented only — pixels stay on routeDisplayFrames.
let sabDisplayWriter: SabDisplayWriter | null = null;
let sabDisplaySlotCursor = 0;

function attachCommandRings(data: any): void {
    try {
        sabCmdReader = null;
        sabEvtWriter = null;
        sabDebugService = null;
        sabDisplayWriter = null;
        sabDisplaySlotCursor = 0;
        const cmdBuf = (data as any)?.cmdBuffer as SharedArrayBuffer | undefined;
        const evtBuf = (data as any)?.evtBuffer as SharedArrayBuffer | undefined;
        const sab = (data as any)?.sab as SharedArrayBuffer | undefined;
        if (cmdBuf) sabCmdReader = new SabCommandReader(cmdBuf);
        if (evtBuf) sabEvtWriter = new SabEventWriter(evtBuf);
        if (sab && (sabCmdReader || sabEvtWriter)) {
            const offsets = ((data as any)?.sabOffsets || {}) as Record<string, number>;
            sabDebugService = new DebugService(sab, { ...offsets }, sabEvtWriter);
        }
        // Display descriptors ride the SAME state SAB (slot-oriented).
        try {
            const ddOff = Number((data as any)?.sabDisplayDescOffset);
            if (sab && Number.isFinite(ddOff) && ddOff > 0) {
                sabDisplayWriter = new SabDisplayWriter(sab, ddOff);
            }
        } catch { sabDisplayWriter = null; }
    } catch {
        sabCmdReader = null;
        sabEvtWriter = null;
        sabDebugService = null;
        sabDisplayWriter = null;
    }
}

self.onerror = (msg, url, line, col, error) => {
    console.error(`[SimWorker] Global Error: ${msg} at ${line}:${col}`, error);
    return false;
};

let runner: BoardRunner | null = null;
let boardRunners: Map<string, BoardRunner> = new Map();
let boardTypes: Map<string, string> = new Map();
// Per-board compute workers (SAB-native): boardId → Worker running
// board.worker.ts with exactly one runner. Heavy engines (Xtensa WASM,
// Emscripten RP2040, Rust STM32 cores) tick on these threads; the legacy
// in-process boardRunners map stays as fallback (AVR + degraded mode).
// A board lives in EXACTLY one of the two maps.
let boardWorkers: Map<string, Worker> = new Map();
let boardWorkerTypes: Map<string, string> = new Map();
let boardWorkerReady: Map<string, boolean> = new Map();
// Async aggregation for board-worker DEBUG_SNAPSHOT / DEBUG_READ_MEM: the
// parent collects one reply per board worker, then posts the merged message
// once (same shape as the in-process paths). Entries expire with the run.
let pendingBoardSnapshots: Map<string, any> = new Map();
let pendingBoardSnapshotWant = 0;
let pendingBoardMem: Map<string, number[]> = new Map();
let pendingBoardMemWant = 0;
let pendingBoardMemAddr = 0;
let pendingBoardMemLen = 0;

function maybeFlushBoardSnapshotBatch(): void {
    if (pendingBoardSnapshots.size < pendingBoardSnapshotWant) return;
    const out: Record<string, any> = {};
    if (mode === 'single' && runner) {
        try { out['single'] = (runner as any)?.getDebugSnapshot?.() ?? null; } catch { out['single'] = null; }
    } else {
        for (const [id, br] of boardRunners) {
            try { out[id] = (br as any)?.getDebugSnapshot?.() ?? null; } catch { out[id] = null; }
        }
    }
    for (const [id, snap] of pendingBoardSnapshots) out[id] = snap;
    postMessage({ type: 'DEBUG_SNAPSHOT', snapshot: out });
    pendingBoardSnapshots.clear();
    pendingBoardSnapshotWant = 0;
}

function maybeFlushBoardMemBatch(): void {
    if (pendingBoardMem.size < pendingBoardMemWant) return;
    let mem: number[] = [];
    for (const arr of pendingBoardMem.values()) {
        if (Array.isArray(arr) && arr.length) { mem = arr; break; }
    }
    postMessage({ type: 'DEBUG_MEM', addr: pendingBoardMemAddr, len: pendingBoardMemLen, mem });
    pendingBoardMem.clear();
    pendingBoardMemWant = 0;
}
let mode: 'single' | 'multi' = 'single';
let pinToNet: Map<string, number> = new Map();
let boardSerialOutput: Map<string, string> = new Map();

// Append-only per-board serial mirror (cap 8k chars). The SAB TX ring is the
// fast path; this Map is the debuggable record (plotter/serial history).
function appendBoardSerialOutput(boardId: string, chunk: string) {
    const id = String(boardId || '').trim() || 'default';
    const merged = (boardSerialOutput.get(id) || '') + String(chunk ?? '');
    boardSerialOutput.set(id, merged.length > 8192 ? merged.slice(-8192) : merged);
}
let syncValidationEnabled = false;
let syncFrameByBoard: Map<string, number> = new Map();
let syncSnapshotByBoard: Map<string, {
    pins: Record<string, unknown>;
    analog: unknown;
    components: Record<string, unknown>;
}> = new Map();
let syncHeartbeatByBoard: Map<string, { frameId: number; hash: string; emittedAt: number }> = new Map();
let syncMismatchCountByBoard: Map<string, number> = new Map();
let syncFaultLatchedByBoard: Map<string, boolean> = new Map();
let boardInjectSessions: Map<string, {
    timers: any[];
    restore?: () => void;
}> = new Map();



/**
 * MessagePort to the Render Worker. Set when the main thread sends SET_RENDER_PORT.
 * When set, display pixel frames are sent directly here (zero-copy) instead of
 * being passed through the main thread.
 */
let renderWorkerPort: MessagePort | null = null;

/**
 * MessagePort to the Network Worker. Set when the main thread sends SET_NET_PORT.
 * When set, Ethernet frames from WiFi boards are forwarded directly (zero-copy),
 * keeping DNS/TCP/UDP I/O completely isolated from the CPU simulation loop.
 */
let netWorkerPort: MessagePort | null = null;

/** Display component types that have a Render Worker renderer registered. */
const DISPLAY_COMPONENT_TYPES = new Set([
    'openhw-ili9341',
    'openhw-ssd1306-oled',
]);

/** Maps component type → displayType string used in the Render Worker registry. */
const DISPLAY_TYPE_MAP: Record<string, string> = {
    'openhw-ili9341':      'ili9341',
    'openhw-ssd1306-oled': 'ssd1306',
};

const UNSAFE_DYNAMIC_CODE_PATTERN = /\b(?:importScripts|XMLHttpRequest|WebSocket|EventSource|SharedWorker|Worker|navigator\.sendBeacon|document\.cookie|localStorage|sessionStorage|indexedDB)\b|(?:\bfetch\s*\()|(?:\beval\s*\()|(?:\bnew\s+Function\b)/i;

function assertSafeDynamicModule(code: string, label: string) {
    const cleanCode = String(code || '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(?:^|[^:])\/\/[^\r\n]*/g, '')
        .replace(/'(?:[^'\\]|\\.)*'/g, '')
        .replace(/"(?:[^"\\]|\\.)*"/g, '')
        .replace(/`(?:[^`\\]|\\.)*`/g, '');
    if (UNSAFE_DYNAMIC_CODE_PATTERN.test(cleanCode)) {
        throw new Error(`${label} uses blocked browser APIs in sandbox mode`);
    }
}

function resetSyncValidationState() {
    syncFrameByBoard.clear();
    syncSnapshotByBoard.clear();
    syncHeartbeatByBoard.clear();
    syncMismatchCountByBoard.clear();
    syncFaultLatchedByBoard.clear();
}

function normalizeHashValue(value: any, depth = 0): any {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;

    if (ArrayBuffer.isView(value)) {
        const view = value as ArrayLike<number> & { length?: number };
        const len = Number(view?.length || 0);
        const preview: number[] = [];
        for (let i = 0; i < Math.min(len, 24); i++) {
            preview.push(Number(view[i] || 0));
        }
        return {
            kind: 'typed-array',
            length: len,
            preview,
        };
    }

    if (Array.isArray(value)) {
        if (value.length > 64) {
            return {
                kind: 'array',
                length: value.length,
                preview: value.slice(0, 64).map((entry) => normalizeHashValue(entry, depth + 1)),
            };
        }
        return value.map((entry) => normalizeHashValue(entry, depth + 1));
    }

    if (typeof value === 'object') {
        const keys = Object.keys(value);
        if (depth > 4 && keys.length > 24) {
            return {
                kind: 'object',
                keys: keys.sort().slice(0, 24),
                size: keys.length,
            };
        }

        const out: Record<string, unknown> = {};
        for (const key of keys.sort((a, b) => a.localeCompare(b))) {
            out[key] = normalizeHashValue(value[key], depth + 1);
        }
        return out;
    }

    return String(value);
}

function fnv1aHash(input: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}

function clearInjectSession(boardId: string) {
    const id = String(boardId || '').trim() || 'default';
    const session = boardInjectSessions.get(id);
    if (!session) return;

    if (Array.isArray(session.timers)) {
        for (const timerId of session.timers) {
            clearInterval(timerId);
            clearTimeout(timerId);
        }
    }
    if (typeof session.restore === 'function') {
        session.restore();
    }
    boardInjectSessions.delete(id);
}

function registerInjectTimer(boardId: string, timerId: any) {
    const id = String(boardId || '').trim() || 'default';
    let session = boardInjectSessions.get(id);
    if (!session) {
        session = { timers: [] };
        boardInjectSessions.set(id, session);
    }
    session.timers.push(timerId);
}

function registerInjectRestore(boardId: string, restoreFn: () => void) {
    const id = String(boardId || '').trim() || 'default';
    let session = boardInjectSessions.get(id);
    if (!session) {
        session = { timers: [] };
        boardInjectSessions.set(id, session);
    }
    session.restore = restoreFn;
}

function computeSyncHash(payload: unknown): string {
    const normalized = normalizeHashValue(payload, 0);
    const serialized = JSON.stringify(normalized);
    return fnv1aHash(serialized);
}

function ensureSyncSnapshot(boardId: string): {
    pins: Record<string, unknown>;
    analog: unknown;
    components: Record<string, unknown>;
} {
    const id = String(boardId || '').trim() || 'default';
    const existing = syncSnapshotByBoard.get(id);
    if (existing) return existing;

    const created = {
        pins: {},
        analog: [],
        components: {},
    };
    syncSnapshotByBoard.set(id, created);
    return created;
}

function applyStateToSyncSnapshot(boardId: string, stateObj: any) {
    const snapshot = ensureSyncSnapshot(boardId);

    if (stateObj?.pins && typeof stateObj.pins === 'object') {
        snapshot.pins = {
            ...snapshot.pins,
            ...stateObj.pins,
        };
    }

    if (stateObj && Object.prototype.hasOwnProperty.call(stateObj, 'analog')) {
        snapshot.analog = stateObj.analog;
    }

    if (Array.isArray(stateObj?.components)) {
        for (const comp of stateObj.components) {
            const id = String(comp?.id || '').trim();
            if (!id) continue;
            snapshot.components[id] = comp?.state ?? {};
        }
    }

    return snapshot;
}

function emitSyncHeartbeat(boardId: string, stateObj: any) {
    if (!syncValidationEnabled) return;
    if (!stateObj || stateObj.type !== 'state') return;

    const id = String(boardId || stateObj?.boardId || 'default').trim() || 'default';
    const snapshot = applyStateToSyncSnapshot(id, stateObj);
    const frameId = Number(syncFrameByBoard.get(id) || 0) + 1;
    const hash = computeSyncHash(snapshot);
    const emittedAt = Date.now();

    syncFrameByBoard.set(id, frameId);
    syncHeartbeatByBoard.set(id, { frameId, hash, emittedAt });

    postMessage({
        type: 'sync_heartbeat',
        boardId: id,
        frameId,
        hash,
        simTime: frameId,
        emittedAt,
    });
}

function stopAllRunners() {
    if (runner) {
        runner.stop();
        runner = null;
    }
    boardRunners.forEach((r) => r.stop());
    boardRunners.clear();
    // Terminate per-board compute workers (their runners stop with them).
    boardWorkers.forEach((w) => {
        try { w.postMessage({ type: 'STOP' }); } catch { /* ignore */ }
        try { w.terminate(); } catch { /* ignore */ }
    });
    boardWorkers.clear();
    boardWorkerTypes.clear();
    boardWorkerReady.clear();
    pendingBoardSnapshots.clear();
    pendingBoardSnapshotWant = 0;
    pendingBoardMem.clear();
    pendingBoardMemWant = 0;
    boardTypes.clear();
    pinToNet.clear();
    boardSerialOutput.clear();
    syncValidationEnabled = false;
    resetSyncValidationState();

    // Clear all pending code injections and UART restorations
    for (const boardId of boardInjectSessions.keys()) {
        clearInjectSession(boardId);
    }
    boardInjectSessions.clear();
    dmaWarned = false;
}

function endpointAliases(endpoint: string): string[] {
    const [compId, pinId] = endpoint.split(':');
    if (!compId || !pinId) return [endpoint];

    const aliases = new Set<string>([endpoint]);
    if (/^\d+$/.test(pinId)) aliases.add(`${compId}:D${pinId}`);
    if (/^D\d+$/i.test(pinId)) aliases.add(`${compId}:${pinId.substring(1)}`);
    return Array.from(aliases);
}

function buildNetIndex(wires: any[]) {
    const adj = new Map<string, string[]>();

    for (const wire of wires || []) {
        if (!adj.has(wire.from)) adj.set(wire.from, []);
        if (!adj.has(wire.to)) adj.set(wire.to, []);
        adj.get(wire.from)!.push(wire.to);
        adj.get(wire.to)!.push(wire.from);
    }

    const visited = new Set<string>();
    pinToNet.clear();
    let currentNet = 0;

    for (const startNode of adj.keys()) {
        if (visited.has(startNode)) continue;
        const queue = [startNode];
        visited.add(startNode);
        while (queue.length > 0) {
            const node = queue.shift()!;
            pinToNet.set(node, currentNet);
            endpointAliases(node).forEach((alias) => pinToNet.set(alias, currentNet));

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

function areConnected(pinA: string, pinB: string): boolean {
    const netA = pinToNet.get(pinA);
    const netB = pinToNet.get(pinB);
    return netA !== undefined && netA === netB;
}

let dmaWarned = false;

function routeDisplayFrames(components: any[]): any[] {
    if (!renderWorkerPort || !Array.isArray(components)) return components;

    const remaining: any[] = [];

    for (const comp of components) {
        const compType = String(comp?.type || '').trim();
        const displayType = DISPLAY_TYPE_MAP[compType];

        if (!displayType || !comp?.state) {
            remaining.push(comp);
            continue;
        }

        // Route pixel buffer directly to Render Worker (zero-copy transfer).
        const rawBuffer = comp.state?.buffer;
        let transferable: ArrayBuffer | null = null;
        let bufferForWorker: ArrayBuffer | null = null;

        if (typeof SharedArrayBuffer !== 'undefined' && rawBuffer instanceof SharedArrayBuffer) {
            bufferForWorker = rawBuffer;
            transferable = null;
        } else if (rawBuffer instanceof Uint8Array && rawBuffer.buffer) {
            if (typeof SharedArrayBuffer !== 'undefined' && rawBuffer.buffer instanceof SharedArrayBuffer) {
                bufferForWorker = rawBuffer;
                transferable = null;
            } else {
                // Slice to get a fresh ArrayBuffer we can transfer without detaching the original.
                bufferForWorker = rawBuffer.buffer.slice(rawBuffer.byteOffset, rawBuffer.byteOffset + rawBuffer.byteLength);
                transferable = bufferForWorker;
            }
        } else if (rawBuffer instanceof ArrayBuffer) {
            bufferForWorker = rawBuffer.slice(0);
            transferable = bufferForWorker;
        }

        const frame: any = {
            type: 'DISPLAY_FRAME',
            compId: String(comp.id || '').trim(),
            displayType,
            width:  comp.state?.width  ?? (displayType === 'ili9341' ? 240 : 128),
            height: comp.state?.height ?? (displayType === 'ili9341' ? 320 : 64),
            buffer: bufferForWorker,
            state: {
                powerOn:          comp.state?.powerOn,
                reset:            comp.state?.reset,
                // SSD1306 state fields
                vram:             comp.state?.vram,
                displayOn:        comp.state?.displayOn,
                invert:           comp.state?.invert,
                allOn:            comp.state?.allOn,
                displayStartLine: comp.state?.displayStartLine,
                segmentRemap:     comp.state?.segmentRemap,
                comScanDir:       comp.state?.comScanDir,
                displayOffset:    comp.state?.displayOffset,
            },
            timestamp: Date.now(),
        };

        if (transferable) {
            renderWorkerPort.postMessage(frame, [transferable]);
        } else {
            renderWorkerPort.postMessage(frame);
        }

        // Display descriptor (§10.4): slot-oriented record into the state SAB
        // (compSlot from sabDebugService offsets, w/h, handle idx, dirtyRect).
        // Pixels NEVER go here — VRAM already routed above. Null-safe: the
        // writer is null on legacy allocs (postMessage descriptors then).
        try {
            const slotById = (sabDebugService as any)?.slotById as Record<string, number> | undefined;
            const slot = slotById ? Number(slotById[String(comp.id || '').trim()]) : NaN;
            if (sabDisplayWriter && Number.isFinite(slot) && (slot as number) >= 0) {
                const idx = sabDisplaySlotCursor % 16;
                sabDisplaySlotCursor += 1;
                sabDisplayWriter.write(
                    idx,
                    slot as number,
                    Number(frame.width) || 0,
                    Number(frame.height) || 0,
                    idx,
                    0xffffffff,
                );
            }
        } catch { /* descriptor write never breaks routing */ }

        // Strip the pixel buffer from the main-thread message — send only
        // lightweight telemetry state (powerOn, spiFrames, compactSnapshot, etc.).
        remaining.push({
            ...comp,
            state: comp.state ? {
                ...comp.state,
                buffer: null,  // buffer already transferred to render worker
                vram: undefined, // vram not needed on main thread
            } : comp.state,
        });
    }

    return remaining;
}

// T5 (§12.3): postMessage byte accounting for the bench gate.
// Tracks steady-frame `components` bytes; exposed via GET_SAB_STATS.
let sabBenchBytesTotal = 0;
let sabBenchFrames = 0;
let sabBenchLastComponentsBytes = 0;
let sabBenchWakeups = 0;

function estimateComponentsBytes(components: any): number {
    if (!components) return 0;
    try {
        if (Array.isArray(components)) {
            let n = 0;
            for (const c of components) {
                const s = (c as any)?.state;
                if (s && typeof s === 'object') {
                    n += Object.keys(s).length * 24;
                    const v = (s as any)?.buffer;
                    if (v instanceof Uint8Array) n += v.byteLength;
                    else if (v instanceof ArrayBuffer) n += v.byteLength;
                } else {
                    n += 32;
                }
            }
            return n;
        }
        return 64;
    } catch { return 0; }
}

function postRunnerState(stateObj: any, boardId: string) {
    const resolvedBoardId = String(stateObj?.boardId || boardId || 'default').trim() || 'default';

    if (!dmaWarned && stateObj?.components && Array.isArray(stateObj.components)) {
        for (const comp of stateObj.components) {
            if (comp.state?.dmaBypassDisabled) {
                dmaWarned = true;
                postMessage({
                    type: 'toast',
                    level: 'warning',
                    message: 'Logic Analyzer detected. High-speed DMA bypassed. Simulation running in cycle-accurate mode.'
                });
                break;
            }
        }
    }

    // Route display pixel frames to the Render Worker before posting to main thread.
    const resolvedComponents = stateObj?.components
        ? routeDisplayFrames(stateObj.components)
        : stateObj?.components;

    // T5: bench accounting — measured BEFORE any shrink so the gate can
    // observe the delta as sabFastPath flips on.
    const compBytes = estimateComponentsBytes(resolvedComponents);

    if (mode === 'single') {
        // T5 FLUSH shrink: when the SAB fast path is active, main already
        // polls slots via __sabTickers — post only the wakeup
        // {seq, simTimeMs, dirtyBoards} instead of the full components array.
        // Slow-mirror (full payload) still flows for: trace recording,
        // teacher-key capture, first frame after START (seq 0 → hydration),
        // and whenever the SAB is absent (fallback).
        const canShrink = !!(stateObj as any)?.sabFastPath
            && (stateObj as any)?.type === 'state'
            && !isRecordingTrace;
        if (canShrink) {
            sabBenchWakeups += 1;
            sabBenchLastComponentsBytes = 0;
            const wakeup: any = {
                type: 'state', boardId: resolvedBoardId,
                sabWakeup: true,
                seq: (stateObj as any)._emitSeq ?? 0,
                simTimeMs: (stateObj as any).simTimeMs,
                dirtySlots: (stateObj as any).dirtySlots || [],
            };
            if ((stateObj as any).pins) wakeup.pins = (stateObj as any).pins;
            if ((stateObj as any).analog) wakeup.analog = (stateObj as any).analog;
            if ((stateObj as any).perf) wakeup.perf = (stateObj as any).perf;
            postMessage(wakeup);
            emitSyncHeartbeat(resolvedBoardId, wakeup);
            return;
        }
        const msg = (stateObj && typeof stateObj === 'object')
            ? { ...stateObj, boardId: resolvedBoardId, components: resolvedComponents }
            : stateObj;

        if (isRecordingTrace) {
            handleRecorderState(msg, resolvedBoardId);
        }

        sabBenchBytesTotal += compBytes;
        sabBenchFrames += 1;
        sabBenchLastComponentsBytes = compBytes;
        postMessage(msg);
        emitSyncHeartbeat(resolvedBoardId, msg);
        return;
    }

    if (stateObj.type !== 'state') {
        if (isRecordingTrace) {
            handleRecorderState(stateObj, resolvedBoardId);
        }
        postMessage({ ...stateObj, boardId: resolvedBoardId });
        return;
    }

    const msg: any = { type: 'state', boardId: resolvedBoardId };

    if (stateObj.pins) msg.pins = stateObj.pins;
    if (stateObj.components) msg.components = resolvedComponents;
    if (stateObj.simTimeMs) msg.simTimeMs = stateObj.simTimeMs;
    if ((stateObj as any).dirtySlots) msg.dirtySlots = (stateObj as any).dirtySlots;
    if ((stateObj as any)._emitSeq !== undefined) msg._emitSeq = (stateObj as any)._emitSeq;
    if ((stateObj as any)._emitTime !== undefined) msg._emitTime = (stateObj as any)._emitTime;

    if (isRecordingTrace) {
        handleRecorderState(msg, resolvedBoardId);
    }

    sabBenchBytesTotal += compBytes;
    sabBenchFrames += 1;
    sabBenchLastComponentsBytes = compBytes;
    postMessage(msg);
    emitSyncHeartbeat(resolvedBoardId, msg);
}

function handleRecorderState(stateObj: any, boardId: string) {
    if (!isRecordingTrace) return;
    const activeRunner = mode === 'single' ? runner : boardRunners.get(boardId);
    if (!activeRunner) return;
    
    const nowMs = activeRunner.getSimulatedTimeMs?.() ?? 0;
    
    // Stop recording if we hit the cutoff
    if (nowMs - traceCaptureStartMs > traceCutoffMs) {
        isRecordingTrace = false;
        finalizeRecorderTrace();
        return;
    }

    // 1. Process Pin Changes
    if (stateObj.type === 'state' && stateObj.pins) {
        for (const pinId in stateObj.pins) {
            const newState = !!stateObj.pins[pinId];
            const prevState = traceLastPinStates[pinId];
            if (prevState === undefined) {
                traceLastPinStates[pinId] = newState;
                continue; // baseline
            }
            if (newState !== prevState) {
                traceBuffer.push({ PinChange: { pin: pinId, state: newState, time_ms: Math.floor(nowMs) } });
                traceLastPinStates[pinId] = newState;
            }
        }
    }
    
    // 2. Process Serial (+ agent trace tap — watch-scoped, zero-cost unwatched).
    if (stateObj.type === 'serial') {
        traceBuffer.push({ SerialOutput: { data: stateObj.data, time_ms: Math.floor(nowMs) } });
        try {
            agentRecorder.pushSerial(
                String((stateObj as any)?.boardId || boardId || 'default'),
                String((stateObj as any)?.data ?? ''),
                String((stateObj as any)?.source || 'uart'),
                Number((stateObj as any)?.cycles) || 0,
                Number((stateObj as any)?.simTimeMs) || 0,
            );
        } catch { /* trace tap never breaks ingest */ }
    }
    
    // 3. Process Component State (deltas + agent trace tap).
    if (stateObj.components && Array.isArray(stateObj.components)) {
        for (const comp of stateObj.components) {
            const cid = comp.id;
            const metrics = comp.metrics || {};
            const custom = metrics.custom || comp.customTelemetry || comp._metrics?.customTelemetry || {};
            const stateLike = comp.state && typeof comp.state === 'object' ? comp.state : {};
            const emitSource = Object.keys(custom).length > 0 ? custom : stateLike;

            for (const key in emitSource) {
                const val = emitSource[key];
                const stateKey = `${cid}:${key}`;
                const serialized = typeof val === 'object' && val !== null ? JSON.stringify(val) : val;
                const lastSerialized = traceLastComponentStates[stateKey];

                if (lastSerialized === undefined || lastSerialized !== serialized) {
                    traceBuffer.push({ ComponentState: { id: cid, key: key, value: val, time_ms: Math.floor(nowMs) } });
                    traceLastComponentStates[stateKey] = serialized;
                    try {
                        agentRecorder.pushComponentState(
                            String(cid), String(key), val,
                            Number((stateObj as any)?.cycles) || 0,
                            Number((stateObj as any)?.simTimeMs) || 0,
                        );
                    } catch { /* tap never breaks ingest */ }
                }
            }
        }
    }
    // 4. Pin changes → agent trace (watch-scoped).
    try {
        const pins = (stateObj as any)?.pins;
        if (pins && typeof pins === 'object') {
            for (const pin of Object.keys(pins)) {
                agentRecorder.pushPinChange(
                    String((stateObj as any)?.boardId || boardId || 'default'),
                    String(pin), !!pins[pin],
                    Number((stateObj as any)?.cycles) || 0,
                    Number((stateObj as any)?.simTimeMs) || 0,
                );
            }
        }
    } catch { /* tap never breaks ingest */ }
}

async function finalizeRecorderTrace() {
    if (captureFlushInterval) {
        clearInterval(captureFlushInterval);
        captureFlushInterval = null;
    }
    console.log(`[SimWorker:Recorder] Trace capture complete. Generating binary key via grading engine...`);
    const telemetryPayload = {
        events: traceBuffer,
        serial: "",
        duration_ms: traceCutoffMs,
        error: null,
        crashed: false,
        rich_metrics: null, // we skip deep snapshot for this proxy mode
        coverage_issues: [],
        ignored_events: []
    };
    
    try {
        // Delegate to grading worker natively inside the worker
        const gradingWorkerMod = await import('./grading-engine.worker.ts');
        // Actually, we can just send it back to the main thread and let GradingPage package it!
        // Wait, the main thread F1MenuOverlay doesn't have the GradingWorker initialized.
        // We can just post a special message back to the UI, and the UI will spawn the GradingWorker to bundle it.
        postMessage({ 
            type: 'TEACHER_KEY_CAPTURE_COMPLETE', 
            telemetry: telemetryPayload,
            projectJson: traceActiveProjectJson,
            board: traceBoardId,
            component: traceComponentId
        });
    } catch (e) {
        console.error("Failed to finalize trace:", e);
    }
}

function isSoftSerialLabel(label: string): boolean {
    const key = String(label || '').trim().toLowerCase();
    return key === 'softserial' || key === 'soft-serial' || key === 'soft_uart' || key === 'soft-uart' || key === 'softuart';
}

function routeUartByte(sourceBoardId: string, value: number, sourceLabel = 'uart0') {
    const sourceRunner = boardRunners.get(sourceBoardId) ?? null;
    const sourceType = boardTypes.get(sourceBoardId) || boardWorkerTypes.get(sourceBoardId) || '';
    const sourceBaud = sourceRunner?.getSerialBaudRate?.() ?? 9600;
    const fromSoftSerial = isSoftSerialLabel(sourceLabel);

    for (const [targetBoardId, targetRunner] of boardRunners.entries()) {
        if (targetBoardId === sourceBoardId) continue;

        const targetType = boardTypes.get(targetBoardId) || '';
        const uartRoute = fromSoftSerial
            ? { connected: false, targetSource: null }
            : resolveUartRoute(sourceBoardId, sourceType, targetBoardId, targetType, areConnected, sourceLabel);
        const softLinked = areBoardsSoftSerialConnected(sourceBoardId, sourceType, targetBoardId, targetType, areConnected);

        if (uartRoute.connected || softLinked) {
            targetRunner.setSerialBaudRate(sourceBaud);
            if (uartRoute.connected && typeof (targetRunner as any).serialRxByteFromSource === 'function') {
                (targetRunner as any).serialRxByteFromSource(value, uartRoute.targetSource || 'uart0');
            } else if (softLinked && typeof (targetRunner as any).softSerialRxByte === 'function') {
                (targetRunner as any).softSerialRxByte(value);
            } else {
                targetRunner.serialRxByte(value);
            }
        }
    }

    // Board-worker targets: same routing decision, delivery via SERIAL_RX
    // postMessage (their RX ring is the same shared SAB, this is the wakeup).
    for (const [targetBoardId, targetWorker] of boardWorkers.entries()) {
        if (targetBoardId === sourceBoardId) continue;
        const targetType = boardWorkerTypes.get(targetBoardId) || '';
        const uartRoute = fromSoftSerial
            ? { connected: false, targetSource: null as string | null }
            : resolveUartRoute(sourceBoardId, sourceType, targetBoardId, targetType, areConnected, sourceLabel);
        const softLinked = areBoardsSoftSerialConnected(sourceBoardId, sourceType, targetBoardId, targetType, areConnected);
        if (uartRoute.connected || softLinked) {
            try {
                targetWorker.postMessage({
                    type: 'SERIAL_RX',
                    bytes: [value & 0xff],
                    source: uartRoute.connected ? (uartRoute.targetSource || 'uart0') : 'softserial',
                });
            } catch { /* ignore */ }
        }
    }
}

let activeTelemetryEnabled = false;
let activeTelemetryMode = 'detail';
let activeTelemetryWatchedParamsMap: Record<string, string[]> = {};
let activeDeepSiliconEnabled = false;

// ── Teacher Key Recorder State ──────────────────────────────────────────────
let isRecordingTrace = false;
let traceCutoffMs = 0;
let traceBuffer: any[] = [];
let traceComponentMetrics: Record<string, any> = {};
let traceLastComponentStates: Record<string, string> = {};
let traceLastPinStates: Record<string, boolean> = {};
let traceDeepSnapshotCache: any = null;
let traceActiveProjectJson: string | null = null;
let traceBoardId: string | null = null;
let traceComponentId: string | null = null;
let traceCaptureStartMs = 0;
let captureFlushInterval: any = null;

// ── Early Hardware Message Queue ─────────────────────────────────────────────
let isInitializingRunners = false;
let earlyHardwareMessages: any[] = [];

function emitComponentStateEventsToTrace(snapshot: any, timeMs: number) {
    if (snapshot && Array.isArray(snapshot.components)) {
        for (const comp of snapshot.components) {
            const cid = comp.id;
            const stateLike = comp.state && typeof comp.state === 'object' ? comp.state : {};
            const metrics = comp.metrics || {};
            const custom = metrics.custom || comp.customTelemetry || comp._metrics?.customTelemetry || {};
            const emitSource = Object.keys(custom).length > 0 ? custom : stateLike;
            
            for (const key in emitSource) {
                const val = emitSource[key];
                const stateKey = `${cid}:${key}`;
                const serialized = typeof val === 'object' && val !== null ? JSON.stringify(val) : val;
                
                traceBuffer.push({ ComponentState: { id: cid, key: key, value: val, time_ms: timeMs } });
                traceLastComponentStates[stateKey] = serialized;
            }
        }
    }
}



const coreMessageHandler = async (e: MessageEvent) => {
    const data = e.data;

    // ── Render Worker port handshake ──────────────────────────────────────────
    if (data.type === 'SET_RENDER_PORT') {
        const port: MessagePort = data.port;
        console.log('[SimWorker] SET_RENDER_PORT message received, port:', !!port);
        if (port && typeof port.postMessage === 'function') {
            renderWorkerPort = port;
            renderWorkerPort.start();
            console.log('[SimWorker] renderWorkerPort successfully registered and started');
        }
        return;
    }

    if (data.type === 'START_KEY_CAPTURE') {
        console.log('[SimWorker] START_KEY_CAPTURE received. Preparing telemetry buffer...');
        isRecordingTrace = true;
        traceBuffer = [];
        traceBoardId = data.board;
        traceComponentId = data.component;
        traceActiveProjectJson = data.projectJson;
        const activeRunner = mode === 'single' ? runner : boardRunners.get(traceBoardId || "");
        traceCaptureStartMs = activeRunner?.getSimulatedTimeMs?.() ?? 0;
        traceCutoffMs = data.durationMs || 7900;
        
        console.log(`[SimWorker] Telemetry recording started for ${traceCutoffMs}ms`);

        if (captureFlushInterval) clearInterval(captureFlushInterval);
        captureFlushInterval = setInterval(() => {
            const runnerToFlush = mode === 'single' ? runner : boardRunners.get(traceBoardId || "");
            if (runnerToFlush && typeof (runnerToFlush as any).forceEmitState === 'function') {
                (runnerToFlush as any).forceEmitState();
            }
        }, 16.6);

        setTimeout(() => {
            if (captureFlushInterval) {
                clearInterval(captureFlushInterval);
                captureFlushInterval = null;
            }
            console.log(`[SimWorker] Telemetry recording finished. Collected ${traceBuffer.length} frames.`);
            isRecordingTrace = false;
            postMessage({
                type: 'TEACHER_KEY_CAPTURE_COMPLETE',
                telemetry: traceBuffer,
                board: traceBoardId,
                component: traceComponentId,
                projectJson: traceActiveProjectJson
            });
            traceBuffer = [];
        }, traceCutoffMs);
        return;
    }

    // ── Smart Prefetching ─────────────────────────────────────────────────────
    if (data.type === 'PRELOAD_RUNNERS') {
        // Board-specific runners (pico-emu, esp32-emu, stm32f4-emu,
        // stm32f1-emu) prefetch from scratch here. AVR is the only bundled
        // runner; prefetch it unconditionally.
        import('./runners/avr-runner.ts').catch(() => {});
        return;
    }

    // ── Network Worker port handshake ─────────────────────────────────────────
    // Sent from the main thread after creating the Network Worker.
    // The sim worker uses netWorkerPort to forward Ethernet frames from WiFi
    // boards (Pico W) to the dedicated Network Worker — zero-copy transfers.
    if (data.type === 'SET_NET_PORT') {
        const port: MessagePort = data.port;
        console.log('[SimWorker] SET_NET_PORT message received, port:', !!port);
        if (port && typeof port.postMessage === 'function') {
            netWorkerPort = port;
            netWorkerPort.start();
            // Forward inbound frames (FRAME_IN / WIFI_STATUS) back to main thread
            netWorkerPort.onmessage = (evt: MessageEvent) => {
                const msg = evt.data;
                if (msg?.type === 'FRAME_IN') {
                    // Inject Ethernet frame into the Pico W chip via the runner
                    // The runner must have onEthernetFrameIn(boardId, frame) or similar
                    const boardId = String(msg.boardId || '');
                    const frame   = new Uint8Array(msg.frame as ArrayBuffer);
                    const b64     = btoa(String.fromCharCode(...frame));
                    // Forward to main thread as a wifi_packet_in event
                    postMessage({ type: 'wifi_packet_in', boardId, ether_b64: b64 });
                } else if (msg?.type === 'WIFI_STATUS') {
                    // Forward status to main thread for UI
                    postMessage({ type: 'wifi_status', ...msg });
                } else if (msg?.type === 'PCAP_DATA') {
                    // Transfer PCAP buffer back to main thread for download
                    const buf = msg.data as ArrayBuffer;
                    postMessage({ type: 'wifi_pcap', boardId: msg.boardId, data: buf }, [buf]);
                }
            };
            console.log('[SimWorker] netWorkerPort successfully registered and started');
        }
        return;
    }

    if (data.type === 'DOWNLOAD_PCAP') {
        const boardId = data.boardId;
        const targetRunner = boardRunners.get(boardId) || runner;
        if (targetRunner && typeof targetRunner.downloadPcap === 'function') {
            console.log(`[SimWorker] Triggering PCAP download for ${boardId}`);
            targetRunner.downloadPcap();
        } else {
            console.warn(`[SimWorker] PCAP download requested for ${boardId} but runner doesn't support it or isn't active`);
        }
        return;
    }

    if (data.type === 'START') {
        const {
            hex,
            components,
            wires,
            customLogics,
            boardHexMap,
            baudRate,
            boardBaudMap,
            debugSyncHeartbeat,
            speed,
            telemetryEnabled,
            telemetryMode,
        } = data;
        const initialSpeed = Number(speed ?? 1.0);
        activeTelemetryEnabled = !!telemetryEnabled;
        activeTelemetryMode = telemetryMode || 'detail';
        activeTelemetryWatchedParamsMap = data.watchedParamsMap || {};
        activeDeepSiliconEnabled = !!data.deepSilicon;

        stopAllRunners();
        syncValidationEnabled = !!debugSyncHeartbeat;
        resetSyncValidationState();
        attachCommandRings(data);

        // --- INJECT TEMPORARY SANDBOX LOGIC ---
        if (customLogics && Array.isArray(customLogics)) {
            customLogics.forEach((cl: any) => {
                try {
                    assertSafeDynamicModule(cl.code, `${cl.type || 'custom'} logic`);
                    const exportsObj: any = {};
                    const requireFn = (mod: string) => {
                        if (mod.includes('BaseComponent')) return { BaseComponent };
                        return {};
                    };
                    // codeql[js/code-injection] - Intentional dynamic evaluation for custom simulation logic.
                    // Globals are shadowed to provide a hardened sandbox environment.
                    const evalFn = new Function(
                        'exports', 'require', 'self', 'globalThis', 'window', 'document', 'location', 'console',
                        `"use strict";\n${cl.code}`
                    );
                    evalFn(exportsObj, requireFn, undefined, undefined, undefined, undefined, undefined, console);

                    const LogicClass = exportsObj[Object.keys(exportsObj)[0]] || exportsObj.default;
                    if (LogicClass) {
                        LOGIC_REGISTRY[cl.type] = LogicClass;
                        COMPONENT_PINS[cl.type] = cl.pins;
                        console.log(`[Worker] Sandbox injected component logic for: ${cl.type}`);
                    }
                } catch (e) {
                    console.error(`[Worker] Failed to inject sandbox logic for ${cl.type}:`, e);
                }
            });
        }

        const programmableBoards = (components || []).filter((c: any) => isProgrammableBoardType(c.type));
        const sharedPeripheralComponents = (components || []).filter((c: any) => !isProgrammableBoardType(c.type));

        if (programmableBoards.length <= 1) {
            mode = 'single';
            const singleBoardComp = programmableBoards[0] || null;
            const singleBoardType = String(singleBoardComp?.type || 'openhw-arduino-uno');
            const singleBoardId = singleBoardComp?.id;
            console.log(`[Worker] Creating runner for board: ${singleBoardType}, boardId: ${singleBoardId}`);
            try {
                // Single-board firmware: boardHexMap wins (UF2/bin/hex/ELF or
                // PYSCRIPT: sentinel), else the legacy top-level hex blob.
                const singleRaw = (singleBoardId && (boardHexMap as any)?.[singleBoardId])
                    || (singleBoardComp as any)?.attrs?.firmwareHex
                    || (singleBoardComp as any)?.attrs?.hex
                    || hex;
                let singleHex = singleRaw;
                let singlePyScript = '';
                if (typeof singleRaw === 'string' && singleRaw.startsWith('PYSCRIPT:')) {
                    singlePyScript = singleRaw.slice('PYSCRIPT:'.length);
                    singleHex = '';
                }
                runner = await createRunnerForBoard(
                    singleBoardType,
                    typeof singleHex === 'string' ? singleHex : hex,
                    components,
                    wires,
                    (stateObj) => postRunnerState(stateObj, singleBoardId || 'default'),
                    {
                        boardId: singleBoardId,
                        pyScript: singlePyScript,
                        serialBaudRate: Number(boardBaudMap?.[singleBoardId] ?? baudRate ?? 9600),
                        debugEnabled: false,
                        debugIntervalMs: 0,
                        speed: initialSpeed,
                        sessionId: data.networkRoomCode || '',
                        onByteTransmit: ({ boardId, value, char, source }) => {
                            appendBoardSerialOutput(String(boardId || ''), String(char || ''));
                            postMessage({ type: 'serial', data: char, boardId, value, source });
                            try {
                                agentRecorder.pushSerial(
                                    String(boardId || ''), String(char || ''),
                                    String(source || 'uart'));
                            } catch { /* tap never breaks serial */ }
                        },
                        telemetryEnabled: activeTelemetryEnabled,
                        telemetryMode: activeTelemetryMode,
                        telemetryWatchedParams: activeTelemetryWatchedParamsMap,
                        deepSiliconEnabled: activeDeepSiliconEnabled,
                        sab: data.sab,
                        sabOffsets: data.sabOffsets,
                        cmdBuffer: (data as any).cmdBuffer,
                        evtBuffer: (data as any).evtBuffer,
                        // Full-map geometry (§10.4): postamble-computed, so
                        // runners bind pin/debug writers without re-deriving.
                        sabGeometry: (data as any).sabGeometry,
                        sabDebugOffset: (data as any).sabDebugOffset,
                        sabSerialRxOffset: (data as any).sabSerialRxOffset,
                        sabSerialTxOffset: (data as any).sabSerialTxOffset,
                        sabDisplayDescOffset: (data as any).sabDisplayDescOffset,
                        boardPinMaps: (data as any).boardPinMaps,
                    }
                );
                console.log(`[Worker] Runner created OK. running=${(runner as any)?.running}`);
                
                // If this is teacher key capture, initialize capture state and baseline snapshot before starting execution
                if (data.isTeacherKeyCapture) {
                    console.log('[SimWorker] Single board isTeacherKeyCapture. Initializing capture state and baseline at T=0.');
                    isRecordingTrace = true;
                    traceBuffer = [];
                    traceBoardId = data.teacherKeyBoardId || null;
                    traceComponentId = data.teacherKeyComponentId || null;
                    traceActiveProjectJson = data.teacherKeyProjectJson || null;
                    traceCaptureStartMs = runner.getSimulatedTimeMs?.() ?? 0;
                    traceCutoffMs = data.teacherKeyDurationMs || 7900;
                    
                    traceLastComponentStates = {};
                    traceLastPinStates = {};
                    
                    const baselineSnapshot = runner.getRichTelemetrySnapshot({ mode: 'deep' });
                    emitComponentStateEventsToTrace(baselineSnapshot, 0);

                    if (captureFlushInterval) clearInterval(captureFlushInterval);
                    captureFlushInterval = setInterval(() => {
                        if (runner && typeof (runner as any).forceEmitState === 'function') {
                            (runner as any).forceEmitState();
                        }
                    }, 16.6);

                    setTimeout(() => {
                        if (captureFlushInterval) {
                            clearInterval(captureFlushInterval);
                            captureFlushInterval = null;
                        }
                        console.log(`[SimWorker] Telemetry recording finished. Collected ${traceBuffer.length} frames.`);
                        isRecordingTrace = false;
                        postMessage({
                            type: 'TEACHER_KEY_CAPTURE_COMPLETE',
                            telemetry: traceBuffer,
                            board: traceBoardId,
                            component: traceComponentId,
                            projectJson: traceActiveProjectJson
                        });
                        traceBuffer = [];
                    }, traceCutoffMs);
                }

                // Start execution
                if (runner && typeof (runner as any).execute === 'function') {
                    (runner as any).execute();
                }
            } catch (runnerErr: any) {
                console.error('[Worker] FATAL: createRunnerForBoard threw:', runnerErr);
                postMessage({ type: 'error', message: `Runner init failed: ${runnerErr?.message || runnerErr}` });
                return;
            }

            if (typeof (runner as any).setTelemetryEnabled === 'function') {
                (runner as any).setTelemetryEnabled(activeTelemetryEnabled, activeTelemetryMode, activeTelemetryWatchedParamsMap, activeDeepSiliconEnabled);
            }

            if (singleBoardId) {
                boardTypes.set(singleBoardId, singleBoardType);
                boardSerialOutput.set(singleBoardId, '');
            }
            // NOTE: single-board START already initializes teacher-key capture
            // inline above (isTeacherKeyCapture branch); no extra helper needed.
            // (A stale call to an undefined startTeacherKeyCaptureIfRequested
            //  used to live here and threw a ReferenceError on every run.)
            return;
        }

        mode = 'multi';
        buildNetIndex(wires || []);

        // v2 boardIdx: board workers bind their OWN serial/debug regions by
        // index into sabBoardSerialBase/sabBoardDebugBase. Order follows the
        // START boardPinMaps so main-thread readers agree.
        const boardIdToIdx = new Map<string, number>();
        try {
            const ids = (data as any).sabBoardIds;
            if (Array.isArray(ids)) ids.forEach((id: any, i: number) => boardIdToIdx.set(String(id), i));
        } catch { /* fall back to loop order */ }
        let multiIdx = 0;
        for (const boardComp of programmableBoards) {
            const rawFw = boardHexMap?.[boardComp.id] || boardComp?.attrs?.firmwareHex || boardComp?.attrs?.hex;
            // MicroPython sentinel: boardHexMap carries `PYSCRIPT:<code>`.
            // Split into pyScript (runner injects over REPL) + empty firmware
            // (runner boots the bundled MP image).
            let fwHex = rawFw;
            let pyScript = '';
            if (typeof rawFw === 'string' && rawFw.startsWith('PYSCRIPT:')) {
                pyScript = rawFw.slice('PYSCRIPT:'.length);
                fwHex = '';
            }
            if (!boardComp.attrs) {
                boardComp.attrs = {};
            }
            boardComp.attrs.sessionId = data.networkRoomCode || '';

            if (typeof fwHex !== 'string' || !fwHex.trim()) {
                // Empty + no micropython script → nothing to boot. With a
                // script, the runner boots the bundled MP image instead.
                if (!pyScript.trim()) {
                    console.warn(`[Worker] Skipping board ${boardComp.id}: no board-specific firmware available.`);
                    continue;
                }
            }
            const runnerComponents = [boardComp, ...sharedPeripheralComponents];
            const boardType = String(boardComp.type || '');
            const boardIdx = boardIdToIdx.has(boardComp.id) ? boardIdToIdx.get(boardComp.id)! : multiIdx;
            const runnerOptions = {
                boardId: boardComp.id,
                pyScript,
                boardIdx,
                serialBaudRate: Number(boardBaudMap?.[boardComp.id] ?? baudRate ?? 9600),
                debugEnabled: false,
                debugIntervalMs: 0,
                speed: initialSpeed,
                sessionId: data.networkRoomCode || '',
                onByteTransmit: ({ boardId, value, char, source }: any) => {
                    appendBoardSerialOutput(String(boardId || ''), String(char || ''));
                    postMessage({ type: 'serial', data: char, boardId, value, source });
                    try {
                        agentRecorder.pushSerial(
                            String(boardId || ''), String(char || ''),
                            String(source || 'uart0'));
                    } catch { /* tap never breaks serial */ }
                    routeUartByte(boardId, value, source || 'uart0');
                },
                sab: data.sab,
                sabOffsets: data.sabOffsets,
                cmdBuffer: (data as any).cmdBuffer,
                evtBuffer: (data as any).evtBuffer,
                // Full-map geometry (§10.4): same as single-board path.
                sabGeometry: (data as any).sabGeometry,
                sabDebugOffset: (data as any).sabDebugOffset,
                sabSerialRxOffset: (data as any).sabSerialRxOffset,
                sabSerialTxOffset: (data as any).sabSerialTxOffset,
                sabDisplayDescOffset: (data as any).sabDisplayDescOffset,
                // v2 per-board regions: this runner binds only its own.
                sabBoardSerialBase: (data as any).sabBoardSerialBase,
                sabBoardDebugBase: (data as any).sabBoardDebugBase,
                sabNumBoards: (data as any).sabNumBoards,
                boardPinMaps: (data as any).boardPinMaps,
                // START telemetry intent, same as the single-board path:
                // runners apply it at construction (no post-START race).
                telemetryEnabled: activeTelemetryEnabled,
                telemetryMode: activeTelemetryMode,
                telemetryWatchedParams: activeTelemetryWatchedParamsMap,
                deepSiliconEnabled: activeDeepSiliconEnabled,
            };

            // Heavy engines (ARM boards) tick on a dedicated compute Worker
            // so one board's WASM burst never starves the others. AVR stays
            // in-process (cheap, synchronous, needs direct instance access
            // for INTERACT/physics). Degraded mode (no Worker): in-process.
            const useBoardWorker = !/arduino|avr|mega|nano|attiny/i.test(boardType) && typeof Worker !== 'undefined';
            if (useBoardWorker) {
                const bw = new Worker(new URL('./board.worker.ts', import.meta.url), { type: 'module' });
                const targetId = boardComp.id;
                const targetType = boardType;
                // Surface nested-worker failures (module load / wasm) to the
                // monitor — otherwise a dead board worker is silent (no
                // 'ready', no uart-tx, verdict just times out).
                bw.onerror = (evt: any) => {
                    const msg = String((evt as any)?.message || (evt as any)?.type || 'board worker error');
                    console.error(`[Worker] board worker ${targetId} error:`, msg);
                    postMessage({ type: 'error', message: `Board ${targetId}: ${msg}` });
                };
                bw.onmessage = (evt: MessageEvent) => {
                    const msg = (evt as any)?.data || {};
                    if (msg.type === 'ready') {
                        boardWorkerReady.set(targetId, true);
                    } else if (msg.type === 'state') {
                        postRunnerState(msg.state, targetId);
                    } else if (msg.type === 'uart-tx') {
                        appendBoardSerialOutput(targetId, String(msg.char || ''));
                        postMessage({ type: 'serial', data: msg.char, boardId: targetId, value: msg.value, source: msg.source });
                        try {
                            agentRecorder.pushSerial(targetId, String(msg.char || ''), String(msg.source || 'uart0'));
                        } catch { /* tap never breaks serial */ }
                        routeUartByte(targetId, msg.value, msg.source || 'uart0');
                    } else if (msg.type === 'interact-miss') {
                        console.warn(`[Worker] INTERACT target not found in board worker ${targetId}: ${msg.compId}`);
                    } else if (msg.type === 'debug-snapshot') {
                        pendingBoardSnapshots.set(`${targetId}`, msg.snapshot ?? null);
                        maybeFlushBoardSnapshotBatch();
                    } else if (msg.type === 'debug-mem') {
                        pendingBoardMem.set(`${targetId}`, Array.isArray(msg.mem) ? msg.mem : []);
                        maybeFlushBoardMemBatch();
                    } else if (msg.type === 'error') {
                        postMessage({ type: 'error', message: `Board ${targetId}: ${msg.message}` });
                    }
                };
                bw.postMessage({
                    type: 'BOARD_START',
                    boardIdx,
                    boardId: targetId,
                    boardType: targetType,
                    firmware: typeof fwHex === 'string' ? fwHex : '',
                    pyScript,
                    components: runnerComponents,
                    wires,
                    // NOTE: cmd/evt buffers stay with the parent (MPSC ring);
                    // board workers get control via postMessage fan-out.
                    options: { ...runnerOptions, onByteTransmit: undefined, cmdBuffer: undefined, evtBuffer: undefined },
                });
                boardWorkers.set(boardComp.id, bw);
                boardWorkerTypes.set(boardComp.id, boardType);
                boardWorkerReady.set(boardComp.id, false);
                boardSerialOutput.set(boardComp.id, '');
                multiIdx++;
                continue;
            }

            const boardRunner = await createRunnerForBoard(
                boardType,
                typeof fwHex === 'string' ? fwHex : '',
                runnerComponents,
                wires,
                (stateObj) => postRunnerState(stateObj, boardComp.id),
                runnerOptions,
            );

            boardRunners.set(boardComp.id, boardRunner);
            boardTypes.set(boardComp.id, String(boardComp.type || ''));
            boardSerialOutput.set(boardComp.id, '');
            multiIdx++;
        }

        boardRunners.forEach((br) => {
            if (typeof (br as any).setTelemetryEnabled === 'function') {
                (br as any).setTelemetryEnabled(activeTelemetryEnabled, activeTelemetryMode, activeTelemetryWatchedParamsMap, activeDeepSiliconEnabled);
            }
        });

        // If this is teacher key capture, initialize capture state and baseline snapshot before starting execution
        if (data.isTeacherKeyCapture) {
            console.log('[SimWorker] Multi-board isTeacherKeyCapture. Initializing capture state and baseline at T=0.');
            isRecordingTrace = true;
            traceBuffer = [];
            traceBoardId = data.teacherKeyBoardId || null;
            traceComponentId = data.teacherKeyComponentId || null;
            traceActiveProjectJson = data.teacherKeyProjectJson || null;
            
            traceLastComponentStates = {};
            traceLastPinStates = {};
            
            const activeRunner = boardRunners.get(traceBoardId || "");
            if (activeRunner) {
                traceCaptureStartMs = activeRunner.getSimulatedTimeMs?.() ?? 0;
                traceCutoffMs = data.teacherKeyDurationMs || 7900;
                
                const baselineSnapshot = activeRunner.getRichTelemetrySnapshot({ mode: 'deep' });
                emitComponentStateEventsToTrace(baselineSnapshot, 0);
            }

            if (captureFlushInterval) clearInterval(captureFlushInterval);
            captureFlushInterval = setInterval(() => {
                const runnerToFlush = boardRunners.get(traceBoardId || "");
                if (runnerToFlush && typeof (runnerToFlush as any).forceEmitState === 'function') {
                    (runnerToFlush as any).forceEmitState();
                }
            }, 16.6);

            setTimeout(() => {
                if (captureFlushInterval) {
                    clearInterval(captureFlushInterval);
                    captureFlushInterval = null;
                }
                console.log(`[SimWorker] Telemetry recording finished. Collected ${traceBuffer.length} frames.`);
                isRecordingTrace = false;
                postMessage({
                    type: 'TEACHER_KEY_CAPTURE_COMPLETE',
                    telemetry: traceBuffer,
                    board: traceBoardId,
                    component: traceComponentId,
                    projectJson: traceActiveProjectJson
                });
                traceBuffer = [];
            }, traceCutoffMs);
        }

        // Now start execution for all runners!
        boardRunners.forEach((br) => {
            if (typeof (br as any).execute === 'function') {
                (br as any).execute();
            }
        });
    } else if (data.type === 'STOP') {
        stopAllRunners();
    } else if (data.type === 'DEBUG_HALT') {
        // Debug control-plane (ring-first; postMessage fallback when no rings).
        // HALT freezes run loops via DebugService; runners check budgets/ticks.
        // Board workers don't drain the shared cmd ring (MPSC race), so the
        // parent fans HALT out as an explicit DEBUG_CMD + mirrors it locally.
        try {
            if (sabDebugService) {
                (sabDebugService as any).halt?.();
            }
        } catch { /* ignore */ }
        const targets = mode === 'single' && runner ? [runner] : [...boardRunners.values()];
        for (const r of targets) {
            try { (r as any)?.pause?.(); } catch { /* ignore */ }
        }
        boardWorkers.forEach((bw) => {
            try { bw.postMessage({ type: 'DEBUG_CMD', cmd: 'halt' }); } catch { /* ignore */ }
        });
        postMessage({ type: 'DEBUG_STATE', halted: true });
        return;
    } else if (data.type === 'DEBUG_RESUME') {
        try {
            if (sabDebugService) {
                (sabDebugService as any).resume?.();
            }
        } catch { /* ignore */ }
        const targets = mode === 'single' && runner ? [runner] : [...boardRunners.values()];
        for (const r of targets) {
            try { (r as any)?.resume?.(); } catch { /* ignore */ }
        }
        boardWorkers.forEach((bw) => {
            try { bw.postMessage({ type: 'DEBUG_CMD', cmd: 'resume' }); } catch { /* ignore */ }
        });
        postMessage({ type: 'DEBUG_STATE', halted: false });
        return;
    } else if (data.type === 'DEBUG_STEP') {
        const n = Math.max(1, Number(data.cycles) || Number(data.steps) || 16000);
        const viaRing = (data as any)?.viaRing === true;
        const targets = mode === 'single' && runner ? [runner] : [...boardRunners.values()];
        for (const r of targets) {
            try {
                if (viaRing) {
                    // UI already enqueued STEP into the ring; the halted
                    // runner drains it on its next tick (drain runs before
                    // the freeze check) and stepCycles() bursts
                    // synchronously there. No worker action needed.
                    continue;
                }
                // PostMessage fallback: queue budget directly on the service
                // (logged for replayDigest determinism), then burst inline.
                try {
                    const svc = (r as any)?.debugService ?? sabDebugService;
                    (svc as any)?.queueStep?.(n);
                } catch { /* ignore */ }
                const budget = (r as any)?.stepCycles?.(n) ?? 0;
                // If runner lacks ring support, run the burst inline (legacy).
                if (!budget && (r as any)?.running === false) {
                    (r as any)?.resume?.();
                }
            } catch { /* ignore */ }
        }
        // Board workers never drain the shared ring, so STEP always fans out
        // explicitly (their own DebugService logs it for determinism).
        boardWorkers.forEach((bw) => {
            try { bw.postMessage({ type: 'DEBUG_CMD', cmd: 'step', cycles: n, snapshot: true }); } catch { /* ignore */ }
        });
        // Snapshot refresh so the panel shows the advanced pc/cycles.
        // Board-worker snapshots arrive async and merge via
        // maybeFlushBoardSnapshotBatch; count them first.
        pendingBoardSnapshotWant = boardWorkers.size;
        pendingBoardSnapshots.clear();
        try {
            if (mode === 'single' && runner) {
                pendingBoardSnapshots.set('single', (runner as any)?.getDebugSnapshot?.() ?? null);
            } else {
                for (const [id, br] of boardRunners) {
                    try { pendingBoardSnapshots.set(id, (br as any)?.getDebugSnapshot?.() ?? null); } catch { pendingBoardSnapshots.set(id, null); }
                }
            }
        } catch { /* ignore */ }
        if (pendingBoardSnapshotWant === 0) {
            try {
                const out: Record<string, any> = {};
                for (const [id, snap] of pendingBoardSnapshots) out[id] = snap;
                postMessage({ type: 'DEBUG_SNAPSHOT', snapshot: out });
            } catch { /* ignore */ }
            pendingBoardSnapshots.clear();
            return;
        }
        // In-process part posts immediately; board parts merge in.
        // To keep one message shape, hold until the batch completes.
        return;
    } else if (data.type === 'DEBUG_WATCH') {
        // Pin watchpoint add. Authoritative path is the command ring
        // (WATCH_ADD record, cycle-stamped, drained per-tick even while
        // halted). The worker owns the ring READER; the UI owns the WRITER,
        // so the UI already enqueued the record — here we only cover the
        // postMessage fallback (ring absent/full: viaRing === false).
        const pin = String((data as any)?.pin || '').trim();
        const expectHigh = (data as any)?.expectHigh !== false;
        const viaRing = (data as any)?.viaRing === true;
        if (pin && !viaRing) {
            try {
                const svc = sabDebugService as any;
                if (svc && typeof svc.addPinWatch === 'function') {
                    svc.addPinWatch(pin, expectHigh);
                }
            } catch { /* ignore */ }
            const targets = mode === 'single' && runner ? [runner] : [...boardRunners.values()];
            for (const r of targets) {
                try { (r as any)?.addPinWatch?.(pin, expectHigh); } catch { /* ignore */ }
            }
            boardWorkers.forEach((bw) => {
                try { bw.postMessage({ type: 'DEBUG_CMD', cmd: 'watch', pin, expectHigh }); } catch { /* ignore */ }
            });
        }
        // Echo current watch list so the panel stays in sync.
        try {
            const watches = ((sabDebugService as any)?.getWatches?.() ?? null) as any;
            postMessage({ type: 'DEBUG_STATE', halted: !!(sabDebugService as any)?.isHalted?.(), watches });
        } catch {
            postMessage({ type: 'DEBUG_STATE', halted: false });
        }
        return;
    } else if (data.type === 'DEBUG_UNWATCH') {
        const pin = String((data as any)?.pin || '').trim();
        try {
            const svc = sabDebugService as any;
            if (svc && typeof svc.removePinWatch === 'function') {
                svc.removePinWatch(pin);
            }
        } catch { /* ignore */ }
        const targets = mode === 'single' && runner ? [runner] : [...boardRunners.values()];
        for (const r of targets) {
            try { (r as any)?.removePinWatch?.(pin); } catch { /* ignore */ }
        }
        boardWorkers.forEach((bw) => {
            try { bw.postMessage({ type: 'DEBUG_CMD', cmd: 'unwatch', pin }); } catch { /* ignore */ }
        });
        return;
    } else if (data.type === 'DEBUG_PC_BREAK') {
        // PC breakpoint add (§10.7): chunk-boundary checked in run loops,
        // never per-instruction. Ring path (if a PC_BREAK op lands later)
        // stays authoritative; this covers the postMessage fallback now.
        const pc = Number((data as any)?.pc) >>> 0;
        if (Number.isFinite(pc)) {
            try {
                const svc = sabDebugService as any;
                if (svc && typeof svc.addPcBreakpoint === 'function') {
                    svc.addPcBreakpoint(pc);
                }
            } catch { /* ignore */ }
            const targets = mode === 'single' && runner ? [runner] : [...boardRunners.values()];
            for (const r of targets) {
                try {
                    const svc = (r as any)?.debugService;
                    if (svc && typeof svc.addPcBreakpoint === 'function') {
                        svc.addPcBreakpoint(pc);
                    }
                } catch { /* ignore */ }
            }
            boardWorkers.forEach((bw) => {
                try { bw.postMessage({ type: 'DEBUG_CMD', cmd: 'pcbreak', pc }); } catch { /* ignore */ }
            });
        }
        return;
    } else if (data.type === 'DEBUG_PC_BREAK_CLEAR') {
        // Clear PC breakpoints ONLY — pin watches are preserved
        // (clearBreakpoints() drops both, so it is not used here).
        try {
            const svc = sabDebugService as any;
            if (svc && typeof svc.clearPcBreakpoints === 'function') {
                svc.clearPcBreakpoints();
            }
        } catch { /* ignore */ }
        const targets = mode === 'single' && runner ? [runner] : [...boardRunners.values()];
        for (const r of targets) {
            try {
                const svc = (r as any)?.debugService;
                if (svc && typeof svc.clearPcBreakpoints === 'function') {
                    svc.clearPcBreakpoints();
                }
            } catch { /* ignore */ }
        }
        boardWorkers.forEach((bw) => {
            try { bw.postMessage({ type: 'DEBUG_CMD', cmd: 'pcbreak-clear' }); } catch { /* ignore */ }
        });
        return;
    } else if (data.type === 'DEBUG_READ_MEM') {
        const addr = Number((data as any)?.addr || 0) >>> 0;
        const len = Math.max(1, Math.min(256, Number((data as any)?.len || 16)));
        let mem: Array<number> | null = null;
        try {
            const svc = sabDebugService as any;
            if (svc && typeof svc.readMem === 'function') {
                const view = svc.readMem(addr, len) as Uint8Array;
                mem = Array.from(view);
            }
        } catch { mem = null; }
        if (!mem) {
            const targets = mode === 'single' && runner ? [runner] : [...boardRunners.values()];
            for (const r of targets) {
                try {
                    const view = (r as any)?.readMem?.(addr, len);
                    if (view) { mem = Array.from(view as Uint8Array); break; }
                } catch { /* ignore */ }
            }
        }
        if (mem) {
            postMessage({ type: 'DEBUG_MEM', addr, len, mem });
            return;
        }
        // Board workers own their memories: fan out, merge first non-empty.
        pendingBoardMem.clear();
        pendingBoardMemWant = boardWorkers.size;
        pendingBoardMemAddr = addr;
        pendingBoardMemLen = len;
        if (pendingBoardMemWant === 0) {
            postMessage({ type: 'DEBUG_MEM', addr, len, mem: [] });
            return;
        }
        boardWorkers.forEach((bw) => {
            try { bw.postMessage({ type: 'DEBUG_CMD', cmd: 'readmem', addr, len }); } catch { /* ignore */ }
        });
        return;
    } else if (data.type === 'DEBUG_SNAPSHOT') {
        // Board-worker snapshots arrive async; merge with in-process ones.
        pendingBoardSnapshotWant = boardWorkers.size;
        pendingBoardSnapshots.clear();
        if (pendingBoardSnapshotWant === 0) {
            const snap = (mode === 'single' && runner)
                ? ((runner as any)?.getDebugSnapshot?.() ?? null)
                : (() => {
                    const out: Record<string, any> = {};
                    for (const [id, br] of boardRunners) {
                        try { out[id] = (br as any)?.getDebugSnapshot?.() ?? null; } catch { out[id] = null; }
                    }
                    return out;
                })();
            let digest: string | null = null;
            try {
                const svc = sabDebugService as any;
                if (svc && typeof svc.replayDigest === 'function') {
                    digest = svc.replayDigest();
                }
            } catch { digest = null; }
            postMessage({ type: 'DEBUG_SNAPSHOT', snapshot: snap, digest });
            return;
        }
        boardWorkers.forEach((bw) => {
            try { bw.postMessage({ type: 'DEBUG_CMD', cmd: 'snapshot' }); } catch { /* ignore */ }
        });
        // In-process snapshots merge when the batch flushes.
        try {
            if (mode === 'single' && runner) {
                pendingBoardSnapshots.set('single', (runner as any)?.getDebugSnapshot?.() ?? null);
            } else {
                for (const [id, br] of boardRunners) {
                    try { pendingBoardSnapshots.set(id, (br as any)?.getDebugSnapshot?.() ?? null); } catch { pendingBoardSnapshots.set(id, null); }
                }
            }
        } catch { /* ignore */ }
        maybeFlushBoardSnapshotBatch();
        return;
    } else if (data.type === 'INTERACT') {
        console.log(`[Worker] Received INTERACT for ${data.compId}: ${data.event}`);

        // DHT-type components manage their own bus state via _setAvrPinDirect.
        // Calling repropagateAllVoltages immediately after onEvent triggers a
        // netlist traversal that fires onPinStateChange on the DHT mid-transmission,
        // corrupting the 40-bit packet. Skip repropagation for these components.
        const isDhtTarget = /dht/i.test(String(data.compId || ''));

        const runQuickBurst = (r: BoardRunner) => {
            if (r.running && r.cpu) {
                if (!isDhtTarget && typeof (r as any).repropagateAllVoltages === 'function') {
                    (r as any).repropagateAllVoltages();
                }
                if (typeof (r as any).pollADCChannels === 'function') {
                    (r as any).pollADCChannels();
                }
                if (typeof (r as any).updateGPIOInputsFromCircuit === 'function') {
                    (r as any).updateGPIOInputsFromCircuit();
                }

                if (r.cpu.pc !== undefined) {
                    const quickCycles = 16000;
                    const targetObj = r.cpu.cycles + quickCycles;
                    while (r.cpu.cycles < targetObj && r.running) {
                        avrInstruction(r.cpu);
                        r.cpu.tick();
                    }
                    const instArray = Array.from(r.instances.values());
                    instArray.forEach(c => c.update(r.cpu.cycles, (r as any).currentWires, instArray));
                    if (typeof r.forceEmitState === 'function') {
                        r.forceEmitState();
                    }
                } else if (r.cpu.core && typeof r.cpu.core.executeInstruction === 'function') {
                    let cyclesDone = 0;
                    while (cyclesDone < 16000 && r.running) {
                        const before = r.cpu.core.cycles >>> 0;
                        r.cpu.core.executeInstruction();
                        const after = r.cpu.core.cycles >>> 0;
                        const delta = (after - before) >>> 0;
                        cyclesDone += delta > 0 ? delta : 1;
                    }
                    const instArray = Array.from(r.instances.values());
                    instArray.forEach(c => c.update(r.cpu.core.cycles, (r as any).currentWires, instArray));
                    if (typeof r.forceEmitState === 'function') {
                        r.forceEmitState();
                    }
                }
            }
        };

        if (mode === 'single' && runner) {
            const inst = runner.instances.get(data.compId);
            if (inst) {
                inst.onEvent(data.event);
                runQuickBurst(runner);
            } else {
                console.warn(`[Worker] INTERACT target not found in single runner: ${data.compId}`);
            }
        } else {
            let delivered = false;
            for (const boardRunner of boardRunners.values()) {
                const inst = boardRunner.instances.get(data.compId);
                if (inst) {
                    inst.onEvent(data.event);
                    delivered = true;
                    runQuickBurst(boardRunner);
                }
            }
            // Board workers own their instances; delegate so ARM boards get
            // the event + a fresh emit (their tick keeps running).
            if (boardWorkers.size > 0) {
                for (const bw of boardWorkers.values()) {
                    try { bw.postMessage({ type: 'INTERACT_EVT', compId: data.compId, event: data.event }); } catch { /* ignore */ }
                }
                delivered = true;
            }
            if (!delivered) {
                console.warn(`[Worker] INTERACT target not found in any runner: ${data.compId}`);
            }
        }
    } else if (data.type === 'RENDER_REPORT') {
        if (!syncValidationEnabled) {
            return;
        }

        const boardId = String(data.boardId || '').trim() || 'default';
        const renderedHash = String(data.hash || '').trim();
        const reportedFrameId = Number(data.frameId);
        if (!renderedHash) {
            return;
        }

        const heartbeat = syncHeartbeatByBoard.get(boardId);
        if (!heartbeat) {
            return;
        }

        if (Number.isFinite(reportedFrameId) && reportedFrameId > 0 && reportedFrameId < heartbeat.frameId) {
            return;
        }

        if (renderedHash === heartbeat.hash) {
            syncMismatchCountByBoard.set(boardId, 0);
            syncFaultLatchedByBoard.set(boardId, false);
            return;
        }

        const mismatchCount = Number(syncMismatchCountByBoard.get(boardId) || 0) + 1;
        syncMismatchCountByBoard.set(boardId, mismatchCount);

        if (mismatchCount > 3 && !syncFaultLatchedByBoard.get(boardId)) {
            syncFaultLatchedByBoard.set(boardId, true);
            postMessage({
                type: 'sync_fault',
                boardId,
                frameId: heartbeat.frameId,
                mismatches: mismatchCount,
                expectedHash: heartbeat.hash,
                renderedHash,
                emittedAt: Date.now(),
            });
        }
    } else if (data.type === 'SET_SPEED') {
        const nextSpeed = Number(data.speed);
        if (Number.isFinite(nextSpeed) && nextSpeed > 0) {
            if (mode === 'single' && runner) {
                runner.setSpeed(nextSpeed);
            } else {
                boardRunners.forEach((br) => br.setSpeed(nextSpeed));
                boardWorkers.forEach((bw) => {
                    try { bw.postMessage({ type: 'SET_SPEED', speed: nextSpeed }); } catch { /* ignore */ }
                });
            }
        }
    } else if (data.type === 'SET_COMPONENT_TELEMETRY') {
        const enabled = !!data.enabled;
        const telemetryMode = data.mode || 'detail';
        activeTelemetryEnabled = enabled;
        activeTelemetryMode = telemetryMode;
        if (data.watchedParamsMap) {
            activeTelemetryWatchedParamsMap = data.watchedParamsMap;
        }
        if (data.deepSilicon !== undefined) {
            activeDeepSiliconEnabled = !!data.deepSilicon;
        }
        if (mode === 'single' && runner) {
            if (typeof (runner as any).setTelemetryEnabled === 'function') {
                (runner as any).setTelemetryEnabled(enabled, telemetryMode, activeTelemetryWatchedParamsMap, activeDeepSiliconEnabled);
            }
        } else {
            boardRunners.forEach((br) => {
                if (typeof (br as any).setTelemetryEnabled === 'function') {
                    (br as any).setTelemetryEnabled(enabled, telemetryMode, activeTelemetryWatchedParamsMap, activeDeepSiliconEnabled);
                }
            });
        }
    } else if (data.type === 'FLUSH_VISUALS') {
        if (mode === 'single' && runner) {
            if (typeof (runner as any).forceEmitState === 'function') {
                (runner as any).forceEmitState();
            }
        } else {
            boardRunners.forEach((br) => {
                if (typeof (br as any).forceEmitState === 'function') {
                    (br as any).forceEmitState();
                }
            });
            // Board workers emit on their own cadence via SAB + state
            // wakeups; nothing to flush over the wire.
        }
    } else if (data.type === 'GET_SAB_STATS') {
        // T5 bench gate readout for Playwright: steady-frame components bytes,
        // wakeup count, and running averages. Never blocks the tick loop.
        postMessage({
            type: 'SAB_STATS',
            frames: sabBenchFrames,
            bytesTotal: sabBenchBytesTotal,
            lastComponentsBytes: sabBenchLastComponentsBytes,
            wakeups: sabBenchWakeups,
            avgComponentsBytes: sabBenchFrames > 0 ? Math.round(sabBenchBytesTotal / sabBenchFrames) : 0,
        });
        return;
    } else if (data.type === 'REAL_METRICS') {
        setRealMetrics(data.canvasFps, data.uiMainThreadBlockedTimeMs);
    } else if (data.type === 'SERIAL_SET_BAUD') {
        const parsedBaud = Number(data.baudRate);
        if (!Number.isFinite(parsedBaud)) {
            return;
        }

        if (mode === 'single' && runner) {
            runner.setSerialBaudRate(parsedBaud);
        } else if (data.targetBoardId) {
            const target = boardRunners.get(data.targetBoardId);
            if (target) {
                target.setSerialBaudRate(parsedBaud);
            } else {
                // Board-worker target: no baud setter on the wire; the next
                // routeUartByte syncs it. Track locally and no-op.
            }
        } else {
            boardRunners.forEach((boardRunner) => {
                boardRunner.setSerialBaudRate(parsedBaud);
            });
        }
    } else if (data.type === 'GDB_INPUT') {
        if (mode === 'single' && runner) {
            runner.gdbRx(data.data);
        } else if (data.targetBoardId) {
            boardRunners.get(data.targetBoardId)?.gdbRx(data.data);
        }
    } else if (data.type === 'SERIAL_INPUT') {
        if (mode === 'single' && runner) {
            if (data.baudRate) runner.setSerialBaudRate(Number(data.baudRate));
            runner.serialRx(data.data);
        } else {
            if (data.targetBoardId) {
                const target = boardRunners.get(data.targetBoardId);
                if (target) {
                    if (data.baudRate) target.setSerialBaudRate(Number(data.baudRate));
                    target.serialRx(data.data);
                } else {
                    // Board-worker target: single SERIAL_STR string (the
                    // runner drains it into its UART; no per-byte fan-out).
                    const bw = boardWorkers.get(data.targetBoardId);
                    if (bw) {
                        try { bw.postMessage({ type: 'SERIAL_STR', data: String(data.data ?? '') }); } catch { /* ignore */ }
                    }
                }
            } else {
                boardRunners.forEach((boardRunner) => {
                    if (data.baudRate) boardRunner.setSerialBaudRate(Number(data.baudRate));
                    boardRunner.serialRx(data.data);
                });
                boardWorkers.forEach((bw) => {
                    try { bw.postMessage({ type: 'SERIAL_STR', data: String(data.data ?? '') }); } catch { /* ignore */ }
                });
            }
        }
    } else if (data.type === 'RESET') {
        if (mode === 'single' && runner) {
            if (typeof runner.reset === 'function') runner.reset();
            else if (runner.cpu) runner.cpu.reset();
        } else {
            boardRunners.forEach((boardRunner) => {
                if (typeof boardRunner.reset === 'function') boardRunner.reset();
                else if (boardRunner.cpu) boardRunner.cpu.reset();
            });
            // Board workers: engines reset in place (no re-BOOT, no
            // firmware reload). Their runners keep ticking afterwards.
            boardWorkers.forEach((bw) => {
                try { bw.postMessage({ type: 'DEBUG_CMD', cmd: 'reset' }); } catch { /* ignore */ }
            });
        }
        if (syncValidationEnabled) {
            resetSyncValidationState();
        }

        // Clear injection sessions on board reset
        if (mode === 'single') {
            clearInjectSession('default');
        } else {
            boardRunners.forEach((_, boardId) => clearInjectSession(boardId));
        }
    } else if (data.type === 'GPIO_SYNC') {
        const pin = String(data.pin);
        const value = Boolean(data.value);
        
        if (mode === 'single' && runner) {
            if (typeof (runner as any).syncGpio === 'function') {
                (runner as any).syncGpio(pin, value);
            }
        } else {
            const targetBoardId = data.boardId;
            if (targetBoardId) {
                const target = boardRunners.get(targetBoardId);
                if (target && typeof (target as any).syncGpio === 'function') {
                    (target as any).syncGpio(pin, value);
                }
            } else {
                boardRunners.forEach(br => {
                    if (typeof (br as any).syncGpio === 'function') {
                        (br as any).syncGpio(pin, value);
                    }
                });
            }
        }
    } else if (data.type === 'TONE') {
        const pin = String(data.pin);
        const frequency = Number(data.frequency);
        const duration = Number(data.duration);
        
        if (mode === 'single' && runner) {
            if (typeof (runner as any).syncTone === 'function') {
                (runner as any).syncTone(pin, frequency, duration);
            }
        } else {
            const targetBoardId = data.boardId;
            if (targetBoardId) {
                const target = boardRunners.get(targetBoardId);
                if (target && typeof (target as any).syncTone === 'function') {
                    (target as any).syncTone(pin, frequency, duration);
                }
            } else {
                boardRunners.forEach(br => {
                    if (typeof (br as any).syncTone === 'function') {
                        (br as any).syncTone(pin, frequency, duration);
                    }
                });
            }
        }
    } else if (String(data.type || '').startsWith('AGENT_')) {
        // Agent trace plane (§11 R2): watch-scoped recorder control.
        // Pre-v2 transport (postMessage); v2 re-points at the SAB ring.
        try {
            if (data.type === 'AGENT_START_CAPTURE') {
                agentRecorder.startCapture((data as any)?.watch || {});
                agentRecorder.pushRunEvent('STARTED', 'agent capture armed');
                postMessage({ type: 'AGENT_CAPTURE_STATE', active: true });
            } else if (data.type === 'AGENT_STOP_CAPTURE') {
                agentRecorder.pushRunEvent('STOPPED', 'agent capture closed');
                agentRecorder.stopCapture();
                postMessage({ type: 'AGENT_CAPTURE_STATE', active: false });
            } else if (data.type === 'AGENT_GET_TRACE') {
                const t = agentRecorder.getTrace(
                    Number((data as any)?.sinceSeq) || 0,
                    Number((data as any)?.limit) || 500,
                );
                postMessage({ type: 'AGENT_TRACE', ...t, reqId: (data as any)?.reqId ?? null });
            }
        } catch { /* agent plane never breaks sim */ }
        return;
    }
};

self.onmessage = async (e) => {
    const data = e.data;

    if (data.type === 'START') {
        isInitializingRunners = true;
        try {
            await coreMessageHandler(e);
        } finally {
            isInitializingRunners = false;
            if (earlyHardwareMessages.length > 0) {
                console.log(`[SimWorker] Replaying ${earlyHardwareMessages.length} early hardware messages queued during initialization.`);
                const queue = [...earlyHardwareMessages];
                earlyHardwareMessages = [];
                for (const msg of queue) {
                    await coreMessageHandler({ data: msg } as MessageEvent);
                }
            }
        }
        return;
    }

    if (isInitializingRunners && (

        data.type === 'GPIO_SYNC' ||
        data.type === 'SERIAL_INPUT' ||
        data.type === 'GDB_INPUT' ||
        data.type === 'TONE' ||
        data.type === 'DAC_SYNC' ||
        data.type === 'SERIAL_SET_BAUD' ||
        data.type === 'RESET' ||
        data.type === 'GPIO_ROUTING' ||
        data.type === 'GPIO_ROUTING_CLEAR' ||
        data.type === 'LEDC_SYNC' ||
        data.type === 'LEDC_ATTACH' ||
        data.type === 'PCNT_INIT' ||
        data.type === 'TWAI_TX' ||
        data.type === 'RMT_PULSE' ||
        data.type === 'SLEEP_START'
    )) {
        earlyHardwareMessages.push(data);
        return;
    }

    await coreMessageHandler(e);
};
