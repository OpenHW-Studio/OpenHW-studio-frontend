export const validation = {
    rules: [
        {
            name: "Sensor Connection Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const pins = (component.pins || []).map((p: any) => p.id);
                const vcc = pins.find((p: string) => p.includes('VCC') || p.includes('5V') || p.includes('V+'));
                const gnd = pins.find((p: string) => p.includes('GND'));
                const sigPins = pins.filter((p: string) => p.includes('SIG') || p.includes('OUT') || p.includes('AO') || p.includes('DO'));

                if (vcc && validator.getNeighbors(`${component.id}.${vcc}`).length === 0) {
                    return `⚠️ [${component.type} ${component.id}] Power is not connected.`;
                }
                if (gnd && validator.getNeighbors(`${component.id}.${gnd}`).length === 0) {
                    return `⚠️ [${component.type} ${component.id}] Ground is not connected.`;
                }
                
                const connectedSigs = sigPins.filter(p => validator.getNeighbors(`${component.id}.${p}`).length > 0);
                if (sigPins.length > 0 && connectedSigs.length === 0) {
                    return `⚠️ [${component.type} ${component.id}] Warning: No signal/output pins are connected. The sensor will not provide any data.`;
                }

                return null;
            }
        }
    ]
};
