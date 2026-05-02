import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'ldr-module-wiring-check',
            name: 'LDR Module Wiring Check',
            severity: 'warn',
            priority: 10,
            description: 'Warn when the LDR module is shorted or its analog output is floating.',
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const vccNode = `${component.id}.VCC`;
                const gndNode = `${component.id}.GND`;
                const outNode = `${component.id}.AO`;
                const vccV = validator.calculateVoltageAtNode(vccNode);
                const gndV = validator.calculateVoltageAtNode(gndNode);

                if (vccV > 0.5 && Math.abs(vccV - gndV) < 0.1) {
                    return createValidationIssue({
                        ruleId: 'ldr-module-wiring-check',
                        severity: 'error',
                        message: `🔥 [LDR Module ${component.id}] FATAL: VCC and GND are shorted on the module pins!`,
                        compIds: [component.id],
                        remediation: 'Fix the short between VCC and GND.',
                        autoFix: false,
                    });
                }

                if (validator.getNeighbors(vccNode).length > 0 && validator.getNeighbors(outNode).length === 0) {
                    return createValidationIssue({
                        ruleId: 'ldr-module-wiring-check',
                        severity: 'warn',
                        message: `⚠️ [LDR Module ${component.id}] Warning: Module is powered but the Signal (AO) pin is not connected to anything.`,
                        compIds: [component.id],
                        remediation: 'Connect AO to an analog input pin.',
                        autoFix: true,
                    });
                }

                return null;
            }
        }
    ]
};