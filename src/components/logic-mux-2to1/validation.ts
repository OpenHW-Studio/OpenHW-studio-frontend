export const validation = {
    rules: [
        {
            name: "MUX 2:1 Connection Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const pinD0 = graph.get(`${component.id}.D0`);
                const pinD1 = graph.get(`${component.id}.D1`);
                const pinSel = graph.get(`${component.id}.SEL`);
                const pinOut = graph.get(`${component.id}.OUT`);

                if ((!pinD0 || pinD0.length === 0) && (!pinD1 || pinD1.length === 0) &&
                    (!pinSel || pinSel.length === 0) && (!pinOut || pinOut.length === 0)) {
                    return `⚠️ [MUX 2:1 ${component.id}] Warning: No pins are connected.`;
                }
                return null;
            }
        }
    ]
};
