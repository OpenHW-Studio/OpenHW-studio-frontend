import * as emulatorComponents from '../../components/index.js';
const COMPONENT_SPECS = Object.values(emulatorComponents).reduce((acc, comp) => { if (comp?.manifest?.type) { acc[comp.manifest.type] = { type: comp.manifest.type, ...(comp.manifest.specs || {}) } } return acc; }, { mcu_uno: { limits: { vin_min: 7.0, vin_max: 12.0, pin_5v_max: 5.5, pin_3v3_max: 3.6, gpio_voltage_max: 5.5, gpio_current_max: 0.040, total_package_current_max: 0.200 } } });

export function validatePowerDissipation(validator) {
    console.log("⚡ Checking Power Dissipation (Wattage Limits)...");

    validator.components.forEach(comp => {
        if (comp.type === "resistor" || comp.type === "potentiometer") {

            const maxPower = COMPONENT_SPECS[comp.type]?.maxPower || 0.25;

            const vPin1 = validator.calculateVoltageAtNode(`${comp.id}.pin1`);
            const vPin2 = validator.calculateVoltageAtNode(`${comp.id}.pin2`);
            const voltageDrop = Math.abs(vPin1 - vPin2);

            if (comp.type === "resistor") {
                const resistance = comp.value || 1;
                const powerDissipated = (voltageDrop ** 2) / resistance;

                if (powerDissipated > maxPower) {
                    validator.errors.push(`🔥 ${comp.id} BURNING: Dissipating ${powerDissipated.toFixed(2)}W! Limit is ${maxPower}W. Resistance is too low for this voltage.`);
                }
            }
            else if (comp.type === "potentiometer") {
                const dangerousLowResistance = 10;
                const worstCasePower = (voltageDrop ** 2) / dangerousLowResistance;

                if (worstCasePower > maxPower) {
                    validator.errors.push(`🔥 ${comp.id} DANGER: If you turn this knob to 0Ω, it will dissipate ${worstCasePower.toFixed(2)}W and burn out its internal track! Add a static resistor in series to absorb the power.`);
                }
            }
        }
    });
}
