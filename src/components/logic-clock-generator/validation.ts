export const validation = {
    rules: [
        {
            name: "Clock Generator Output Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const pinOut = graph.get(`${component.id}.OUT`);
                // It is just a warning if the clock isn't connected to anything
                if (!pinOut || pinOut.length === 0) {
                    return `⚠️ [Clock Generator ${component.id}] Warning: Clock OUT pin is not connected to anything.`;
                }
                return null;
            }
        }
    ]
};
