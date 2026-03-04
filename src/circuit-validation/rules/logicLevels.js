import * as emulatorComponents from '../../components/index.js';
const COMPONENT_SPECS = Object.values(emulatorComponents).reduce((acc, comp) => { if (comp?.manifest?.type) { acc[comp.manifest.type] = { type: comp.manifest.type, ...(comp.manifest.specs || {}) } } return acc; }, { mcu_uno: { limits: { vin_min: 7.0, vin_max: 12.0, pin_5v_max: 5.5, pin_3v3_max: 3.6, gpio_voltage_max: 5.5, gpio_current_max: 0.040, total_package_current_max: 0.200 } } });

export function validateLogicLevels(validator) {
    console.log("⚡ Checking Logic Level Compatibility (5V vs 3.3V)...");

    // Scan all wire connections in the project
    validator.connections.forEach(conn => {
        const compA = validator.getComponent(conn.from);
        const compB = validator.getComponent(conn.to);

        if (!compA || !compB) return;

        const logicA = COMPONENT_SPECS[compA.type]?.logicVoltage;
        const logicB = COMPONENT_SPECS[compB.type]?.logicVoltage;

        if (logicA && logicB && logicA !== logicB) {
            if (logicA === 5.0 && logicB === 3.3) {
                validator.errors.push(`🔥 LOGIC MISMATCH: You are sending a 5V signal from ${compA.id} directly into ${compB.id}, which expects 3.3V. This will fry the 3.3V chip! Use a Logic Level Converter or a Voltage Divider.`);
            }
        }
    });
}
