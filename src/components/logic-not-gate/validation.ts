export const validation = {
    rules: [
        {
            name: "NOT Gate Connection Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const pinIn = graph.get(`${component.id}.IN`);
                const pinOut = graph.get(`${component.id}.OUT`);

                if ((!pinIn || pinIn.length === 0) && (!pinOut || pinOut.length === 0)) {
                    return `⚠️ [NOT Gate ${component.id}] Warning: Neither input nor output pins are connected.`;
                }

                if (!pinIn || pinIn.length === 0) {
                    return `⚠️ [NOT Gate ${component.id}] Warning: Input pin (IN) is not connected. Output will float.`;
                }

                if (!pinOut || pinOut.length === 0) {
                    return `⚠️ [NOT Gate ${component.id}] Warning: Output pin (OUT) is not connected.`;
                }

                return null;
            }
        }
    ]
};
