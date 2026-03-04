export const validation = {
    rules: [
        {
            name: "Pushbutton Floating Input Check",
            check: (component: any, graph: Map<string, string[]>) => {
                // Check if any pin is connected
                const p1 = graph.get(`${component.id}.1l`);
                const p2 = graph.get(`${component.id}.2l`);

                if ((!p1 || p1.length === 0) && (!p2 || p2.length === 0)) {
                    return `⚠️ [Pushbutton ${component.id}] Warning: Button is completely disconnected.`;
                }
                return null;
            }
        }
    ]
};
