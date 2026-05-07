// Explicitly disable WebGPU and enforce WASM for max compatibility
let env: any;
let pipeline: any;
let cos_sim: any;

// Ultimate Debugger: Intercept all possible data sources
const originalFetch = self.fetch;
(self as any).fetch = async (...args: any[]) => {
    const url = args[0] instanceof URL ? args[0].href : args[0];
    // self.postMessage({ type: 'STATUS', msg: `DEBUG Fetch: ${url}` }); // Quiet in production
    const response = await originalFetch(...args);
    return response;
};

const originalParse = JSON.parse;
JSON.parse = function(text: string, reviver?: any) {
    if (typeof text === 'string' && text.trim().startsWith('<')) {
        self.postMessage({ type: 'STATUS', msg: `DEBUG JSON.parse Error: Input starts with HTML: ${text.substring(0, 100)}` });
    }
    return originalParse(text, reviver);
};

let extractor: any = null;

async function initTransformers() {
    if (pipeline) return;
    
    // KILL THE CACHE once to ensure we aren't reading old index.html ghosts
    // Note: In production we might want to check a version flag instead of wiping every time.
    if ((self as any).caches) {
        const keys = await caches.keys();
        if (keys.length > 0) {
            self.postMessage({ type: 'STATUS', msg: 'Wiping AI Cache Storage for fresh start...' });
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
    
    self.postMessage({ type: 'STATUS', msg: 'Loading AI Semantic Model (WASM) from Local Public Folder...' });
    
    try {
        extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
            quantized: true,
            progress_callback: (x: any) => {
                if (x.status === 'progress') {
                    self.postMessage({ type: 'PROGRESS', progress: x.progress });
                }
            }
        });
    } catch (e: any) {
        self.postMessage({ type: 'ERROR', error: `Pipeline Error: ${e.message}` });
        throw e;
    }
    
    const loadTime = Math.round(performance.now() - loadStart);
    self.postMessage({ type: 'STATUS', msg: `AI Semantic Model Ready. (Loaded in ${loadTime}ms)` });
}

/**
 * Highly optimized Behavioral report flattener with:
 * 1. Functional Trace (Hardware Outcomes)
 * 2. Electrical Trace (Pin Execution)
 */
function flattenTelemetry(input: any): { functional: string, electrical: string } {
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
        electrical: electrical.join(" ")
    };
}


self.onmessage = async (e) => {
    const { type, teacherTelemetry, studentTelemetry } = e.data;

    if (type === 'GRADE_SEMANTICS') {
        try {
            await initModel();

            const auditStart = performance.now();
            self.postMessage({ type: 'STATUS', msg: 'Processing Delta-Reports (Pre-Normalized in Rust)...' });
            
            const teacherEvents = typeof teacherTelemetry === 'string' ? JSON.parse(teacherTelemetry) : teacherTelemetry;
            const studentEvents = typeof studentTelemetry === 'string' ? JSON.parse(studentTelemetry) : studentTelemetry;

            const tTraces = flattenTelemetry(teacherEvents);
            const sTraces = flattenTelemetry(studentEvents);

            self.postMessage({ type: 'STATUS', msg: 'Generating Weighted Embeddings (85/15 Blend)...' });
            
            // 1. Functional Embedding (85% weight)
            let functionalSim = 1.0;
            if (tTraces.functional.length > 0) {
                const tFunc = await extractor(tTraces.functional, { pooling: 'mean', normalize: true });
                const sFunc = await extractor(sTraces.functional || "empty", { pooling: 'mean', normalize: true });
                functionalSim = cos_sim(tFunc.data, sFunc.data);
            }

            // 2. Electrical Embedding (15% weight)
            let electricalSim = 1.0;
            if (tTraces.electrical.length > 0) {
                const tElec = await extractor(tTraces.electrical, { pooling: 'mean', normalize: true });
                const sElec = await extractor(sTraces.electrical || "empty", { pooling: 'mean', normalize: true });
                electricalSim = cos_sim(tElec.data, sElec.data);
            }

            // 3. Final Blending (The 15% Pin Rule)
            const similarity = (functionalSim * 0.85) + (electricalSim * 0.15);
            
            const auditTime = Math.round(performance.now() - auditStart);

            self.postMessage({ 
                type: 'RESULT', 
                score: Math.max(0, similarity),
                teacherTokens: Array.isArray(teacherEvents) ? teacherEvents.length : (teacherEvents?.events?.length || 0),
                studentTokens: Array.isArray(studentEvents) ? studentEvents.length : (studentEvents?.events?.length || 0),
                auditTimeMs: auditTime,
                teacherStr: tTraces.functional, // Return for debug
                studentStr: sTraces.functional  // Return for debug
            });

        } catch (error: any) {
            self.postMessage({ type: 'ERROR', error: error.message });
        }
    }
};
