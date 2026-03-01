import { AVRRunner } from './execute';
// We will create execute.ts to manage avr8js.

let runner: AVRRunner | null = null;
let components: any[] = [];
let wires: any[] = [];
let oopInstances: Map<string, any> = new Map();

self.onmessage = async (e) => {
    const data = e.data;

    if (data.type === 'START') {
        const { hex, components, wires } = data;

        if (runner) {
            runner.stop();
        }

        // Instantiate OOP logics
        oopInstances.clear();
        for (const c of components) {
            // Dynamic import logic.ts works in some bundlers for workers, but Vite has specific rules.
            // A safer approach for Vite workers is to map them statically or let the main thread pass the behavior.
            // Since we know the types, we can use a factory here or import them up top.
        }

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
    }
};
