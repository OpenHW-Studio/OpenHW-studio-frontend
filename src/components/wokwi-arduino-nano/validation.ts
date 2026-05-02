export const validation = {
    rules: [
        {
            name: "Floating Pins Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const digitalPins = ["D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12", "D13"];
                digitalPins.forEach(pinName => {
                    const pinNode = `${component.id}.${pinName}`;
                    const neighbors = validator.getNeighbors(pinNode);
                    if (neighbors.length > 0) {
                        // Check if it leads to a switch without pullup
                        const isFloating = neighbors.some((n: string) => n.includes('button') || n.includes('switch'));
                        if (isFloating) {
                             const hasPowerPath = validator.calculateVoltageAtNode(pinNode) > 0 || validator.isGroundNode(pinNode);
                             if (!hasPowerPath) {
                                 validator.errors.push(`👻 [Nano ${component.id}] FLOATING PIN: ${pinNode} is connected to a switch but lacks a pull-up/pull-down resistor.`);
                             }
                        }
                    }
                });
                return null;
            }
        },
        {
            name: "I2C Pullups Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const i2cPins = ["A4", "A5"];
                i2cPins.forEach(pinName => {
                    const pinNode = `${component.id}.${pinName}`;
                    if (validator.getNeighbors(pinNode).length > 0) {
                        const hasPullup = validator.findSeriesResistance(pinNode) > 0;
                        if (!hasPullup) {
                            validator.errors.push(`⚠️ [Nano ${component.id}] I2C PULLUP WARNING: ${pinNode} is in use but missing a Pull-Up resistor to VCC.`);
                        }
                    }
                });
                return null;
            }
        }
    ]
};
