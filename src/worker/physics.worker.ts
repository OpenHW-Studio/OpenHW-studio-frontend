// physics.worker.ts
// Dedicated worker for heavy Modified Nodal Analysis (MNA) matrix calculations

import { CircuitSolver } from './execute.ts';

let solver = new CircuitSolver();

self.onmessage = async (e) => {
    const { type, payload } = e.data;

    switch (type) {
        case 'reset':
            solver.reset();
            break;

        case 'topology':
            // payload: { pinNodes: Record<string, number>, componentsData: any[] }
            solver.reset();
            if (payload.pinNodes) {
                Object.entries(payload.pinNodes).forEach(([pinId, nodeId]) => {
                    solver.addPin(pinId, nodeId as number);
                });
            }
            if (payload.componentsData) {
                // Reconstruct stamps if needed, or if the solver is modified to accept raw stamps
                // For now, let's assume we pass component types and they are reconstructed
            }
            break;

        case 'solve':
            // payload: { voltageSources: { pinId: string, voltage: number }[] }
            if (payload.voltageSources) {
                (solver as any).voltageSources = [];
                payload.voltageSources.forEach((vs: any) => {
                    solver.addVoltageSource(vs.pinId, vs.voltage);
                });
            }
            const voltages = solver.solve();
            self.postMessage({ type: 'voltages', payload: Array.from(voltages.entries()) });
            break;
            
        case 'solve_stamped':
            // High-performance path: solver already has topology, just update sources and solve
            if (payload.voltageSources) {
                (solver as any).voltageSources = [];
                payload.voltageSources.forEach((vs: any) => {
                    solver.addVoltageSource(vs.pinId, vs.voltage);
                });
            }
            const vMap = solver.solve();
            self.postMessage({ type: 'voltages', payload: Array.from(vMap.entries()) });
            break;
    }
};
