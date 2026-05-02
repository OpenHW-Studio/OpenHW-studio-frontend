import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'l293d-dual-power-supply-check',
            name: 'L293D Dual Power Supply Check',
            severity: 'warn',
            priority: 10,
            description: 'Check the logic and motor power rails on the L293D.',
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const vcc1 = `${component.id}.VCC1`;
                const vcc2 = `${component.id}.VCC2`;
                const gndCandidates = [`${component.id}.GND.1`, `${component.id}.GND`];
                const gnd = gndCandidates.find(node => validator.getNeighbors(node).length > 0) || gndCandidates[0];
                const issues = [];

                const v1 = validator.calculateVoltageAtNode(vcc1);
                const v2 = validator.calculateVoltageAtNode(vcc2);

                if (v1 < 4.5) {
                    issues.push(createValidationIssue({
                        ruleId: 'l293d-dual-power-supply-check',
                        severity: 'warn',
                        message: `⚠️ [L293D ${component.id}] Logic Power (VCC1) is missing or too low. Motor driver will not function.`,
                        compIds: [component.id],
                        remediation: 'Connect VCC1 to the correct logic supply.',
                        autoFix: true,
                    }));
                }
                if (v2 < v1) {
                    issues.push(createValidationIssue({
                        ruleId: 'l293d-dual-power-supply-check',
                        severity: 'warn',
                        message: `⚠️ [L293D ${component.id}] Warning: Motor Power (VCC2) is lower than Logic Power. Motors may be underpowered or stall.`,
                        compIds: [component.id],
                        remediation: 'Raise the motor supply rail above the logic rail.',
                        autoFix: true,
                    }));
                }
                if (validator.getNeighbors(gnd).length === 0) {
                    issues.push(createValidationIssue({
                        ruleId: 'l293d-dual-power-supply-check',
                        severity: 'warn',
                        message: `⚠️ [L293D ${component.id}] Ground connection is missing.`,
                        compIds: [component.id],
                        remediation: 'Connect the L293D ground pin to the common ground rail.',
                        autoFix: true,
                    }));
                }

                return issues.length > 0 ? issues : null;
            }
        }
    ]
};
