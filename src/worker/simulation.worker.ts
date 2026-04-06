import { BoardRunner, createRunnerForBoard, LOGIC_REGISTRY, COMPONENT_PINS, buildFatFsImage, buildLittleFsImage } from './execute';
import { BaseComponent } from '@openhw/emulator/src/components/BaseComponent.ts';
import {
    isProgrammableBoardType,
    resolveUartRoute,
    areBoardsSoftSerialConnected,
} from './protocol-routing.js';

let runner: BoardRunner | null = null;
let boardRunners: Map<string, BoardRunner> = new Map();
let boardTypes: Map<string, string> = new Map();
let mode: 'single' | 'multi' = 'single';
let pinToNet: Map<string, number> = new Map();
let boardSerialOutput: Map<string, string> = new Map();
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

const RP2040_LOGICAL_FLASH_BYTES = 2 * 1024 * 1024;
const RP2040_MICROPYTHON_FS_OFFSET = 0xA0000;
const RP2040_CIRCUITPYTHON_FS_OFFSET = 0xC0000;
const RP2040_LITTLEFS_BLOCK_SIZE = 4096;

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

type Rp2040RuntimeEnv = 'native' | 'micropython' | 'circuitpython';

function normalizeRp2040RuntimeEnv(source: unknown): Rp2040RuntimeEnv {
    const value = String(source || '').trim().toLowerCase();
    if (!value || value === 'none' || value === 'native' || value === 'ino') return 'native';
    if (value === 'cp' || value === 'circuitpy' || value === 'circuitpython' || value.startsWith('circuitpython')) {
        return 'circuitpython';
    }
    if (value === 'py' || value === 'python' || value === 'micropython' || value.startsWith('micropython')) {
        return 'micropython';
    }
    return 'native';
}

function isRp2040PythonRuntimeEnv(env: Rp2040RuntimeEnv): boolean {
    return env === 'micropython' || env === 'circuitpython';
}

function getRp2040PythonFsOffset(env: Rp2040RuntimeEnv): number {
    return env === 'circuitpython'
        ? RP2040_CIRCUITPYTHON_FS_OFFSET
        : RP2040_MICROPYTHON_FS_OFFSET;
}

function getRp2040PythonFsBytes(env: Rp2040RuntimeEnv): number {
    const offset = getRp2040PythonFsOffset(env);
    return Math.max(0, RP2040_LOGICAL_FLASH_BYTES - offset);
}

function getRp2040PythonEntryFileName(env: Rp2040RuntimeEnv): string {
    return env === 'circuitpython' ? 'code.py' : 'main.py';
}

function normalizeRp2040RuntimePath(pathLike: unknown): string {
    const normalized = String(pathLike || '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .trim();
    if (!normalized) return '';

    const parts = normalized
        .split('/')
        .map((part) => part.trim())
        .filter((part) => part && part !== '.' && part !== '..');

    return parts.join('/');
}

function collectRp2040RuntimeFiles(
    boardId: string,
    env: Rp2040RuntimeEnv,
    boardPythonFilesMap: any,
    boardPythonMap: any
): Array<{ path: string; data: string }> {
    const filesByPath = new Map<string, string>();
    const addFile = (rawPath: unknown, rawContent: unknown) => {
        const path = normalizeRp2040RuntimePath(rawPath);
        if (!path) return;
        const content = typeof rawContent === 'string'
            ? rawContent
            : String(rawContent ?? '');
        filesByPath.set(path, content);
    };

    const fromMap = boardPythonFilesMap?.[boardId];
    if (Array.isArray(fromMap)) {
        for (const entry of fromMap) {
            if (!entry || typeof entry !== 'object') continue;
            addFile((entry as any).path, (entry as any).content ?? (entry as any).data);
        }
    } else if (fromMap && typeof fromMap === 'object') {
        for (const [filePath, content] of Object.entries(fromMap)) {
            addFile(filePath, content);
        }
    }

    const fallbackScript = typeof boardPythonMap?.[boardId] === 'string'
        ? String(boardPythonMap[boardId] || '')
        : '';
    if (fallbackScript.trim()) {
        const entryFile = getRp2040PythonEntryFileName(env);
        const existing = String(filesByPath.get(entryFile) || '');
        if (!existing.trim()) {
            filesByPath.set(entryFile, fallbackScript);
        }
    }

    return Array.from(filesByPath.entries()).map(([path, data]) => ({ path, data }));
}

function buildCircuitPythonInjectedScript(runtimeFiles: Array<{ path: string; data: string }>): string {
    const files = Array.isArray(runtimeFiles) ? runtimeFiles : [];
    if (files.length === 0) return '';

    const normalizeModuleName = (runtimePath: string): string | null => {
        const normalized = normalizeRp2040RuntimePath(runtimePath);
        if (!normalized || !normalized.toLowerCase().endsWith('.py')) return null;
        if (normalized.includes('/')) return null;
        const stem = normalized.slice(0, -3);
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(stem)) return null;
        if (stem === 'code' || stem === 'main') return null;
        return stem;
    };

    const escapeRegExp = (value: string): string => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const mainFile = files.find((file) => String(file.path || '').toLowerCase() === 'code.py')
        || files.find((file) => String(file.path || '').toLowerCase() === 'main.py')
        || files.find((file) => String(file.path || '').toLowerCase().endsWith('.py'))
        || null;
    if (!mainFile) return '';

    let mainSource = String(mainFile.data || '');
    const lines: string[] = [];

    for (const file of files) {
        const moduleName = normalizeModuleName(String(file.path || ''));
        if (!moduleName) continue;

        const importFromPattern = new RegExp(`^\\s*from\\s+${escapeRegExp(moduleName)}\\s+import\\s+.*$`, 'gm');
        const importModulePattern = new RegExp(`^\\s*import\\s+${escapeRegExp(moduleName)}\\s*$`, 'gm');
        mainSource = mainSource.replace(importFromPattern, '');
        mainSource = mainSource.replace(importModulePattern, '');

        lines.push(String(file.data || ''));
        lines.push('');
    }

    lines.push(mainSource);
    lines.push('');
    return lines.join('\n');
}

function appendBoardSerialOutput(boardId: string, chunk: string) {
    const id = String(boardId || '').trim();
    if (!id || !chunk) return;
    const prev = boardSerialOutput.get(id) || '';
    const merged = `${prev}${chunk}`;
    boardSerialOutput.set(id, merged.length > 8192 ? merged.slice(-8192) : merged);
}

function scheduleCircuitPythonInject(
    target: BoardRunner,
    boardId: string,
    runtimeFiles: Array<{ path: string; data: string }>,
    delayMs = 1800,
) {
    const script = buildCircuitPythonInjectedScript(runtimeFiles);
    if (!script.trim()) return;

    let transportSource: 'usb' | 'uart0' = 'usb';

    const sendByte = (byte: number) => {
        const targetAny = target as any;
        if (typeof targetAny.serialRxByteFromSource === 'function') {
            targetAny.serialRxByteFromSource(byte & 0xff, transportSource);
        } else if (typeof targetAny.serialRxByte === 'function') {
            targetAny.serialRxByte(byte & 0xff);
        } else if (typeof targetAny.serialRx === 'function') {
            targetAny.serialRx(String.fromCharCode(byte & 0xff));
        }
    };

    const streamText = (text: string, chunkSize = 24, everyMs = 4) => {
        const bytes = Array.from(String(text || ''), (ch) => ch.charCodeAt(0) & 0xff);
        if (bytes.length === 0) return;

        let index = 0;
        const streamTimer = setInterval(() => {
            const end = Math.min(index + chunkSize, bytes.length);
            for (let i = index; i < end; i++) sendByte(bytes[i]);
            index = end;
            if (index >= bytes.length) {
                clearInterval(streamTimer);
            }
        }, Math.max(1, Number(everyMs || 1)));
    };

    const startAt = Date.now();
    let injected = false;
    const pollTimer = setInterval(() => {
        if (injected) return;

        const usbReady = !!(target as any)?.usbCdcReady;
        const waitedMs = Date.now() - startAt;
        if (!usbReady && waitedMs < Math.max(9000, Number(delayMs || 0))) {
            return;
        }

        transportSource = usbReady ? 'usb' : 'uart0';

        injected = true;
        clearInterval(pollTimer);

        // Enter raw REPL first; send script only after prompt appears.
        streamText('x\r\u0003\u0003', 1, 18);
        setTimeout(() => {
            streamText('\u0001', 1, 18);
        }, 120);

        const rawPromptStartedAt = Date.now();
        let scriptDispatched = false;
        const dispatchScript = () => {
            if (scriptDispatched) return;
            scriptDispatched = true;
            streamText(`${script}\n\u0004`, 24, 4);
        };

        const rawPromptPoll = setInterval(() => {
            if (scriptDispatched) {
                clearInterval(rawPromptPoll);
                return;
            }

            const waitedMs = Date.now() - rawPromptStartedAt;
            const serialText = boardSerialOutput.get(String(boardId || '').trim()) || '';
            if (/raw REPL; CTRL-B to exit/.test(serialText)) {
                dispatchScript();
                clearInterval(rawPromptPoll);
                return;
            }

            if (waitedMs >= 2200) {
                dispatchScript();
                clearInterval(rawPromptPoll);
            }
        }, 80);
    }, 120);
}

async function buildRp2040FlashPartitions(
    boardId: string,
    env: Rp2040RuntimeEnv,
    boardPythonFilesMap: any,
    boardPythonMap: any
): Promise<Array<{ offset: number; data: Uint8Array }> | undefined> {
    if (!isRp2040PythonRuntimeEnv(env)) return undefined;

    const runtimeFiles = collectRp2040RuntimeFiles(boardId, env, boardPythonFilesMap, boardPythonMap);
    if (runtimeFiles.length === 0) return undefined;

    const fsOffset = getRp2040PythonFsOffset(env);
    const fsBytes = getRp2040PythonFsBytes(env);
    if (fsBytes <= 0) return undefined;

    const image = env === 'circuitpython'
        ? buildFatFsImage(runtimeFiles, {
            sizeBytes: fsBytes,
            volumeLabel: 'CIRCUITPY',
        })
        : await buildLittleFsImage(runtimeFiles, {
            sizeBytes: fsBytes,
            blockSize: RP2040_LITTLEFS_BLOCK_SIZE,
        });
    if (!image || image.length === 0) return undefined;

    return [{
        offset: fsOffset,
        data: image,
    }];
}

function buildMicroPythonPastePayload(scriptSource: string): string {
    const normalized = String(scriptSource || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .map((line) => line.replace(/\u0004/g, ''))
        .join('\r\n');
    // Ctrl-C, Ctrl-C, Ctrl-E (paste mode), script, Ctrl-D (execute)
    return `\u0003\u0003\u0005${normalized}\r\n\u0004`;
}

function buildMicroPythonRawPayload(scriptSource: string): string {
    const normalized = String(scriptSource || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .map((line) => line.replace(/\u0004/g, ''))
        .join('\n');
    // Ctrl-A (raw REPL), script, Ctrl-D (execute).
    // Do not prepend Ctrl-C here: probe kicks already interrupt to prompt,
    // and extra Ctrl-C bytes can leak into execution as KeyboardInterrupt.
    return `\u0001${normalized}\n\u0004`;
}

function buildMicroPythonReplProbe(boardId: string): string {
    void boardId;
    // Non-interrupting probe: nudge REPL to emit a prompt without injecting
    // Ctrl-C, which can otherwise break user scripts with KeyboardInterrupt.
    return '\r\n';
}

/**
 * Waits until the MicroPython REPL '>>>' prompt appears on the board UART,
 * then sends the script once via raw-REPL mode. Falls back after `timeoutMs` ms.
 *
 * Works by monkey-patching the runner's onStateUpdate to sniff serial bytes
 * from the cpu.uart[0] callback, without interfering with the existing flow.
 */
function scheduleMicroPythonInject(
    target: BoardRunner,
    boardId: string,
    pyScript: string,
    baudOverride: number,
    timeoutMs = 12000
): void {
    const rawPayload = buildMicroPythonRawPayload(pyScript);
    const replProbePayload = buildMicroPythonReplProbe(boardId);
    const startedAt = Date.now();
    let uartBuf = '';
    let finalized = false;
    let probeTimer: any = null;
    let timeoutGuard: any = null;
    let injectedOnce = false;
    let restoreUart0OnByte: (() => void) | null = null;

    const clearTimers = () => {
        if (probeTimer) {
            clearInterval(probeTimer);
            probeTimer = null;
        }
        if (timeoutGuard) {
            clearTimeout(timeoutGuard);
            timeoutGuard = null;
        }
    };

    const finalize = () => {
        if (finalized) return;
        finalized = true;
        clearTimers();
        if (restoreUart0OnByte) {
            restoreUart0OnByte();
            restoreUart0OnByte = null;
        }
    };

    const sendProbe = () => {
        if (finalized) return;
        if (!target) return;

        // Keep REPL responsive and request a prompt.
        target.setSerialBaudRate(baudOverride);
        target.serialRx(replProbePayload);
    };

    const sendRawOnce = () => {
        if (finalized || injectedOnce) return;
        if (!target) return;

        injectedOnce = true;
        // Drop stale probe bytes so raw payload starts cleanly.
        const targetAny = target as any;
        if (Array.isArray(targetAny?.serialBuffer)) {
            targetAny.serialBuffer.length = 0;
        }
        target.setSerialBaudRate(baudOverride);
        target.serialRx(rawPayload);
        finalize();
    };

    const shouldForceInjectFromBootTraffic = () => {
        const targetAny = target as any;
        const waitedMs = Date.now() - startedAt;
        if (waitedMs < 2200) return false;

        const txBytes = Number(targetAny?.debugSerialTxBytes || 0);
        const activeUart = Number(targetAny?.activeUartIndex ?? -1);
        const usbReady = !!targetAny?.usbCdcReady;

        // USB-first MicroPython builds can expose prompt/output on USB CDC while
        // uart[0] prompt sniffing stays quiet. Use tx activity as readiness signal.
        if (txBytes >= 64 && (activeUart === 2 || usbReady)) return true;
        if (txBytes >= 192) return true;
        return false;
    };

    // Sniff UART output by wrapping the cpu uart onByte callback.
    // rp2040js exposes cpu.uart[0].onByte – we chain onto it.
    const patchUart = () => {
        const cpu = (target as any).cpu;
        if (!cpu?.uart?.[0]) return false;
        const prev = cpu.uart[0].onByte;
        const patched = (value: number) => {
            if (prev) prev(value);
            if (finalized) return;

            uartBuf += String.fromCharCode(value);
            if (uartBuf.length > 32) uartBuf = uartBuf.slice(-32);

            if (uartBuf.includes('>>>')) {
                sendRawOnce();
            }
        };
        cpu.uart[0].onByte = patched;
        restoreUart0OnByte = () => {
            if ((cpu as any)?.uart?.[0]?.onByte === patched) {
                cpu.uart[0].onByte = prev;
            }
        };
        return true;
    };

    // The cpu may not be initialised exactly when we schedule, retry briefly.
    let patchAttempts = 0;
    const tryPatch = () => {
        if (finalized) return;
        if (patchUart()) return; // success
        if (++patchAttempts < 10) setTimeout(tryPatch, 50);
    };
    tryPatch();

    // Initial kick after boot; only probes here, no script payload yet.
    setTimeout(() => {
        if (finalized) return;
        sendProbe();
    }, 1400);

    // Repeat probe while waiting for prompt; inject once when detected.
    probeTimer = setInterval(() => {
        if (finalized) {
            clearTimers();
            return;
        }
        if (shouldForceInjectFromBootTraffic()) {
            sendRawOnce();
            return;
        }
        sendProbe();
    }, 2800);

    // Final guard: if prompt sniff fails, inject exactly once anyway.
    timeoutGuard = setTimeout(() => {
        if (!finalized) {
            sendRawOnce();
        }
    }, timeoutMs);
}

function stopAllRunners() {
    if (runner) {
        runner.stop();
        runner = null;
    }
    boardRunners.forEach((r) => r.stop());
    boardRunners.clear();
    boardTypes.clear();
    pinToNet.clear();
    boardSerialOutput.clear();
    syncValidationEnabled = false;
    resetSyncValidationState();
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

function resolveRp2040ExecutableRanges(boardComp: any, boardExecutableRangesMap: any): any[] | undefined {
    const boardId = String(boardComp?.id || '').trim();
    const fromMap = boardId ? boardExecutableRangesMap?.[boardId] : undefined;
    const fromAttrs = boardComp?.attrs?.rp2040ExecutableRanges;
    const candidate = fromMap ?? fromAttrs;
    return Array.isArray(candidate) ? candidate : undefined;
}

function postRunnerState(stateObj: any, boardId: string) {
    const resolvedBoardId = String(stateObj?.boardId || boardId || 'default').trim() || 'default';

    if (mode === 'single') {
        const msg = (stateObj && typeof stateObj === 'object')
            ? { ...stateObj, boardId: resolvedBoardId }
            : stateObj;
        postMessage(msg);
        emitSyncHeartbeat(resolvedBoardId, msg);
        return;
    }

    if (stateObj.type !== 'state') {
        postMessage({ ...stateObj, boardId: resolvedBoardId });
        return;
    }

    const msg: any = { type: 'state', boardId: resolvedBoardId };

    if (stateObj.pins) msg.pins = stateObj.pins;

    if (stateObj.analog) msg.analog = stateObj.analog;
    if (stateObj.components) msg.components = stateObj.components;
    postMessage(msg);
    emitSyncHeartbeat(resolvedBoardId, msg);
}

function isSoftSerialLabel(label: string): boolean {
    const key = String(label || '').trim().toLowerCase();
    return key === 'softserial' || key === 'soft-serial' || key === 'soft_uart' || key === 'soft-uart' || key === 'softuart';
}

function routeUartByte(sourceBoardId: string, value: number, sourceLabel = 'uart0') {
    const sourceRunner = boardRunners.get(sourceBoardId);
    const sourceType = boardTypes.get(sourceBoardId) || '';
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
}

self.onmessage = async (e) => {
    const data = e.data;

    if (data.type === 'START') {
        const {
            hex,
            components,
            wires,
            customLogics,
            boardHexMap,
            boardPythonMap,
            boardPythonFilesMap,
            boardRuntimeEnvMap,
            baudRate,
            boardBaudMap,
            boardExecutableRangesMap,
            debugRp2040,
            debugSyncHeartbeat,
        } = data;
        const rp2040DebugEnabled = !!debugRp2040;

        stopAllRunners();
        syncValidationEnabled = !!debugSyncHeartbeat;
        resetSyncValidationState();

        // --- INJECT TEMPORARY SANDBOX LOGIC ---
        if (customLogics && Array.isArray(customLogics)) {
            customLogics.forEach((cl: any) => {
                try {
                    const exportsObj: any = {};
                    const requireFn = (mod: string) => {
                        if (mod.includes('BaseComponent')) return { BaseComponent };
                        return {};
                    };
                    const evalFn = new Function('exports', 'require', cl.code);
                    evalFn(exportsObj, requireFn);

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
            const singleBoardType = String(singleBoardComp?.type || 'wokwi-arduino-uno');
            const singleBoardId = singleBoardComp?.id;
            const pyScript = singleBoardId ? String(boardPythonMap?.[singleBoardId] || '') : '';
            const singleBoardIsRp2040 = /(rp2040|pico)/i.test(singleBoardType);
            const singleBoardExecutableRanges = resolveRp2040ExecutableRanges(singleBoardComp, boardExecutableRangesMap);
            const singleBoardRuntimeEnv: Rp2040RuntimeEnv = singleBoardIsRp2040
                ? normalizeRp2040RuntimeEnv(boardRuntimeEnvMap?.[singleBoardId] ?? singleBoardComp?.attrs?.env)
                : 'native';
            const singleBoardRuntimeFiles = singleBoardIsRp2040 && singleBoardId && singleBoardRuntimeEnv !== 'native'
                ? collectRp2040RuntimeFiles(singleBoardId, singleBoardRuntimeEnv, boardPythonFilesMap, boardPythonMap)
                : [];

            const singleBoardFlashPartitions = singleBoardIsRp2040 && singleBoardId
                ? await buildRp2040FlashPartitions(singleBoardId, singleBoardRuntimeEnv, boardPythonFilesMap, boardPythonMap)
                : undefined;

            if (singleBoardIsRp2040 && singleBoardRuntimeEnv !== 'native' && (!singleBoardFlashPartitions || singleBoardFlashPartitions.length === 0)) {
                console.warn(`[Worker] RP2040 Python filesystem unavailable for ${singleBoardId}; falling back where possible.`);
            }

            const shouldInjectPythonOverUart = singleBoardIsRp2040
                && singleBoardRuntimeEnv !== 'native'
                && (!singleBoardFlashPartitions || singleBoardFlashPartitions.length === 0)
                && !!pyScript.trim();

            runner = createRunnerForBoard(
                singleBoardType,
                hex,
                components,
                wires,
                (stateObj) => postRunnerState(stateObj, singleBoardId || 'default'),
                {
                    boardId: singleBoardId,
                    serialBaudRate: Number(boardBaudMap?.[singleBoardId] ?? baudRate ?? 9600),
                    debugEnabled: singleBoardIsRp2040 && rp2040DebugEnabled,
                    debugIntervalMs: singleBoardIsRp2040 && rp2040DebugEnabled ? 1200 : 0,
                    // Pass pyScript metadata so the worker can inject over UART0 after boot.
                    pyScript: typeof pyScript === 'string' ? pyScript : '',
                    onByteTransmit: ({ boardId, value, char, source }) => {
                        appendBoardSerialOutput(String(boardId || ''), String(char || ''));
                        postMessage({ type: 'serial', data: char, boardId, value, source });
                    },
                    rp2040ExecutableRanges: singleBoardIsRp2040 ? singleBoardExecutableRanges : undefined,
                    rp2040LogicalFlashBytes: singleBoardIsRp2040 ? RP2040_LOGICAL_FLASH_BYTES : undefined,
                    rp2040FlashPartitions: singleBoardIsRp2040 ? singleBoardFlashPartitions : undefined,
                }
            );

            if (singleBoardId) {
                boardTypes.set(singleBoardId, singleBoardType);
                boardSerialOutput.set(singleBoardId, '');
                if (shouldInjectPythonOverUart && (runner as any)?.cpu?.uart?.[0]) {
                    scheduleMicroPythonInject(
                        runner!,
                        singleBoardId,
                        pyScript,
                        Number(boardBaudMap?.[singleBoardId] ?? 115200)
                    );
                }
                if (singleBoardIsRp2040 && singleBoardRuntimeEnv === 'circuitpython' && singleBoardRuntimeFiles.length > 0) {
                    scheduleCircuitPythonInject(runner!, singleBoardId, singleBoardRuntimeFiles);
                }
            }
            return;
        }

        mode = 'multi';
        buildNetIndex(wires || []);

        const uartInjectionScripts = new Map<string, string>();
        const circuitPythonInjectionFiles = new Map<string, Array<{ path: string; data: string }>>();

        for (const boardComp of programmableBoards) {
            const fwHex = boardHexMap?.[boardComp.id] || boardComp?.attrs?.firmwareHex || boardComp?.attrs?.hex;
            const executableRanges = resolveRp2040ExecutableRanges(boardComp, boardExecutableRangesMap);
            if (typeof fwHex !== 'string' || !fwHex.trim()) {
                console.warn(`[Worker] Skipping board ${boardComp.id}: no board-specific firmware available.`);
                continue;
            }
            const runnerComponents = [boardComp, ...sharedPeripheralComponents];
            const pyScript = String(boardPythonMap?.[boardComp.id] || '');
            const isRp2040Board = /(rp2040|pico)/i.test(String(boardComp.type || ''));
            const rp2040RuntimeEnv: Rp2040RuntimeEnv = isRp2040Board
                ? normalizeRp2040RuntimeEnv(boardRuntimeEnvMap?.[boardComp.id] ?? boardComp?.attrs?.env)
                : 'native';
            const rp2040RuntimeFiles = isRp2040Board && rp2040RuntimeEnv !== 'native'
                ? collectRp2040RuntimeFiles(boardComp.id, rp2040RuntimeEnv, boardPythonFilesMap, boardPythonMap)
                : [];
            const rp2040FlashPartitions = isRp2040Board
                ? await buildRp2040FlashPartitions(boardComp.id, rp2040RuntimeEnv, boardPythonFilesMap, boardPythonMap)
                : undefined;

            if (isRp2040Board && rp2040RuntimeEnv !== 'native' && (!rp2040FlashPartitions || rp2040FlashPartitions.length === 0)) {
                console.warn(`[Worker] RP2040 Python filesystem unavailable for ${boardComp.id}; falling back where possible.`);
            }
            if (
                isRp2040Board
                && rp2040RuntimeEnv !== 'native'
                && (!rp2040FlashPartitions || rp2040FlashPartitions.length === 0)
                && pyScript.trim()
            ) {
                uartInjectionScripts.set(boardComp.id, pyScript);
            }
            if (isRp2040Board && rp2040RuntimeEnv === 'circuitpython' && rp2040RuntimeFiles.length > 0) {
                circuitPythonInjectionFiles.set(boardComp.id, rp2040RuntimeFiles);
            }

            const boardRunner = createRunnerForBoard(
                String(boardComp.type || ''),
                typeof fwHex === 'string' ? fwHex : '',
                runnerComponents,
                wires,
                (stateObj) => postRunnerState(stateObj, boardComp.id),
                {
                    boardId: boardComp.id,
                    serialBaudRate: Number(boardBaudMap?.[boardComp.id] ?? baudRate ?? 9600),
                    debugEnabled: /(rp2040|pico)/i.test(String(boardComp.type || '')) && rp2040DebugEnabled,
                    debugIntervalMs: /(rp2040|pico)/i.test(String(boardComp.type || '')) && rp2040DebugEnabled ? 1200 : 0,
                    pyScript: typeof pyScript === 'string' ? pyScript : '',
                    onByteTransmit: ({ boardId, value, char, source }) => {
                        appendBoardSerialOutput(String(boardId || ''), String(char || ''));
                        postMessage({ type: 'serial', data: char, boardId, value, source });
                        routeUartByte(boardId, value, source || 'uart0');
                    },
                    rp2040ExecutableRanges: isRp2040Board ? executableRanges : undefined,
                    rp2040LogicalFlashBytes: isRp2040Board ? RP2040_LOGICAL_FLASH_BYTES : undefined,
                    rp2040FlashPartitions: isRp2040Board ? rp2040FlashPartitions : undefined,
                }
            );

            boardRunners.set(boardComp.id, boardRunner);
            boardTypes.set(boardComp.id, String(boardComp.type || ''));
            boardSerialOutput.set(boardComp.id, '');
        }

        for (const [boardId, pyScript] of uartInjectionScripts.entries()) {
            const target = boardRunners.get(boardId);
            if (!target) continue;
            if ((target as any)?.cpu?.uart?.[0]) {
                scheduleMicroPythonInject(
                    target,
                    boardId,
                    pyScript,
                    Number(boardBaudMap?.[boardId] ?? 115200)
                );
            }
        }

        for (const [boardId, runtimeFiles] of circuitPythonInjectionFiles.entries()) {
            const target = boardRunners.get(boardId);
            if (!target) continue;
            scheduleCircuitPythonInject(target, boardId, runtimeFiles);
        }

    } else if (data.type === 'STOP') {
        stopAllRunners();
    } else if (data.type === 'INTERACT') {
        console.log(`[Worker] Received INTERACT for ${data.compId}: ${data.event}`);

        if (mode === 'single' && runner) {
            const inst = runner.instances.get(data.compId);
            if (inst && typeof inst.onEvent === 'function') {
                inst.onEvent(data.event);
            }
        } else {
            let delivered = false;
            for (const boardRunner of boardRunners.values()) {
                const inst = boardRunner.instances.get(data.compId);
                if (inst && typeof inst.onEvent === 'function') {
                    inst.onEvent(data.event);
                    delivered = true;
                }
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
    } else if (data.type === 'SERIAL_SET_BAUD') {
        const parsedBaud = Number(data.baudRate);
        if (!Number.isFinite(parsedBaud)) {
            return;
        }

        if (mode === 'single' && runner) {
            runner.setSerialBaudRate(parsedBaud);
        } else if (data.targetBoardId) {
            const target = boardRunners.get(data.targetBoardId);
            if (!target) return;
            target.setSerialBaudRate(parsedBaud);
        } else {
            boardRunners.forEach((boardRunner) => {
                boardRunner.setSerialBaudRate(parsedBaud);
            });
        }
    } else if (data.type === 'SERIAL_INPUT') {
        if (mode === 'single' && runner) {
            if (data.baudRate) runner.setSerialBaudRate(Number(data.baudRate));
            runner.serialRx(data.data);
        } else {
            if (data.targetBoardId) {
                if (!boardRunners.has(data.targetBoardId)) {
                    return;
                }
                const target = boardRunners.get(data.targetBoardId)!;
                if (data.baudRate) target.setSerialBaudRate(Number(data.baudRate));
                target.serialRx(data.data);
            } else {
                boardRunners.forEach((boardRunner) => {
                    if (data.baudRate) boardRunner.setSerialBaudRate(Number(data.baudRate));
                    boardRunner.serialRx(data.data);
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
        }
        if (syncValidationEnabled) {
            resetSyncValidationState();
        }
    }
};
