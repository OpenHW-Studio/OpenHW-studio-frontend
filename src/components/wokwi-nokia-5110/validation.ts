export function validate(component: any, wires: any[]) {
    const warnings = [];
    const errors = [];
    const connectedPins = new Set();

    wires.forEach(wire => {
        if (wire.from.startsWith(`${component.id}:`)) connectedPins.add(wire.from.split(':')[1]);
        if (wire.to.startsWith(`${component.id}:`)) connectedPins.add(wire.to.split(':')[1]);
    });

    if (!connectedPins.has('VCC') || !connectedPins.has('GND')) {
        errors.push('Nokia 5110 requires power (VCC and GND).');
    }

    if (!connectedPins.has('DIN') || !connectedPins.has('CLK') || !connectedPins.has('CE') || !connectedPins.has('DC')) {
        warnings.push('Nokia 5110 SPI pins (DIN, CLK, CE, DC) are not fully connected.');
    }

    return { warnings, errors };
}
