export const validation = {
    rules: [
        {
            name: "Keypad Connection Check",
            check: (component: any, graph: Map<string, string[]>) => {
                const r1 = graph.get(`${component.id}.R1`);
                const c1 = graph.get(`${component.id}.C1`);
                if ((!r1 || r1.length === 0) && (!c1 || c1.length === 0)) {
                    return `⚠️ [Keypad ${component.id}] Warning: Keypad is completely disconnected.`;
                }
                return null;
            }
        }
    ]
};
