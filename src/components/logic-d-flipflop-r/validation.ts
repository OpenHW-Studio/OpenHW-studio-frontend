import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'logic-d-flipflop-reset-connection-check',
            name: 'D Flip-Flop (Reset) Connection Check',
            severity: 'warn',
            priority: 10,
            description: 'Warn when the reset-capable D flip-flop is not wired.',
            check: (component: any, graph: Map<string, string[]>) => {
                const pinD = graph.get(`${component.id}.D`);
                const pinClk = graph.get(`${component.id}.CLK`);
                const pinR = graph.get(`${component.id}.R`);
                const pinQ = graph.get(`${component.id}.Q`);

                if ((!pinD || pinD.length === 0) && (!pinClk || pinClk.length === 0) &&
                    (!pinQ || pinQ.length === 0) && (!pinR || pinR.length === 0)) {
                    return createValidationIssue({
                        ruleId: 'logic-d-flipflop-reset-connection-check',
                        severity: 'warn',
                        message: `⚠️ [D Flip-Flop (Reset) ${component.id}] Warning: No pins are connected.`,
                        compIds: [component.id],
                        remediation: 'Wire the D, CLK, Q, and R pins as required by the design.',
                        autoFix: true,
                    });
                }
                return null;
            }
        }
    ]
};
