import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'diode-connection-check',
            name: 'Diode Connection Check',
            severity: 'warn',
            priority: 10,
            description: 'Warn when the diode is disconnected or reverse-biased.',
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const anodeNode = `${component.id}.A`;
                const cathodeNode = `${component.id}.K`;

                const aConns = graph.get(anodeNode) || [];
                const kConns = graph.get(cathodeNode) || [];

                if (aConns.length === 0 && kConns.length === 0) {
                    return createValidationIssue({
                        ruleId: 'diode-connection-check',
                        severity: 'warn',
                        message: `⚠️ [Diode ${component.id}] Warning: Neither Anode nor Cathode is connected.`,
                        compIds: [component.id],
                        remediation: 'Wire the diode into a circuit with the correct polarity.',
                        autoFix: true,
                    });
                }

                const vA = validator.calculateVoltageAtNode(anodeNode);
                const vK = validator.calculateVoltageAtNode(cathodeNode);

                if (vK > vA + 0.1 && aConns.length > 0 && kConns.length > 0) {
                    return createValidationIssue({
                        ruleId: 'diode-connection-check',
                        severity: 'warn',
                        message: `⚠️ [Diode ${component.id}] Reverse Bias: Cathode voltage (${vK.toFixed(1)}V) is higher than Anode (${vA.toFixed(1)}V). Diode will block current.`,
                        compIds: [component.id],
                        remediation: 'Flip the diode orientation or reverse the applied polarity.',
                        autoFix: false,
                    });
                }

                return null;
            }
        }
    ]
};
