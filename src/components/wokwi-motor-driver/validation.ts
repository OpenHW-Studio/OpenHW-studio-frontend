export const validation = {
    rules: [
        {
            name: "Motor Driver Power Check",
            check: (component: any, graph: Map<string, string[]>) => {
                const logicPower = graph.get(`${component.id}.VCC`); // Assuming VCC is logic
                const motorPower = graph.get(`${component.id}.VM`);  // Assuming VM is motor

                if (!logicPower || logicPower.length === 0) {
                    return `⚠️ [Motor Driver ${component.id}] Error: Logic power (VCC) is missing.`;
                }
                if (!motorPower || motorPower.length === 0) {
                    return `⚠️ [Motor Driver ${component.id}] Error: Motor power (VM) is missing.`;
                }
                return null;
            }
        }
    ]
};
