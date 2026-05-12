export const validation = {
    rules: [
        {
            name: "Buffer Gate Connection Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const pinIn = graph.get(`${component.id}.IN`);
                const pinOut = graph.get(`${component.id}.OUT`);

                if ((!pinIn || pinIn.length === 0) && (!pinOut || pinOut.length === 0)) {
                    return `⚠️ [Buffer Gate ${component.id}] Warning: No pins are connected.`;
                }
                return null;
            }
        }
    ]
};
