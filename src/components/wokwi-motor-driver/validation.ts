import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'motor-driver-power-check',
            name: 'Motor Driver Power Check',
            severity: 'warn',
            priority: 10,
            description: 'Check that the logic and motor supply rails are connected.',
            check: (component: any, graph: Map<string, string[]>) => {
                const logicPower = graph.get(`${component.id}.VCC`);
                const motorPower = graph.get(`${component.id}.VM`);
                const issues = [];

                if (!logicPower || logicPower.length === 0) {
                    issues.push(createValidationIssue({
                        ruleId: 'motor-driver-power-check',
                        severity: 'warn',
                        message: `⚠️ [Motor Driver ${component.id}] Error: Logic power (VCC) is missing.`,
                        compIds: [component.id],
                        remediation: 'Connect the logic supply pin.',
                        autoFix: true,
                    }));
                }
                if (!motorPower || motorPower.length === 0) {
                    issues.push(createValidationIssue({
                        ruleId: 'motor-driver-power-check',
                        severity: 'warn',
                        message: `⚠️ [Motor Driver ${component.id}] Error: Motor power (VM) is missing.`,
                        compIds: [component.id],
                        remediation: 'Connect the motor supply pin.',
                        autoFix: true,
                    }));
                }
                return issues.length > 0 ? issues : null;
            }
        }
    ]
};
