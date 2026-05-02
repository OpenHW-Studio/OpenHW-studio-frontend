import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'arduino-nano-floating-pins',
            name: 'Floating Pins Check',
            severity: 'warn',
            priority: 10,
            description: 'Detect Nano pins that are only reachable through a button or switch.',
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const digitalPins = ["D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12", "D13"];
                const issues = [];

                digitalPins.forEach(pinName => {
                    const pinNode = `${component.id}.${pinName}`;
                    const neighbors = validator.getNeighbors(pinNode);
                    if (neighbors.length > 0) {
                        const isFloating = neighbors.some((n: string) => n.includes('button') || n.includes('switch'));
                        if (isFloating) {
                             const hasPowerPath = validator.calculateVoltageAtNode(pinNode) > 0 || validator.isGroundNode(pinNode);
                             if (!hasPowerPath) {
                                 issues.push(createValidationIssue({
                                     ruleId: 'arduino-nano-floating-pins',
                                     severity: 'warn',
                                     message: `👻 [Nano ${component.id}] FLOATING PIN: ${pinNode} is connected to a switch but lacks a pull-up/pull-down resistor.`,
                                     compIds: [component.id],
                                     remediation: 'Add a pull-up or pull-down resistor.',
                                 }));
                             }
                        }
                    }
                });

                return issues.length > 0 ? issues : null;
            }
        },
        {
            id: 'arduino-nano-i2c-pullups',
            name: 'I2C Pullups Check',
            severity: 'warn',
            priority: 20,
            description: 'Warn when the Nano I2C pins do not have a pull-up path to VCC.',
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const i2cPins = ["A4", "A5"];
                const issues = [];

                i2cPins.forEach(pinName => {
                    const pinNode = `${component.id}.${pinName}`;
                    if (validator.getNeighbors(pinNode).length > 0) {
                        const hasPullup = validator.findSeriesResistance(pinNode) > 0;
                        if (!hasPullup) {
                            issues.push(createValidationIssue({
                                ruleId: 'arduino-nano-i2c-pullups',
                                severity: 'warn',
                                message: `⚠️ [Nano ${component.id}] I2C PULLUP WARNING: ${pinNode} is in use but missing a Pull-Up resistor to VCC.`,
                                compIds: [component.id],
                                remediation: 'Add a pull-up resistor to VCC.',
                            }));
                        }
                    }
                });

                return issues.length > 0 ? issues : null;
            }
        }
    ]
};
