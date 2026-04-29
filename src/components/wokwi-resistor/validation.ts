export const validation = {
    rules: [
        {
            name: "Resistor Power Dissipation",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const maxPower = 0.25; // 1/4 Watt assumed

                // Fetch the voltages from both ends
                const vPin1 = validator?.calculateVoltageAtNode(`${component.id}.p1`);
                const vPin2 = validator?.calculateVoltageAtNode(`${component.id}.p2`);

                if (vPin1 !== undefined && vPin2 !== undefined) {
                    const voltageDrop = Math.abs(vPin1 - vPin2);
                    const resistance = parseFloat(component.attrs.value || "1"); // in Ohms

                    const powerDissipated = (voltageDrop ** 2) / resistance;

                    if (powerDissipated > maxPower) {
                        return `🔥 [Resistor ${component.id}] BURNING: Dissipating ${powerDissipated.toFixed(2)}W! Limit is ${maxPower}W. Resistance too low for this voltage drop.`;
                    }
                }

                return null;
            }
        }
    ]
};
