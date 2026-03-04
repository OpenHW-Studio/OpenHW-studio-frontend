import * as emulatorComponents from '../../components/index.js';
const COMPONENT_SPECS = Object.values(emulatorComponents).reduce((acc, comp) => { if (comp?.manifest?.type) { acc[comp.manifest.type] = { type: comp.manifest.type, ...(comp.manifest.specs || {}) } } return acc; }, { mcu_uno: { limits: { vin_min: 7.0, vin_max: 12.0, pin_5v_max: 5.5, pin_3v3_max: 3.6, gpio_voltage_max: 5.5, gpio_current_max: 0.040, total_package_current_max: 0.200 } } });

export function validateReversePolarity(validator) {
    console.log("⚡ Checking Reverse Polarity...");
    validator.components.forEach(comp => {
        if (comp.type === "diode" || comp.type === "diode_array") {
            const specs = COMPONENT_SPECS[comp.type];
            const vAnode = validator.calculateVoltageAtNode(`${comp.id}.anode`);
            const vCathode = validator.calculateVoltageAtNode(`${comp.id}.cathode`);

            if (vCathode > vAnode) {
                const reverseVoltage = vCathode - vAnode;
                if (specs.reverseBreakdownVoltage && reverseVoltage > specs.reverseBreakdownVoltage) {
                    validator.errors.push(`🔥 ${comp.id} FRIED: Reverse breakdown voltage exceeded (${reverseVoltage}V applied backward).`);
                } else {
                    validator.errors.push(`⚠️ ${comp.id} WIRED BACKWARDS: It is reverse-biased and will not function.`);
                }
            }
        }
    });
}
