export const validation = {
    rules: [
        {
            name: "Buzzer Connection Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const pin1 = graph.get(`${component.id}.1`);
                const pin2 = graph.get(`${component.id}.2`);

                if ((!pin1 || pin1.length === 0) && (!pin2 || pin2.length === 0)) {
                    return `⚠️ [Buzzer ${component.id}] Warning: Neither of the buzzer pins are connected.`;
                }

                return null;
            }
        }
    ]
};
