import * as emulatorComponents from '../../components/index.js';
const COMPONENT_SPECS = Object.values(emulatorComponents).reduce((acc, comp) => { if (comp?.manifest?.type) { acc[comp.manifest.type] = { type: comp.manifest.type, ...(comp.manifest.specs || {}) } } return acc; }, { mcu_uno: { limits: { vin_min: 7.0, vin_max: 12.0, pin_5v_max: 5.5, pin_3v3_max: 3.6, gpio_voltage_max: 5.5, gpio_current_max: 0.040, total_package_current_max: 0.200 } } });

export function validateMcuPower(validator) {
    console.log("⚡ Checking MCU Power Inputs...");
    const powerSources = validator.components.filter(c => c.type === "power_supply");

    powerSources.forEach(source => {
        const connectedNodes = validator.graph.get(`${source.id}.vcc`) || [];
        connectedNodes.forEach(node => {
            const comp = validator.getComponent(node);
            if (comp && comp.type === "microcontroller") {
                const pinName = node.split(".")[1];
                const limits = COMPONENT_SPECS.mcu_uno.limits; // fallback or dynamic lookup

                if (pinName === "vin") {
                    if (source.voltage < limits.vin_min) validator.errors.push(`⚠️ UNDERVOLTAGE: ${source.voltage}V applied to VIN. Requires >= 7.0V.`);
                    else if (source.voltage > limits.vin_max) validator.errors.push(`🔥 MCU FRIED: ${source.voltage}V applied to VIN. Max limit is ${limits.vin_max}V.`);
                }
                else if (pinName === "5v" && source.voltage > limits.pin_5v_max) {
                    validator.errors.push(`🔥 MCU FRIED: ${source.voltage}V applied to 5V pin. Bypassed regulator!`);
                }
            }
        });
    });
}
