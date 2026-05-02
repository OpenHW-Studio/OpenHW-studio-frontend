import { createValidationIssue } from '../component-schema.js';
import type { ComponentValidationRule } from '../component-schema.js';

export const validation: { rules: ComponentValidationRule[] } = {
    rules: [
        {
            id: '7segment-common-and-segment-check',
            name: '7-Segment Common Pin Check',
            severity: 'warn',
            priority: 10,
            description: 'Warn when the common pin or segment resistors are missing.',
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const com1 = `${component.id}.COM.1`;
                const com2 = `${component.id}.COM.2`;
                const issues = [];
                
                const hasCom1 = validator.getNeighbors(com1).length > 0;
                const hasCom2 = validator.getNeighbors(com2).length > 0;

                if (!hasCom1 && !hasCom2) {
                    issues.push(createValidationIssue({
                        ruleId: '7segment-common-and-segment-check',
                        severity: 'warn',
                        message: `⚠️ [7-Segment ${component.id}] Common pin (COM) is not connected. The display will not light up.`,
                        compIds: [component.id],
                        remediation: 'Connect one of the common pins to the correct rail.',
                        autoFix: true,
                    }));
                }

                const segments = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP'];
                const unprotectedSegments = segments.filter(seg => {
                    const node = `${component.id}.${seg}`;
                    return validator.getNeighbors(node).length > 0 && validator.findSeriesResistance(node) === 0;
                });

                if (unprotectedSegments.length > 0) {
                    issues.push(createValidationIssue({
                        ruleId: '7segment-common-and-segment-check',
                        severity: 'warn',
                        message: `⚠️ [7-Segment ${component.id}] Warning: Segments ${unprotectedSegments.join(', ')} are connected without series resistors. Pins may be overloaded.`,
                        compIds: [component.id],
                        remediation: 'Add a series resistor for each lit segment.',
                        autoFix: true,
                    }));
                }

                return issues.length > 0 ? issues : null;
            }
        }
    ]
};