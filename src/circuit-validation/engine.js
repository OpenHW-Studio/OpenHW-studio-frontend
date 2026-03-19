import * as allRules from './rules/index.js';
import * as emulatorComponents from '../components/index.js'; // Note typescript files will compile or be bundled

export class FullCircuitValidator {
    constructor(projectData) {
        this.components = projectData.components || [];
        this.connections = projectData.connections || [];
        this.graph = this.buildGraph(this.connections);
        this.errors = [];
        this.errorSet = new Set();

        this.mcuSpecs = {
            vinMin: 7,
            vinMax: 12,
            gpioPinMaxCurrentA: 0.04,
            gpioPackageMaxCurrentA: 0.2,
        };

        this.componentSpecs = {
            'wokwi-resistor': { maxPowerW: 0.25 },
            'wokwi-potentiometer': { maxPowerW: 0.25, totalResistance: 10000 },
            'wokwi-slide-potentiometer': { maxPowerW: 0.25, totalResistance: 10000 },
            'wokwi-led': { forwardVoltage: 2.0, maxCurrentA: 0.02, reverseBreakdownVoltage: 5.0 },
            'wokwi-buzzer': { typicalCurrentA: 0.03 },
            'wokwi-motor': { typicalCurrentA: 0.25 },
            'wokwi-servo': { typicalCurrentA: 0.5 },
        };
    }

    // --- CORE GRAPH UTILITIES ---
    buildGraph(connections) {
        const graph = new Map();
        const addEdge = (nodeA, nodeB) => {
            if (!graph.has(nodeA)) graph.set(nodeA, []);
            if (!graph.has(nodeB)) graph.set(nodeB, []);
            graph.get(nodeA).push(nodeB);
            graph.get(nodeB).push(nodeA);
        };
        connections.forEach(conn => addEdge(conn.from, conn.to));
        return graph;
    }

    getComponent(nodeId) {
        const [compId] = nodeId.split(".");
        return this.components.find(c => c.id === compId);
    }

    getComponentById(componentId) {
        return this.components.find(c => c.id === componentId);
    }

    getNeighbors(nodeId) {
        return this.graph.get(nodeId) || [];
    }

    normalizeType(type) {
        return String(type || '').toLowerCase().trim();
    }

    isType(component, ...types) {
        if (!component) return false;
        const normalized = this.normalizeType(component.type);
        return types.map(t => this.normalizeType(t)).includes(normalized);
    }

    addError(message) {
        if (!this.errorSet.has(message)) {
            this.errorSet.add(message);
            this.errors.push(message);
        }
    }

    getNodeParts(nodeId) {
        const [componentId, pinId] = String(nodeId || '').split('.');
        return { componentId, pinId };
    }

    getPinNumericVoltageLabel(pinId) {
        const normalized = String(pinId || '').toLowerCase();
        if (normalized === '5v') return 5.0;
        if (normalized === '3v3' || normalized === '3.3v') return 3.3;
        if (normalized === '12v') return 12.0;
        return null;
    }

    isGroundNode(nodeId) {
        const { pinId } = this.getNodeParts(nodeId);
        const normalized = String(pinId || '').toLowerCase();
        return normalized === 'gnd' || normalized.startsWith('gnd_');
    }

    isSupplyNode(nodeId) {
        const { pinId } = this.getNodeParts(nodeId);
        const normalized = String(pinId || '').toLowerCase();
        return ['5v', '3v3', '3.3v', 'vcc', 'vin', '12v'].includes(normalized);
    }

    getComponentAttrNumber(component, attrName, fallbackValue = 0) {
        const raw = component?.attrs?.[attrName] ?? component?.[attrName];
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : fallbackValue;
    }

    getTwoTerminalPins(component) {
        const pins = component?.pins || component?.manifest?.pins || [];
        return pins.map(p => p.id);
    }

    getOtherTerminalNode(component, nodeId) {
        const { pinId } = this.getNodeParts(nodeId);
        const pinCandidates = this.getTwoTerminalPins(component);

        if (!pinCandidates.length) {
            return null;
        }

        const explicitPairs = [
            ['p1', 'p2'],
            ['pin1', 'pin2'],
            ['1', '2'],
            ['A', 'K'],
            ['GND', 'VCC'],
            ['GND', 'V+'],
        ];

        for (const [a, b] of explicitPairs) {
            if (pinCandidates.includes(a) && pinCandidates.includes(b)) {
                if (pinId === a) return `${component.id}.${b}`;
                if (pinId === b) return `${component.id}.${a}`;
            }
        }

        if (pinCandidates.length === 2) {
            const [a, b] = pinCandidates;
            if (pinId === a) return `${component.id}.${b}`;
            if (pinId === b) return `${component.id}.${a}`;
        }

        return null;
    }

    getNodeDirectVoltage(nodeId) {
        const { componentId, pinId } = this.getNodeParts(nodeId);
        const component = this.getComponentById(componentId);
        const normalizedPin = String(pinId || '').toLowerCase();

        if (this.isGroundNode(nodeId)) return 0.0;

        const pinVoltage = this.getPinNumericVoltageLabel(pinId);
        if (pinVoltage !== null) return pinVoltage;

        if (this.isType(component, 'wokwi-power-supply')) {
            const configured = this.getComponentAttrNumber(component, 'voltage', 5.0);
            if (normalizedPin === '5v' || normalizedPin === 'vcc') return configured;
            if (normalizedPin === 'gnd') return 0.0;
        }

        return null;
    }

    // Heuristic voltage lookup by traversing nearby rails/sources.
    calculateVoltageAtNode(nodeId) {
        const queue = [nodeId];
        const visited = new Set([nodeId]);
        const seenVoltages = [];

        while (queue.length > 0) {
            const currentNode = queue.shift();
            const directVoltage = this.getNodeDirectVoltage(currentNode);

            if (directVoltage !== null) {
                seenVoltages.push(directVoltage);
            }

            const neighbors = this.getNeighbors(currentNode);
            for (const neighbor of neighbors) {
                if (visited.has(neighbor)) continue;
                visited.add(neighbor);
                queue.push(neighbor);
            }
        }

        if (seenVoltages.length === 0) return 0.0;
        return Math.max(...seenVoltages);
    }

    // --- CORE HELPER: Calculate Series Resistance ---
    findSeriesResistance(startNode) {
        let totalResistance = 0;
        let foundPowerSource = false;

        // BFS Queue to trace back to a power source
        const queue = [[startNode, new Set([startNode]), 0]];

        while (queue.length > 0) {
            const [currentNode, visited, currentRes] = queue.shift();

            if (currentNode.endsWith(".5V") || currentNode.endsWith(".3v3") || currentNode.endsWith(".vcc")) {
                totalResistance = currentRes;
                foundPowerSource = true;
                break;
            }

            const neighbors = this.graph.get(currentNode) || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    const newVisited = new Set(visited);
                    newVisited.add(neighbor);

                    const comp = this.getComponent(neighbor);
                    let addedResistance = 0;

                    if (this.isType(comp, 'resistor', 'wokwi-resistor')) {
                        addedResistance = this.getComponentAttrNumber(comp, 'value', 0);
                        const nextNode = this.getOtherTerminalNode(comp, neighbor);
                        if (nextNode) {
                            queue.push([nextNode, newVisited, currentRes + addedResistance]);
                            continue;
                        }
                    }

                    else if (this.isType(comp, 'potentiometer', 'wokwi-potentiometer', 'wokwi-slide-potentiometer', 'switch', 'wokwi-pushbutton')) {
                        addedResistance = 0;
                        const nextNode = this.getOtherTerminalNode(comp, neighbor);
                        if (nextNode) {
                            queue.push([nextNode, newVisited, currentRes + addedResistance]);
                            continue;
                        }
                    }

                    queue.push([neighbor, newVisited, currentRes]);
                }
            }
        }

        return foundPowerSource ? totalResistance : 0;
    }

    runValidation() {
        this.errors = [];
        this.errorSet = new Set();

        // Run all registered rules dynamically
        Object.values(allRules).forEach(ruleFunc => {
            if (typeof ruleFunc === 'function') {
                ruleFunc(this);
            }
        });

        // Run component-level custom validations dynamically
        this.components.forEach(comp => {
            Object.values(emulatorComponents).forEach(EmulatorComp => {
                if (EmulatorComp && EmulatorComp.manifest && EmulatorComp.manifest.type === comp.type) {
                    if (EmulatorComp.validation && EmulatorComp.validation.rules) {
                        EmulatorComp.validation.rules.forEach(rule => {
                            const err = rule.check(comp, this.graph, this);
                            if (err) this.addError(err);
                        });
                    }
                }
            });
        });

        if (this.errors.length === 0) {
            console.log("\n✅ ALL CHECKS PASSED: Circuit is safe for code execution.");
            return true;
        } else {
            console.log("\n🛑 VALIDATION FAILED:");
            this.errors.forEach(err => console.log(err));
            return false; // Tells the UI to halt execution and show errors to the student
        }
    }
}
