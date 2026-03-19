export function validateShortCircuits(validator) {
    console.log("🔍 Checking for VCC-GND Short Circuits...");
    const powerNodes = [];

    validator.components.forEach(component => {
        if (validator.isType(component, 'wokwi-arduino-uno', 'mcu_uno')) {
            powerNodes.push(`${component.id}.5V`);
            return;
        }

        if (validator.isType(component, 'wokwi-power-supply')) {
            powerNodes.push(`${component.id}.5V`);
        }
    });

    powerNodes.forEach(startNode => {
        const queue = [[startNode, new Set([startNode]), 0]];

        while (queue.length > 0) {
            const [currentNode, visited, resistance] = queue.shift();

            if (validator.isGroundNode(currentNode) && resistance === 0) {
                validator.addError('🔥 FATAL SHORT CIRCUIT: Direct path from VCC to GND detected with 0 ohm resistance!');
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
                    if (validator.isType(comp, 'resistor', 'wokwi-resistor')) {
                        addedResistance = validator.getComponentAttrNumber(comp, 'value', 0);
                        const nextNode = validator.getOtherTerminalNode(comp, neighbor);
                        if (nextNode) {
                            queue.push([nextNode, newVisited, resistance + addedResistance]);
                            continue;
                        }
                    } else if (validator.isType(comp, 'potentiometer', 'wokwi-potentiometer', 'wokwi-slide-potentiometer', 'switch', 'wokwi-pushbutton')) {
                        const nextNode = validator.getOtherTerminalNode(comp, neighbor);
                        if (nextNode) {
                            queue.push([nextNode, newVisited, resistance]);
                            continue;
                        }
                    }

                    if (validator.isType(comp, 'wokwi-led', 'wokwi-motor', 'wokwi-servo', 'wokwi-buzzer')) continue;

                    queue.push([neighbor, newVisited, resistance + addedResistance]);
                }
            }
        }
    });
}
