export const validation = {
    rules: [
        {
            name: "NPN Transistor Connection Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const b = `${component.id}.B`; // Base
                const c = `${component.id}.C`; // Collector
                const e = `${component.id}.E`; // Emitter

                const hasB = validator.getNeighbors(b).length > 0;
                const hasC = validator.getNeighbors(c).length > 0;
                const hasE = validator.getNeighbors(e).length > 0;

                if (hasB && hasC && hasE) {
                    const vB = validator.calculateVoltageAtNode(b);
                    const vC = validator.calculateVoltageAtNode(c);
                    const vE = validator.calculateVoltageAtNode(e);

                    if (vB > vC + 0.5 && vC > 0.1) {
                        return `⚠️ [NPN ${component.id}] Potential Over-Saturation: Base voltage (${vB.toFixed(1)}V) is higher than Collector (${vC.toFixed(1)}V). Ensure you have a current-limiting resistor on the Base.`;
                    }
                    if (vE > vB && vE > 0.1) {
                        return `⚠️ [NPN ${component.id}] Reverse Bias: Emitter voltage is higher than Base. The transistor will not switch correctly in this configuration.`;
                    }
                } else if (hasB || hasC || hasE) {
                    return `⚠️ [NPN ${component.id}] Warning: Transistor is only partially connected. All three pins (C, B, E) usually need to be wired.`;
                }

                return null;
            }
        }
    ]
};
