export const validation = {
    rules: [
        {
            name: "Rotary Encoder Connection Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const clk = `${component.id}.CLK`;
                const dt = `${component.id}.DT`;
                const gnd = `${component.id}.GND`;

                if (validator.getNeighbors(gnd).length === 0) {
                    return `⚠️ [Encoder ${component.id}] Ground (GND) is not connected.`;
                }

                if (validator.getNeighbors(clk).length === 0 || validator.getNeighbors(dt).length === 0) {
                    return `⚠️ [Encoder ${component.id}] Warning: Quadrature outputs (CLK/DT) must both be connected to track rotation.`;
                }

                return null;
            }
        }
    ]
};
