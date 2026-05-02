import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'hc-sr04-connection-check',
            name: 'Ultrasonic Sensor Connection Check',
            severity: 'warn',
            priority: 10,
            description: 'Warn when TRIG or ECHO are disconnected while the sensor is powered.',
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const triggerPin = `${component.id}.TRIG`;
                const echoPin = `${component.id}.ECHO`;
                const vccPin = `${component.id}.VCC`;
                const gndPin = `${component.id}.GND`;
                const issues = [];

                if (validator.getNeighbors(vccPin).length > 0 && validator.getNeighbors(gndPin).length > 0) {
                    if (validator.getNeighbors(triggerPin).length === 0) {
                        issues.push(createValidationIssue({
                            ruleId: 'hc-sr04-connection-check',
                            severity: 'warn',
                            message: `⚠️ [Ultrasonic ${component.id}] Warning: TRIG pin is not connected. Sensor cannot be triggered.`,
                            compIds: [component.id],
                            remediation: 'Connect TRIG to a digital output pin.',
                            autoFix: true,
                        }));
                    }
                    if (validator.getNeighbors(echoPin).length === 0) {
                        issues.push(createValidationIssue({
                            ruleId: 'hc-sr04-connection-check',
                            severity: 'warn',
                            message: `⚠️ [Ultrasonic ${component.id}] Warning: ECHO pin is not connected. No distance reading will be received.`,
                            compIds: [component.id],
                            remediation: 'Connect ECHO to a digital input pin.',
                            autoFix: true,
                        }));
                    }
                }

                return issues.length > 0 ? issues : null;
            }
        }
    ]
};
