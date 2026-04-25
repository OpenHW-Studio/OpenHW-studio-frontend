export const validation = {
    rules: [
        {
            name: 'SD Card wiring check',
            check: (component: any, graph: Map<string, string[]>) => {
                const vcc = graph.get(`${component.id}.VCC`) || [];
                const gnd = graph.get(`${component.id}.GND`) || [];
                const cs = graph.get(`${component.id}.CS`) || [];
                const sck = graph.get(`${component.id}.SCK`) || [];
                const mosi = graph.get(`${component.id}.MOSI`) || [];

                if (vcc.length === 0 || gnd.length === 0) {
                    return `⚠️ [SD ${component.id}] Warning: Connect both VCC and GND to power the card.`;
                }

                if (cs.length === 0 || sck.length === 0 || mosi.length === 0) {
                    return `⚠️ [SD ${component.id}] Warning: CS/SCK/MOSI are required for SPI communication.`;
                }

                return null;
            },
        },
    ],
};
