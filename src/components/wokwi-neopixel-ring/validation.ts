export function validate(component: any, wires: any[]) {
    const warnings = [];
    const errors = [];
    const connectedPins = new Set();

    wires.forEach(wire => {
        if (wire.from.startsWith(`${component.id}:`)) connectedPins.add(wire.from.split(':')[1]);
        if (wire.to.startsWith(`${component.id}:`)) connectedPins.add(wire.to.split(':')[1]);
    });

    if (!connectedPins.has('VDD') || !connectedPins.has('VSS')) {
        errors.push('NeoPixel Ring requires power (VDD and VSS) to function.');
    }

    if (!connectedPins.has('DIN')) {
        warnings.push('Data input (DIN) is missing. The ring will not display anything.');
    }

    return { warnings, errors };
}
