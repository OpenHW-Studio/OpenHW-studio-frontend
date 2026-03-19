export const validation = {
    rules: [
        {
            id: "ldr-mod-short",
            description: "Check for VCC and GND short on LDR module.",
            check: (comp: any, graph: any, validator: any) => {
                const vccV = validator.calculateVoltageAtNode(`${comp.id}:VCC`);
                const gndV = validator.calculateVoltageAtNode(`${comp.id}:GND`);
                if (vccV > 0.5 && Math.abs(vccV - gndV) < 0.1) {
                    return { passed: false, warning: "LDR Module VCC and GND are shorted!" };
                }
                return { passed: true };
            }
        }
    ]
};