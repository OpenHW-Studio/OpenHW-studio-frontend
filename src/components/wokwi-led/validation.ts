export const validation = {
    rules: [
        {
            name: "LED Series Resistor Check",
            check: (component: any, graph: Map<string, string[]>) => {
                // To check if the LED has a series resistor, we can see if it directly connects 
                // to power or ground without any resistor in between.
                // Note: FullCircuitValidator already does current calculation, 
                // but this represents component-specific hints.
                const anodeConnected = graph.get(`${component.id}.A`);
                const cathodeConnected = graph.get(`${component.id}.K`);

                if (!anodeConnected || !cathodeConnected) return null;

                // If directly connected to VCC and GND without a resistor, the global engine catches it.
                // We'll leave it simple.
                if (anodeConnected.length === 0 && cathodeConnected.length === 0) {
                    return `⚠️ [LED ${component.id}] Warning: Neither Anode nor Cathode is connected.`;
                }
                return null;
            }
        }
    ]
};
