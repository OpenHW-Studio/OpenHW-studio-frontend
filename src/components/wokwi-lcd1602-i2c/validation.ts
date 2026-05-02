export const validation = {
    rules: [
        {
            name: "I2C Interface Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const pins = (component.pins || []).map((p: any) => p.id);
                const sda = pins.find((p: string) => p.includes('SDA'));
                const scl = pins.find((p: string) => p.includes('SCL'));
                const vcc = pins.find((p: string) => p.includes('VCC') || p.includes('V+'));
                const gnd = pins.find((p: string) => p.includes('GND'));

                if (vcc && validator.getNeighbors(`${component.id}.${vcc}`).length === 0) {
                    return `⚠️ [${component.type} ${component.id}] Power (VCC) is not connected.`;
                }
                if (gnd && validator.getNeighbors(`${component.id}.${gnd}`).length === 0) {
                    return `⚠️ [${component.type} ${component.id}] Ground (GND) is not connected.`;
                }
                if (sda && validator.getNeighbors(`${component.id}.${sda}`).length === 0) {
                    return `⚠️ [${component.type} ${component.id}] I2C SDA pin is floating.`;
                }
                if (scl && validator.getNeighbors(`${component.id}.${scl}`).length === 0) {
                    return `⚠️ [${component.type} ${component.id}] I2C SCL pin is floating.`;
                }

                return null;
            }
        }
    ]
};
