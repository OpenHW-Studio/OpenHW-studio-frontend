export const validation = {
    rules: [
        {
            id: 'max7219-power-check',
            description: 'MAX7219 needs VCC and GND properly connected',
            check(comp: any, graph: any, validator: any) {
                const vccPin = comp.pins.find((p: any) => p.id === 'VCC');
                const vccVolts = validator.calculateVoltageAtNode(vccPin.id);
                
                if (vccVolts < 4.5) {
                    return { level: 'warning', message: 'MAX7219 requires 5V on VCC' };
                }
                return null;
            }
        }
    ]
};