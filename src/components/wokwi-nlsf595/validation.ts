export function validate(component: any, wires: any[]) {
    const warnings = [];
    const errors = [];
    const connectedPins = new Set();

    wires.forEach(wire => {
        if (wire.from.startsWith(`${component.id}:`)) connectedPins.add(wire.from.split(':')[1]);
        if (wire.to.startsWith(`${component.id}:`)) connectedPins.add(wire.to.split(':')[1]);
    });

    if (!connectedPins.has('VCC') || !connectedPins.has('GND')) {
        errors.push('NLSF595 requires power: VCC and GND must be connected.');
    }
    if (!connectedPins.has('MOSI') || !connectedPins.has('SCK') || !connectedPins.has('CS')) {
        warnings.push('NLSF595 SPI inputs (MOSI, SCK, CS) are not fully connected.');
    }

    return { warnings, errors };
}
