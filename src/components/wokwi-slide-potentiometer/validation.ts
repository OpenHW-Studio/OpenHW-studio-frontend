import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'slide-potentiometer-power-dissipation',
            name: 'Slide Potentiometer Power Dissipation',
            severity: 'error',
            priority: 10,
            description: 'Detect when the slide potentiometer track would overheat.',
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const maxPower = 0.25;
                const dangerousLowResistance = 10;
                const vVCC = validator?.calculateVoltageAtNode(`${component.id}.VCC`);
                const vGND = validator?.calculateVoltageAtNode(`${component.id}.GND`);

                if (vVCC !== undefined && vGND !== undefined) {
                    const voltageDrop = Math.abs(vVCC - vGND);
                    const worstCasePower = (voltageDrop ** 2) / dangerousLowResistance;

                    if (worstCasePower > maxPower) {
                        return createValidationIssue({
                            ruleId: 'slide-potentiometer-power-dissipation',
                            severity: 'error',
                            message: `🔥 [Slide Pot ${component.id}] DANGER: If sliding to 0Ω, track will dissipate ${worstCasePower.toFixed(2)}W. Add series resistor.`,
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
