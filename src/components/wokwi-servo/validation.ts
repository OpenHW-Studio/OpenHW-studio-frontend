export const validation = {
    rules: [
        {
            name: "Servo Power and Signal Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const pwmPin = graph.get(`${component.id}.PWM`);
                const vccPin = graph.get(`${component.id}.V+`);
                const gndPin = graph.get(`${component.id}.GND`);

                if (!pwmPin || pwmPin.length === 0) {
                    return `⚠️ [Servo ${component.id}] Warning: PWM Signal pin is floating.`;
                }
                if (!vccPin || vccPin.length === 0) {
                    return `⚠️ [Servo ${component.id}] Warning: V+ Power is not connected.`;
                }
                if (!gndPin || gndPin.length === 0) {
                    return `⚠️ [Servo ${component.id}] Warning: Ground is not connected.`;
                }

                return null;
            }
        }
    ]
};
