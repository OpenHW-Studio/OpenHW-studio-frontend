import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'logic-d-flipflop-dsr-connection-check',
            name: 'D Flip-Flop (Set/Reset) Connection Check',
            severity: 'warn',
            priority: 10,
            description: 'Warn when the set/reset D flip-flop is not wired.',
            check: (component: any, graph: Map<string, string[]>) => {
                const pinD = graph.get(`${component.id}.D`);
                const pinClk = graph.get(`${component.id}.CLK`);
                const pinS = graph.get(`${component.id}.S`);
                const pinR = graph.get(`${component.id}.R`);
                const pinQ = graph.get(`${component.id}.Q`);

                if ((!pinD || pinD.length === 0) && (!pinClk || pinClk.length === 0) &&
                    (!pinQ || pinQ.length === 0) && (!pinR || pinR.length === 0) && (!pinS || pinS.length === 0)) {
                    return createValidationIssue({
                        ruleId: 'logic-d-flipflop-dsr-connection-check',
                        severity: 'warn',
                        message: `⚠️ [D Flip-Flop (Set/Reset) ${component.id}] Warning: No pins are connected.`,
                        compIds: [component.id],
                        remediation: 'Wire the D, CLK, Q, S, and R pins as required by the design.',
                        autoFix: true,
                    });
                }
                return null;
            }
        }
    ]
};
