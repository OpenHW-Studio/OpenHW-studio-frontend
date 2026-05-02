import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'logic-ic-74xx-power-input-check',
            name: '74xx IC Power and Input Check',
            severity: 'warn',
            priority: 10,
            description: 'Detect missing power, ground, and floating logic inputs on 74xx ICs.',
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const vcc = `${component.id}.VCC`;
                const gnd = `${component.id}.GND`;

                if (validator.getNeighbors(vcc).length === 0) {
                    return createValidationIssue({
                        ruleId: 'logic-ic-74xx-power-input-check',
                        severity: 'warn',
                        message: `⚠️ [74xx IC ${component.id}] Power (VCC) is missing. Digital logic requires power.`,
                        compIds: [component.id],
                        remediation: 'Connect VCC to the logic supply rail.',
                        autoFix: true,
                    });
                }

                if (validator.getNeighbors(gnd).length === 0) {
                    return createValidationIssue({
                        ruleId: 'logic-ic-74xx-power-input-check',
                        severity: 'warn',
                        message: `⚠️ [74xx IC ${component.id}] Ground (GND) is missing.`,
                        compIds: [component.id],
                        remediation: 'Connect GND to the common ground rail.',
                        autoFix: true,
                    });
                }

                const pins = (component.pins || []).map((p: any) => p.id);
                const inputPins = pins.filter((p: string) => p.includes('IN') || /^[ABCD]\d?$/.test(p));
                const floatingInputs = inputPins.filter(p => validator.getNeighbors(`${component.id}.${p}`).length === 0);

                if (floatingInputs.length > 0) {
                    return createValidationIssue({
                        ruleId: 'logic-ic-74xx-power-input-check',
                        severity: 'warn',
                        message: `⚠️ [74xx IC ${component.id}] Floating Inputs: Pins ${floatingInputs.join(', ')} are not connected. CMOS logic chips can behave unpredictably with floating inputs.`,
                        compIds: [component.id],
                        remediation: 'Tie unused inputs to a defined logic level through a resistor or direct connection per the datasheet.',
                        autoFix: true,
                    });
                }

                return null;
            }
        }
    ]
};
