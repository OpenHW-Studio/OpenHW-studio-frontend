export function validate(component: any, wires: any[]) {
    const warnings = [];
    const errors = [];
    const connectedPins = new Set();

    wires.forEach(wire => {
        if (wire.from.startsWith(`${component.id}:`)) connectedPins.add(wire.from.split(':')[1]);
        if (wire.to.startsWith(`${component.id}:`)) connectedPins.add(wire.to.split(':')[1]);
    });

    if (!connectedPins.has('VCC') || !connectedPins.has('GND')) {
        errors.push('Rotary Encoder requires power: VCC and GND must be connected.');
    }
    if (!connectedPins.has('CLK') && !connectedPins.has('DT')) {
        warnings.push('Rotary Encoder quadrature output pins (CLK, DT) are unconnected.');
    }

    return { warnings, errors };
}
