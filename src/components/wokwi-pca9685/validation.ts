export function validate(component: any, wires: any[]) {
    const warnings = [];
    const errors = [];
    const connectedPins = new Set();

    wires.forEach(wire => {
        if (wire.from.startsWith(`${component.id}:`)) connectedPins.add(wire.from.split(':')[1]);
        if (wire.to.startsWith(`${component.id}:`)) connectedPins.add(wire.to.split(':')[1]);
    });

    if (!connectedPins.has('VCC') || !connectedPins.has('GND')) {
        errors.push('PCA9685 requires logic power (VCC and GND).');
    }
    if (!connectedPins.has('SCL') || !connectedPins.has('SDA')) {
        warnings.push('PCA9685 I2C lines (SDA/SCL) are unconnected.');
    }

    return { warnings, errors };
}
