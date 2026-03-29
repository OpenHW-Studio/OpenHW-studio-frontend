export function validate(component: any, wires: any[]) {
    const warnings = [];
    const errors = [];
    const connectedPins = new Set();

    wires.forEach(wire => {
        if (wire.from.startsWith(`${component.id}:`)) connectedPins.add(wire.from.split(':')[1]);
        if (wire.to.startsWith(`${component.id}:`)) connectedPins.add(wire.to.split(':')[1]);
    });

    if (!connectedPins.has('VDD') || !connectedPins.has('GND_LOGIC')) {
        errors.push('A4988 requires logic power: VDD and GND_LOGIC must be connected.');
    }

    if (!connectedPins.has('VMOT') || !connectedPins.has('GND_MOT')) {
        errors.push('A4988 requires motor power: VMOT and GND_MOT must be connected to drive the stepper.');
    }

    if (!connectedPins.has('STEP')) {
        warnings.push('A4988 STEP pin is unconnected. The motor will not turn.');
    }

    return { warnings, errors };
}
