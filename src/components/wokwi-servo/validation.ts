import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'servo-power-and-signal-check',
            name: 'Servo Power and Signal Check',
            severity: 'warn',
            priority: 10,
            description: 'Warn when the servo PWM, power, or ground pins are disconnected.',
            check: (component: any, graph: Map<string, string[]>) => {
                const pwmPin = graph.get(`${component.id}.PWM`);
                const vccPin = graph.get(`${component.id}.V+`);
                const gndPin = graph.get(`${component.id}.GND`);
                const issues = [];

                if (!pwmPin || pwmPin.length === 0) {
                    issues.push(createValidationIssue({
                        ruleId: 'servo-power-and-signal-check',
                        severity: 'warn',
                        message: `⚠️ [Servo ${component.id}] Warning: PWM Signal pin is floating.`,
                        compIds: [component.id],
                        remediation: 'Connect the PWM control pin.',
                        autoFix: true,
                    }));
                }
                if (!vccPin || vccPin.length === 0) {
                    issues.push(createValidationIssue({
                        ruleId: 'servo-power-and-signal-check',
                        severity: 'warn',
                        message: `⚠️ [Servo ${component.id}] Warning: V+ Power is not connected.`,
                        compIds: [component.id],
                        remediation: 'Connect the servo power pin.',
                        autoFix: true,
                    }));
                }
                if (!gndPin || gndPin.length === 0) {
                    issues.push(createValidationIssue({
                        ruleId: 'servo-power-and-signal-check',
                        severity: 'warn',
                        message: `⚠️ [Servo ${component.id}] Warning: Ground is not connected.`,
                        compIds: [component.id],
                        remediation: 'Connect the servo ground pin.',
                        autoFix: true,
                    }));
                }

                return issues.length > 0 ? issues : null;
            }
        }
    ]
};
