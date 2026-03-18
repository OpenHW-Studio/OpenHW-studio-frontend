export const validation = {
    rules: [
        {
            id: "lcd2004-i2c-connection",
            description: "Check I2C Connection",
            check: (component: any, graph: Map<string, string[]>) => {
                const sda = graph.get(`${component.id}.SDA`);
                const scl = graph.get(`${component.id}.SCL`);
                if ((!sda || sda.length === 0) && (!scl || scl.length === 0)) {
                    return { passed: false, warning: `[LCD 2004 ${component.id}] Warning: SDA and SCL are not connected.` };
                }
                return { passed: true };
            }
        }
    ]
};