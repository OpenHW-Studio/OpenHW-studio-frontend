export const validation = {
    rules: [
        {
            name: 'MPU6050 Power Check',
            check: (component: any, graph: Map<string, string[]>) => {
                const vcc = graph.get(`${component.id}.VCC`);
                const gnd = graph.get(`${component.id}.GND`);
                if (!vcc || vcc.length === 0) return `⚠️ [MPU6050 ${component.id}] VCC not connected. Connect to 3.3V or 5V.`;
                if (!gnd || gnd.length === 0) return `⚠️ [MPU6050 ${component.id}] GND not connected.`;
                return null;
            },
        },
        {
            name: 'MPU6050 I2C Check',
            check: (component: any, graph: Map<string, string[]>) => {
                const scl = graph.get(`${component.id}.SCL`);
                const sda = graph.get(`${component.id}.SDA`);
                if (!scl || scl.length === 0) return `⚠️ [MPU6050 ${component.id}] SCL not connected. Connect to Arduino A5.`;
                if (!sda || sda.length === 0) return `⚠️ [MPU6050 ${component.id}] SDA not connected. Connect to Arduino A4.`;
                return null;
            },
        },
        {
            name: 'MPU6050 Wake Up Reminder',
            check: (component: any, graph: Map<string, string[]>) => {
                const sda = graph.get(`${component.id}.SDA`);
                if (sda && sda.length > 0) {
                    return `💡 [MPU6050 ${component.id}] Remember to call Wire.beginTransmission(0x68); Wire.write(0x6B); Wire.write(0); Wire.endTransmission(); in setup() to wake the MPU6050 from sleep mode.`;
                }
                return null;
            },
        },
    ],
};
