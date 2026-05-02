import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'arduino-uno-floating-pins',
            name: 'Floating Pins Check',
            severity: 'warn',
            priority: 10,
            description: 'Detect MCU pins that float through a pushbutton without a pull resistor.',
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const digitalPins = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"];
                const issues = [];

                digitalPins.forEach(pinName => {
                    const pinNode = `${component.id}.${pinName}`;
                    let hasPathToPowerOrGnd = false;
                    let isFloating = false;

                    const queue: [string, Set<string>][] = [[pinNode, new Set([pinNode])]];

                    while (queue.length > 0) {
                        const [currentNode, visited] = queue.shift()!;

                        if (currentNode.endsWith(".5V") || currentNode.endsWith(".gnd") || currentNode.match(/gnd_\d+/)) {
                            hasPathToPowerOrGnd = true;
                            break;
                        }

                        const neighbors = graph.get(currentNode) || [];
                        for (const neighbor of neighbors) {
                            if (!visited.has(neighbor)) {
                                const newVisited = new Set(visited);
                                newVisited.add(neighbor);

                                const comp = validator?.getComponent(neighbor);
                                if (comp && comp.type === "wokwi-pushbutton") {
                                    isFloating = true;
                                    continue;
                                }
                                queue.push([neighbor, newVisited]);
                            }
                        }
                    }

                    if (isFloating && !hasPathToPowerOrGnd) {
                        issues.push(createValidationIssue({
                            ruleId: 'arduino-uno-floating-pins',
                            severity: 'warn',
                            message: `👻 [Arduino ${component.id}] FLOATING PIN: ${pinNode} is connected to a switch but lacks a pull-up/pull-down resistor. The MCU will read random noise!`,
                            compIds: [component.id],
                            remediation: 'Add a pull-up or pull-down resistor.',
                        }));
                    }
                });

                return issues.length > 0 ? issues : null;
            }
        },
        {
            id: 'arduino-uno-i2c-pullups',
            name: 'I2C Pullups Check',
            severity: 'warn',
            priority: 20,
            description: 'Warn when the UNO I2C pins do not have a pull-up path to VCC.',
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const i2cPins = ["A4", "A5"];
                const issues = [];

                i2cPins.forEach(pinName => {
                    const pinNode = `${component.id}.${pinName}`;
                    const connections = graph.get(pinNode);

                    if (!connections || connections.length === 0) return;

                    let hasPullup = false;
                    const queue: [string, Set<string>][] = [[pinNode, new Set([pinNode])]];

                    while (queue.length > 0) {
                        const [currentNode, visited] = queue.shift()!;

                        if (currentNode.endsWith(".5V") || currentNode.endsWith(".3v3") || currentNode.endsWith(".vcc")) {
                            hasPullup = true;
                            break;
                        }

                        const neighbors = graph.get(currentNode) || [];
                        for (const neighbor of neighbors) {
                            if (!visited.has(neighbor)) {
                                const newVisited = new Set(visited);
                                newVisited.add(neighbor);

                                const comp = validator?.getComponent(neighbor);
                                if (comp && comp.type === "wokwi-resistor") {
                                    queue.push([neighbor, newVisited]);
                                }
                            }
                        }
                    }

                    if (!hasPullup) {
                        issues.push(createValidationIssue({
                            ruleId: 'arduino-uno-i2c-pullups',
                            severity: 'warn',
                            message: `⚠️ [Arduino ${component.id}] I2C PULLUP WARNING: ${pinNode} is in use but missing a Pull-Up resistor to VCC. I2C devices will fail. (Ignore if used for Analog Read)`,
                            compIds: [component.id],
                            remediation: 'Add an I2C pull-up resistor to VCC.',
                        }));
                    }
                });

                return issues.length > 0 ? issues : null;
            }
        },
        {
            id: 'arduino-uno-power-input',
            name: 'MCU Power Input Check',
            severity: 'error',
            priority: 30,
            description: 'Check that VIN and 5V stay within safe limits.',
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const vinConns = graph.get(`${component.id}.vin`) || [];
                const v5Conns = graph.get(`${component.id}.5V`) || [];

                const vinVolts = validator?.calculateVoltageAtNode(`${component.id}.vin`);
                const v5Volts = validator?.calculateVoltageAtNode(`${component.id}.5V`);
                const issues = [];

                if (vinConns.length > 0 && vinVolts > 12.0) {
                    issues.push(createValidationIssue({
                        ruleId: 'arduino-uno-power-input',
                        severity: 'error',
                        message: `🔥 [Arduino ${component.id}] FRIED: ${vinVolts}V applied to VIN. Max is 12V.`,
                        compIds: [component.id],
                        remediation: 'Keep VIN below 12V.',
                    }));
                }

                if (v5Conns.length > 0 && v5Volts > 5.5) {
                    issues.push(createValidationIssue({
                        ruleId: 'arduino-uno-power-input',
                        severity: 'error',
                        message: `🔥 [Arduino ${component.id}] FRIED: ${v5Volts}V applied to 5V pin. Bypassed internal regulator!`,
                        compIds: [component.id],
                        remediation: 'Do not inject more than 5.5V into the 5V pin.',
                    }));
                }

                return issues.length > 0 ? issues : null;
            }
        }
    ]
};
