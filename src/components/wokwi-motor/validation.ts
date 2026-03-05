export const validation = {
    rules: [
        {
            name: "Motor Flyback Diode Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const pin1Neighbors = graph.get(`${component.id}.1`) || [];
                const pin2Neighbors = graph.get(`${component.id}.2`) || [];

                let hasFlybackDiode = false;

                pin1Neighbors.forEach(n1 => {
                    const comp1 = validator?.getComponent(n1);
                    if (comp1 && comp1.type === "wokwi-diode") {
                        const otherDiodePin = n1.endsWith(".anode") ? `${comp1.id}.cathode` : `${comp1.id}.anode`;
                        if (pin2Neighbors.includes(otherDiodePin)) {
                            hasFlybackDiode = true;
                        }
                    }
                });

                if (!hasFlybackDiode) {
                    return `⚠️ [Motor ${component.id}] FLYBACK DANGER: Inductive load without flyback diode. Turning it off generates voltage spike that can destroy switching transistor or MCU!`;
                }

                return null;
            }
        }
    ]
};
