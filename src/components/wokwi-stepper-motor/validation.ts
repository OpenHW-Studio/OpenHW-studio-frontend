import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'stepper-coil-connection-check',
            name: 'Stepper Coil Connection Check',
            severity: 'warn',
            priority: 10,
            description: 'Warn when one or more stepper coils are disconnected.',
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const requiredPins = ['A+', 'A-', 'B+', 'B-'];
                const missingPins = requiredPins.filter(pin => {
                    const node = `${component.id}.${pin}`;
                    return validator.getNeighbors(node).length === 0;
                });

                if (missingPins.length > 0) {
                    return createValidationIssue({
                        ruleId: 'stepper-coil-connection-check',
                        severity: 'warn',
                        message: `⚠️ [Stepper ${component.id}] Coil Warning: The following pins are not connected: ${missingPins.join(', ')}. Stepper motor requires both coils (A and B) to be fully wired.`,
                        compIds: [component.id],
                        remediation: 'Connect all stepper coil pins.',
                        autoFix: true,
                    });
                }

                return null;
            }
        }
    ]
};
