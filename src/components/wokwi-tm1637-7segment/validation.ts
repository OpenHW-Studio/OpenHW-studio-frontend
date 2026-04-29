export function validate(component: any, wires: any[]) {
    const warnings = [];
    const errors = [];

    const connectedPins = new Set();
    wires.forEach(wire => {
        if (wire.from.startsWith(`${component.id}:`)) connectedPins.add(wire.from.split(':')[1]);
        if (wire.to.startsWith(`${component.id}:`)) connectedPins.add(wire.to.split(':')[1]);
    });

    if (!connectedPins.has('VCC') || !connectedPins.has('GND')) {
        warnings.push('Power pins (VCC/GND) are not fully connected.');
    }

    if (!connectedPins.has('CLK') || !connectedPins.has('DIO')) {
        warnings.push('Data pins (CLK/DIO) must be connected to use the TM1637 display.');
    }

    return { warnings, errors };
}
