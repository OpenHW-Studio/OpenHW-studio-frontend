export function validateFloatingPins(validator) {
    console.log("⚡ Checking for Floating Digital Pins...");
    const mcuDigitalPins = Array.from(validator.graph.keys()).filter(node => node.includes("mcu_uno.digital"));

    mcuDigitalPins.forEach(pinNode => {
        let hasPathToPowerOrGnd = false;
        let isFloating = false;

        const queue = [[pinNode, new Set([pinNode])]];

        while (queue.length > 0) {
            const [currentNode, visited] = queue.shift();

            if (currentNode.endsWith(".5V") || currentNode.endsWith(".gnd")) {
                hasPathToPowerOrGnd = true;
                break;
            }

            const neighbors = validator.graph.get(currentNode) || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    const newVisited = new Set(visited);
                    newVisited.add(neighbor);

                    const comp = validator.getComponent(neighbor);
                    if (comp && comp.type === "switch") {
                        isFloating = true;
                        continue;
                    }
                    queue.push([neighbor, newVisited]);
                }
            }
        }

        if (isFloating && !hasPathToPowerOrGnd) {
            validator.errors.push(`👻 FLOATING PIN: ${pinNode} is connected to a switch but lacks a pull-up/pull-down resistor. The MCU will read random noise!`);
        }
    });
}
