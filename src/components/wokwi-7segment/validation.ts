export const validation = {
    rules: [
        {
            name: "7-Segment Common Pin Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const com1 = `${component.id}.COM.1`;
                const com2 = `${component.id}.COM.2`;
                
                const hasCom1 = validator.getNeighbors(com1).length > 0;
                const hasCom2 = validator.getNeighbors(com2).length > 0;

                if (!hasCom1 && !hasCom2) {
                    return `⚠️ [7-Segment ${component.id}] Common pin (COM) is not connected. The display will not light up.`;
                }

                // Check for series resistors on segments
                const segments = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP'];
                const unprotectedSegments = segments.filter(seg => {
                    const node = `${component.id}.${seg}`;
                    return validator.getNeighbors(node).length > 0 && validator.findSeriesResistance(node) === 0;
                });

                if (unprotectedSegments.length > 0) {
                    return `⚠️ [7-Segment ${component.id}] Warning: Segments ${unprotectedSegments.join(', ')} are connected without series resistors. Pins may be overloaded.`;
                }

                return null;
            }
        }
    ]
};