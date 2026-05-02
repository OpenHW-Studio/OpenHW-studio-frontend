import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: 'membrane-keypad-connection-check',
            name: 'Keypad Connection Check',
            severity: 'warn',
            priority: 10,
            description: 'Warn when only part of the keypad matrix is connected.',
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const pins = (component.pins || []).map((p: any) => p.id);
                const connectedCount = pins.filter((p: string) => validator.getNeighbors(`${component.id}.${p}`).length > 0).length;

                if (connectedCount > 0 && connectedCount < pins.length) {
                    return createValidationIssue({
                        ruleId: 'membrane-keypad-connection-check',
                        severity: 'warn',
                        message: `⚠️ [Keypad ${component.id}] Partial Connection: Only ${connectedCount} out of ${pins.length} pins are wired. Keypads usually require all row and column pins to be connected.`,
                        compIds: [component.id],
                        remediation: 'Connect all keypad row and column pins.',
                        autoFix: true,
                    });
                }

                return null;
            }
        }
    ]
};
