console.log("Grading Worker [v2.2]: Script parsing started...");

// Global error handler for debugging silent worker crashes
self.onerror = (msg, url, lineNo, columnNo, error) => {
    console.error(`Grading Worker Error: ${msg} at ${lineNo}:${columnNo}`, error);
    (self as any).postMessage({ type: 'LOG', msg: `WORKER CRASH: ${msg}`, logType: 'error' });
    return false;
};

self.onunhandledrejection = (event) => {
    console.error('Grading Worker Unhandled Promise Rejection:', event.reason);
    (self as any).postMessage({ type: 'LOG', msg: `WORKER PROMISE REJECTION: ${event.reason}`, logType: 'error' });
};

import init, { grade_circuits_wasm, generate_binary_key, extract_project_meta, init_panic_hook } from '../wasm/grading/openhw_studio_grading_engine.js';
import wasmUrl from '../wasm/grading/openhw_studio_grading_engine_bg.wasm?url';

// Direct logic imports to avoid "window is not defined" errors in Worker
import { FullCircuitValidator } from "@openhw/emulator/src/circuit-validation/engine.js";
import { analyzeCodeHardwareSync } from "@openhw/emulator/src/circuit-validation/sync-analyzer.js";

let isInitialized = false;

async function initEngine() {
    if (isInitialized) return;
    console.log("Grading Worker: Initializing WASM Engine...");
    await init(wasmUrl);
    init_panic_hook();
    isInitialized = true;
    console.log("Grading Worker: WASM Engine ready.");
    (self as any).postMessage({ type: 'LOG', msg: "Grading Engine (WASM) Initialized." });
}

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
}

import { getBoardCompileFiles } from '../utils/projectCompilerUtils';

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

async function compileSourceCode(payload: any, board: string): Promise<string> {
    const COMPILER_URL = 'http://localhost:5001/api/compile';
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
    } catch (err) {
        throw new Error(`[Network/API Error] ${err.message}`);
    }
}

async function captureBehavior(meta: any, durationMs: number, label: string): Promise<any> {
    const telemetry = {
        events: [] as any[],
        serial: "",
        duration_ms: durationMs
    };

    let lastComponentStates: Record<string, any> = {};
    let lastPinStates: Record<string, boolean> = {};
    const startTime = Date.now();

    try {
        const { createRunnerForBoard } = await import('./execute');
        const boardComp = (meta.components || []).find((c: any) => /(arduino|esp32|stm32|rp2040|pico)/i.test(String(c.type || '')));
        
        const boardCompId = boardComp?.id || 'uno1';
        const boardType = meta.board || boardComp?.type || 'wokwi-arduino-uno';
        const compileUnit = getBoardCompileFiles(meta, boardCompId);
        
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
            } catch (compileErr) {
                postMessage({ type: 'LOG', msg: `[v2.8] Warning: ${label} compilation failed: ${compileErr.message}`, logType: 'warning' });
            }
        }

        console.log(`[v2.8] ${label} starting simulation (Hex Length: ${firmwareHex.length})`);

        const runner = await createRunnerForBoard(
            meta.board || boardComp?.type || 'wokwi-arduino-uno',
            firmwareHex,
            meta.components || [],
            meta.connections || [],
            (state: any) => {
                const nowMs = runner.getSimulatedTimeMs();
                if (state.type === 'state' && state.pins) {
                    for (const pinId in state.pins) {
                        const newState = !!state.pins[pinId];
                        if (newState !== lastPinStates[pinId]) {
                            telemetry.events.push({
                                PinChange: { pin: pinId, state: newState, time_ms: nowMs }
                            });
                            lastPinStates[pinId] = newState;
                        }
                    }
                } else if (state.type === 'serial') {
                    telemetry.events.push({
                        SerialOutput: { data: state.data, time_ms: nowMs }
                    });
                    telemetry.serial += state.data;
                }
            },
            { speed: 1.0 }
        );
        
        runner.setTelemetryEnabled(true);
        const simStartMs = runner.getSimulatedTimeMs();
        
        while (runner.getSimulatedTimeMs() - simStartMs < durationMs) {
            await new Promise(resolve => setTimeout(resolve, 20));

            const nowMs = runner.getSimulatedTimeMs();
            const snapshot = runner.getRichTelemetrySnapshot({ mode: 'delta' });
            
            if (snapshot.components) {
                for (const comp of snapshot.components) {
                    if (!comp.delta) continue;
                    const cid = comp.id;
                    const custom = comp.metrics?.custom || {};
                    for (const key in custom) {
                        const val = custom[key];
                        const stateKey = `${cid}:${key}`;
                        
                        // Per-key filtering for extreme cleanliness
                        if (JSON.stringify(val) !== JSON.stringify(lastComponentStates[stateKey])) {
                            telemetry.events.push({ 
                                ComponentState: { id: cid, key: key, value: val, time_ms: nowMs } 
                            });
                            lastComponentStates[stateKey] = JSON.parse(JSON.stringify(val));
                        }
                    }
                }
            }

            if (Date.now() - startTime > 30000) { // Increased timeout for compilation buffer
                console.warn(`[v2.4] ${label} simulation timed out!`);
                break;
            }
        }
        
        const richSnapshot = runner.getRichTelemetrySnapshot({ mode: 'deep' });
        telemetry.rich_metrics = JSON.stringify(richSnapshot);
        
        runner.stop();
        postMessage({ type: 'LOG', msg: `[v2.3] ${label} complete. (${telemetry.events.length} events)` });
        return telemetry;
    } catch (err) {
        postMessage({ type: 'LOG', msg: `[v2.3] Warning: ${label} simulation failed: ${err}`, logType: 'warning' });
        return telemetry;
    }
}

onmessage = async (e: MessageEvent<GradingMessage>) => {
    try {
        const { type, teacher, student, options } = e.data;
        
        await initEngine();
        
        if (type === 'GENERATE_KEY') {
            const teacherData = teacher as any;
            postMessage({ type: 'LOG', msg: "Generating Reference Key: Running simulation..." });
            
            let teacherMeta;
            let projectJson: string;
            
            if (teacherData.project && teacherData.project.startsWith('{')) {
                projectJson = teacherData.project;
                teacherMeta = JSON.parse(projectJson);
            } else {
                const buf = teacherData.projectBuf || teacher;
                projectJson = extract_project_meta(new Uint8Array(buf as any));
                teacherMeta = JSON.parse(projectJson);
            }

            // Teacher Validation Gate
            postMessage({ type: 'LOG', msg: "Auditing Teacher Reference Circuit..." });
            const validator = new FullCircuitValidator(teacherMeta);
            validator.runValidation();
            const syncResult = analyzeCodeHardwareSync(teacherMeta);
            const teacherHealth = validator.calculateHealthScore(syncResult.issues);

            if (teacherHealth < 100) {
                postMessage({ type: 'LOG', msg: `[Warning] Teacher's reference circuit has spatial/electrical errors! Health: ${teacherHealth}%`, logType: 'warning' });
            }

            const telemetry = await captureBehavior(teacherMeta, 8000, "Teacher Reference");
            const key = generate_binary_key(
                projectJson, 
                JSON.stringify(telemetry),
                teacherHealth,
                JSON.stringify(validator.errors.map((e: any) => e.message))
            );
            postMessage({ type: 'KEY_GENERATED', key });

        } else if (type === 'GRADE' && student) {
            postMessage({ type: 'LOG', msg: "Starting Intelligent Grading Process..." });
            
            // 1. Student Metadata
            const studentMetaJson = extract_project_meta(new Uint8Array(student));
            const studentMeta = JSON.parse(studentMetaJson);

            // 2. RUN VALIDATION ENGINE (Electrical Safety & Sync)
            postMessage({ type: 'LOG', msg: "Running Electrical Safety & Sync Validation..." });
            const validator = new FullCircuitValidator(studentMeta);
            validator.runValidation();
            const syncResult = analyzeCodeHardwareSync(studentMeta);
            
            // 3. Behavioral Analysis (Teacher - IF PNG)
            let teacherBinaryKey: Uint8Array;
            if (teacher instanceof ArrayBuffer) {
                postMessage({ type: 'LOG', msg: "Teacher reference is a PNG. Generating behavioral baseline first..." });
                const teacherMetaJson = extract_project_meta(new Uint8Array(teacher));
                const teacherMeta = JSON.parse(teacherMetaJson);
                
                // Teacher Validation (Audit)
                const tValidator = new FullCircuitValidator(teacherMeta);
                tValidator.runValidation();
                const tSync = analyzeCodeHardwareSync(teacherMeta);
                const tHealth = tValidator.calculateHealthScore(tSync.issues);
                
                const teacherTelemetry = await captureBehavior(teacherMeta, 8000, "Teacher Reference");
                teacherBinaryKey = generate_binary_key(
                    teacherMetaJson, 
                    JSON.stringify(teacherTelemetry),
                    tHealth,
                    JSON.stringify(tValidator.errors.map((e: any) => e.message))
                );
            } else {
                teacherBinaryKey = new Uint8Array(teacher as any);
            }

            // 4. Behavioral Analysis (Student)
            const studentTelemetry = await captureBehavior(studentMeta, 8000, "Student Submission");

            // 5. BEHAVIOR-CORRECTED HEALTH (Trusting the simulation results over static analysis)
            const activeComponentIds = new Set(
                studentTelemetry.events
                    .filter(e => e.ComponentState)
                    .map(e => e.ComponentState.id)
            );

            const correctedErrors = validator.errors.filter(err => {
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

            validator.errors = correctedErrors;
            const healthScore = validator.calculateHealthScore(syncResult.issues);
            postMessage({ type: 'LOG', msg: `[Validation] Final Health Score: ${healthScore}%` });

            const validationErrors = [
                ...correctedErrors.map((e: any) => `Safety: ${e.message}`),
                ...syncResult.issues.map((e: any) => `Sync: ${e.message}`)
            ];

            postMessage({ type: 'LOG', msg: "[v2.2] Running Final Comparison (Rust/WASM)..." });
            const result = grade_circuits_wasm(
                new Uint8Array(student),
                teacherBinaryKey,
                JSON.stringify(studentTelemetry),
                {
                    ...options,
                    validation_health: healthScore,
                    validation_errors: validationErrors
                }
            );
            
            postMessage({ 
                type: 'GRADING_COMPLETE', 
                result,
                teacherBinaryKey: teacherBinaryKey 
            });
        }
    } catch (globalErr) {
        postMessage({ type: 'LOG', msg: `CRITICAL ERROR: ${globalErr}`, logType: 'error' });
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
