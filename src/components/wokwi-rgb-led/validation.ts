export function validate(component: any, wires: any[]) {
    const warnings = [];
    const errors = [];
    const connectedPins = new Set();

    wires.forEach(wire => {
        if (wire.from.startsWith(`${component.id}:`)) connectedPins.add(wire.from.split(':')[1]);
        if (wire.to.startsWith(`${component.id}:`)) connectedPins.add(wire.to.split(':')[1]);
    });

    if (!connectedPins.has('COM')) {
        errors.push('RGB LED requires the Common (COM) pin to be connected to GND (Cathode) or VCC (Anode).');
    }
    if (!connectedPins.has('R') && !connectedPins.has('G') && !connectedPins.has('B')) {
        warnings.push('RGB LED has no color pins connected. It will not light up.');
    }

    return { warnings, errors };
}
