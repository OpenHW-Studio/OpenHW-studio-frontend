export function validate(component: any, wires: any[]) {
    const warnings = [];
    const errors = [];
    const connectedPins = new Set();

    wires.forEach(wire => {
        if (wire.from.startsWith(`${component.id}:`)) connectedPins.add(wire.from.split(':')[1]);
        if (wire.to.startsWith(`${component.id}:`)) connectedPins.add(wire.to.split(':')[1]);
    });

    if (!connectedPins.has('GND')) {
        errors.push('Logic Analyzer GND must be connected to the circuit common ground to reference signals correctly.');
    }

    let hasDataPin = false;
    for (let i = 0; i < 8; i++) {
        if (connectedPins.has(`D${i}`)) {
            hasDataPin = true;
            break;
        }
    }

    if (!hasDataPin) {
        warnings.push('Logic Analyzer has no data lines (D0-D7) connected. It will not register any signals.');
    }

    return { warnings, errors };
}
