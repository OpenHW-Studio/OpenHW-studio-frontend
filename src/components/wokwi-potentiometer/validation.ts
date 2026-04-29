export const validation = {
    rules: [
        {
            name: "Potentiometer Power Dissipation",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const maxPower = 0.25; // 1/4 Watt assumed
                const dangerousLowResistance = 10;

                // Assuming typical pin naming for Wokwi pot: GND, SIG/OUT, VCC
                const vPin1 = validator?.calculateVoltageAtNode(`${component.id}.GND`);
                const vPin2 = validator?.calculateVoltageAtNode(`${component.id}.VCC`);

                if (vPin1 !== undefined && vPin2 !== undefined) {
                    const voltageDrop = Math.abs(vPin1 - vPin2);
                    const worstCasePower = (voltageDrop ** 2) / dangerousLowResistance;

                    if (worstCasePower > maxPower) {
                        return `🔥 [Potentiometer ${component.id}] DANGER: If you turn knob to 0Ω, it will dissipate ${worstCasePower.toFixed(2)}W and burn track! Add static resistor in series.`;
                    }
                }

                return null;
            }
        }
    ]
};
