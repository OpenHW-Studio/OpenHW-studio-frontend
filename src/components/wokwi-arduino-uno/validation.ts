export const validation = {
    rules: [
        {
            name: "Floating Pins Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                const digitalPins = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"];

                digitalPins.forEach(pinName => {
                    const pinNode = `${component.id}.${pinName}`;
                    let hasPathToPowerOrGnd = false;
                    let isFloating = false;

                    const queue: [string, Set<string>][] = [[pinNode, new Set([pinNode])]];

                    while (queue.length > 0) {
                        const [currentNode, visited] = queue.shift()!;

                        // Check if we hit a power rail or GND
                        if (currentNode.endsWith(".5V") || currentNode.endsWith(".gnd") || currentNode.match(/gnd_\d+/)) {
                            hasPathToPowerOrGnd = true;
                            break;
                        }

                        const neighbors = graph.get(currentNode) || [];
                        for (const neighbor of neighbors) {
                            if (!visited.has(neighbor)) {
                                const newVisited = new Set(visited);
                                newVisited.add(neighbor);

                                const comp = validator?.getComponent(neighbor);
                                if (comp && comp.type === "wokwi-pushbutton") {
                                    isFloating = true;
                                    continue;
                                }
                                queue.push([neighbor, newVisited]);
                            }
                        }
                    }

                    if (isFloating && !hasPathToPowerOrGnd) {
                        validator.errors.push(`👻 [Arduino ${component.id}] FLOATING PIN: ${pinNode} is connected to a switch but lacks a pull-up/pull-down resistor. The MCU will read random noise!`);
                    }
                });

                return null;
            }
        },
        {
            name: "I2C Pullups Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                // For UNO, A4 is SDA and A5 is SCL
                const i2cPins = ["A4", "A5"];

                i2cPins.forEach(pinName => {
                    const pinNode = `${component.id}.${pinName}`;
                    const connections = graph.get(pinNode);

                    // If pin has no connections, it isn't being used for I2C (or anything else). Skip.
                    if (!connections || connections.length === 0) return;

                    let hasPullup = false;
                    const queue: [string, Set<string>][] = [[pinNode, new Set([pinNode])]];

                    while (queue.length > 0) {
                        const [currentNode, visited] = queue.shift()!;

                        if (currentNode.endsWith(".5V") || currentNode.endsWith(".3v3") || currentNode.endsWith(".vcc")) {
                            hasPullup = true;
                            break;
                        }

                        const neighbors = graph.get(currentNode) || [];
                        for (const neighbor of neighbors) {
                            if (!visited.has(neighbor)) {
                                const newVisited = new Set(visited);
                                newVisited.add(neighbor);

                                const comp = validator?.getComponent(neighbor);
                                // Must cross a resistor to VCC
                                if (comp && comp.type === "wokwi-resistor") {
                                    queue.push([neighbor, newVisited]);
                                }
                            }
                        }
                    }

                    // A simplification: We assume if connected, we expect a pullup. 
                    // To avoid false positives on simple analog reads, we might only check 
                    // if it's connected to known I2C devices. Just a basic check here.
                    // Instead of failing hard, we log a warning string.
                    if (!hasPullup) {
                        validator.errors.push(`⚠️ [Arduino ${component.id}] I2C PULLUP WARNING: ${pinNode} is in use but missing a Pull-Up resistor to VCC. I2C devices will fail. (Ignore if used for Analog Read)`);
                    }
                });

                return null;
            }
        },
        {
            name: "MCU Power Input Check",
            check: (component: any, graph: Map<string, string[]>, validator: any) => {
                // Determine if VIN or 5V is receiving voltage
                const vinConns = graph.get(`${component.id}.vin`) || [];
                const v5Conns = graph.get(`${component.id}.5V`) || [];

                // Using FullCircuitValidator's mock API to get voltage
                const vinVolts = validator?.calculateVoltageAtNode(`${component.id}.vin`);
                const v5Volts = validator?.calculateVoltageAtNode(`${component.id}.5V`);

                // If vinVolts comes back as external high voltage (eg > 12V), fry the MCU.
                if (vinVolts > 12.0) {
                    return `🔥 [Arduino ${component.id}] FRIED: ${vinVolts}V applied to VIN. Max is 12V.`;
                }

                if (v5Volts > 5.5) {
                    return `🔥 [Arduino ${component.id}] FRIED: ${v5Volts}V applied to 5V pin. Bypassed internal regulator!`;
                }

                return null;
            }
        }
    ]
};
