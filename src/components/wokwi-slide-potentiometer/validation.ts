export const validation = {
    rules: [
        {
            name: "Floating Pins Check",
            check: (component: any, graph: Map<string, string[]>) => {
                // Default generic validation for wokwi-slide-potentiometer
                // Implement further physics logic based on specific pins
                return null;
            }
        }
    ]
};
