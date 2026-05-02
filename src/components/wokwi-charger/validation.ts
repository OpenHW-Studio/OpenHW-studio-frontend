import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'charger-input-voltage-check',
            name: 'Check Charger Input Voltage',
            severity: 'error',
            priority: 10,
            description: 'Detect charger input over-voltage.',
            check: (comp, graph, validator) => {
                const vinNode = `${comp.id}.IN+`;
                const v = validator.calculateVoltageAtNode(vinNode);
                if (v > 6.0) {
                    return createValidationIssue({
                        ruleId: 'charger-input-voltage-check',
                        severity: 'error',
                        message: `🔥 [Charger ${comp.id}] Input voltage ${v.toFixed(1)}V exceeds 6V limit! Chip will be damaged.`,
                        compIds: [comp.id],
                        remediation: 'Reduce the charger input voltage to within the rated range.',
                        autoFix: false,
                    });
                }
                return null;
            }
        }
    ]
};
