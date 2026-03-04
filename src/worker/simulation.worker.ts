import { AVRRunner, LOGIC_REGISTRY, COMPONENT_PINS } from './execute';
import { BaseComponent } from '@openhw/emulator/src/components/BaseComponent.ts';

let runner: AVRRunner | null = null;
let components: any[] = [];
let wires: any[] = [];
let oopInstances: Map<string, any> = new Map();

self.onmessage = async (e) => {
    const data = e.data;

    if (data.type === 'START') {
        const { hex, components, wires, customLogics } = data;

        if (runner) {
            runner.stop();
        }

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

        // Instantiate OOP logics

        runner = new AVRRunner(hex, components, wires, (stateObj) => {
            postMessage(stateObj);
        });

    } else if (data.type === 'STOP') {
        if (runner) {
            runner.stop();
            runner = null;
        }
    } else if (data.type === 'INTERACT') {
        console.log(`[Worker] Received INTERACT for ${data.compId}: ${data.event}`);
        if (runner) {
            const inst = runner.instances.get(data.compId);
            if (inst && typeof inst.onEvent === 'function') {
                inst.onEvent(data.event);
            }
        }
    } else if (data.type === 'SERIAL_INPUT') {
        if (runner) {
            runner.serialRx(data.data);
        }
    } else if (data.type === 'RESET') {
        if (runner && runner.cpu) {
            runner.cpu.reset();
        }
    }
};
