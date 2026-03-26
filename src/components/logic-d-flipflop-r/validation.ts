export const validation = {
    rules: [
        {
            name: "D Flip-Flop (Reset) Connection Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const pinD = graph.get(`${component.id}.D`);
                const pinClk = graph.get(`${component.id}.CLK`);
                const pinR = graph.get(`${component.id}.R`);
                const pinQ = graph.get(`${component.id}.Q`);

                if ((!pinD || pinD.length === 0) && (!pinClk || pinClk.length === 0) &&
                    (!pinQ || pinQ.length === 0) && (!pinR || pinR.length === 0)) {
                    return `⚠️ [D Flip-Flop (Reset) ${component.id}] Warning: No pins are connected.`;
                }
                return null;
            }
        }
    ]
};
