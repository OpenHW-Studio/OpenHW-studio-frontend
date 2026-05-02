export const validation = {
    rules: [
        {
            name: "74xx IC Power and Input Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const vcc = `${component.id}.VCC`;
                const gnd = `${component.id}.GND`;

                if (validator.getNeighbors(vcc).length === 0) {
                    return `⚠️ [74xx IC ${component.id}] Power (VCC) is missing. Digital logic requires power.`;
                }
                if (validator.getNeighbors(gnd).length === 0) {
                    return `⚠️ [74xx IC ${component.id}] Ground (GND) is missing.`;
                }

                // Generic floating input check for logic pins
                const pins = (component.pins || []).map((p: any) => p.id);
                const inputPins = pins.filter((p: string) => p.includes('IN') || /^[ABCD]\d?$/.test(p));
                
                const floatingInputs = inputPins.filter(p => validator.getNeighbors(`${component.id}.${p}`).length === 0);
                if (floatingInputs.length > 0) {
                    return `⚠️ [74xx IC ${component.id}] Floating Inputs: Pins ${floatingInputs.join(', ')} are not connected. CMOS logic chips can behave unpredictably with floating inputs.`;
                }

                return null;
            }
        }
    ]
};
