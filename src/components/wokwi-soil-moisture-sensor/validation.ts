export function validate(component: any, wires: any[]) {
    const warnings = [];
    const errors = [];
    const connectedPins = new Set();

    wires.forEach(wire => {
        if (wire.from.startsWith(`${component.id}:`)) connectedPins.add(wire.from.split(':')[1]);
        if (wire.to.startsWith(`${component.id}:`)) connectedPins.add(wire.to.split(':')[1]);
    });

    if (!connectedPins.has('VCC') || !connectedPins.has('GND')) {
        errors.push('Soil Moisture Sensor requires VCC (+) and GND (-) connections to operate.');
    }

    if (!connectedPins.has('SIG')) {
        warnings.push('Soil Moisture Sensor has no output pin connected (SIG / S).');
    }

    return { warnings, errors };
}
