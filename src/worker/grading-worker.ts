console.log("Grading Worker: Script parsing started...");
import init, { grade_circuits_wasm, generate_binary_key, extract_project_meta } from '../wasm/grading/openhw_studio_grading_engine.js';
import wasmUrl from '../wasm/grading/openhw_studio_grading_engine_bg.wasm?url';

let isInitialized = false;

async function initEngine() {
    if (isInitialized) return;
    console.log("Grading Worker: Initializing WASM Engine...");
    await init(wasmUrl);
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

onmessage = async (e: MessageEvent<GradingMessage>) => {
    try {
        const { type, teacher, student, options } = e.data;
        
        await initEngine();
        
        if (type === 'GENERATE_KEY') {
            const teacherData = teacher as TeacherData;
            const key = generate_binary_key(teacherData.project, teacherData.telemetry);
            postMessage({ type: 'KEY_GENERATED', key });
        } else if (type === 'GRADE' && student) {
            postMessage({ type: 'LOG', msg: "Extracting metadata from student submission..." });
            
            let studentMeta;
            try {
                const studentMetaJson = extract_project_meta(new Uint8Array(student));
                studentMeta = JSON.parse(studentMetaJson);
                postMessage({ type: 'LOG', msg: `Metadata extracted: ${studentMeta.components.length} components found.` });
            } catch (err) {
                throw new Error(`Failed to extract student metadata: ${err}`);
            }

            const captureBehavior = async (meta: any, label: string) => {
                postMessage({ type: 'LOG', msg: `[v2.2] Capturing behavior for ${label}...` });
                const telemetry = {
                    events: [] as any[],
                    serial: "",
                    duration_ms: 5000
                };

                try {
                    const { createRunnerForBoard } = await import('./execute.js');
                    const runner = await createRunnerForBoard(
                        meta.board || 'arduino_uno',
                        meta.code || "",
                        meta.components || [],
                        meta.connections || [],
                        (state: any) => {
                            if (state.type === 'state' && state.pins) {
                                telemetry.events.push({
                                    t: Date.now(),
                                    type: 'pin',
                                    pins: state.pins
                                });
                            }
                        }
                    );
                    
                    runner.onSerialByte = (byte: number) => {
                        telemetry.serial += String.fromCharCode(byte);
                    };

                    for (let i = 5; i > 0; i--) {
                        postMessage({ type: 'LOG', msg: `[v2.2] ${label} simulation: ${i}s remaining` });
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    
                    runner.stop();
                    return telemetry;
                } catch (err) {
                    postMessage({ type: 'LOG', msg: `[v2.2] Warning: ${label} simulation failed.` });
                    return telemetry;
                }
            };

            let studentTelemetryJson = "{}";
            if (type === 'GRADE') {
                // If teacher is a PNG (not a binary key), we should ideally capture it too.
                // But for speed, if we are in GRADE mode, we focus on student.
                // HOWEVER, if the user wants accurate behavior, we need BOTH.
                // For now, let's run student capture.
                const sTel = await captureBehavior(studentMeta, "Student Submission");
                studentTelemetryJson = JSON.stringify(sTel);
            }

            postMessage({ type: 'LOG', msg: "[v2.2] Running Intelligent Comparison (Rust/WASM)..." });
            const result = grade_circuits_wasm(
                new Uint8Array(student),
                new Uint8Array(teacher as ArrayBuffer),
                studentTelemetryJson,
                options
            );
            
            postMessage({ type: 'GRADING_COMPLETE', result });
        }
    } catch (globalErr) {
        postMessage({ type: 'LOG', msg: `CRITICAL ERROR: ${globalErr}`, logType: 'error' });
        // Send a mock result so the UI stops spinning
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
