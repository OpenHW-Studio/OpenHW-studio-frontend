import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'battery-short-circuit-check',
            name: 'Check Battery Short Circuit',
            severity: 'error',
            priority: 10,
            description: 'Detect a low-resistance path across the battery terminals.',
            check: (comp, graph, validator) => {
                const vccNode = `${comp.id}.VCC`;
                const gndNode = `${comp.id}.GND`;
                if (validator.findResistanceBetween(vccNode, gndNode) < 1.0) {
                    return createValidationIssue({
                        ruleId: 'battery-short-circuit-check',
                        severity: 'error',
                        message: `🔥 [Battery ${comp.id}] Dead short detected! Battery will overheat and catch fire.`,
                        compIds: [comp.id],
                        remediation: 'Remove the short or add a proper load path.',
                        autoFix: false,
                    });
                }
                return null;
            }
        }
    ]
};
