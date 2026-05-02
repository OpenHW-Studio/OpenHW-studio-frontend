import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'logic-d-flipflop-connection-check',
            name: 'D Flip-Flop Connection Check',
            severity: 'warn',
            priority: 10,
            description: 'Warn when the D flip-flop is not connected at all.',
            check: (component: any, graph: Map<string, string[]>) => {
                const pinD = graph.get(`${component.id}.D`);
                const pinClk = graph.get(`${component.id}.CLK`);
                const pinQ = graph.get(`${component.id}.Q`);

                if ((!pinD || pinD.length === 0) && (!pinClk || pinClk.length === 0) && (!pinQ || pinQ.length === 0)) {
                    return createValidationIssue({
                        ruleId: 'logic-d-flipflop-connection-check',
                        severity: 'warn',
                        message: `⚠️ [D Flip-Flop ${component.id}] Warning: No pins are connected.`,
                        compIds: [component.id],
                        remediation: 'Connect D, CLK, and Q to the surrounding circuit.',
                        autoFix: true,
                    });
                }
                return null;
            }
        }
    ]
};
