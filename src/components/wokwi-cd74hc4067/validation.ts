export function validate(component: any, wires: any[]) {
    const warnings = [];
    const errors = [];
    const connectedPins = new Set();

    wires.forEach(wire => {
        if (wire.from.startsWith(`${component.id}:`)) connectedPins.add(wire.from.split(':')[1]);
        if (wire.to.startsWith(`${component.id}:`)) connectedPins.add(wire.to.split(':')[1]);
    });

    if (!connectedPins.has('VCC') || !connectedPins.has('GND')) {
        errors.push('CD74HC4067 requires power: VCC and GND must be connected.');
    }
    if (!connectedPins.has('SIG')) {
        warnings.push('SIG common pin is not connected.');
    }

    return { warnings, errors };
}
