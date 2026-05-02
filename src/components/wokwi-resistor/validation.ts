import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'resistor-power-dissipation',
            name: 'Resistor Power Dissipation',
            severity: 'error',
            priority: 10,
            description: 'Detect when the resistor exceeds its power rating.',
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const maxPower = 0.25;
                const vPin1 = validator?.calculateVoltageAtNode(`${component.id}.p1`);
                const vPin2 = validator?.calculateVoltageAtNode(`${component.id}.p2`);

                if (vPin1 !== undefined && vPin2 !== undefined) {
                    const voltageDrop = Math.abs(vPin1 - vPin2);
                    const resistance = parseFloat(component.attrs.value || '1');

                    if (!Number.isFinite(resistance) || resistance <= 0) {
                        return null;
                    }

                    const powerDissipated = (voltageDrop ** 2) / resistance;

                    if (powerDissipated > maxPower) {
                        return createValidationIssue({
                            ruleId: 'resistor-power-dissipation',
                            severity: 'error',
                            message: `🔥 [Resistor ${component.id}] BURNING: Dissipating ${powerDissipated.toFixed(2)}W! Limit is ${maxPower}W. Resistance too low for this voltage drop.`,
                            compIds: [component.id],
                            remediation: 'Increase the resistor value or reduce the applied voltage.',
                            autoFix: false,
                        });
                    }
                }

                return null;
            }
        }
    ]
};
