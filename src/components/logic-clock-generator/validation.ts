import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'clock-generator-output-check',
            name: 'Clock Generator Output Check',
            severity: 'warn',
            priority: 10,
            description: 'Warn when the clock output is floating.',
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const pinOut = graph.get(`${component.id}.OUT`);
                if (!pinOut || pinOut.length === 0) {
                    return createValidationIssue({
                        ruleId: 'clock-generator-output-check',
                        severity: 'warn',
                        message: `⚠️ [Clock Generator ${component.id}] Warning: Clock OUT pin is not connected to anything.`,
                        compIds: [component.id],
                        remediation: 'Connect the clock output to the circuit that consumes it.',
                        autoFix: true,
                    });
                }
                return null;
            }
        }
    ]
};
