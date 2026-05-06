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

async function captureBehavior(meta: any, durationMs: number, label: string): Promise<any> {
    const telemetry = {
        events: [] as any[],
        serial: "",
        duration_ms: durationMs
    };

    let lastPins: Record<string, boolean> = {};
    const startTime = Date.now();

    try {
        console.log(`Grading Worker: Starting simulation for ${label}...`);
        const { createRunnerForBoard } = await import('./execute');
        const runner = await createRunnerForBoard(
            meta.board || 'arduino_uno',
            meta.code || "",
            meta.components || [],
            meta.connections || [],
            (state: any) => {
                const nowMs = runner.getSimulatedTimeMs();
                if (state.type === 'state') {
                    // 1. CPU Pin Changes
                    if (state.pins) {
                        for (const pinId in state.pins) {
                            const val = !!state.pins[pinId];
                            if (val !== lastPins[pinId]) {
                                telemetry.events.push({
                                    PinChange: {
                                        pin: pinId,
                                        state: val,
                                        time_ms: nowMs
                                    }
                                });
                                lastPins[pinId] = val;
                            }
                        }
                    }

                    // 2. Component Internal States (Functional Telemetry)
                    if (state.components && Array.isArray(state.components)) {
                        for (const comp of state.components) {
                            const cid = comp.id;
                            if (comp.glow !== undefined) {
                                telemetry.events.push({ ComponentState: { id: cid, key: 'glow', value: String(comp.glow), time_ms: nowMs } });
                            }
                            if (comp.current !== undefined) {
                                telemetry.events.push({ ComponentState: { id: cid, key: 'current', value: String(comp.current), time_ms: nowMs } });
                            }
                            if (comp.voltageDrop !== undefined) {
                                telemetry.events.push({ ComponentState: { id: cid, key: 'voltageDrop', value: String(comp.voltageDrop), time_ms: nowMs } });
                            }
                        }
                    }
                } else if (state.type === 'serial') {
                    telemetry.events.push({
                        SerialOutput: {
                            data: state.data,
                            time_ms: nowMs
                        }
                    });
                }
            }
        );
        
        runner.onSerialByte = (byte: number) => {
            const char = String.fromCharCode(byte);
            telemetry.serial += char;
            telemetry.events.push({
                SerialOutput: {
                    data: char,
                    time_ms: runner.getSimulatedTimeMs()
                }
            });
        };

        runner.setTelemetryEnabled(true);
        postMessage({ type: 'LOG', msg: `[v2.2] ${label} simulation started. Capturing (8s)...` });
        
        const loopStart = Date.now();
        while (Date.now() - loopStart < durationMs) {
            const remaining = Math.ceil((durationMs - (Date.now() - loopStart)) / 1000);
            postMessage({ type: 'LOG', msg: `[v2.2] ${label} capture: ${remaining}s remaining...` });
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Final Rich Snapshot (Explicitly DEEP mode for grading)
        const richSnapshot = runner.getRichTelemetrySnapshot({ mode: 'deep' });
        telemetry.rich_metrics = JSON.stringify(richSnapshot);
        
        runner.stop();
        postMessage({ type: 'LOG', msg: `[v2.2] ${label} capture complete. (${telemetry.events.length} events recorded)` });
        return telemetry;
    } catch (err) {
        console.error(`Grading Worker: ${label} Simulation Error`, err);
        postMessage({ type: 'LOG', msg: `[v2.2] Warning: ${label} simulation failed (${err}).`, logType: 'warning' });
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

            const telemetry = await captureBehavior(teacherMeta, 5000, "Teacher Reference");
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
            const healthScore = validator.calculateHealthScore(syncResult.issues);
            
            postMessage({ type: 'LOG', msg: `[Validation] Project Health: ${healthScore}%` });
            validator.errors.forEach((err: any) => {
                postMessage({ type: 'LOG', msg: `[Validation] SAFETY: ${err.message}`, logType: 'warning' });
            });
            syncResult.issues.forEach((issue: any) => {
                postMessage({ type: 'LOG', msg: `[Validation] SYNC: ${issue.message}`, logType: 'warning' });
            });

            const validationErrors = [
                ...validator.errors.map((e: any) => `Safety: ${e.message}`),
                ...syncResult.issues.map((e: any) => `Sync: ${e.message}`)
            ];

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
