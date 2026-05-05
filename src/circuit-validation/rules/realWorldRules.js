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

            let va = validator.calculateVoltageAtNode(anode);
            let vk = validator.calculateVoltageAtNode(cathode);
            const ledSpec = validator.componentSpecs['wokwi-led'];

            // Handle Active-Low logic and worst-case states for digital pins:
            // We trace paths to find if any digital pins are reachable.
            const cathodeSources = validator.collectVoltageSources(cathode);
            const anodeSources = validator.collectVoltageSources(anode);
            
            const hasDigitalSink = cathodeSources.some(s => validator.isDigitalPin(s.nodeId));
            const hasDigitalSource = anodeSources.some(s => validator.isDigitalPin(s.nodeId));

            if (hasDigitalSink && vk >= 4.5) {
                vk = 0.0; // Assume pin can sink to GND
            }
            if (hasDigitalSource && va <= 0.5) {
                va = 5.0; // Assume pin can source from VCC
            }

            if (va > vk) {
                const driveVoltage = va - vk - ledSpec.forwardVoltage;
                if (driveVoltage <= 0) return;

                // Sum resistance from both sides.
                // We look for the resistance to a valid source/sink.
                const rAnode = validator.findSeriesResistance(anode, s => s.voltage > 0 || validator.isDigitalPin(s.nodeId));
                const rCathode = validator.findSeriesResistance(cathode, s => s.voltage === 0 || validator.isDigitalPin(s.nodeId));
                
                // If either side is truly open-circuit, skip current calculation (handled by other rules)
                if (rAnode === Infinity || rCathode === Infinity) return;

                const seriesResistance = rAnode + rCathode;
                
                if (seriesResistance <= 0) {
                    validator.addError(
                        `🔥 [LED ${component.id}] No series resistance detected. LED will burn out. Fix: Add a 220 ohm resistor in series.`
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

            let va = validator.calculateVoltageAtNode(anodeNode);
            let vk = validator.calculateVoltageAtNode(cathodeNode);

            // Predictive check: If pins are connected to digital GPIOs, assume worst-case polarity.
            const anodeSources = validator.collectVoltageSources(anodeNode);
            const cathodeSources = validator.collectVoltageSources(cathodeNode);
            
            const canAnodeGoLow = anodeSources.some(s => validator.isDigitalPin(s.nodeId));
            const canCathodeGoHigh = cathodeSources.some(s => validator.isDigitalPin(s.nodeId));

            if (canAnodeGoLow && va >= 4.5) va = 0.0;
            if (canCathodeGoHigh && vk <= 0.5) vk = 5.0;

            if (vk <= va) return;

            const reverseV = vk - va;
            const ledSpec = validator.componentSpecs['wokwi-led'];
            const vBreak = ledSpec.reverseBreakdownVoltage;

            if (reverseV >= vBreak) {
                validator.addError(
                    `🔥 [LED ${led.id}] Reverse breakdown: ${reverseV.toFixed(2)}V exceeds ${vBreak.toFixed(2)}V. LED will be destroyed.`
                );
            } else {
                validator.addError(
                    `🔥 [LED ${led.id}] Reverse polarity detected. LED is connected backwards and will not light. Flip the LED or check your wiring.`
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
                validator.addError(`⚠️ [I2C ${mcu.id}] SDA missing pull-up. Fix: Add 4.7k I2C pull-up resistors.`);
            }

            if (!hasResistivePathToSupply(validator, sclNode)) {
                validator.addError(`⚠️ [I2C ${mcu.id}] SCL missing pull-up. Fix: Add 4.7k I2C pull-up resistors.`);
            }
        });
}export function validateSerialPinConflict(validator) {
    console.log('🔍 Checking Serial pin (D0/D1) conflicts...');
    validator.components
        .filter(comp => validator.isType(comp, 'wokwi-arduino-uno'))
        .forEach(uno => {
            ['0', '1'].forEach(pin => {
                const node = `${uno.id}.${pin}`;
                const neighbors = validator.getNeighbors(node);
                if (neighbors.length > 0) {
                    validator.addError(`⚠️ [Arduino ${uno.id}] Pin D${pin} is connected. This may conflict with Serial USB communication/upload.`);
                }
            });
        });
}

export function validateI2CDeviceWithoutMcu(validator) {
    console.log('🔍 Checking for I2C devices without MCU...');
    const hasMcu = validator.components.some(comp => validator.isType(comp, ...MCU_TYPES));
    if (hasMcu) return;

    validator.components.forEach(comp => {
        if (validator.isType(comp, ...I2C_DEVICE_TYPES)) {
            validator.addError(`⚠️ [I2C ${comp.id}] Device detected but no MCU found on canvas to control it. Fix: Add an Arduino/Pico and connect its I2C pins (A4/A5 or GP4/5).`);
        }
    });
}

export function validateLedFloatingPins(validator) {
    console.log('🔍 Checking for floating LED pins...');
    validator.components
        .filter(comp => validator.isType(comp, 'wokwi-led'))
        .forEach(led => {
            const anode = `${led.id}.A`;
            const cathode = `${led.id}.K`;
            const aConn = hasConnection(validator, anode);
            const kConn = hasConnection(validator, cathode);

            if (!aConn && !kConn) {
                validator.addError(`⚠️ [LED ${led.id}] Component is unconnected.`);
            } else if (!aConn) {
                validator.addError(`🔥 [LED ${led.id}] Anode (A) is floating. Fix: Connect to power or digital pin.`);
            } else if (!kConn) {
                validator.addError(`🔥 [LED ${led.id}] Cathode (K) is floating. Fix: Connect to GND.`);
            }
        });
}

export function validateRp2040VoltageInputs(validator) {
    console.log('🔍 Checking RP2040 3.3V logic limits...');
    const PICO_TYPES = ['wokwi-raspberry-pi-pico', 'wokwi-raspberry-pi-pico-w'];
    
    validator.components
        .filter(comp => validator.isType(comp, ...PICO_TYPES))
        .forEach(pico => {
            // Check all pins connected to this pico
            const pins = getComponentPins(pico);
            pins.forEach(pin => {
                const node = `${pico.id}.${pin.id}`;
                if (!hasConnection(validator, node)) return;

                const v = validator.calculateVoltageAtNode(node);
                if (v > 3.6) {
                    validator.addError(`🔥 [Pico ${pico.id}] Over-voltage on ${pin.id}: ${v.toFixed(1)}V exceeds 3.3V logic limit! Fix: Use a voltage divider.`);
                }
            });
        });
}

export function validateBuzzerResistor(validator) {
    console.log('🔍 Checking buzzer series resistance...');
    validator.components
        .filter(comp => validator.isType(comp, 'wokwi-buzzer'))
        .forEach(buzzer => {
            const pin1 = `${buzzer.id}.1` || `${buzzer.id}.p1`; // depends on manifest
            // In Wokwi buzzer is usually 2 terminals, pin 1 and 2 or + and -
            // Let's assume typical pins from manifest if available or fallback
            const pins = getComponentPins(buzzer).map(p => p.id);
            if (pins.length < 2) return;

            const node1 = `${buzzer.id}.${pins[0]}`;
            if (!hasConnection(validator, node1)) return;

            const res = validator.findSeriesResistance(node1);
            if (res === 0) {
                validator.addError(`⚠️ [Buzzer ${buzzer.id}] No series resistance. GPIO might overload. Fix: Add a 220 ohm resistor.`);
            }
        });
}

export function validateDuplicateI2CAddress(validator) {
    console.log('🔍 Checking for duplicate I2C addresses...');
    const addressMap = new Map();

    validator.components
        .filter(comp => validator.isType(comp, ...I2C_DEVICE_TYPES))
        .forEach(comp => {
            // This is a simplified check assuming types have default addresses
            // A real check would look at 'address' attribute if supported
            const addr = comp.attrs?.i2cAddress || comp.type; 
            if (addressMap.has(addr)) {
                validator.addError(`⚠️ [I2C] Potential address conflict between ${comp.id} and ${addressMap.get(addr)}. Fix: Change I2C address attribute.`);
            } else {
                addressMap.set(addr, comp.id);
            }
        });
}

export function validatePotentiometer(validator) {
    console.log('🔍 Checking potentiometer wiring safety...');
    validator.components
        .filter(comp => validator.isType(comp, 'wokwi-potentiometer', 'wokwi-slide-potentiometer'))
        .forEach(pot => {
            const pins = (pot.pins || []).map(p => p.id);
            // Typically 1, 2 (wiper), 3
            const vccNode = `${pot.id}.${pins[0]}`;
            const wiperNode = `${pot.id}.${pins[1]}`;
            const gndNode = `${pot.id}.${pins[2]}`;

            if (validator.getNeighbors(vccNode).length > 0 && 
                validator.getNeighbors(gndNode).length > 0 && 
                validator.getNeighbors(wiperNode).length === 0) {
                validator.addError(`⚠️ [Pot ${pot.id}] Power and GND are connected, but the Wiper (output) is floating.`);
            }
        });
}

export function validateDiodePolarity(validator) {
    console.log('🔍 Checking diode orientation...');
    validator.components
        .filter(comp => validator.isType(comp, 'wokwi-diode'))
        .forEach(diode => {
            const anode = `${diode.id}.A`;
            const cathode = `${diode.id}.K`;
            
            const vA = validator.calculateVoltageAtNode(anode);
            const vK = validator.calculateVoltageAtNode(cathode);

            if (vK > vA + 0.1 && validator.getNeighbors(anode).length > 0 && validator.getNeighbors(cathode).length > 0) {
                validator.addError(`⚠️ [Diode ${diode.id}] Reverse bias detected. Current will be blocked. Fix: Flip component polarity.`);
            }
        });
}

export function validateTotalPowerBudget(validator) {
    console.log('🔍 Checking total system power budget...');
    const MCU_REGULATOR_LIMIT = 0.5; // 500mA typical USB limit
    let totalCurrent = 0.05; // 50mA baseline for MCU itself

    validator.components.forEach(comp => {
        // Estimate current for common components
        if (validator.isType(comp, 'wokwi-led')) totalCurrent += 0.02; // 20mA per LED
        if (validator.isType(comp, 'wokwi-motor', 'wokwi-stepper-motor', 'wokwi-servo')) totalCurrent += 0.15; // ~150mA for a small motor
        if (validator.isType(comp, 'wokwi-lcd1602-i2c', 'wokwi-lcd2004-i2c', 'wokwi-ssd1306-oled')) totalCurrent += 0.04; // 40mA
        if (validator.isType(comp, 'wokwi-neopixel', 'wokwi-neopixel-matrix', 'wokwi-neopixel-ring')) {
            const count = comp.attrs?.pixels || 16;
            totalCurrent += (count * 0.02); // 20mA per pixel
        }
        if (validator.isType(comp, 'wokwi-buzzer')) totalCurrent += 0.03; // 30mA
    });

    if (totalCurrent > MCU_REGULATOR_LIMIT) {
        validator.addError(`⚠️ Power Budget Warning: Total estimated current is ${(totalCurrent * 1000).toFixed(0)}mA. This exceeds the standard 500mA regulator limit. Consider an external power supply.`);
    }
}
export function validateThermalLimits(validator) {
    console.log('🔍 Checking thermal limits...');
    const stats = validator.calculatePowerStats();
    Object.entries(stats.thermal).forEach(([compId, data]) => {
        if (data.estimatedTemp > 75) {
            validator.addError(`⚠️ [${compId}] Thermal Warning: Component is dissipating ${data.power.toFixed(2)}W. Estimated temp: ${data.estimatedTemp.toFixed(1)}°C. Consider a heatsink.`);
        }
    });
}

export function validateBatteryLife(validator) {
    console.log('🔍 Estimating battery life...');
    const stats = validator.calculatePowerStats();
    const battery = validator.components.find(c => validator.isType(c, 'wokwi-battery'));
    
    if (battery) {
        const capacity = parseFloat(battery.attrs?.capacityMah || '2000');
        const drawMa = stats.totalCurrent * 1000;
        const hours = capacity / drawMa;
        
        if (hours < 1) {
            validator.addError(`⚠️ [Battery] High drain detected. Estimated runtime: ${Math.round(hours * 60)} minutes.`, 'warn');
        } else {
            validator.addError(`💡 [Battery] Estimated runtime: ${hours.toFixed(1)} hours.`, 'warn');
        }
    }
}

export function validateVoltageDrops(validator) {
    console.log('🔍 Checking wire voltage drops...');
    const stats = validator.calculatePowerStats();
    if (stats.totalCurrent > 0.4) {
        const drop = validator.calculateVoltageDrop(stats.totalCurrent);
        if (drop > 0.05) {
            validator.addError(`⚠️ [System] High current draw causing ${drop.toFixed(2)}V drop on main rails. Expect minor signal instability.`);
        }
    }
}

export function validateDeadlocks(validator) {
    // Basic software deadlock check (simulated based on code analysis)
    // This looks for blocking calls without interrupts
    const mcus = validator.components.filter(c => validator.isType(c, ...MCU_TYPES));
    mcus.forEach(mcu => {
        const code = validator.code || '';
        if (code.includes('while(1)') && !code.includes('interrupt') && !code.includes('millis()')) {
            validator.addError(`⚠️ [${mcu.id}] Potential Deadlock: Code contains a tight while(1) loop without non-blocking timing. Board might become unresponsive.`);
        }
    });
}

export function validateSignalIntegrity(validator) {
    console.log('🔍 Analyzing signal integrity...');
    // Check for high-speed signals crossing power lines or missing bypass caps
    const hasMotor = validator.components.some(c => validator.isType(c, 'wokwi-motor', 'wokwi-servo'));
    const hasDigitalDisplay = validator.components.some(c => validator.isType(c, 'wokwi-lcd1602-i2c', 'wokwi-oled'));
    
    if (hasMotor && hasDigitalDisplay) {
        validator.addError(`💡 [Signal] EMI Risk: Motors and digital displays detected. Ensure you use decoupling capacitors (0.1uF) to avoid I2C noise.`, 'warn');
    }
}

export function validateRailConflicts(validator) {
    console.log('🔍 Checking for mixed rail conflicts...');

    const supplyNodes = [];
    validator.components.forEach(component => {
        const pins = getComponentPins(component);
        pins.forEach(pin => {
            const node = `${component.id}.${pin.id}`;
            const directVoltage = validator.getNodeDirectVoltage(node);
            if (Number.isFinite(directVoltage) && directVoltage > 0) {
                supplyNodes.push({ node, voltage: directVoltage });
            }
        });
    });

    for (let i = 0; i < supplyNodes.length; i += 1) {
        for (let j = i + 1; j < supplyNodes.length; j += 1) {
            const left = supplyNodes[i];
            const right = supplyNodes[j];
            const delta = Math.abs(left.voltage - right.voltage);
            if (delta < 0.8) continue;

            const resistance = validator.findResistanceBetween(left.node, right.node);
            if (!Number.isFinite(resistance)) continue;

            if (resistance <= 1) {
                validator.addError({
                    ruleId: 'validateRailConflicts',
                    severity: 'error',
                    message: `Mixed-rail hard tie detected between ${left.node} (${left.voltage.toFixed(1)}V) and ${right.node} (${right.voltage.toFixed(1)}V).`,
                    compIds: [validator.getComponentIdFromNode(left.node), validator.getComponentIdFromNode(right.node)].filter(Boolean),
                    remediation: 'Separate 5V/3.3V rails or add proper level shifting/regulation between domains.',
                    confidence: 0.95,
                });
            } else if (resistance < 50) {
                validator.addError({
                    ruleId: 'validateRailConflicts',
                    severity: 'warn',
                    message: `Potential rail conflict path between ${left.node} and ${right.node} (${resistance.toFixed(1)}Ω).`,
                    remediation: 'Inspect resistor network to ensure rails are intentionally isolated.',
                    confidence: 0.75,
                });
            }
        }
    }
}

export function validateCrossComponentInteractions(validator) {
    console.log('🔍 Checking cross-component interaction risks...');

    const highSurgeTypes = ['wokwi-motor', 'wokwi-servo', 'wokwi-stepper-motor'];
    const sensitiveTypes = ['wokwi-ssd1306-oled', 'wokwi-lcd1602-i2c', 'wokwi-lcd2004-i2c', 'max30102'];

    const surgeComponents = validator.components.filter(component => validator.isType(component, ...highSurgeTypes));
    const sensitiveComponents = validator.components.filter(component => validator.isType(component, ...sensitiveTypes));

    if (!surgeComponents.length || !sensitiveComponents.length) return;

    const hasSharedSupplyPath = surgeComponents.some(surge => {
        const surgePins = getComponentPins(surge);
        return surgePins.some(pin => {
            const surgeNode = `${surge.id}.${pin.id}`;
            return sensitiveComponents.some(sensitive => {
                const sensitivePins = getComponentPins(sensitive);
                return sensitivePins.some(sensitivePin => {
                    const sensitiveNode = `${sensitive.id}.${sensitivePin.id}`;
                    const resistance = validator.findResistanceBetween(surgeNode, sensitiveNode);
                    return Number.isFinite(resistance) && resistance <= 5;
                });
            });
        });
    });

    if (hasSharedSupplyPath) {
        validator.addError({
            ruleId: 'validateCrossComponentInteractions',
            severity: 'warn',
            message: 'High-surge loads and sensitive peripherals appear to share a low-impedance rail path.',
            compIds: [...surgeComponents.map(component => component.id), ...sensitiveComponents.map(component => component.id)],
            remediation: 'Isolate sensitive devices with dedicated decoupling and separate high-current return paths.',
            autoFix: false,
            confidence: 0.8,
        });
    }
}
