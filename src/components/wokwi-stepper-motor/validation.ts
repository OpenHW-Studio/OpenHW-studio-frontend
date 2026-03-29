export function validate(component: any, wires: any[]) {
    const warnings = [];
    const errors = [];
    const connectedPins = new Set();

    wires.forEach(wire => {
        if (wire.from.startsWith(`${component.id}:`)) connectedPins.add(wire.from.split(':')[1]);
        if (wire.to.startsWith(`${component.id}:`)) connectedPins.add(wire.to.split(':')[1]);
    });

    if (!connectedPins.has('A+') || !connectedPins.has('A-') || !connectedPins.has('B+') || !connectedPins.has('B-')) {
        warnings.push('Stepper Motor (Bipolar) has unconnected coils. Ensure A+, A-, B+, and B- are connected correctly.');
    }

    return { warnings, errors };
}
