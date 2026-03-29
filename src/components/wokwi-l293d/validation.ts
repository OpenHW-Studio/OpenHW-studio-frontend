export function validate(component: any, wires: any[]) {
    const warnings = [];
    const errors = [];
    const connectedPins = new Set();

    wires.forEach(wire => {
        if (wire.from.startsWith(`${component.id}:`)) connectedPins.add(wire.from.split(':')[1]);
        if (wire.to.startsWith(`${component.id}:`)) connectedPins.add(wire.to.split(':')[1]);
    });

    if (!connectedPins.has('VCC1') || !connectedPins.has('VCC2')) {
        errors.push('L293D requires both VCC1 (Logic) and VCC2 (Motor) power.');
    }
    if (!connectedPins.has('GND1') && !connectedPins.has('GND2') && !connectedPins.has('GND3') && !connectedPins.has('GND4')) {
        errors.push('L293D requires at least one GND connection.');
    }

    return { warnings, errors };
}
