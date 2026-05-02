import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'logic-mux-2to1-connection-check',
            name: 'MUX 2:1 Connection Check',
            severity: 'warn',
            priority: 10,
            description: 'Warn when the multiplexer is not wired.',
            check: (component: any, graph: Map<string, string[]>) => {
                const pinD0 = graph.get(`${component.id}.D0`);
                const pinD1 = graph.get(`${component.id}.D1`);
                const pinSel = graph.get(`${component.id}.SEL`);
                const pinOut = graph.get(`${component.id}.OUT`);

                if ((!pinD0 || pinD0.length === 0) && (!pinD1 || pinD1.length === 0) &&
                    (!pinSel || pinSel.length === 0) && (!pinOut || pinOut.length === 0)) {
                    return createValidationIssue({
                        ruleId: 'logic-mux-2to1-connection-check',
                        severity: 'warn',
                        message: `⚠️ [MUX 2:1 ${component.id}] Warning: No pins are connected.`,
                        compIds: [component.id],
                        remediation: 'Wire the select, inputs, and output pins into the circuit.',
                        autoFix: true,
                    });
                }
                return null;
            }
        }
    ]
};
