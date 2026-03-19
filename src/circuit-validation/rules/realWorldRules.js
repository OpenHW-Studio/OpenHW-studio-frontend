const MCU_TYPES = ['wokwi-arduino-uno', 'mcu_uno'];
const I2C_DEVICE_TYPES = ['wokwi-lcd2004-i2c', 'wokwi-ssd1306-oled', 'max30102'];
const DRIVER_TYPES = ['wokwi-motor-driver', 'shift_register'];

function getPinId(nodeId) {
    return String(nodeId || '').split('.')[1] || '';
}

function getPinLower(nodeId) {
    return getPinId(nodeId).toLowerCase();
}

function getComponentPins(component) {
    return component?.pins || component?.manifest?.pins || [];
}

function getNodeType(component, pinId) {
    const pins = getComponentPins(component);
    const pin = pins.find(p => p.id === pinId);
    return pin?.type || null;
}

function getEndpointPinsConnectedToMcuDigital(validator, endpointNode) {
    const hits = [];
    const neighbors = validator.getNeighbors(endpointNode);

    neighbors.forEach(neighbor => {
        const comp = validator.getComponent(neighbor);
        if (!comp || !validator.isType(comp, ...MCU_TYPES)) return;

        const pin = getPinId(neighbor);
        if (/^\d+$/.test(pin) || /^D\d+$/i.test(pin) || /^A\d+$/i.test(pin)) {
            hits.push({ boardId: comp.id, pin });
        }
    });

    return hits;
}

function getMcuDigitalPins(component) {
    const pins = getComponentPins(component);
    const fromManifest = pins
        .filter(pin => pin.type === 'digital')
        .map(pin => pin.id);

    if (fromManifest.length) return fromManifest;

    return ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'];
}

function hasConnection(validator, nodeId) {
    return (validator.getNeighbors(nodeId) || []).length > 0;
}

function hasResistivePathToSupply(validator, startNode) {
    const queue = [[startNode, false, new Set([startNode])]];

    while (queue.length > 0) {
        const [currentNode, hasResistor, visited] = queue.shift();

        if (validator.isSupplyNode(currentNode) && hasResistor) {
            return true;
        }

        const neighbors = validator.getNeighbors(currentNode);
        for (const neighbor of neighbors) {
            if (visited.has(neighbor)) continue;

            const nextVisited = new Set(visited);
            nextVisited.add(neighbor);

            const comp = validator.getComponent(neighbor);
            if (validator.isType(comp, 'wokwi-resistor', 'resistor')) {
                const otherNode = validator.getOtherTerminalNode(comp, neighbor);
                if (otherNode && !nextVisited.has(otherNode)) {
                    nextVisited.add(otherNode);
                    queue.push([otherNode, true, nextVisited]);
                }
                continue;
            }

            queue.push([neighbor, hasResistor, nextVisited]);
        }
    }

    return false;
}

function hasI2CDeviceConnected(validator, mcu) {
    const a4Node = `${mcu.id}.A4`;
    const a5Node = `${mcu.id}.A5`;

    const queue = [a4Node, a5Node];
    const visited = new Set(queue);

    while (queue.length > 0) {
        const current = queue.shift();
        const comp = validator.getComponent(current);
        if (validator.isType(comp, ...I2C_DEVICE_TYPES)) {
            return true;
        }

        const neighbors = validator.getNeighbors(current);
        for (const neighbor of neighbors) {
            if (visited.has(neighbor)) continue;
            visited.add(neighbor);
            queue.push(neighbor);
        }
    }

    return false;
}

function getComponentLogicVoltage(validator, component) {
    if (!component) return null;

    if (validator.isType(component, 'wokwi-arduino-uno')) return 5.0;
    if (validator.isType(component, 'max30102')) return 3.3;

    const fromAttrs = Number(component?.attrs?.logicVoltage);
    if (Number.isFinite(fromAttrs) && fromAttrs > 0) return fromAttrs;

    return null;
}

export function validateMcuPower(validator) {
    console.log('🔍 Checking MCU power input limits...');

    validator.components
        .filter(comp => validator.isType(comp, ...MCU_TYPES))
        .forEach(mcu => {
            const vinNode = `${mcu.id}.vin`;
            const v5Node = `${mcu.id}.5V`;
            const v33Node = `${mcu.id}.3v3`;

            if (hasConnection(validator, vinNode)) {
                const vin = validator.calculateVoltageAtNode(vinNode);
                if (vin > 0 && (vin < validator.mcuSpecs.vinMin || vin > validator.mcuSpecs.vinMax)) {
                    validator.addError(
                        `🔥 [MCU ${mcu.id}] VIN out of safe range: ${vin.toFixed(2)}V. Use ${validator.mcuSpecs.vinMin}-${validator.mcuSpecs.vinMax}V on VIN.`
                    );
                }
            }

            if (hasConnection(validator, v5Node)) {
                const v5 = validator.calculateVoltageAtNode(v5Node);
                if (v5 > 5.5) {
                    validator.addError(
                        `🔥 [MCU ${mcu.id}] Regulator bypass damage: ${v5.toFixed(2)}V applied to 5V pin.`
                    );
                }
            }

            if (hasConnection(validator, v33Node)) {
                const v33 = validator.calculateVoltageAtNode(v33Node);
                if (v33 > 3.6) {
                    validator.addError(
                        `🔥 [MCU ${mcu.id}] 3.3V rail over-voltage: ${v33.toFixed(2)}V detected on 3v3 pin.`
                    );
                }
            }
        });
}

export function validateComponentLimits(validator) {
    console.log('🔍 Checking LED current and MCU GPIO load limits...');

    const packageCurrentByMcu = new Map();

    validator.components.forEach(component => {
        if (validator.isType(component, 'wokwi-led')) {
            const anode = `${component.id}.A`;
            const cathode = `${component.id}.K`;
            if (!hasConnection(validator, anode) || !hasConnection(validator, cathode)) return;

            const anodeMcuPins = getEndpointPinsConnectedToMcuDigital(validator, anode);
            const cathodeMcuPins = getEndpointPinsConnectedToMcuDigital(validator, cathode);
            if (anodeMcuPins.length > 0 && cathodeMcuPins.length > 0) {
                validator.addError(
                    `🔥 [LED ${component.id}] Unsupported pin-to-pin drive: LED is connected between MCU GPIO pins (${anodeMcuPins[0].boardId}:${anodeMcuPins[0].pin} and ${cathodeMcuPins[0].boardId}:${cathodeMcuPins[0].pin}).`
                );
            }

            const va = validator.calculateVoltageAtNode(anode);
            const vk = validator.calculateVoltageAtNode(cathode);
            const ledSpec = validator.componentSpecs['wokwi-led'];

            if (va > vk) {
                const driveVoltage = va - vk - ledSpec.forwardVoltage;
                if (driveVoltage <= 0) return;

                const seriesResistance = validator.findSeriesResistance(anode);
                if (seriesResistance <= 0) {
                    validator.addError(
                        `🔥 [LED ${component.id}] No series resistance detected. LED is effectively shorted and will burn out.`
                    );
                    return;
                }

                const currentA = driveVoltage / seriesResistance;
                if (currentA > ledSpec.maxCurrentA) {
                    validator.addError(
                        `🔥 [LED ${component.id}] Over-current ${Math.round(currentA * 1000)}mA > ${Math.round(ledSpec.maxCurrentA * 1000)}mA. Increase resistor value.`
                    );
                }
            }
        }

        if (!validator.isType(component, ...MCU_TYPES)) return;

        const digitalPins = getMcuDigitalPins(component);
        let packageCurrent = 0;

        digitalPins.forEach(pinId => {
            const pinNode = `${component.id}.${pinId}`;
            const neighbors = validator.getNeighbors(pinNode);
            if (!neighbors.length) return;

            let pinCurrent = 0;

            neighbors.forEach(neighbor => {
                const neighborComp = validator.getComponent(neighbor);
                if (!neighborComp) return;

                if (validator.isType(neighborComp, ...DRIVER_TYPES)) {
                    return;
                }

                let loadCurrent = 0;
                if (validator.isType(neighborComp, 'wokwi-motor')) {
                    loadCurrent = validator.componentSpecs['wokwi-motor'].typicalCurrentA;
                    validator.addError(
                        `🔥 [MCU ${component.id}] GPIO ${pinId} drives DC motor ${neighborComp.id} directly. Use a transistor or motor driver.`
                    );
                } else if (validator.isType(neighborComp, 'wokwi-servo')) {
                    loadCurrent = validator.componentSpecs['wokwi-servo'].typicalCurrentA;
                    validator.addError(
                        `🔥 [MCU ${component.id}] GPIO ${pinId} is sourcing servo ${neighborComp.id} power directly. Provide external 5V rail.`
                    );
                } else if (validator.isType(neighborComp, 'wokwi-buzzer')) {
                    loadCurrent = validator.componentSpecs['wokwi-buzzer'].typicalCurrentA;
                }

                pinCurrent += loadCurrent;
            });

            if (pinCurrent > validator.mcuSpecs.gpioPinMaxCurrentA) {
                validator.addError(
                    `🔥 [MCU ${component.id}] GPIO ${pinId} current ${Math.round(pinCurrent * 1000)}mA exceeds ${Math.round(validator.mcuSpecs.gpioPinMaxCurrentA * 1000)}mA limit.`
                );
            }

            packageCurrent += pinCurrent;
        });

        packageCurrentByMcu.set(component.id, packageCurrent);
    });

    packageCurrentByMcu.forEach((totalCurrent, mcuId) => {
        if (totalCurrent > validator.mcuSpecs.gpioPackageMaxCurrentA) {
            validator.addError(
                `🔥 [MCU ${mcuId}] Total GPIO package current ${Math.round(totalCurrent * 1000)}mA exceeds ${Math.round(validator.mcuSpecs.gpioPackageMaxCurrentA * 1000)}mA maximum.`
            );
        }
    });
}

export function validatePowerDissipation(validator) {
    console.log('🔍 Checking passive component power dissipation...');

    validator.components.forEach(component => {
        if (!validator.isType(component, 'wokwi-resistor', 'wokwi-potentiometer', 'wokwi-slide-potentiometer')) {
            return;
        }

        const pins = getComponentPins(component).map(pin => pin.id);
        if (pins.length < 2) return;

        const nodeA = `${component.id}.${pins[0]}`;
        const nodeB = `${component.id}.${pins[1]}`;
        if (!hasConnection(validator, nodeA) || !hasConnection(validator, nodeB)) return;

        const vA = validator.calculateVoltageAtNode(nodeA);
        const vB = validator.calculateVoltageAtNode(nodeB);
        const vDrop = Math.abs(vA - vB);

        let resistance = 0;
        if (validator.isType(component, 'wokwi-resistor')) {
            resistance = validator.getComponentAttrNumber(component, 'value', 220);
        } else if (validator.isType(component, 'wokwi-potentiometer', 'wokwi-slide-potentiometer')) {
            resistance = validator.componentSpecs[validator.normalizeType(component.type)].totalResistance;
        }

        if (!Number.isFinite(resistance) || resistance <= 0) return;

        const powerW = (vDrop * vDrop) / resistance;
        const maxPowerW = validator.componentSpecs[validator.normalizeType(component.type)]?.maxPowerW || 0.25;

        if (powerW > maxPowerW) {
            validator.addError(
                `🔥 [${component.id}] Power dissipation ${powerW.toFixed(2)}W exceeds ${maxPowerW.toFixed(2)}W rating.`
            );
        }
    });
}

export function validateReversePolarity(validator) {
    console.log('🔍 Checking polarized component orientation...');

    validator.components
        .filter(component => validator.isType(component, 'wokwi-led'))
        .forEach(led => {
            const anodeNode = `${led.id}.A`;
            const cathodeNode = `${led.id}.K`;
            if (!hasConnection(validator, anodeNode) || !hasConnection(validator, cathodeNode)) return;

            const anodeV = validator.calculateVoltageAtNode(anodeNode);
            const cathodeV = validator.calculateVoltageAtNode(cathodeNode);
            if (cathodeV <= anodeV) return;

            const reverseV = cathodeV - anodeV;
            const vBreak = validator.componentSpecs['wokwi-led'].reverseBreakdownVoltage;

            if (reverseV >= vBreak) {
                validator.addError(
                    `🔥 [LED ${led.id}] Reverse breakdown: ${reverseV.toFixed(2)}V exceeds ${vBreak.toFixed(2)}V.`
                );
            } else {
                validator.addError(
                    `⚠️ [LED ${led.id}] Reverse polarity detected (${reverseV.toFixed(2)}V). LED will not light and may degrade.`
                );
            }
        });
}

export function validateFloatingPins(validator) {
    console.log('🔍 Checking floating MCU digital inputs...');

    validator.components
        .filter(component => validator.isType(component, ...MCU_TYPES))
        .forEach(mcu => {
            const digitalPins = getMcuDigitalPins(mcu);

            digitalPins.forEach(pinId => {
                const startNode = `${mcu.id}.${pinId}`;
                const neighbors = validator.getNeighbors(startNode);
                if (!neighbors.length) return;

                let hasStablePath = false;
                let hasSwitchOnlyPath = false;
                const queue = [[startNode, false, new Set([startNode])]];

                while (queue.length > 0) {
                    const [currentNode, throughSwitch, visited] = queue.shift();

                    if (validator.isSupplyNode(currentNode) || validator.isGroundNode(currentNode)) {
                        if (throughSwitch) hasSwitchOnlyPath = true;
                        else hasStablePath = true;
                    }

                    const currentComp = validator.getComponent(currentNode);
                    if (currentComp && validator.isType(currentComp, 'wokwi-pushbutton')) {
                        continue;
                    }

                    const currentPin = getPinLower(currentNode);
                    if (currentPin === 'sig') {
                        continue;
                    }

                    const nextNodes = validator.getNeighbors(currentNode);
                    for (const nextNode of nextNodes) {
                        if (visited.has(nextNode)) continue;

                        const nextVisited = new Set(visited);
                        nextVisited.add(nextNode);
                        const nextComp = validator.getComponent(nextNode);
                        const nextThroughSwitch = throughSwitch || validator.isType(nextComp, 'wokwi-pushbutton');

                        queue.push([nextNode, nextThroughSwitch, nextVisited]);
                    }
                }

                if (!hasStablePath && hasSwitchOnlyPath) {
                    validator.addError(
                        `👻 [MCU ${mcu.id}] Floating input on D${pinId}: only path to rail is through a pushbutton. Add pull-up or pull-down resistor.`
                    );
                }
            });
        });
}

export function validateLogicLevels(validator) {
    console.log('🔍 Checking digital logic-level compatibility...');

    validator.connections.forEach(connection => {
        const fromComp = validator.getComponent(connection.from);
        const toComp = validator.getComponent(connection.to);
        if (!fromComp || !toComp) return;

        const fromV = getComponentLogicVoltage(validator, fromComp);
        const toV = getComponentLogicVoltage(validator, toComp);
        if (!Number.isFinite(fromV) || !Number.isFinite(toV)) return;

        const fromPinType = getNodeType(fromComp, getPinId(connection.from));
        const toPinType = getNodeType(toComp, getPinId(connection.to));
        const isDataPath = ['digital', 'analog', 'input', 'output'].includes(String(fromPinType))
            || ['digital', 'analog', 'input', 'output'].includes(String(toPinType));

        if (!isDataPath) return;

        if (fromV > toV + 0.6 && toV <= 3.3) {
            validator.addError(
                `🔥 Logic mismatch: ${fromComp.id} (${fromV.toFixed(1)}V logic) drives ${toComp.id} (${toV.toFixed(1)}V logic). Add level shifting.`
            );
        }
    });
}

export function validateI2CPullups(validator) {
    console.log('🔍 Checking I2C pull-up requirements...');

    validator.components
        .filter(component => validator.isType(component, ...MCU_TYPES))
        .forEach(mcu => {
            const sdaNode = `${mcu.id}.A4`;
            const sclNode = `${mcu.id}.A5`;

            if (!hasConnection(validator, sdaNode) || !hasConnection(validator, sclNode)) return;
            if (!hasI2CDeviceConnected(validator, mcu)) return;

            if (!hasResistivePathToSupply(validator, sdaNode)) {
                validator.addError(`⚠️ [I2C ${mcu.id}] SDA is missing a pull-up resistor to VCC.`);
            }

            if (!hasResistivePathToSupply(validator, sclNode)) {
                validator.addError(`⚠️ [I2C ${mcu.id}] SCL is missing a pull-up resistor to VCC.`);
            }
        });
}
