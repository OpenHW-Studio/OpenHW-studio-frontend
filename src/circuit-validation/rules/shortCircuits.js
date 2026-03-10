export function validateShortCircuits(validator) {
    console.log("🔍 Checking for VCC-GND Short Circuits...");
    const powerNodes = validator.components.filter(c => c.type === "mcu_uno").map(mcu => `${mcu.id}.5V`);

    powerNodes.forEach(startNode => {
        const queue = [[startNode, new Set([startNode]), 0]];

        while (queue.length > 0) {
            const [currentNode, visited, resistance] = queue.shift();

            if (currentNode.endsWith(".gnd") && resistance === 0) {
                validator.errors.push(`🔥 FATAL SHORT CIRCUIT: Direct path from 5V to GND detected!`);
                return;
            }

            const neighbors = validator.graph.get(currentNode) || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    const newVisited = new Set(visited);
                    newVisited.add(neighbor);

                    const comp = validator.getComponent(neighbor);
                    if (!comp) {
                        queue.push([neighbor, newVisited, resistance]);
                        continue;
                    }

                    let addedResistance = 0;
                    if (comp.type === "resistor") {
                        addedResistance = comp.value || 0;
                    } else if (comp.type === "potentiometer") {
                        addedResistance = 0;
                    } else if (comp.type === "switch") {
                        addedResistance = 0;
                    }

                    if (["diode", "diode_array", "inductive_load", "active_load", "ic_sensor"].includes(comp.type)) continue;

                    queue.push([neighbor, newVisited, resistance + addedResistance]);
                }
            }
        }
    });
}
