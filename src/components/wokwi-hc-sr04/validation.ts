export const validation = {
    rules: [
        {
            name: "Ultrasonic Sensor Connection Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const triggerPin = `${component.id}.TRIG`;
                const echoPin = `${component.id}.ECHO`;
                const vccPin = `${component.id}.VCC`;
                const gndPin = `${component.id}.GND`;

                if (validator.getNeighbors(vccPin).length > 0 && validator.getNeighbors(gndPin).length > 0) {
                    if (validator.getNeighbors(triggerPin).length === 0) {
                        return `⚠️ [Ultrasonic ${component.id}] Warning: TRIG pin is not connected. Sensor cannot be triggered.`;
                    }
                    if (validator.getNeighbors(echoPin).length === 0) {
                        return `⚠️ [Ultrasonic ${component.id}] Warning: ECHO pin is not connected. No distance reading will be received.`;
                    }
                }

                return null;
            }
        }
    ]
};
