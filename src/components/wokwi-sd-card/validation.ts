import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'sd-card-wiring-check',
            name: 'SD Card wiring check',
            severity: 'warn',
            priority: 10,
            description: 'Warn when the SD card power or SPI pins are disconnected.',
            check: (component: any, graph: Map<string, string[]>) => {
                const vcc = graph.get(`${component.id}.VCC`) || [];
                const gnd = graph.get(`${component.id}.GND`) || [];
                const cs = graph.get(`${component.id}.CS`) || [];
                const sck = graph.get(`${component.id}.SCK`) || [];
                const mosi = graph.get(`${component.id}.MOSI`) || [];
                const issues = [];

                if (vcc.length === 0 || gnd.length === 0) {
                    issues.push(createValidationIssue({
                        ruleId: 'sd-card-wiring-check',
                        severity: 'warn',
                        message: `⚠️ [SD ${component.id}] Warning: Connect both VCC and GND to power the card.`,
                        compIds: [component.id],
                        remediation: 'Connect the SD card power pins.',
                        autoFix: true,
                    }));
                }

                if (cs.length === 0 || sck.length === 0 || mosi.length === 0) {
                    issues.push(createValidationIssue({
                        ruleId: 'sd-card-wiring-check',
                        severity: 'warn',
                        message: `⚠️ [SD ${component.id}] Warning: CS/SCK/MOSI are required for SPI communication.`,
                        compIds: [component.id],
                        remediation: 'Wire the SD card SPI pins to the MCU.',
                        autoFix: true,
                    }));
                }

                return issues.length > 0 ? issues : null;
            },
        },
    ],
};
