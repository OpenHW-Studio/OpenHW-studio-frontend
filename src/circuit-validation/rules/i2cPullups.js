export function validateI2CPullups(validator) {
    console.log("⚡ Checking I2C Protocol Requirements...");

    const i2cPins = Array.from(validator.graph.keys()).filter(node => node.includes(".sda") || node.includes(".scl"));

    i2cPins.forEach(pinNode => {
        let hasPullup = false;

        const queue = [[pinNode, new Set([pinNode])]];
        while (queue.length > 0) {
            const [currentNode, visited] = queue.shift();

            if (currentNode.endsWith(".5V") || currentNode.endsWith(".3v3") || currentNode.endsWith(".vcc")) {
                hasPullup = true;
                break;
            }

            const neighbors = validator.graph.get(currentNode) || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    const newVisited = new Set(visited);
                    newVisited.add(neighbor);

                    const comp = validator.getComponent(neighbor);
                    if (comp && comp.type === "resistor") {
                        queue.push([neighbor, newVisited]);
                    }
                }
            }
        }

        if (!hasPullup) {
            validator.errors.push(`⚠️ I2C COMMUNICATION FAILURE: ${pinNode} is missing a Pull-Up resistor to VCC. I2C devices will not be able to talk to the MCU.`);
        }
    });
}
