import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'npn-transistor-connection-check',
            name: 'NPN Transistor Connection Check',
            severity: 'warn',
            priority: 10,
            description: 'Warn when the transistor is miswired or only partially connected.',
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const b = `${component.id}.B`;
                const c = `${component.id}.C`;
                const e = `${component.id}.E`;
                const issues = [];

                const hasB = validator.getNeighbors(b).length > 0;
                const hasC = validator.getNeighbors(c).length > 0;
                const hasE = validator.getNeighbors(e).length > 0;

                if (hasB && hasC && hasE) {
                    const vB = validator.calculateVoltageAtNode(b);
                    const vC = validator.calculateVoltageAtNode(c);
                    const vE = validator.calculateVoltageAtNode(e);

                    if (vB > vC + 0.5 && vC > 0.1) {
                        issues.push(createValidationIssue({
                            ruleId: 'npn-transistor-connection-check',
                            severity: 'warn',
                            message: `⚠️ [NPN ${component.id}] Potential Over-Saturation: Base voltage (${vB.toFixed(1)}V) is higher than Collector (${vC.toFixed(1)}V). Ensure you have a current-limiting resistor on the Base.`,
                            compIds: [component.id],
                            remediation: 'Add a base resistor to limit drive current.',
                            autoFix: true,
                        }));
                    }
                    if (vE > vB && vE > 0.1) {
                        issues.push(createValidationIssue({
                            ruleId: 'npn-transistor-connection-check',
                            severity: 'warn',
                            message: `⚠️ [NPN ${component.id}] Reverse Bias: Emitter voltage is higher than Base. The transistor will not switch correctly in this configuration.`,
                            compIds: [component.id],
                            remediation: 'Rewire the transistor so the emitter is at the lower potential.',
                            autoFix: true,
                        }));
                    }
                } else if (hasB || hasC || hasE) {
                    issues.push(createValidationIssue({
                        ruleId: 'npn-transistor-connection-check',
                        severity: 'warn',
                        message: `⚠️ [NPN ${component.id}] Warning: Transistor is only partially connected. All three pins (C, B, E) usually need to be wired.`,
                        compIds: [component.id],
                        remediation: 'Wire all three transistor pins.',
                        autoFix: true,
                    }));
                }

                return issues.length > 0 ? issues : null;
            }
        }
    ]
};
