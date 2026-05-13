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

// Explicitly disable WebGPU and enforce WASM for max compatibility
let env: any;
let pipeline: any;
let cos_sim: any;
let extractor: any = null;
const MODEL_TIMEOUT_MS = 45000; // Increased to allow full model loading
const modelDiagnostics = { modelPath: '/models/', status: 'not-loaded' as string, error: null as any, loadTimeMs: 0 };
const jsonLogs: Array<{time: string, source: string, level: string, message: string}> = [];
const teacherCache = new Map<string, any>();

// Ultimate Debugger: Intercept all possible data sources
self.onerror = (msg, url, line, col, error) => {
    console.error(`[AIAuditWorker] Global Error: ${msg} at ${line}:${col}`, error);
    return false;
};
const originalFetch = self.fetch;
(self as any).fetch = async (...args: any[]) => {
    const url = args[0] instanceof URL ? args[0].href : args[0];
    // self.postMessage({ type: 'STATUS', msg: `DEBUG Fetch: ${url}` }); // Quiet in production
    const response = await originalFetch(...args);
    return response;
};

function getEventTime(event: any): number {
    if (event?.PinChange) return Number(event.PinChange.time_ms) || 0;
    if (event?.ComponentState) return Number(event.ComponentState.time_ms) || 0;
    if (event?.SerialOutput) return Number(event.SerialOutput.time_ms) || 0;
    return 0;
}

function buildNormalizedTrace(input: any, label: string = ''): { functional: string, electrical: string, normalized: string, raw: string } {
    let events = Array.isArray(input) ? input : (input?.events || []);
    const orderedEvents = [...events].filter(Boolean).sort((a, b) => getEventTime(a) - getEventTime(b));

    sendJsonLog(`[TRACE-BUILD] ${label} - Input: ${events.length} events → ${orderedEvents.length} ordered`, 'debug');

    // Apply entropy filtering to remove static noise (values that never change)
    const filteredEvents = entropyFilter(orderedEvents);
    const eventsRemoved = orderedEvents.length - filteredEvents.length;
    if (eventsRemoved > 0) {
        sendJsonLog(`[TRACE-BUILD] ${label} - Entropy filter removed ${eventsRemoved} static events (kept ${filteredEvents.length})`, 'debug');
    }

    const rawTokens: string[] = [];
    const functionalTokens: string[] = [];
    const electricalTokens: string[] = [];

    const lastComponentValues = new Map<string, string>();
    const lastPinValues = new Map<string, string>();
    let lastSerialValue = '';

    let pinChangeCount = 0, compStateCount = 0, serialCount = 0;
    let pinTransitions = 0, compTransitions = 0, serialTransitions = 0;

    for (const event of filteredEvents) {
        if (event.PinChange) {
            pinChangeCount++;
            const pin = String(event.PinChange.pin || '');
            const stateToken = event.PinChange.state ? 'H' : 'L';
            rawTokens.push(`PinChange(${pin}=${stateToken}@${event.PinChange.time_ms})`);

            if (lastPinValues.get(pin) !== stateToken) {
                pinTransitions++;
                electricalTokens.push(`p${pin}:${stateToken}`);
                lastPinValues.set(pin, stateToken);
            }
            continue;
        }

        if (event.ComponentState) {
            compStateCount++;
            const id = String(event.ComponentState.id || '');
            const key = String(event.ComponentState.key || '');
            const value = String(event.ComponentState.value ?? '');
            const cacheKey = `${id}|${key}`;
            const token = `${id}:${key}=${value}`;

            rawTokens.push(`ComponentState(${token}@${event.ComponentState.time_ms})`);

            if (lastComponentValues.get(cacheKey) !== value) {
                compTransitions++;
                functionalTokens.push(`${token}`);
                lastComponentValues.set(cacheKey, value);
            }
            continue;
        }

        if (event.SerialOutput) {
            serialCount++;
            const serialValue = String(event.SerialOutput.data || '').trim();
            rawTokens.push(`SerialOutput(${serialValue}@${event.SerialOutput.time_ms})`);

            if (serialValue && serialValue !== lastSerialValue) {
                serialTransitions++;
                functionalTokens.push(`ser:"${serialValue}"`);
                lastSerialValue = serialValue;
            }
        }
    }

    const raw = rawTokens.join(' ').trim();
    const functional = functionalTokens.join(' ').trim() || 'silent';
    const electrical = electricalTokens.join(' ').trim() || 'silent';
    const normalized = `${functional} ${electrical !== 'silent' ? electrical : ''}`.trim();

    sendJsonLog(
        `[TRACE-BUILD] ${label} - Event breakdown: ${pinChangeCount} PinChanges (${pinTransitions} transitions), ` +
        `${compStateCount} ComponentStates (${compTransitions} transitions), ${serialCount} SerialOutputs (${serialTransitions} transitions)`,
        'debug'
    );
    sendJsonLog(`[TRACE-BUILD] ${label} - Functional tokens: ${functionalTokens.length}, Electrical tokens: ${electricalTokens.length}`, 'debug');
    sendJsonLog(`[TRACE-BUILD] ${label} - Functional length: ${functional.length}, Electrical length: ${electrical.length}`, 'debug');

    return { raw, functional, electrical, normalized: normalized || functional };
}
function timeStamp(): string {
    return new Date().toLocaleTimeString();
}

function sendJsonLog(msg: string, level = 'info') {
    const payload = {
        time: timeStamp(),
        source: 'ai-audit',
        level,
        message: msg
    };
    jsonLogs.push(payload); // Collect for merged report
    // Backwards-compatible channels
    self.postMessage({ type: 'LOG_JSON', payload });
}

function sendStatus(msg: string) {
    sendJsonLog(msg, 'info');
}

function sendError(err: string) {
    sendJsonLog(err, 'error');
}
async function initTransformers() {
    if (pipeline) return;
    
    // KILL THE CACHE once to ensure we aren't reading old index.html ghosts
    // Note: In production we might want to check a version flag instead of wiping every time.
    if ((self as any).caches) {
        const keys = await caches.keys();
        if (keys.length > 0) {
                sendStatus('AI Auditor: Wiping AI Cache Storage for fresh start...');
            for (const key of keys) {
                await caches.delete(key);
            }
        }
    }

    const transformers = await import('@xenova/transformers');
    pipeline = transformers.pipeline;
    env = transformers.env;
    cos_sim = transformers.cos_sim;

    env.backends.onnx.wasm.numThreads = 1;
    env.backends.onnx.wasm.wasmPaths = '/'; // Read from public root
    env.allowLocalModels = true;
    env.allowRemoteModels = false;
    env.localModelPath = '/models/';
}

// The model takes about 23MB, so we initialize it only when requested.
async function initModel() {
    await initTransformers();
    if (extractor) return;
    const loadStart = performance.now();
    
    sendStatus('AI Auditor: Loading AI Semantic Model (WASM) from Local Public Folder...');
    
    try {
        extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
            quantized: true,
            progress_callback: (x: any) => {
                if (x.status === 'progress') {
                    self.postMessage({ type: 'PROGRESS', progress: x.progress });
                }
            }
        });
        const loadTime = Math.round(performance.now() - loadStart);
        modelDiagnostics.status = 'loaded';
        modelDiagnostics.loadTimeMs = loadTime;
        sendStatus(`AI Semantic Model Ready. (Loaded in ${loadTime}ms from ${modelDiagnostics.modelPath})`);
    } catch (e: any) {
        const loadTime = Math.round(performance.now() - loadStart);
        modelDiagnostics.status = 'error';
        modelDiagnostics.loadTimeMs = loadTime;
        modelDiagnostics.error = {
            message: e?.message || String(e),
            stack: e?.stack ? e.stack.split('\n').slice(0, 5).join(' | ') : 'No stack',
            name: e?.name || 'UnknownError',
            cause: String(e?.cause || '')
        };
        const errMsg = `AI Auditor Pipeline Error: ${e.message} (after ${loadTime}ms from ${modelDiagnostics.modelPath})`;
        sendError(errMsg);
        throw e;
    }
}

function strHash(s: string): string {
    let h = 5381;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) + h) + s.charCodeAt(i);
        h = h & 0xffffffff;
    }
    return (h >>> 0).toString(36);
}

function entropyFilter(eventsInput: any[]): any[] {
    // Remove keys that never change (static noise). Works on ComponentState and PinChange.
    const compKeyVals: Map<string, Set<string>> = new Map();
    const pinVals: Map<string, Set<string>> = new Map();

    for (const ev of eventsInput) {
        if (!ev) continue;
        if (ev.ComponentState) {
            const id = ev.ComponentState.id || "";
            const key = ev.ComponentState.key || "";
            const val = String(ev.ComponentState.value || "");
            const k = id + '|' + key;
            if (!compKeyVals.has(k)) compKeyVals.set(k, new Set());
            compKeyVals.get(k)!.add(val);
        } else if (ev.PinChange) {
            const p = String(ev.PinChange.pin);
            const v = ev.PinChange.state ? '1' : '0';
            if (!pinVals.has(p)) pinVals.set(p, new Set());
            pinVals.get(p)!.add(v);
        }
    }

    return eventsInput.filter(ev => {
        if (!ev) return false;
        if (ev.ComponentState) {
            const id = ev.ComponentState.id || "";
            const key = ev.ComponentState.key || "";
            const k = id + '|' + key;
            const s = compKeyVals.get(k);
            if (!s) return true;
            return s.size > 1; // keep only if multiple distinct values observed
        }
        if (ev.PinChange) {
            const p = String(ev.PinChange.pin);
            const s = pinVals.get(p);
            if (!s) return true;
            return s.size > 1;
        }
        return true;
    });
}

function buildRawTrace(input: any): string {
    const events = Array.isArray(input) ? input : (input?.events || []);
    const tokens: string[] = [];

    for (const event of events) {
        if (!event) continue;
        if (event.PinChange) {
            tokens.push(`PinChange(${event.PinChange.pin}=${event.PinChange.state ? 'H' : 'L'}@${event.PinChange.time_ms})`);
        } else if (event.ComponentState) {
            tokens.push(`ComponentState(${event.ComponentState.id}.${event.ComponentState.key}=${event.ComponentState.value}@${event.ComponentState.time_ms})`);
        } else if (event.SerialOutput) {
            tokens.push(`SerialOutput(${String(event.SerialOutput.data).trim()}@${event.SerialOutput.time_ms})`);
        }
    }

    return tokens.join(' ');
}

function withTimeout<T>(p: Promise<T>, ms: number, msg = 'Operation timed out') {
    return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);
}

/**
 * Highly optimized Behavioral report flattener with:
 * 1. Functional Trace (Hardware Outcomes)
 * 2. Electrical Trace (Pin Execution)
 */
function flattenTelemetry(input: any): { functional: string, electrical: string, normalized: string } {
    const functional: string[] = [];
    const electrical: string[] = [];
    
    // Robust check: Handle both raw arrays and wrapped objects
    const events = Array.isArray(input) ? input : (input?.events || []);
    
    for (const event of events) {
        if (!event) continue;
        
        if (event.PinChange) {
            electrical.push(`p${event.PinChange.pin}:${event.PinChange.state ? 'H' : 'L'}`);
        } else if (event.ComponentState) {
            const stateStr = `${event.ComponentState.id}:${event.ComponentState.key}=${event.ComponentState.value}`;
            // Weighting: High-level hardware states are repeated to ensure semantic focus
            functional.push(stateStr, stateStr, stateStr);
        } else if (event.SerialOutput) {
            const s = `ser:"${event.SerialOutput.data.trim()}"`;
            functional.push(s, s);
        }
    }

    return {
        functional: functional.join(" "),
        electrical: electrical.join(" "),
        normalized: `${functional.join(" ")} ${electrical.join(" ")}`.trim()
    };
}


self.onmessage = async (e) => {
    const { type, teacherTelemetry, studentTelemetry, simulationSpeed } = e.data;

    if (type === 'GRADE_SEMANTICS') {
        try {
            await initModel();

            const auditStart = performance.now();
            const runSpeed = Number.isFinite(Number(simulationSpeed)) && Number(simulationSpeed) > 0 ? Number(simulationSpeed) : 1;
            sendJsonLog(`[RUN-CONFIG] speed=${runSpeed}x`, 'info');
            sendStatus('Processing Delta-Reports (Pre-Normalized in Rust)...');
            
            const teacherEvents = typeof teacherTelemetry === 'string' ? JSON.parse(teacherTelemetry) : teacherTelemetry;
            const studentEvents = typeof studentTelemetry === 'string' ? JSON.parse(studentTelemetry) : studentTelemetry;

            const tEventsRaw = Array.isArray(teacherEvents) ? teacherEvents : (teacherEvents?.events || []);
            const sEventsRaw = Array.isArray(studentEvents) ? studentEvents : (studentEvents?.events || []);

            sendJsonLog(`[EXTRACTION-START] Received ${tEventsRaw.length} teacher events, ${sEventsRaw.length} student events`, 'info');

            const tRawTrace = buildRawTrace(tEventsRaw);
            const sRawTrace = buildRawTrace(sEventsRaw);
            
            sendJsonLog(`[RAW-TRACES] Teacher raw trace length: ${tRawTrace.length} chars`, 'debug');
            sendJsonLog(`[RAW-TRACES] Student raw trace length: ${sRawTrace.length} chars`, 'debug');

            const tTraces = buildNormalizedTrace(tEventsRaw, 'TEACHER');
            const sTraces = buildNormalizedTrace(sEventsRaw, 'STUDENT');

            sendJsonLog(`[NORMALIZED-SUMMARY] Teacher - Func: ${tTraces.functional.length}ch, Elec: ${tTraces.electrical.length}ch`, 'debug');
            sendJsonLog(`[NORMALIZED-SUMMARY] Student - Func: ${sTraces.functional.length}ch, Elec: ${sTraces.electrical.length}ch`, 'debug');

            if (tTraces.functional.length === 0 || sTraces.functional.length === 0) {
                sendJsonLog(`[WARNING] Empty functional traces detected! Teacher: ${tTraces.functional.length === 0}, Student: ${sTraces.functional.length === 0}`, 'warn');
                if (tTraces.functional.length === 0) {
                    sendJsonLog(`[DEBUG-TEACHER] Teacher normalized="silent" → showing first 500 raw chars: ${tRawTrace.substring(0, 500)}`, 'debug');
                }
                if (sTraces.functional.length === 0) {
                    sendJsonLog(`[DEBUG-STUDENT] Student normalized="silent" → showing first 500 raw chars: ${sRawTrace.substring(0, 500)}`, 'debug');
                }
            }

            sendStatus('Generating Weighted Embeddings (85/15 Blend)...');
            
            // 1. Functional Embedding (85% weight) with teacher caching
            let functionalSim = 1.0;
            const teacherKey = strHash(tTraces.functional + '::' + tTraces.electrical);
            let cached = teacherCache.get(teacherKey);
            let tFuncVec: any = null;
            let tElecVec: any = null;

            if (cached) {
                sendJsonLog(`[EXTRACTION-CACHE] HIT for teacher (key: ${teacherKey.substring(0, 8)})`, 'debug');
                tFuncVec = cached.func;
                tElecVec = cached.elec;
            } else if (tTraces.functional.length > 0) {
                sendJsonLog(`[EXTRACTION-FUNC] Extracting teacher functional (length: ${tTraces.functional.length})...`, 'debug');
                const tFunc = await withTimeout(extractor(tTraces.functional, { pooling: 'mean', normalize: true }), MODEL_TIMEOUT_MS, 'Feature extraction timed out');
                tFuncVec = tFunc.data;
                sendJsonLog(`[EXTRACTION-FUNC] Teacher functional vector dims: ${tFuncVec?.length || 'undefined'}`, 'debug');
                // store partial; elec stored later if computed
            } else {
                sendJsonLog(`[EXTRACTION-FUNC] Teacher functional is empty/silent, skipping extraction`, 'warn');
            }

            if (tFuncVec) {
                sendJsonLog(`[EXTRACTION-FUNC] Extracting student functional (length: ${(sTraces.functional || "empty").length})...`, 'debug');
                const sFunc = await withTimeout(extractor(sTraces.functional || "empty", { pooling: 'mean', normalize: true }), MODEL_TIMEOUT_MS, 'Feature extraction timed out');
                functionalSim = cos_sim(tFuncVec, sFunc.data);
                sendJsonLog(`[SIMILARITY-FUNCTIONAL] functionalSim = ${functionalSim.toFixed(4)}`, 'info');
            } else {
                sendJsonLog(`[SIMILARITY-FUNCTIONAL] Skipped: no teacher functional vector`, 'warn');
            }

            // 2. Electrical Embedding (15% weight)
            let electricalSim = 1.0;
            if (tTraces.electrical.length > 0) {
                if (!tElecVec) {
                    sendJsonLog(`[EXTRACTION-ELEC] Extracting teacher electrical (length: ${tTraces.electrical.length})...`, 'debug');
                    const tElec = await withTimeout(extractor(tTraces.electrical, { pooling: 'mean', normalize: true }), MODEL_TIMEOUT_MS, 'Feature extraction timed out');
                    tElecVec = tElec.data;
                    sendJsonLog(`[EXTRACTION-ELEC] Teacher electrical vector dims: ${tElecVec?.length || 'undefined'}`, 'debug');
                }
                sendJsonLog(`[EXTRACTION-ELEC] Extracting student electrical (length: ${(sTraces.electrical || "empty").length})...`, 'debug');
                const sElec = await withTimeout(extractor(sTraces.electrical || "empty", { pooling: 'mean', normalize: true }), MODEL_TIMEOUT_MS, 'Feature extraction timed out');
                electricalSim = cos_sim(tElecVec, sElec.data);
                sendJsonLog(`[SIMILARITY-ELECTRICAL] electricalSim = ${electricalSim.toFixed(4)}`, 'info');
            } else {
                sendJsonLog(`[SIMILARITY-ELECTRICAL] Skipped: no electrical traces`, 'warn');
            }

            // Store teacher vectors in cache if we computed them
            if (tFuncVec || tElecVec) {
                teacherCache.set(teacherKey, { func: tFuncVec, elec: tElecVec });
                // Keep cache size modest
                if (teacherCache.size > 64) {
                    // delete oldest entry (Map preserves insertion order)
                    const first = teacherCache.keys().next().value;
                    teacherCache.delete(first);
                }
            }

            // 3. Final Blending
            // NOTE: electrical/pin-change signals are retained for reporting, but
            // we no longer fold them into the AI semantic final score. The AI
            // semantic audit focuses on high-level functional similarity only.
            const similarity = functionalSim;
            sendJsonLog(`[SIMILARITY-FINAL] Final blend: using functionalSim only = ${similarity.toFixed(4)} (electricalSim reported separately as ${electricalSim.toFixed(4)})`, 'info');
            
            const auditTime = Math.round(performance.now() - auditStart);

            self.postMessage({ 
                type: 'RESULT', 
                score: Math.max(0, similarity),
                functionalMatch: Math.round(functionalSim * 100),
                electricalMatch: Math.round(electricalSim * 100),
                teacherTokens: Array.isArray(teacherEvents) ? teacherEvents.length : (teacherEvents?.events?.length || 0),
                studentTokens: Array.isArray(studentEvents) ? studentEvents.length : (studentEvents?.events?.length || 0),
                auditTimeMs: auditTime,
                teacherRawTrace: tRawTrace,
                studentRawTrace: sRawTrace,
                teacherFunctionalTrace: tTraces.functional,
                studentFunctionalTrace: sTraces.functional,
                teacherElectricalTrace: tTraces.electrical,
                studentElectricalTrace: sTraces.electrical,
                teacherNormalizedTrace: tTraces.normalized,
                studentNormalizedTrace: sTraces.normalized,
                teacherStr: tTraces.functional,
                studentStr: sTraces.functional,
                teacherElec: tTraces.electrical,
                studentElec: sTraces.electrical,
                modelDiagnostics: modelDiagnostics,
                aiLogs: jsonLogs
            });

        } catch (error: any) {
            sendError(`AI Auditor Error: ${error?.message || String(error)}`);
        }
    }
};
