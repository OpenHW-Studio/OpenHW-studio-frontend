export const validation = {
    rules: [
        {
            name: "74xx IC VCC Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const vcc = graph.get(`${component.id}.p14`);
                if (!vcc || vcc.length === 0) {
                    return `⚠️ [${component.id}] Warning: VCC (pin 14) is not connected. IC needs 5V power.`;
                }
                return null;
            }
        },
        {
            name: "74xx IC GND Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const gnd = graph.get(`${component.id}.p7`);
                if (!gnd || gnd.length === 0) {
                    return `⚠️ [${component.id}] Warning: GND (pin 7) is not connected. IC needs ground.`;
                }
                return null;
            }
        }
    ]
};
