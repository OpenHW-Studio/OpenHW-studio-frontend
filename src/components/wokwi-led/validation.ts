import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'led-series-resistor-check',
            name: 'LED Series Resistor Check',
            severity: 'warn',
            priority: 10,
            description: 'Warn when an LED is left completely disconnected.',
            check: (component: any, graph: Map<string, string[]>) => {
                const anodeConnected = graph.get(`${component.id}.A`);
                const cathodeConnected = graph.get(`${component.id}.K`);

                if (!anodeConnected || !cathodeConnected) return null;

                if (anodeConnected.length === 0 && cathodeConnected.length === 0) {
                    return createValidationIssue({
                        ruleId: 'led-series-resistor-check',
                        severity: 'warn',
                        message: `⚠️ [LED ${component.id}] Warning: Neither Anode nor Cathode is connected.`,
                        compIds: [component.id],
                        remediation: 'Wire the LED into a circuit with a series resistor.',
                    });
                }
                return null;
            }
        }
    ]
};
