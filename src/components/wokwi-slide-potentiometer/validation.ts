export const validation = {
    rules: [
        {
            name: "Slide Potentiometer Power Dissipation",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const maxPower = 0.25; // 1/4 Watt assumed
                const dangerousLowResistance = 10;

                // Typical Wokwi Slide Pot pins: VCC, GND
                const vVCC = validator?.calculateVoltageAtNode(`${component.id}.VCC`);
                const vGND = validator?.calculateVoltageAtNode(`${component.id}.GND`);

                if (vVCC !== undefined && vGND !== undefined) {
                    const voltageDrop = Math.abs(vVCC - vGND);
                    const worstCasePower = (voltageDrop ** 2) / dangerousLowResistance;

                    if (worstCasePower > maxPower) {
                        return `🔥 [Slide Pot ${component.id}] DANGER: If sliding to 0Ω, track will dissipate ${worstCasePower.toFixed(2)}W. Add series resistor.`;
                    }
                }

                return null;
            }
        }
    ]
};
