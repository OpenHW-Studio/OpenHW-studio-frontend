export const validation = {
    rules: [
        {
            name: "Keypad Connection Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const pins = (component.pins || []).map((p: any) => p.id);
                const connectedCount = pins.filter((p: string) => validator.getNeighbors(`${component.id}.${p}`).length > 0).length;

                if (connectedCount > 0 && connectedCount < pins.length) {
                    return `⚠️ [Keypad ${component.id}] Partial Connection: Only ${connectedCount} out of ${pins.length} pins are wired. Keypads usually require all row and column pins to be connected.`;
                }

                return null;
            }
        }
    ]
};
