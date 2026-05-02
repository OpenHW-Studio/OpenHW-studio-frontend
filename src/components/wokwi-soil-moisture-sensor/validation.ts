import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'soil-moisture-sensor-connection-check',
            name: 'Sensor Connection Check',
            severity: 'warn',
            priority: 10,
            description: 'Warn when sensor power, ground, or signal pins are disconnected.',
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const pins = (component.pins || []).map((p: any) => p.id);
                const vcc = pins.find((p: string) => p.includes('VCC') || p.includes('5V') || p.includes('V+'));
                const gnd = pins.find((p: string) => p.includes('GND'));
                const sigPins = pins.filter((p: string) => p.includes('SIG') || p.includes('OUT') || p.includes('AO') || p.includes('DO'));

                if (vcc && validator.getNeighbors(`${component.id}.${vcc}`).length === 0) {
                    return createValidationIssue({
                        ruleId: 'soil-moisture-sensor-connection-check',
                        severity: 'warn',
                        message: `⚠️ [${component.type} ${component.id}] Power is not connected.`,
                        compIds: [component.id],
                        remediation: 'Connect the sensor power pin to the supply rail.',
                        autoFix: true,
                    });
                }

                if (gnd && validator.getNeighbors(`${component.id}.${gnd}`).length === 0) {
                    return createValidationIssue({
                        ruleId: 'soil-moisture-sensor-connection-check',
                        severity: 'warn',
                        message: `⚠️ [${component.type} ${component.id}] Ground is not connected.`,
                        compIds: [component.id],
                        remediation: 'Connect the sensor ground pin to the common ground rail.',
                        autoFix: true,
                    });
                }
                
                const connectedSigs = sigPins.filter(p => validator.getNeighbors(`${component.id}.${p}`).length > 0);
                if (sigPins.length > 0 && connectedSigs.length === 0) {
                    return createValidationIssue({
                        ruleId: 'soil-moisture-sensor-connection-check',
                        severity: 'warn',
                        message: `⚠️ [${component.type} ${component.id}] Warning: No signal/output pins are connected. The sensor will not provide any data.`,
                        compIds: [component.id],
                        remediation: 'Wire the signal output to an MCU input or analog read pin.',
                        autoFix: true,
                    });
                }

                return null;
            }
        }
    ]
};
