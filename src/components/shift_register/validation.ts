export const validation = {
    // Custom Validation rules scoped specifically for the Shift Register that the Engine will consume
    rules: [
        {
            name: "Floating Output Enable (OE) Pin",
            check: (component: any, graph: Map<string, string[]>) => {
                const oeConnected = graph.get(`${component.id}.oe`);
                if (!oeConnected || oeConnected.length === 0) {
                    return `⚠️ [Shift Register ${component.id}] Warning: Output Enable (OE) pin is floating. It should be tied to GND to enable outputs, or driven by the MCU.`;
                }
                return null; // Passed
            }
        },
        {
            name: "Floating Clear (SRCLR) Pin",
            check: (component: any, graph: Map<string, string[]>) => {
                const clearConnected = graph.get(`${component.id}.srclr`);
                if (!clearConnected || clearConnected.length === 0) {
                    return `⚠️ [Shift Register ${component.id}] Warning: Clear (SRCLR) pin is floating. It should be tied to VCC to prevent random resets.`;
                }
                return null;
            }
        }
    ]
};
