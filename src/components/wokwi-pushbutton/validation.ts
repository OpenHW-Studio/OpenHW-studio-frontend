import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'pushbutton-floating-input-check',
            name: 'Pushbutton Floating Input Check',
            severity: 'warn',
            priority: 10,
            description: 'Warn when the pushbutton is not connected at all.',
            check: (component: any, graph: Map<string, string[]>) => {
                const p1 = graph.get(`${component.id}.1l`);
                const p2 = graph.get(`${component.id}.2l`);

                if ((!p1 || p1.length === 0) && (!p2 || p2.length === 0)) {
                    return createValidationIssue({
                        ruleId: 'pushbutton-floating-input-check',
                        severity: 'warn',
                        message: `⚠️ [Pushbutton ${component.id}] Warning: Button is completely disconnected.`,
                        compIds: [component.id],
                        remediation: 'Wire the pushbutton into the circuit.',
                        autoFix: true,
                    });
                }

                return null;
            }
        }
    ]
};
