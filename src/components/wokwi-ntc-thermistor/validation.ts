export const validation = {
    rules: [
        {
            name: 'NTC Thermistor Connection Check',
            check: (component: any, graph: Map<string, string[]>) => {
                const pinA = graph.get(`${component.id}.A`);
                const pinB = graph.get(`${component.id}.B`);

                if ((!pinA || pinA.length === 0) && (!pinB || pinB.length === 0)) {
                    return `⚠️ [NTC ${component.id}] Not connected. Wire in a voltage divider: 5V → 10kΩ resistor → analog pin → NTC → GND.`;
                }
                if (!pinA || pinA.length === 0) {
                    return `⚠️ [NTC ${component.id}] Terminal A is not connected.`;
                }
                if (!pinB || pinB.length === 0) {
                    return `⚠️ [NTC ${component.id}] Terminal B is not connected.`;
                }
                return null;
            },
        },
        {
            name: 'NTC Thermistor Analog Pin Check',
            check: (component: any, graph: Map<string, string[]>) => {
                const all = [
                    ...(graph.get(`${component.id}.A`) || []),
                    ...(graph.get(`${component.id}.B`) || []),
                ];
                const hasAnalog = all.some((c: string) =>
                    [':A0',':A1',':A2',':A3',':A4',':A5'].some(p => c.includes(p))
                );
                if (!hasAnalog) {
                    return `⚠️ [NTC ${component.id}] Connect one terminal to an analog pin (A0–A5). Use analogRead() and the Beta equation to calculate temperature.`;
                }
                return null;
            },
        },
        {
            name: 'NTC Thermistor Pull-up Resistor Check',
            check: (component: any, graph: Map<string, string[]>) => {
                const all = [
                    ...(graph.get(`${component.id}.A`) || []),
                    ...(graph.get(`${component.id}.B`) || []),
                ];
                const hasResistor = all.some((c: string) => c.includes('wokwi-resistor'));
                if (!hasResistor) {
                    return `⚠️ [NTC ${component.id}] NTC thermistors need a series resistor (10kΩ) to form a voltage divider. Without it, analogRead() will not give meaningful temperature values.`;
                }
                return null;
            },
        },
    ],
};
