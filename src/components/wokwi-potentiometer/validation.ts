import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'potentiometer-power-dissipation',
            name: 'Potentiometer Power Dissipation',
            severity: 'error',
            priority: 10,
            description: 'Detect when the potentiometer track would overheat.',
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const maxPower = 0.25;
                const dangerousLowResistance = 10;
                const vPin1 = validator?.calculateVoltageAtNode(`${component.id}.GND`);
                const vPin2 = validator?.calculateVoltageAtNode(`${component.id}.VCC`);

                if (vPin1 !== undefined && vPin2 !== undefined) {
                    const voltageDrop = Math.abs(vPin1 - vPin2);
                    const worstCasePower = (voltageDrop ** 2) / dangerousLowResistance;

                    if (worstCasePower > maxPower) {
                        return createValidationIssue({
                            ruleId: 'potentiometer-power-dissipation',
                            severity: 'error',
                            message: `🔥 [Potentiometer ${component.id}] DANGER: If you turn knob to 0Ω, it will dissipate ${worstCasePower.toFixed(2)}W and burn track! Add static resistor in series.`,
                            compIds: [component.id],
                            remediation: 'Add a series resistor to limit worst-case current.',
                            autoFix: false,
                        });
                    }
                }

                return null;
            }
        }
    ]
};
