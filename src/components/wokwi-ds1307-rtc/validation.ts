export const validation = {
    rules: [
        {
            name: 'DS1307 Power Check',
            check: (component: any, graph: Map<string, string[]>) => {
                const vcc = graph.get(`${component.id}.VCC`);
                const gnd = graph.get(`${component.id}.GND`);
                if (!vcc || vcc.length === 0) return `⚠️ [DS1307 ${component.id}] VCC not connected. Connect to 5V.`;
                if (!gnd || gnd.length === 0) return `⚠️ [DS1307 ${component.id}] GND not connected.`;
                return null;
            },
        },
        {
            name: 'DS1307 I2C Check',
            check: (component: any, graph: Map<string, string[]>) => {
                const sda = graph.get(`${component.id}.SDA`);
                const scl = graph.get(`${component.id}.SCL`);
                if (!sda || sda.length === 0) return `⚠️ [DS1307 ${component.id}] SDA not connected. Connect to Arduino A4.`;
                if (!scl || scl.length === 0) return `⚠️ [DS1307 ${component.id}] SCL not connected. Connect to Arduino A5.`;
                return null;
            },
        },
    ],
};
