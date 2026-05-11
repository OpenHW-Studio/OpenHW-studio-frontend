export const validation = {
    rules: [
        {
            name: 'BMP180 Power Check',
            check: (component: any, graph: Map<string, string[]>) => {
                const vcc = graph.get(`${component.id}.VIN`);
                const gnd = graph.get(`${component.id}.GND`);
                if (!vcc || vcc.length === 0)
                    return `⚠️ [BMP180 ${component.id}] VIN not connected. Use 3.3V (preferred) or 5V.`;
                if (!gnd || gnd.length === 0)
                    return `⚠️ [BMP180 ${component.id}] GND not connected.`;
                return null;
            },
        },
        {
            name: 'BMP180 I2C Bus Check',
            check: (component: any, graph: Map<string, string[]>) => {
                const scl = graph.get(`${component.id}.SCL`);
                const sda = graph.get(`${component.id}.SDA`);
                if (!scl || scl.length === 0)
                    return `⚠️ [BMP180 ${component.id}] SCL not connected. Connect to Arduino A5 (SCL).`;
                if (!sda || sda.length === 0)
                    return `⚠️ [BMP180 ${component.id}] SDA not connected. Connect to Arduino A4 (SDA).`;
                return null;
            },
        },
        {
            name: 'BMP180 I2C Pin Mapping Check',
            check: (component: any, graph: Map<string, string[]>) => {
                const scl = graph.get(`${component.id}.SCL`) || [];
                const sda = graph.get(`${component.id}.SDA`) || [];
                const sclOk = scl.some((c: string) => c.includes(':A5') || c.includes(':SCL'));
                const sdaOk = sda.some((c: string) => c.includes(':A4') || c.includes(':SDA'));
                if (!sclOk)
                    return `⚠️ [BMP180 ${component.id}] SCL should connect to Arduino A5. Use Wire.begin() and the Adafruit_BMP085 library.`;
                if (!sdaOk)
                    return `⚠️ [BMP180 ${component.id}] SDA should connect to Arduino A4.`;
                return null;
            },
        },
    ],
};
