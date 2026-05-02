import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'shift-register-floating-oe',
            name: 'Floating Output Enable (OE) Pin',
            severity: 'warn',
            priority: 10,
            description: 'Warn when OE is floating and outputs may be disabled.',
            check: (component: any, graph: Map<string, string[]>) => {
                const oeConnected = graph.get(`${component.id}.oe`);
                if (!oeConnected || oeConnected.length === 0) {
                    return createValidationIssue({
                        ruleId: 'shift-register-floating-oe',
                        severity: 'warn',
                        message: `⚠️ [Shift Register ${component.id}] Warning: Output Enable (OE) pin is floating. It should be tied to GND to enable outputs, or driven by the MCU.`,
                        compIds: [component.id],
                        remediation: 'Tie OE to GND or drive it from a control pin.',
                        autoFix: true,
                    });
                }
                return null;
            }
        },
        {
            id: 'shift-register-floating-srclr',
            name: 'Floating Clear (SRCLR) Pin',
            severity: 'warn',
            priority: 20,
            description: 'Warn when SRCLR is floating and may reset the register.',
            check: (component: any, graph: Map<string, string[]>) => {
                const clearConnected = graph.get(`${component.id}.srclr`);
                if (!clearConnected || clearConnected.length === 0) {
                    return createValidationIssue({
                        ruleId: 'shift-register-floating-srclr',
                        severity: 'warn',
                        message: `⚠️ [Shift Register ${component.id}] Warning: Clear (SRCLR) pin is floating. It should be tied to VCC to prevent random resets.`,
                        compIds: [component.id],
                        remediation: 'Tie SRCLR to VCC or drive it from a control pin.',
                        autoFix: true,
                    });
                }
                return null;
            }
        }
    ]
};
