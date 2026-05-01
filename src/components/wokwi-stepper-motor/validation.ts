export const validation = {
    rules: [
        {
            name: "Stepper Coil Connection Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const requiredPins = ['A+', 'A-', 'B+', 'B-'];
                const missingPins = requiredPins.filter(pin => {
                    const node = `${component.id}.${pin}`;
                    return validator.getNeighbors(node).length === 0;
                });

                if (missingPins.length > 0) {
                    return `⚠️ [Stepper ${component.id}] Coil Warning: The following pins are not connected: ${missingPins.join(', ')}. Stepper motor requires both coils (A and B) to be fully wired.`;
                }

                return null;
            }
        }
    ]
};
