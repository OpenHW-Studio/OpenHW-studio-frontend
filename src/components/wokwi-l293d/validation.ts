export const validation = {
    rules: [
        {
            name: "L293D Dual Power Supply Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const vcc1 = `${component.id}.VCC1`; // Logic Power
                const vcc2 = `${component.id}.VCC2`; // Motor Power
                const gnd = `${component.id}.GND.1` || `${component.id}.GND`;

                const v1 = validator.calculateVoltageAtNode(vcc1);
                const v2 = validator.calculateVoltageAtNode(vcc2);

                if (v1 < 4.5) {
                    return `⚠️ [L293D ${component.id}] Logic Power (VCC1) is missing or too low. Motor driver will not function.`;
                }
                if (v2 < v1) {
                    return `⚠️ [L293D ${component.id}] Warning: Motor Power (VCC2) is lower than Logic Power. Motors may be underpowered or stall.`;
                }
                if (validator.getNeighbors(gnd).length === 0) {
                    return `⚠️ [L293D ${component.id}] Ground connection is missing.`;
                }

                return null;
            }
        }
    ]
};
