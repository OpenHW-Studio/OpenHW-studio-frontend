import * as allRules from './rules/index.js';
import * as emulatorComponents from '../components/index.js'; // Note typescript files will compile or be bundled

export class FullCircuitValidator {
    constructor(projectData) {
        this.components = projectData.components || [];
        this.connections = projectData.connections || [];
        this.graph = this.buildGraph(this.connections);
        this.errors = [];
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

    // Mock calculation: In a full engine, this runs Modified Nodal Analysis (MNA)
    calculateVoltageAtNode(nodeId) { return 5.0; }

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

                    if (comp && comp.type === "resistor") {
                        addedResistance = comp.value || 0;
                        const nextNode = neighbor.endsWith("pin1") ? `${comp.id}.pin2` : `${comp.id}.pin1`;
                        queue.push([nextNode, newVisited, currentRes + addedResistance]);
                        continue;
                    }

                    else if (comp && comp.type === "potentiometer") {
                        addedResistance = 0;
                        const nextNode = neighbor.endsWith("pin1") ? `${comp.id}.pin2` : `${comp.id}.pin1`;
                        queue.push([nextNode, newVisited, currentRes + addedResistance]);
                        continue;
                    }

                    queue.push([neighbor, newVisited, currentRes]);
                }
            }
        }

        return foundPowerSource ? totalResistance : 0;
    }

    runValidation() {
        this.errors = [];

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
                            if (err) this.errors.push(err);
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
