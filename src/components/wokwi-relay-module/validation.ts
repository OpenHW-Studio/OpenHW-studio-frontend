export const validation = {
    rules: [
        {
            name: 'Relay Module Power Check',
            check: (component: any, graph: Map<string, string[]>) => {
                const vcc = graph.get(`${component.id}.VCC`);
                const gnd = graph.get(`${component.id}.GND`);
                if (!vcc || vcc.length === 0)
                    return `⚠️ [Relay ${component.id}] VCC not connected. Connect to 5V (not Arduino 5V pin — use external supply for high-current loads).`;
                if (!gnd || gnd.length === 0)
                    return `⚠️ [Relay ${component.id}] GND not connected.`;
                return null;
            },
        },
        {
            name: 'Relay Module Control Pin Check',
            check: (component: any, graph: Map<string, string[]>) => {
                const inp = graph.get(`${component.id}.IN`);
                if (!inp || inp.length === 0)
                    return `⚠️ [Relay ${component.id}] IN pin not connected. Connect to an Arduino digital output pin.`;
                return null;
            },
        },
    ],
};
