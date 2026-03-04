import * as emulatorComponents from '../../components/index.js';
const COMPONENT_SPECS = Object.values(emulatorComponents).reduce((acc, comp) => { if (comp?.manifest?.type) { acc[comp.manifest.type] = { type: comp.manifest.type, ...(comp.manifest.specs || {}) } } return acc; }, { mcu_uno: { limits: { vin_min: 7.0, vin_max: 12.0, pin_5v_max: 5.5, pin_3v3_max: 3.6, gpio_voltage_max: 5.5, gpio_current_max: 0.040, total_package_current_max: 0.200 } } });

export function validateComponentLimits(validator) {
    console.log("⚡ Checking Component Voltage/Current Limits...");

    validator.components.forEach(comp => {
        const specs = COMPONENT_SPECS[comp.type];
        if (!specs || comp.type === "power_supply" || comp.type === "microcontroller") return;

        const appliedVoltage = validator.calculateVoltageAtNode(`${comp.id}.vcc`) || validator.calculateVoltageAtNode(`${comp.id}.anode`);

        // Absolute Voltage Check
        if (specs.maxVoltage && appliedVoltage > specs.maxVoltage) {
            validator.errors.push(`🔥 ${comp.id} FRIED: Applied ${appliedVoltage}V. Max is ${specs.maxVoltage}V.`);
        }

        // Overcurrent Check (Diodes)
        if (comp.type === "diode" || comp.type === "diode_array") {
            const resistance = validator.findSeriesResistance(`${comp.id}.anode`);
            if (resistance === 0) {
                validator.errors.push(`🔥 ${comp.id} FRIED: Direct connection to voltage with no current-limiting resistor!`);
            } else {
                const currentDraw = (appliedVoltage - specs.forwardVoltage) / resistance;
                if (currentDraw > specs.maxCurrent) {
                    validator.errors.push(`🔥 ${comp.id} FRIED: Drawing ${(currentDraw * 1000).toFixed(1)}mA. Limit is ${(specs.maxCurrent * 1000)}mA.`);
                }
            }
        }

        // MCU GPIO Pin Limit Check (40mA)
        if (specs.typicalCurrent || specs.operatingCurrent) {
            const expectedCurrent = specs.typicalCurrent || specs.operatingCurrent;
            const connectedPins = validator.graph.get(`${comp.id}.vcc`) || validator.graph.get(`${comp.id}.pin1`) || [];

            connectedPins.forEach(node => {
                if (node.includes("mcu_uno.digital") && expectedCurrent > COMPONENT_SPECS.mcu_uno.limits.gpio_current_max) {
                    validator.errors.push(`🔥 MCU PIN FRIED: ${comp.id} draws ${(expectedCurrent * 1000)}mA from a digital pin. Pins supply max 40mA!`);
                }
            });
        }
    });
}
