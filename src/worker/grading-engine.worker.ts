if (typeof window === 'undefined') {
    (self as any).window = self;
    (self as any).document = {
        createElement: () => ({ style: {} }),
        getElementsByTagName: () => [],
        createTextNode: () => ({}),
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {},
        removeEventListener: () => {},
    };
}
(self as any).$RefreshReg$ = () => {};
(self as any).$RefreshSig$ = () => () => (type: any) => type;


console.log("[HEARTBEAT] Worker [v3.8]: Environment Polyfilled.");
self.postMessage({ type: 'LOG', msg: "Worker is ALIVE (Dynamic Loader Mode)." });
console.log("[WORKER VERSION] grading-engine.worker.ts v3.9-debug");

function timeStamp() {
    return new Date().toLocaleTimeString();
}
const jsonLogs: any[] = [];

function sendJsonLog(message: string, level = 'info', source = 'grading-engine') {
    const payload = { time: timeStamp(), source, level, message };
    jsonLogs.push(payload);
    self.postMessage({ type: 'LOG_JSON', payload });
}

let wasmExports: any = null;
let emulatorExports: any = null;
let isInitialized = false;
let initPromise: Promise<void> | null = null;

async function initEngine() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
        try {
            if (isInitialized) return;
            console.log("[HEARTBEAT] Worker: initEngine() started...");
            sendJsonLog('Initializing Grading Engine (Rust/WASM)...', 'info');

            // 1. Dynamic WASM Glue
            wasmExports = await import('../wasm/grading/openhw_studio_grading_engine.js');
            const wasmUrlMod = await import('../wasm/grading/openhw_studio_grading_engine_bg.wasm?url');
            const wasmUrl = String((wasmUrlMod as any).default || wasmUrlMod);

            await wasmExports.default(wasmUrl);
            console.log("[HEARTBEAT] Worker: WASM initialized.");
            console.log("[HEARTBEAT] Worker: WASM Exports available:", Object.keys(wasmExports || {}));

            if (wasmExports && wasmExports.init_panic_hook) wasmExports.init_panic_hook();

            // 2. Dynamic Emulator Logic
            postMessage({ type: 'LOG', msg: "Loading Emulator Validator logic..." });
            emulatorExports = await import("@openhw/emulator");
            console.log("[HEARTBEAT] Worker: Emulator logic loaded. Keys:", Object.keys(emulatorExports || {}));

            // Basic validation of emulator exports
            if (!emulatorExports || !emulatorExports.FullCircuitValidator || !emulatorExports.analyzeCodeHardwareSync || !emulatorExports.runUnifiedValidation) {
                throw new Error('Emulator exports missing required symbols (FullCircuitValidator, analyzeCodeHardwareSync, runUnifiedValidation)');
            }

            isInitialized = true;
            sendJsonLog('Grading Engine (WASM + Logic) Ready.', 'info');
        } catch (err: any) {
            console.error("[HEARTBEAT] Worker: DYNAMIC INIT FAILED:", err);
            postMessage({ type: 'LOG', msg: `CRITICAL: Init Failed: ${err?.message || String(err)}`, logType: 'error' });
            initPromise = null; // allow retry on next call
            throw err;
        }
    })();
    return initPromise;
}

// Global error handler
self.onerror = (msg, url, lineNo, columnNo, error) => {
    console.error(`Grading Worker Error: ${msg} at ${lineNo}:${columnNo}`, error);
    (self as any).postMessage({ type: 'LOG', msg: `WORKER CRASH: ${msg}`, logType: 'error' });
    return false;
};

interface GradingOptions {
    exact_match: boolean;
    check_breadboard: boolean;
    check_overlap: boolean;
    ignore_pin_changes: boolean;
}

interface TeacherData {
    project: string;
    telemetry: string;
}

interface GradingMessage {
    type: 'GENERATE_KEY' | 'GRADE';
    teacher: TeacherData | Uint8Array;
    student?: ArrayBuffer;
    studentTelemetry?: string;
    options: GradingOptions;
    simulationSpeed?: number;
}

import { getBoardCompileFiles, extractProjectMetaFromPng } from '../utils/projectCompilerUtils';

function mapBoardToFqbn(board: string): string {
    const s = String(board || '').toLowerCase();
    if (s.includes('uno')) return 'arduino:avr:uno';
    if (s.includes('mega')) return 'arduino:avr:mega';
    if (s.includes('nano')) return 'arduino:avr:nano';
    if (s.includes('esp32')) return 'esp32:esp32:esp32';
    if (s.includes('stm32')) return 'STMicroelectronics:stm32:GenF1';
    if (s.includes('rp2040') || s.includes('pico')) return 'rp2040:rp2040:rpipico';
    return 'arduino:avr:uno';
}

let engineConfig = {
    compilerUrl: 'http://localhost:5001/api/compile'
};

async function compileSourceCode(payload: any, board: string): Promise<string> {
    const COMPILER_URL = engineConfig.compilerUrl;
    const fqbn = mapBoardToFqbn(board);
    
    console.log(`[v2.8] Requesting compilation for ${fqbn} (Sketch: ${payload.sketchName})...`);
    
    try {
        const response = await fetch(COMPILER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                ...payload,
                board: fqbn 
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            const errorMsg = data.error || data.message || 'Unknown compiler error';
            const hint = data.diagnostics?.hint ? ` Hint: ${data.diagnostics.hint}` : '';
            const details = data.details ? `\nDetails: ${data.details}` : '';
            throw new Error(`${errorMsg}${hint}${details} (Status: ${response.status})`);
        }

        if (data && data.hex) return data.hex;
        throw new Error('Backend returned success but no HEX binary was found in response.');
    } catch (err: any) {
        throw new Error(`[Network/API Error] ${err?.message || String(err)}`);
    }
}

async function captureBehavior(meta: any, durationMs: number, label: string, simulationSpeed = 1, useSimTimeCapture = true): Promise<any> {
    const TELEMETRY_CUTOFF_MS = 7900;
    const telemetry = {
        events: [] as any[],
        serial: "",
        duration_ms: durationMs,
        error: null as string | null,
        crashed: false,
        rich_metrics: null as string | null
    };

    let lastComponentStates: Record<string, any> = {};
    let lastComponentMetrics: Record<string, any> = {};  // Track all component metrics, not just custom
    let lastPinStates: Record<string, boolean> = {};
    let runner: any = null;
    const startTime = Date.now();
    const wallTimeoutMs = 35000;
    const normalizedSpeed = Number.isFinite(simulationSpeed) && simulationSpeed > 0 ? simulationSpeed : 1;
    const effectiveCutoffMs = Math.min(durationMs, TELEMETRY_CUTOFF_MS);

    const pushTelemetryEvent = (event: any, nowMs: number): boolean => {
        if (!Number.isFinite(nowMs) || nowMs > effectiveCutoffMs) {
            return false;
        }
        telemetry.events.push(event);
        return true;
    };

    try {
        const { createRunnerForBoard } = await import('./execute');
        const boardComp = (meta.components || []).find((c: any) => /(arduino|esp32|stm32|rp2040|pico)/i.test(String(c.type || '')));
        
        const boardCompId = boardComp?.id || 'uno1';
        const boardType = boardComp?.type || meta.board || 'openhw-arduino-uno';
        const isRp2040Board = /rp2040|pico/i.test(String(boardType));
        const effectiveUseSimTimeCapture = useSimTimeCapture && !isRp2040Board;
        const compileUnit: any = getBoardCompileFiles(meta, boardCompId);
        
        let firmwareHex = meta.hex || boardComp?.attrs?.firmwareHex || boardComp?.attrs?.hex || "";

        // Detection: Is this source code instead of HEX?
        const sourceCode = compileUnit.mainCode || "";
        const isSourceCode = sourceCode.startsWith('#') || 
                             sourceCode.includes('void setup') || 
                             sourceCode.includes('void loop') ||
                             sourceCode.includes('int main');
        
        if (isSourceCode && !firmwareHex) {
            postMessage({ type: 'LOG', msg: `[v2.8] ${label}: Source code detected (${sourceCode.length} chars). Compiling for ${boardCompId}...` });
            // Log the full code for inspection
            postMessage({ type: 'LOG', msg: `--- BEGIN SOURCE ---\n${sourceCode}\n--- END SOURCE ---` });
            
            try {
                firmwareHex = await compileSourceCode({
                    code: sourceCode,
                    files: compileUnit.files,
                    sketchName: compileUnit.sketchName
                }, boardType);
                postMessage({ type: 'LOG', msg: `[v2.8] ${label}: Compilation successful.` });
            } catch (compileErr: any) {
                postMessage({ type: 'LOG', msg: `[v2.8] Warning: ${label} compilation failed: ${compileErr?.message || String(compileErr)}`, logType: 'warning' });
            }
        }

        if (useSimTimeCapture && !effectiveUseSimTimeCapture) {
            postMessage({ type: 'LOG', msg: `[TRACE] ${label}: Falling back to wall-clock capture for ${boardType} to avoid sim-time stalls.` });
        }

        console.log(`[TRACE] ${label}: Starting capture behavior. Source detected: ${isSourceCode}, Hex Length: ${firmwareHex?.length || 0}`);
        postMessage({ type: 'LOG', msg: `[TRACE] ${label}: Initializing Runner for ${boardType} at ${normalizedSpeed}x speed (telemetry cutoff: ${effectiveCutoffMs}ms)...` });

        runner = await createRunnerForBoard(
            boardType,
            firmwareHex,
            meta.components || [],
            meta.connections || [],
            (state: any) => {
                const nowMs = runner?.getSimulatedTimeMs?.() ?? 0;
                if (state.type === 'state' && state.pins) {
                    for (const pinId in state.pins) {
                        const newState = !!state.pins[pinId];
                        const prevState = lastPinStates[pinId];
                        // First observation is treated as baseline, not an edge event.
                        if (prevState === undefined) {
                            lastPinStates[pinId] = newState;
                            continue;
                        }
                        if (newState !== prevState) {
                            pushTelemetryEvent({
                                PinChange: { pin: pinId, state: newState, time_ms: nowMs }
                            }, nowMs);
                            lastPinStates[pinId] = newState;
                        }
                    }
                } else if (state.type === 'serial') {
                    pushTelemetryEvent({
                        SerialOutput: { data: state.data, time_ms: nowMs }
                    }, nowMs);
                    telemetry.serial += state.data;
                }
            },
            { speed: normalizedSpeed }
        );
        
        runner.setTelemetryEnabled(true);
        const captureWallStartMs = Date.now();
        let simStartMs = runner.getSimulatedTimeMs();
        let lastTraceTime = 0;
        let lastPollSimMs = simStartMs;
        let deepSnapshotCache: any | null = null;

        const emitComponentStateEvents = (snapshot: any, eventTimeMs: number, requireDelta: boolean) => {
            if (!snapshot?.components) {
                console.warn(`[EMIT DEBUG] No snapshot.components to process`);
                return;
            }
            
            let eventsEmitted = 0;
            
            for (const comp of snapshot.components) {
                const cid = comp.id;
                const compType = comp.type || 'unknown';
                
                // CRITICAL FIX: Normalize telemetry across snapshot shapes.
                // Some components expose data under metrics.custom, while others surface it as customTelemetry.
                const metrics = comp.metrics || {};
                const custom = metrics.custom || comp.customTelemetry || comp._metrics?.customTelemetry || {};
                const stateLike = comp.state && typeof comp.state === 'object' ? comp.state : {};
                const emitSource = Object.keys(custom).length > 0 ? custom : stateLike;
                
                // For each available field, check if it changed and emit event
                for (const key in emitSource) {
                    const val = emitSource[key];
                    const stateKey = `${cid}:${key}`;
                    const serialized = JSON.stringify(val);
                    const lastSerialized = lastComponentStates[stateKey];
                    
                    // Emit if:
                    // 1. First time seeing this key (baseline capture), OR
                    // 2. Value changed from last capture
                    if (lastSerialized === undefined || lastSerialized !== serialized) {
                        pushTelemetryEvent({
                            ComponentState: { id: cid, key: key, value: val, time_ms: eventTimeMs }
                        }, eventTimeMs);
                        lastComponentStates[stateKey] = serialized;
                        eventsEmitted++;
                    }
                }
                
                // Also capture other metrics that might be useful (not just custom)
                // Examples: pin toggles, io throughput, power profile
                if (!requireDelta) {
                    // For baseline (deep mode), capture initial state of all metrics for reference
                    const metricsSnapshot = {
                        updateFreq: metrics.updateFreq,
                        stateSize: metrics.stateSize,
                        ioThroughput: metrics.ioThroughput,
                        powerProfile: metrics.powerProfile,
                        pinToggles: metrics.pinToggles,
                        customTelemetry: custom,
                        state: stateLike
                    };
                    
                    const metricKey = `${cid}:_metrics`;
                    const metricSerialized = JSON.stringify(metricsSnapshot);
                    if (!lastComponentMetrics[cid] || lastComponentMetrics[cid] !== metricSerialized) {
                        lastComponentMetrics[cid] = metricSerialized;
                    }
                }
            }
            
            if (eventsEmitted > 0) {
                console.log(`[EMIT DEBUG] Emitted ${eventsEmitted} events from snapshot`);
            }
        };

        // Capture baseline component states once so teacher/student runs start from a stable anchor.
        // Use the CURRENT sim-time right before baseline snapshot to ensure time reference alignment.
        const baselineSnapshot = runner.getRichTelemetrySnapshot({ mode: 'deep' });
        simStartMs = runner.getSimulatedTimeMs(); // Re-sample after snapshot to get accurate epoch
        emitComponentStateEvents(baselineSnapshot, Math.floor(simStartMs), false);
        
        console.log(`[TRACE] ${label}: Simulation loop entered.`);

        // Choose capture strategy: sim-time-driven (preferred) or wall-clock (fallback)
        if (effectiveUseSimTimeCapture) {
            // Sim-time-driven capture: wait for runner simulated-time to reach each sample point.
            // Benefits: at higher simulation speeds this finishes proportionally faster (8x -> ~1s),
            // and it captures the same simulation-time window deterministically.
            const targetSimDurationMs = Math.min(durationMs, effectiveCutoffMs);
            const simStartMsLoop = runner.getSimulatedTimeMs();
            const simEndMs = simStartMsLoop + targetSimDurationMs;

            // Choose a sim-time sampling step small enough to catch pin toggles.
            const pollIntervalSimMs = 2; // 2ms simulated-time step (tunable)

            async function waitUntilSim(targetSimMs: number) {
                // Wait until runner.getSimulatedTimeMs() >= targetSimMs
                // Use short yields to avoid blocking the event loop.
                while (runner.getSimulatedTimeMs() < targetSimMs) {
                    if (Date.now() - startTime > wallTimeoutMs) {
                        throw new Error(`Simulation wait timeout after ${wallTimeoutMs}ms at ${normalizedSpeed}x`);
                    }
                    // yield, allow other tasks; at high speed this loop exits quickly
                    await new Promise((r) => setTimeout(r, 0));
                }
            }

            for (let t = simStartMsLoop; t < simEndMs; t += pollIntervalSimMs) {
                const target = t + pollIntervalSimMs;
                await waitUntilSim(target);
                // Use actual sim-time from runner, not quantized/aligned version
                // This ensures absolute timestamp consistency with baseline snapshot
                const nowMs = runner.getSimulatedTimeMs();
                if (nowMs - lastPollSimMs < pollIntervalSimMs) continue;
                lastPollSimMs = nowMs;

                if (nowMs - lastTraceTime > 1000) {
                    postMessage({ type: 'LOG', msg: `[TRACE] ${label}: Simulating... ${Math.round(nowMs)}ms @ ${normalizedSpeed}x` });
                    lastTraceTime = nowMs;
                }

                const snapshot = runner.getRichTelemetrySnapshot({ mode: 'delta' });
                // If delta snapshots omit metrics (delta:false), merge metrics from a deep snapshot once
                if (snapshot && Array.isArray(snapshot.components)) {
                    const missingMetrics = snapshot.components.some((c: any) => {
                        const customKeys = Object.keys(c?.metrics?.custom || {});
                        return !c.metrics || customKeys.length === 0;
                    });
                    if (missingMetrics) {
                        if (!deepSnapshotCache) deepSnapshotCache = runner.getRichTelemetrySnapshot({ mode: 'deep' });
                        if (deepSnapshotCache && Array.isArray(deepSnapshotCache.components)) {
                            const deepMap = new Map(deepSnapshotCache.components.map((c: any) => [c.id, c]));
                            for (const comp of snapshot.components) {
                                const deepComp = deepMap.get(comp.id);
                                if (!deepComp || !deepComp.metrics) continue;
                                const currentKeys = Object.keys(comp?.metrics?.custom || {});
                                if (!comp.metrics || currentKeys.length === 0) {
                                    comp.metrics = deepComp.metrics;
                                }
                            }
                        }
                    }
                }
                
                // DEBUG: Log snapshot structure to diagnose empty telemetry
                if (snapshot && !snapshot._debugLogged) {
                    const compCount = snapshot.components?.length || 0;
                    if (compCount > 0) {
                        const sampleComps = snapshot.components.slice(0, 3).map(c => ({
                            id: c.id,
                            type: c.type,
                            customMetricKeys: Object.keys(c.metrics?.custom || {}),
                            stateKeys: Object.keys(c.state || {})
                        }));
                        console.log(`[SNAPSHOT DEBUG] SIM-TIME: Components: ${compCount}, Sample: ${JSON.stringify(sampleComps)}`);
                    } else {
                        console.warn(`[SNAPSHOT DEBUG] SIM-TIME: Empty snapshot.components (is null/undefined: ${!snapshot.components})`);
                    }
                    snapshot._debugLogged = true;
                }
                
                emitComponentStateEvents(snapshot, nowMs, true);
            }

            // Final flush at sim-end boundary to avoid dropping last transition near cutoff.
            await waitUntilSim(simEndMs);
            const finalSnapshot = runner.getRichTelemetrySnapshot({ mode: 'delta' });
            const finalNowMs = runner.getSimulatedTimeMs();
            emitComponentStateEvents(finalSnapshot, finalNowMs, true);
        } else {
            const wallClockStart = Date.now();
            const wallClockDurationMs = 8000;  // All speeds: 8 seconds wall-clock time
            
            while (Date.now() - wallClockStart < wallClockDurationMs) {
                // Ultra-aggressive polling at 8x: capture more events per cycle
                const pollIntervalMs = normalizedSpeed >= 4
                    ? Math.max(2, Math.round(25 / normalizedSpeed))  // 8x → 3.125ms
                    : Math.max(10, Math.round(50 / normalizedSpeed));
                
                // Sleep with max aggression: divide by 2.5x speed factor
                const sleepWallMs = Math.max(0.5, Math.round(pollIntervalMs / (normalizedSpeed * 2.5)));
                await new Promise(resolve => setTimeout(resolve, sleepWallMs));

                const nowMs = runner.getSimulatedTimeMs();
                // Deterministic rounding: align to poll interval boundaries for consistency
                const alignedNowMs = Math.floor(nowMs / Math.max(1, Math.round(pollIntervalMs))) * Math.max(1, Math.round(pollIntervalMs));
                if (alignedNowMs - lastPollSimMs < pollIntervalMs) { continue; }
                lastPollSimMs = alignedNowMs;

                if (nowMs - lastTraceTime > 1000) {
                    console.log(`[TRACE] ${label}: Progress -> ${Math.round(nowMs)}ms / ${durationMs}ms`);
                    postMessage({ type: 'LOG', msg: `[TRACE] ${label}: Simulating... ${Math.round(nowMs)}ms @ ${normalizedSpeed}x` });
                    lastTraceTime = nowMs;
                }
                
                const snapshot = runner.getRichTelemetrySnapshot({ mode: 'delta' });
                // If delta snapshots omit metrics (delta:false), merge metrics from a deep snapshot once
                if (snapshot && Array.isArray(snapshot.components)) {
                    const missingMetrics = snapshot.components.some((c: any) => {
                        const customKeys = Object.keys(c?.metrics?.custom || {});
                        return !c.metrics || customKeys.length === 0;
                    });
                    if (missingMetrics) {
                        if (!deepSnapshotCache) deepSnapshotCache = runner.getRichTelemetrySnapshot({ mode: 'deep' });
                        if (deepSnapshotCache && Array.isArray(deepSnapshotCache.components)) {
                            const deepMap = new Map(deepSnapshotCache.components.map((c: any) => [c.id, c]));
                            for (const comp of snapshot.components) {
                                const deepComp = deepMap.get(comp.id);
                                if (!deepComp || !deepComp.metrics) continue;
                                const currentKeys = Object.keys(comp?.metrics?.custom || {});
                                if (!comp.metrics || currentKeys.length === 0) {
                                    comp.metrics = deepComp.metrics;
                                }
                            }
                        }
                    }
                }

                // DEBUG: Log snapshot structure to diagnose empty telemetry
                if (snapshot && !snapshot._debugLogged) {
                    const compCount = snapshot.components?.length || 0;
                    if (compCount > 0) {
                        const sampleComps = snapshot.components.slice(0, 3).map(c => ({
                            id: c.id,
                            type: c.type,
                            customMetricKeys: Object.keys(c.metrics?.custom || {}),
                            stateKeys: Object.keys(c.state || {})
                        }));
                        console.log(`[SNAPSHOT DEBUG] Components: ${compCount}, Sample: ${JSON.stringify(sampleComps)}`);
                    } else {
                        console.warn(`[SNAPSHOT DEBUG] Empty snapshot.components (is null/undefined: ${!snapshot.components})`);
                    }
                    snapshot._debugLogged = true;
                }
                
                emitComponentStateEvents(snapshot, alignedNowMs, true);

                // Fixed timeout: independent of speed for consistent report times
                if (Date.now() - startTime > wallTimeoutMs) {
                    console.warn(`[v2.4] ${label} simulation timed out after ${Date.now() - startTime}ms!`);
                    break;
                }
            }
        }
        
        const richSnapshot = runner.getRichTelemetrySnapshot({ mode: 'deep' });
        telemetry.rich_metrics = JSON.stringify(richSnapshot);
        (telemetry as any).simulation_speed = normalizedSpeed;
        (telemetry as any).telemetry_cutoff_ms = effectiveCutoffMs;
        (telemetry as any).real_capture_ms = Date.now() - captureWallStartMs;

        const coverageIssues = Array.isArray(richSnapshot?.components)
            ? richSnapshot.components
                .map((comp: any) => {
                    const customKeys = Object.keys(comp?.metrics?.custom || comp?.customTelemetry || comp?._metrics?.customTelemetry || {});
                    const stateKeys = Object.keys(comp?.state || {});
                    if (customKeys.length === 0 && stateKeys.length === 0) {
                        return `${comp?.id || 'unknown'}:${comp?.type || 'unknown'}`;
                    }
                    return null;
                })
                .filter(Boolean)
            : [];

        if (coverageIssues.length > 0) {
            (telemetry as any).coverage_issues = coverageIssues;
            sendJsonLog(`[Telemetry Coverage] Components with no visible telemetry/state: ${coverageIssues.join(', ')}`, 'warn');
        } else {
            (telemetry as any).coverage_issues = [];
        }

        const allEvents = telemetry.events || [];
        
        console.log(`[CAPTURE SUMMARY] ${label}: Captured ${allEvents.length} events (real_time: ${(telemetry as any).real_capture_ms}ms, sim_time: ${Math.round(runner.getSimulatedTimeMs())}ms)`);
        
        const keptEvents: any[] = [];
        const ignoredEvents: any[] = [];
        for (const evt of allEvents) {
            const eventType = Object.keys(evt || {})[0];
            const eventData = eventType ? evt?.[eventType] : null;
            const eventTime = Number(eventData?.time_ms);
            if (!Number.isFinite(eventTime)) continue;
            if (eventTime <= effectiveCutoffMs) keptEvents.push(evt);
            else ignoredEvents.push(evt);
        }
        (telemetry as any).events = keptEvents;
        (telemetry as any).ignored_events = ignoredEvents;
        
        runner.stop();
        sendJsonLog(`[v2.3] ${label} complete. (${telemetry.events.length} events, speed=${normalizedSpeed}x, cutoff=${effectiveCutoffMs}ms, real_capture=${(telemetry as any).real_capture_ms}ms)`, 'info');
        return telemetry;
    } catch (err: any) {
        const errorMsg = String(err);
        postMessage({ type: 'LOG', msg: `[v2.3] ERROR: ${label} simulation failed: ${errorMsg}`, logType: 'error' });
        telemetry.error = errorMsg;
        telemetry.crashed = true;
        // Ensure runner is stopped if possible
        try { if (runner && runner.stop) runner.stop(); } catch (e) {}
        return telemetry;
    }
}

function detectSourceCode(code: string): boolean {
    if (!code || code.length < 20) return false;
    const hasArduinoMarkers = /\b(void\s+setup|void\s+loop|pinMode|digitalWrite|Serial\.begin|delay)\s*\(/.test(code);
    const hasIncludes = /#\s*include\s+["<]/.test(code);
    const hasMain = /\bint\s+main\s*\(/.test(code);
    const looksLikeHex = /^[0-9a-fA-F:\s]+$/.test(code.trim());
    return (hasArduinoMarkers || hasIncludes || hasMain) && !looksLikeHex;
}

onmessage = async (e: MessageEvent<any>) => {
    const { type, teacher, student, options, simulationSpeed, config } = e.data;
    
    if (config) {
        engineConfig = { ...engineConfig, ...config };
    }

    const runSpeed = Number.isFinite(simulationSpeed) && (simulationSpeed as number) > 0 ? Number(simulationSpeed) : 1;
    console.log(`[HEARTBEAT] Worker: Message Received -> ${type}`);
    try {
        await initEngine();
        
        if (type === 'GENERATE_KEY') {
            const teacherData = teacher as any;
            postMessage({ type: 'LOG', msg: "Generating Reference Key: Running simulation..." });
            sendJsonLog(`[Run Config] mode=GENERATE_KEY speed=${runSpeed}x telemetry_cutoff_ms=7900`, 'info');
            
            let teacherMeta;
            let projectJson: string;
            
            if (teacherData.project && teacherData.project.startsWith('{')) {
                projectJson = teacherData.project;
                teacherMeta = JSON.parse(projectJson);
            } else {
                const buf = teacherData.projectBuf || teacher;
                projectJson = extractProjectMetaFromPng(new Uint8Array(buf as any));
                teacherMeta = JSON.parse(projectJson);
            }

            // Teacher Validation Gate (Locally in Worker)
            postMessage({ type: 'LOG', msg: "Auditing Teacher Reference Circuit..." });
            const { errors, healthScore: teacherHealth } = emulatorExports.runUnifiedValidation(teacherMeta, { 
                profile: 'balanced',
                registry: emulatorExports
            });

            if (teacherHealth < 100) {
                postMessage({ type: 'LOG', msg: `[Warning] Teacher's reference circuit has spatial/electrical errors! Health: ${teacherHealth}%`, logType: 'warning' });
            }

            postMessage({ type: 'LOG', msg: `[TRACE] Teacher key capture speed: ${runSpeed}x` });
            const telemetry = await captureBehavior(teacherMeta, 8000, "Teacher Reference", runSpeed, true);
            const key = wasmExports.generate_binary_key(
                projectJson, 
                JSON.stringify(telemetry),
                teacherHealth,
                JSON.stringify(validator.errors.map((e: any) => e.message))
            );
            postMessage({ type: 'KEY_GENERATED', key });

        } else if (type === 'GRADE' && student) {
            postMessage({ type: 'LOG', msg: "Starting Intelligent Grading Process..." });
            sendJsonLog(`[Run Config] mode=GRADE speed=${runSpeed}x telemetry_cutoff_ms=7900`, 'info');
            
            // 1. Student Metadata
            const studentMeta = extractProjectMetaFromPng(new Uint8Array(student));

            // 2. RUN UNIFIED VALIDATION ENGINE (Locally in Worker)
            postMessage({ type: 'LOG', msg: "Running Unified Electrical Safety & Sync Validation..." });
            const validationResult = emulatorExports.runUnifiedValidation(studentMeta, { 
                profile: 'balanced',
                registry: emulatorExports
            });
            
            // 3. Behavioral Analysis (Teacher - IF PNG)
            let teacherBinaryKey: Uint8Array;
            if (teacher instanceof ArrayBuffer) {
                postMessage({ type: 'LOG', msg: "Teacher reference is a PNG. Generating behavioral baseline first..." });
                const teacherMeta = extractProjectMetaFromPng(new Uint8Array(teacher));
                
                // Teacher Validation (Audit)
                const tResult = emulatorExports.runUnifiedValidation(teacherMeta, { 
                    profile: 'balanced',
                    registry: emulatorExports
                });
                
                postMessage({ type: 'LOG', msg: `[TRACE] Teacher capture speed: ${runSpeed}x` });
                const teacherTelemetry = await captureBehavior(teacherMeta, 8000, "Teacher Reference", runSpeed, true);
                teacherBinaryKey = wasmExports.generate_binary_key(
                    JSON.stringify(teacherMeta), 
                    JSON.stringify(teacherTelemetry),
                    tResult.healthScore,
                    JSON.stringify(tResult.errors.map((e: any) => e.message))
                );
            } else {
                teacherBinaryKey = new Uint8Array(teacher as any);
            }

            // 4. Behavioral Analysis (Student)
            postMessage({ type: 'LOG', msg: `[TRACE] Student capture speed: ${runSpeed}x` });
            const studentTelemetry = await captureBehavior(studentMeta, 8000, "Student Submission", runSpeed, true);

            // 5. BEHAVIOR-CORRECTED HEALTH (Trusting the simulation results over static analysis)
            const activeComponentIds = new Set(
                studentTelemetry.events
                    .filter((e: any) => e.ComponentState)
                    .map((e: any) => e.ComponentState.id)
            );

            const correctedErrors = validationResult.errors.filter((err: any) => {
                // If safety engine says "unconnected" but simulation says "it's glowing", ignore the error
                if (err.message.includes("unconnected")) {
                    const match = err.message.match(/\[.* (.*)\]/);
                    const compId = match ? match[1] : null;
                    if (compId && activeComponentIds.has(compId)) {
                        postMessage({ type: 'LOG', msg: `[Outcome Verification] Overriding unconnected error for ${compId} (Functional activity detected).`, logType: 'success' });
                        return false;
                    }
                }
                return true;
            });

            // Re-calculate Health Score with corrected errors
            const validator = new emulatorExports.FullCircuitValidator(studentMeta);
            validator.errors = correctedErrors;
            const healthScore = validator.calculateHealthScore(validationResult.syncIssues);
            postMessage({ type: 'LOG', msg: `[Validation] Final Health Score: ${healthScore}%` });

            const validationErrors = [
                ...correctedErrors.map((e: any) => `Safety: ${e.message}`),
                ...validationResult.syncIssues.map((e: any) => `Sync: ${e.message}`)
            ];

            postMessage({ type: 'LOG', msg: "[v2.2] Running Final Comparison (Rust/WASM)..." });
            const result = wasmExports.grade_circuits_wasm(
                new Uint8Array(student),
                teacherBinaryKey,
                JSON.stringify(studentTelemetry),
                {
                    ...options,
                    simulation_speed: runSpeed,
                    validation_health: healthScore,
                    validation_errors: validationErrors
                }
            );

            const finalResult = result && typeof result === 'object' ? { ...result } : result;
            if (finalResult && typeof finalResult === 'object') {
                (finalResult as any).simulation_speed = runSpeed;
                (finalResult as any).telemetry_cutoff_ms = 7900;
                if (Array.isArray((finalResult as any).logs)) {
                    (finalResult as any).logs = (finalResult as any).logs.map((line: any) => `[${runSpeed}x] ${String(line)}`);
                }
                const codeScore = Number(finalResult.code_score);
                const pinFidelity = Number(finalResult.pin_fidelity);
                const verifiedScore = Number(finalResult.verified_code_score);

                if ((verifiedScore === 0 || !Number.isFinite(verifiedScore)) && codeScore > 0 && pinFidelity > 0) {
                    finalResult.verified_code_score = Math.round((codeScore * 0.70) + (pinFidelity * 0.30));
                    sendJsonLog(`[v2.2] Recomputed verified code score from Rust fields: ${finalResult.verified_code_score}%`, 'warning');
                }

                if (!finalResult.temporal_breakdown && finalResult.teacher_telemetry && finalResult.student_telemetry) {
                    finalResult.temporal_breakdown = null;
                }
            }
            
            // Emit grading complete log then send result and a downloadable JSON report
            sendJsonLog('Grading complete. Report generated.', 'info');

            const report = {
                generated_at: new Date().toISOString(),
                result: finalResult,
                teacherBinaryKey: Array.from(new Uint8Array(teacherBinaryKey || [])),
                logs: jsonLogs,
                model_diagnostics: null
            };

            // Send report as structured JSON payload (main thread can offer download)
            postMessage({ type: 'DOWNLOAD_REPORT', report: JSON.stringify(report, null, 2) });

            postMessage({ 
                type: 'GRADING_COMPLETE', 
                result: finalResult,
                teacherBinaryKey: teacherBinaryKey 
            });
        } else if (type === 'MERGE_AI_RESULTS') {
            // Option B: Merge AI audit results with grading report and emit merged download
            const { aiResult, gradingResult } = e.data as any;
            if (!aiResult || !gradingResult) {
                postMessage({ type: 'MERGE_ERROR', error: 'Missing AI or grading result' });
                return;
            }
            
            const mergedReport = {
                generated_at: new Date().toISOString(),
                grading_result: gradingResult,
                ai_result: aiResult,
                ai_logs: aiResult.aiLogs || [],
                model_diagnostics: aiResult.modelDiagnostics || null,
                all_logs: [...jsonLogs, ...(aiResult.aiLogs || [])]
            };
            postMessage({ type: 'DOWNLOAD_REPORT_MERGED', report: JSON.stringify(mergedReport, null, 2) });
        }
    } catch (globalErr) {
        sendJsonLog(`CRITICAL ERROR: ${globalErr}`, 'error');
        postMessage({ 
            type: 'GRADING_COMPLETE', 
            result: { 
                score: 0, 
                feedback: [`Internal Engine Error: ${globalErr}`],
                logs: [`Fatal: ${globalErr}`]
            } 
        });
    }
};
