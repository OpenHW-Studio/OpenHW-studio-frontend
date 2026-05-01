export const validation = {
    rules: [
        {
            name: "LDR Module Wiring Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const vccNode = `${component.id}.VCC`;
                const gndNode = `${component.id}.GND`;
                const outNode = `${component.id}.AO`; // Analog Output

                const vccV = validator.calculateVoltageAtNode(vccNode);
                const gndV = validator.calculateVoltageAtNode(gndNode);

                if (vccV > 0.5 && Math.abs(vccV - gndV) < 0.1) {
                    return `🔥 [LDR Module ${component.id}] FATAL: VCC and GND are shorted on the module pins!`;
                }

                if (validator.getNeighbors(vccNode).length > 0 && validator.getNeighbors(outNode).length === 0) {
                    return `⚠️ [LDR Module ${component.id}] Warning: Module is powered but the Signal (AO) pin is not connected to anything.`;
                }

                return null;
            }
        }
    ]
};