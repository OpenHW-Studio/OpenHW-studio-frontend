import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'buzzer-series-resistor',
            name: 'Buzzer Series Resistor Check',
            severity: 'warn',
            priority: 10,
            description: 'Warn when a buzzer is connected without isolation or a series resistor.',
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const pins = (component.pins || []).map((p: any) => p.id);
                const pin1 = pins.length > 0 ? `${component.id}.${pins[0]}` : null;
                const pin2 = pins.length > 1 ? `${component.id}.${pins[1]}` : null;

                if (!pin1 || (validator.getNeighbors(pin1).length === 0 && (!pin2 || validator.getNeighbors(pin2).length === 0))) {
                    return createValidationIssue({
                        ruleId: 'buzzer-series-resistor',
                        severity: 'warn',
                        message: `⚠️ [Buzzer ${component.id}] Warning: Buzzer is not connected.`,
                        compIds: [component.id],
                    });
                }

                const res = validator.findSeriesResistance(pin1);
                if (res === 0) {
                    const neighbors = validator.getNeighbors(pin1);
                    const isMcu = neighbors.some((n: string) => n.includes('arduino') || n.includes('pico'));
                    if (isMcu) {
                        return createValidationIssue({
                            ruleId: 'buzzer-series-resistor',
                            severity: 'warn',
                            message: `⚠️ [Buzzer ${component.id}] Safety Warning: No series resistor detected between Buzzer and MCU. Direct drive can stress GPIO pins.`,
                            compIds: [component.id],
                            remediation: 'Add a series resistor or use a driver transistor.',
                        });
                    }
                }

                return null;
            }
        }
    ]
};
