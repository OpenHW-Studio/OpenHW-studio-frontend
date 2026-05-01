export const validation = {
    rules: [
        {
            name: "Buzzer Series Resistor Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const pins = (component.pins || []).map((p: any) => p.id);
                const pin1 = pins.length > 0 ? `${component.id}.${pins[0]}` : null;
                const pin2 = pins.length > 1 ? `${component.id}.${pins[1]}` : null;

                if (!pin1 || (validator.getNeighbors(pin1).length === 0 && (!pin2 || validator.getNeighbors(pin2).length === 0))) {
                    return `⚠️ [Buzzer ${component.id}] Warning: Buzzer is not connected.`;
                }

                // Check for series resistor if connected to MCU
                const res = validator.findSeriesResistance(pin1);
                if (res === 0) {
                    // Check if it's connected to an MCU pin
                    const neighbors = validator.getNeighbors(pin1);
                    const isMcu = neighbors.some((n: string) => n.includes('arduino') || n.includes('pico'));
                    if (isMcu) {
                        return `⚠️ [Buzzer ${component.id}] Safety Warning: No series resistor detected between Buzzer and MCU. Direct drive can stress GPIO pins.`;
                    }
                }

                return null;
            }
        }
    ]
};
