export const validation = {
    rules: [
        {
            name: "Diode Connection Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const anodeNode = `${component.id}.A`;
                const cathodeNode = `${component.id}.K`;

                const aConns = graph.get(anodeNode) || [];
                const kConns = graph.get(cathodeNode) || [];

                if (aConns.length === 0 && kConns.length === 0) {
                    return `⚠️ [Diode ${component.id}] Warning: Neither Anode nor Cathode is connected.`;
                }

                const vA = validator.calculateVoltageAtNode(anodeNode);
                const vK = validator.calculateVoltageAtNode(cathodeNode);

                if (vK > vA + 0.1 && aConns.length > 0 && kConns.length > 0) {
                    return `⚠️ [Diode ${component.id}] Reverse Bias: Cathode voltage (${vK.toFixed(1)}V) is higher than Anode (${vA.toFixed(1)}V). Diode will block current.`;
                }

                return null;
            }
        }
    ]
};
