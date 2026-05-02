import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'motor-flyback-diode-check',
            name: 'Motor Flyback Diode Check',
            severity: 'warn',
            priority: 10,
            description: 'Warn when an inductive motor load has no flyback diode.',
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const pin1Neighbors = graph.get(`${component.id}.1`) || [];
                const pin2Neighbors = graph.get(`${component.id}.2`) || [];

                let hasFlybackDiode = false;

                pin1Neighbors.forEach(n1 => {
                    const comp1 = validator?.getComponent(n1);
                    if (comp1 && comp1.type === 'wokwi-diode') {
                        const otherDiodePin = n1.endsWith('.anode') ? `${comp1.id}.cathode` : `${comp1.id}.anode`;
                        if (pin2Neighbors.includes(otherDiodePin)) {
                            hasFlybackDiode = true;
                        }
                    }
                });

                if (!hasFlybackDiode) {
                    return createValidationIssue({
                        ruleId: 'motor-flyback-diode-check',
                        severity: 'warn',
                        message: `⚠️ [Motor ${component.id}] FLYBACK DANGER: Inductive load without flyback diode. Turning it off generates voltage spike that can destroy switching transistor or MCU!`,
                        compIds: [component.id],
                        remediation: 'Add a flyback diode across the motor terminals.',
                        autoFix: true,
                    });
                }

                return null;
            }
        }
    ]
};
