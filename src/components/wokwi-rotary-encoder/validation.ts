import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'rotary-encoder-connection-check',
            name: 'Rotary Encoder Connection Check',
            severity: 'warn',
            priority: 10,
            description: 'Warn when the encoder ground or quadrature outputs are disconnected.',
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const clk = `${component.id}.CLK`;
                const dt = `${component.id}.DT`;
                const gnd = `${component.id}.GND`;
                const issues = [];

                if (validator.getNeighbors(gnd).length === 0) {
                    issues.push(createValidationIssue({
                        ruleId: 'rotary-encoder-connection-check',
                        severity: 'warn',
                        message: `⚠️ [Encoder ${component.id}] Ground (GND) is not connected.`,
                        compIds: [component.id],
                        remediation: 'Connect the encoder ground pin.',
                        autoFix: true,
                    }));
                }

                if (validator.getNeighbors(clk).length === 0 || validator.getNeighbors(dt).length === 0) {
                    issues.push(createValidationIssue({
                        ruleId: 'rotary-encoder-connection-check',
                        severity: 'warn',
                        message: `⚠️ [Encoder ${component.id}] Warning: Quadrature outputs (CLK/DT) must both be connected to track rotation.`,
                        compIds: [component.id],
                        remediation: 'Wire both CLK and DT to MCU inputs.',
                        autoFix: true,
                    }));
                }

                return issues.length > 0 ? issues : null;
            }
        }
    ]
};
