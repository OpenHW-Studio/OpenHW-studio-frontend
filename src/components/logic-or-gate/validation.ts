export const validation = {
    rules: [
        {
            name: "OR Gate Connection Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const pinIn1 = graph.get(`${component.id}.IN1`);
                const pinIn2 = graph.get(`${component.id}.IN2`);
                const pinOut = graph.get(`${component.id}.OUT`);

                if ((!pinIn1 || pinIn1.length === 0) && (!pinIn2 || pinIn2.length === 0) && (!pinOut || pinOut.length === 0)) {
                    return `⚠️ [OR Gate ${component.id}] Warning: No pins are connected.`;
                }
                return null;
            }
        }
    ]
};
