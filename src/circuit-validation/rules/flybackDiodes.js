import * as emulatorComponents from '../../components/index.js';
const COMPONENT_SPECS = Object.values(emulatorComponents).reduce((acc, comp) => { if (comp?.manifest?.type) { acc[comp.manifest.type] = { type: comp.manifest.type, ...(comp.manifest.specs || {}) } } return acc; }, { mcu_uno: { limits: { vin_min: 7.0, vin_max: 12.0, pin_5v_max: 5.5, pin_3v3_max: 3.6, gpio_voltage_max: 5.5, gpio_current_max: 0.040, total_package_current_max: 0.200 } } });

export function validateFlybackDiodes(validator) {
    console.log("⚡ Checking for missing Flyback Diodes on Inductive Loads...");

    validator.components.forEach(comp => {
        if (COMPONENT_SPECS[comp.type] && COMPONENT_SPECS[comp.type].type === "inductive_load") {

            const pin1Neighbors = validator.graph.get(`${comp.id}.pin1`) || [];
            const pin2Neighbors = validator.graph.get(`${comp.id}.pin2`) || [];

            let hasFlybackDiode = false;

            pin1Neighbors.forEach(n1 => {
                const comp1 = validator.getComponent(n1);
                if (comp1 && comp1.type === "diode") {
                    const otherDiodePin = n1.endsWith(".anode") ? `${comp1.id}.cathode` : `${comp1.id}.anode`;
                    if (pin2Neighbors.includes(otherDiodePin)) {
                        hasFlybackDiode = true;
                    }
                }
            });

            if (!hasFlybackDiode) {
                validator.errors.push(`⚠️ FLYBACK DANGER: ${comp.id} is an inductive load without a flyback diode. Turning it off will generate a voltage spike that can destroy your switching transistor or MCU!`);
            }
        }
    });
}
