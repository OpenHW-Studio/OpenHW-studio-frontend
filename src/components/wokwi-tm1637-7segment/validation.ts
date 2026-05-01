export const validation = {
    rules: [
        {
            name: "Legacy Validation Wrap",
            check: (component: any, graph: any, validator: any) => {
                const connectedPins = new Set();
                const connections = validator.connections || [];
                connections.forEach((w: any) => {
                    if (w.from.startsWith(component.id + '.')) connectedPins.add(w.from.split('.')[1]);
                    if (w.to.startsWith(component.id + '.')) connectedPins.add(w.to.split('.')[1]);
                });

                // Check for Power/GND/Data from legacy logic (simplified translation)
                const pins = (component.pins || []).map((p:any) => p.id);
                const vcc = pins.find((p:any) => p.includes('VCC') || p.includes('5V') || p.includes('3V3'));
                const gnd = pins.find((p:any) => p.includes('GND'));
                
                if (vcc && validator.getNeighbors(component.id + '.' + vcc).length === 0) {
                    return '⚠️ [' + component.type + ' ' + component.id + '] Power is not connected.';
                }
                if (gnd && validator.getNeighbors(component.id + '.' + gnd).length === 0) {
                    return '⚠️ [' + component.type + ' ' + component.id + '] Ground is not connected.';
                }
                
                return null;
            }
        }
    ]
};
