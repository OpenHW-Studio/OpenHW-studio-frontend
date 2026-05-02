import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
  rules: [
    {
      id: 'rp2040-power-input-check',
      name: 'RP2040 Power Input Check',
      severity: 'error',
      priority: 10,
      description: 'Detect over-voltage on VBUS and the 3V3 rail.',
      check: (component: any, graph: Map<string, string[]>, validator: any) => {
        const vbusVolts = validator?.calculateVoltageAtNode(`${component.id}.VBUS`) || 0;
        const v3Volts = validator?.calculateVoltageAtNode(`${component.id}.3V3`) || 0;

        if (vbusVolts > 5.5) {
          return createValidationIssue({
            ruleId: 'rp2040-power-input-check',
            severity: 'error',
            message: `🔥 [Pico ${component.id}] ${vbusVolts}V applied to VBUS. Max expected is 5V USB input.`,
            compIds: [component.id],
            remediation: 'Keep VBUS at USB-level voltages.',
            autoFix: false,
          });
        }

        if (v3Volts > 3.6) {
          return createValidationIssue({
            ruleId: 'rp2040-power-input-check',
            severity: 'error',
            message: `🔥 [Pico ${component.id}] ${v3Volts}V applied to 3V3 rail.`,
            compIds: [component.id],
            remediation: 'Keep the 3V3 rail within the RP2040 logic range.',
            autoFix: false,
          });
        }

        return null;
      },
    },
  ],
};
