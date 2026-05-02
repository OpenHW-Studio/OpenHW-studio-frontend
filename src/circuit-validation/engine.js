import * as allRules from './rules/index.js';
import * as emulatorComponents from '../components/index.js'; // Note typescript files will compile or be bundled
import { inferValidationRemediation } from '../components/component-schema.js';

export class FullCircuitValidator {
    constructor(projectData = {}) {
        this.components = Array.isArray(projectData.components) ? projectData.components : [];
        this.connections = Array.isArray(projectData.connections) ? projectData.connections : [];
        this.graph = this.buildGraph(this.connections);
        this.resetValidationState();
        this.lastRunMeta = {
            profile: 'balanced',
            stoppedEarly: false,
            fromCache: false,
            fingerprint: null,
            executedRules: [],
            skippedRules: [],
            ignoredErrors: [],
            rootCauseGroups: [],
            recommendedFixes: [],
            dirtyComponentIds: [],
        };

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

    resetValidationState() {
        this.errors = [];
        this.errorSet = new Set();

        Object.defineProperty(this.errors, 'push', {
            value: (...entries) => {
                entries.forEach(entry => this.addError(entry));
                return this.errors.length;
            },
            writable: true,
            configurable: true,
            enumerable: false,
        });

        if (this.lastRunMeta) {
            this.lastRunMeta.stoppedEarly = false;
            this.lastRunMeta.fromCache = false;
            this.lastRunMeta.executedRules = [];
            this.lastRunMeta.skippedRules = [];
            this.lastRunMeta.ignoredErrors = [];
            this.lastRunMeta.rootCauseGroups = [];
            this.lastRunMeta.recommendedFixes = [];
            this.lastRunMeta.dirtyComponentIds = [];
        }
    }

    getValidationProfiles() {
        return {
            strict: {
                includeExpensive: true,
                minimumSeverity: 'info',
            },
            balanced: {
                includeExpensive: true,
                minimumSeverity: 'warn',
            },
            'fast-run': {
                includeExpensive: false,
                minimumSeverity: 'error',
            },
            'beginner-safety': {
                includeExpensive: false,
                minimumSeverity: 'warn',
            },
            'production-reliability': {
                includeExpensive: true,
                minimumSeverity: 'info',
            },
            'low-power-design': {
                includeExpensive: true,
                minimumSeverity: 'warn',
            },
            'educational-lenient': {
                includeExpensive: false,
                minimumSeverity: 'error',
            },
        };
    }

    cloneErrors(errors) {
        if (!Array.isArray(errors)) return [];
        return errors.map(error => ({ ...error }));
    }

    serializeValue(value) {
        if (Array.isArray(value)) {
            return value.map(entry => this.serializeValue(entry));
        }

        if (value && typeof value === 'object') {
            const keys = Object.keys(value).sort();
            const out = {};
            keys.forEach(key => {
                out[key] = this.serializeValue(value[key]);
            });
            return out;
        }

        return value;
    }

    computeCircuitFingerprint() {
        const normalizedComponents = this.components
            .map(component => ({
                id: String(component?.id || ''),
                type: String(component?.type || ''),
                attrs: this.serializeValue(component?.attrs || {}),
                pins: Array.isArray(component?.pins)
                    ? component.pins.map(pin => String(pin?.id || '')).sort()
                    : [],
            }))
            .sort((left, right) => `${left.id}|${left.type}`.localeCompare(`${right.id}|${right.type}`));

        const normalizedConnections = this.connections
            .map(connection => ({
                from: String(connection?.from || ''),
                to: String(connection?.to || ''),
            }))
            .sort((left, right) => `${left.from}|${left.to}`.localeCompare(`${right.from}|${right.to}`));

        return JSON.stringify({ components: normalizedComponents, connections: normalizedConnections });
    }

    decodeFingerprint(fingerprint) {
        try {
            const parsed = JSON.parse(String(fingerprint || '{}'));
            const components = Array.isArray(parsed.components) ? parsed.components : [];
            const connections = Array.isArray(parsed.connections) ? parsed.connections : [];
            return { components, connections };
        } catch {
            return { components: [], connections: [] };
        }
    }

    getComponentIdFromNode(nodeId) {
        return String(nodeId || '').split('.')[0] || '';
    }

    getDirtyComponentIds(previousFingerprint, nextFingerprint) {
        const previous = this.decodeFingerprint(previousFingerprint);
        const next = this.decodeFingerprint(nextFingerprint);
        const dirty = new Set();

        const prevComponents = new Map(previous.components.map(component => [component.id, JSON.stringify(component)]));
        const nextComponents = new Map(next.components.map(component => [component.id, JSON.stringify(component)]));

        for (const [id, payload] of nextComponents.entries()) {
            if (!prevComponents.has(id) || prevComponents.get(id) !== payload) dirty.add(id);
        }
        for (const id of prevComponents.keys()) {
            if (!nextComponents.has(id)) dirty.add(id);
        }

        const prevConnectionSet = new Set(previous.connections.map(connection => `${connection.from}|${connection.to}`));
        const nextConnectionSet = new Set(next.connections.map(connection => `${connection.from}|${connection.to}`));
        const changedConnections = new Set();

        for (const key of nextConnectionSet) {
            if (!prevConnectionSet.has(key)) changedConnections.add(key);
        }
        for (const key of prevConnectionSet) {
            if (!nextConnectionSet.has(key)) changedConnections.add(key);
        }

        for (const connectionKey of changedConnections) {
            const [from, to] = String(connectionKey).split('|');
            const fromId = this.getComponentIdFromNode(from);
            const toId = this.getComponentIdFromNode(to);
            if (fromId) dirty.add(fromId);
            if (toId) dirty.add(toId);
        }

        return dirty;
    }

    normalizeSeverity(severity, fallback = 'error') {
        const normalized = String(severity || '').toLowerCase().trim();

        if (['error', 'fatal', 'critical'].includes(normalized)) return 'error';
        if (['warn', 'warning'].includes(normalized)) return 'warn';
        if (['info', 'information', 'notice', 'hint', 'suggestion'].includes(normalized)) return 'info';

        return this.normalizeSeverity(fallback, 'error');
    }

    isSeverityAtLeast(severity, minimumSeverity = 'info') {
        return this.getSeverityRank(severity) <= this.getSeverityRank(minimumSeverity);
    }

    getSeverityRank(severity) {
        const normalized = this.normalizeSeverity(severity);
        const order = {
            error: 0,
            warn: 1,
            info: 2,
        };

        return order[normalized] ?? 3;
    }

    normalizeCompIds(compIds) {
        if (!compIds) return [];
        const ids = Array.isArray(compIds) ? compIds : [compIds];
        return ids
            .map(id => String(id || '').trim())
            .filter(Boolean);
    }

    inferIssueConfidence(entry = {}, severity = 'warn') {
        const provided = Number(entry.confidence);
        if (Number.isFinite(provided)) {
            return Math.max(0, Math.min(1, provided));
        }

        const text = String(entry.message || '').toLowerCase();
        if (text.includes('fatal short') || text.includes('over-voltage') || text.includes('overvoltage')) {
            return 0.95;
        }

        if (severity === 'error') return 0.85;
        if (severity === 'warn') return 0.7;
        return 0.6;
    }

    parseLegacyErrorString(message) {
        const text = String(message || '');
        const fixMatch = text.match(/Fix:\s*(.+)$/);
        const idMatch = text.match(/\[(?:MCU|LED|I2C|Arduino|Pico|Buzzer|NPN|Servo|Keypad|Encoder|Pot|L293D|74xx|Nano|Mega|Diode|Stepper|Ultrasonic|7-Segment|LCD|OLED|Battery|Power|MAX30102|Sensor)\s+([\w-]+)\]/);

        let severity = null;
        if (text.startsWith('🔥')) severity = 'error';
        else if (text.startsWith('⚠️') || text.startsWith('👻')) severity = 'warn';
        else if (text.startsWith('💡')) severity = 'info';

        return {
            message: text.split('Fix:')[0].trim(),
            severity,
            compIds: idMatch ? [idMatch[1]] : [],
            remediation: fixMatch ? fixMatch[1].trim() : null,
        };
    }

    getErrorSignature(error) {
        return JSON.stringify({
            ruleId: error.ruleId || error.id || null,
            severity: error.severity || error.type || null,
            message: error.message || '',
            compIds: error.compIds || [],
            remediation: error.remediation || null,
            componentId: error.componentId || null,
        });
    }

    normalizeErrorInput(entry, defaults = {}) {
        if (entry === null || entry === undefined || entry === false) {
            return null;
        }

        if (typeof entry === 'string') {
            const parsed = this.parseLegacyErrorString(entry);
            const severity = this.normalizeSeverity(parsed.severity || defaults.severity || defaults.type || 'error');
            const compIds = this.normalizeCompIds(parsed.compIds.length ? parsed.compIds : defaults.compIds);
            const inferred = inferValidationRemediation(parsed, null);

            return {
                id: defaults.id || defaults.ruleId || null,
                ruleId: defaults.ruleId || defaults.id || null,
                severity,
                type: severity,
                message: parsed.message,
                compIds,
                remediation: parsed.remediation || inferred.remediation || defaults.remediation || null,
                autoFix: Boolean(defaults.autoFix ?? inferred.autoFixable),
                componentId: defaults.componentId || (compIds.length === 1 ? compIds[0] : null),
                source: defaults.source || null,
                priority: Number.isFinite(Number(defaults.priority)) ? Number(defaults.priority) : null,
                confidence: this.inferIssueConfidence({ ...parsed, ...defaults }, severity),
                details: defaults.details || null,
            };
        }

        if (typeof entry === 'object') {
            const compIds = this.normalizeCompIds(
                entry.compIds || entry.compId || defaults.compIds || defaults.componentId
            );
            const severity = this.normalizeSeverity(
                entry.severity || entry.type || defaults.severity || defaults.type || 'error'
            );
            const message = String(entry.message || entry.text || defaults.message || '').trim();
            const inferred = inferValidationRemediation({ ...entry, message }, null);

            return {
                id: entry.id || defaults.id || defaults.ruleId || null,
                ruleId: entry.ruleId || defaults.ruleId || entry.id || null,
                severity,
                type: severity,
                message,
                compIds,
                remediation: entry.remediation || entry.fix || inferred.remediation || defaults.remediation || null,
                autoFix: Boolean(entry.autoFix || entry.autoFixable || defaults.autoFix || inferred.autoFixable),
                componentId: entry.componentId || defaults.componentId || (compIds.length === 1 ? compIds[0] : null),
                source: entry.source || defaults.source || null,
                priority: Number.isFinite(Number(entry.priority ?? defaults.priority))
                    ? Number(entry.priority ?? defaults.priority)
                    : null,
                confidence: this.inferIssueConfidence({ ...defaults, ...entry, message }, severity),
                details: entry.details || defaults.details || null,
            };
        }

        return null;
    }

    recordError(entry, defaults = {}) {
        const normalized = this.normalizeErrorInput(entry, defaults);
        if (!normalized || !normalized.message) {
            return null;
        }

        const signature = this.getErrorSignature(normalized);
        if (this.errorSet.has(signature)) {
            return normalized;
        }

        this.errorSet.add(signature);
        Array.prototype.push.call(this.errors, normalized);
        return normalized;
    }

    addError(message, type = 'error', compIds = [], remediation = null) {
        return this.recordError(message, {
            severity: type,
            type,
            compIds,
            remediation,
        });
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
        if (!component) return null;

        if (this.isGroundNode(nodeId)) return 0.0;

        const pinVoltage = this.getPinNumericVoltageLabel(pinId);
        if (pinVoltage !== null) return pinVoltage;

        if (this.isType(component, 'wokwi-arduino-uno', 'mcu_uno')) {
            const pin = String(pinId || '').toUpperCase();
            if (/^(D?\d+|A\d+)$/.test(pin)) return 5.0; // Assume logic high for safety check
            if (pin === '5V' || pin === 'VCC') return 5.0;
            if (pin === '3V3') return 3.3;
        }

        if (this.isType(component, 'wokwi-power-supply')) {
            const configured = this.getComponentAttrNumber(component, 'voltage', 5.0);
            const normalizedPin = String(pinId || '').toLowerCase();
            if (normalizedPin === '5v' || normalizedPin === 'vcc') return configured;
            if (normalizedPin === 'gnd') return 0.0;
        }

        return null;
    }

    isResistiveTraversalComponent(component) {
        return this.isType(
            component,
            'wokwi-resistor',
            'resistor',
            'wokwi-potentiometer',
            'wokwi-slide-potentiometer',
            'potentiometer',
            'switch',
            'wokwi-pushbutton'
        );
    }

    getTraversalResistance(component) {
        if (!component) return 0;

        if (this.isType(component, 'wokwi-resistor', 'resistor')) {
            return Math.max(0, this.getComponentAttrNumber(component, 'value', 220));
        }

        if (this.isType(component, 'wokwi-potentiometer', 'wokwi-slide-potentiometer', 'potentiometer')) {
            const normalizedType = this.normalizeType(component.type);
            const specResistance = this.componentSpecs[normalizedType]?.totalResistance || 10000;
            return Math.max(0, this.getComponentAttrNumber(component, 'value', specResistance));
        }

        if (this.isType(component, 'switch', 'wokwi-pushbutton')) {
            return 0;
        }

        return 0;
    }

    collectVoltageSources(startNode) {
        const sources = [];
        const seenSources = new Set();
        const bestResistance = new Map([[startNode, 0]]);
        const queue = [{ nodeId: startNode, resistance: 0 }];
        const epsilon = 1e-9;

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) continue;

            const knownBest = bestResistance.get(current.nodeId);
            if (knownBest !== undefined && current.resistance > knownBest + epsilon) {
                continue;
            }

            const directVoltage = this.getNodeDirectVoltage(current.nodeId);
            if (directVoltage !== null) {
                const signature = `${current.nodeId}|${directVoltage}|${Math.round(current.resistance * 1e6)}`;
                if (!seenSources.has(signature)) {
                    seenSources.add(signature);
                    sources.push({
                        nodeId: current.nodeId,
                        voltage: directVoltage,
                        resistance: current.resistance,
                    });
                }
            }

            const neighbors = this.getNeighbors(current.nodeId);
            for (const neighbor of neighbors) {
                const nextNode = neighbor;
                const nextResistance = current.resistance;
                const previousResistance = bestResistance.get(nextNode);

                if (previousResistance === undefined || nextResistance + epsilon < previousResistance) {
                    bestResistance.set(nextNode, nextResistance);
                    queue.push({ nodeId: nextNode, resistance: nextResistance });
                }

                const neighborComponent = this.getComponent(neighbor);
                if (!this.isResistiveTraversalComponent(neighborComponent)) {
                    continue;
                }

                const otherTerminalNode = this.getOtherTerminalNode(neighborComponent, neighbor);
                if (!otherTerminalNode) {
                    continue;
                }

                const addedResistance = this.getTraversalResistance(neighborComponent);
                const terminalResistance = current.resistance + addedResistance;
                const terminalBest = bestResistance.get(otherTerminalNode);

                if (terminalBest === undefined || terminalResistance + epsilon < terminalBest) {
                    bestResistance.set(otherTerminalNode, terminalResistance);
                    queue.push({ nodeId: otherTerminalNode, resistance: terminalResistance });
                }
            }
        }

        return sources;
    }

    // Heuristic voltage lookup by traversing nearby rails/sources.
    calculateVoltageAtNode(nodeId) {
        const solvedVoltage = this.solveResistiveVoltageAtNode(nodeId);
        if (Number.isFinite(solvedVoltage)) {
            return solvedVoltage;
        }

        const sources = this.collectVoltageSources(nodeId);

        if (sources.length === 0) return 0.0;

        let weightedVoltage = 0;
        let totalConductance = 0;

        sources.forEach(source => {
            const conductance = 1 / Math.max(source.resistance, 1e-6);
            weightedVoltage += source.voltage * conductance;
            totalConductance += conductance;
        });

        if (totalConductance === 0) return 0.0;
        return weightedVoltage / totalConductance;
    }

    solveResistiveVoltageAtNode(nodeId) {
        const sources = this.collectVoltageSources(nodeId)
            .filter(source => Number.isFinite(source.voltage))
            .sort((left, right) => left.resistance - right.resistance)
            .slice(0, 8);

        if (sources.length < 2) return null;

        const exactSource = sources.find(source => source.resistance <= 1e-9);
        if (exactSource) return exactSource.voltage;

        let weightedVoltage = 0;
        let totalWeight = 0;

        for (const source of sources) {
            const resistance = Math.max(source.resistance, 1e-6);
            const weight = 1 / resistance;
            weightedVoltage += source.voltage * weight;
            totalWeight += weight;
        }

        if (totalWeight <= 0) return null;
        return weightedVoltage / totalWeight;
    }

    // --- CORE HELPER: Calculate Series Resistance ---
    findSeriesResistance(startNode) {
        const sources = this.collectVoltageSources(startNode)
            .filter(source => source.voltage > 0)
            .sort((left, right) => left.resistance - right.resistance);

        if (sources.length === 0) return 0;
        return sources[0].resistance;
    }

    findResistanceBetween(startNode, targetNode) {
        if (!startNode || !targetNode) return Infinity;
        if (startNode === targetNode) return 0;

        const queue = [{ nodeId: startNode, resistance: 0, visited: new Set([startNode]) }];
        let bestResistance = Infinity;

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) continue;

            if (current.resistance >= bestResistance) {
                continue;
            }

            if (current.nodeId === targetNode) {
                bestResistance = Math.min(bestResistance, current.resistance);
                continue;
            }

            const neighbors = this.getNeighbors(current.nodeId);
            for (const neighbor of neighbors) {
                if (current.visited.has(neighbor)) continue;

                if (neighbor === targetNode) {
                    bestResistance = Math.min(bestResistance, current.resistance);
                    continue;
                }

                const nextVisited = new Set(current.visited);
                nextVisited.add(neighbor);

                const nextComponent = this.getComponent(neighbor);
                const nextResistance = current.resistance + this.getTraversalResistance(nextComponent);

                queue.push({ nodeId: neighbor, resistance: nextResistance, visited: nextVisited });

                if (this.isResistiveTraversalComponent(nextComponent)) {
                    const otherTerminalNode = this.getOtherTerminalNode(nextComponent, neighbor);
                    if (otherTerminalNode && !nextVisited.has(otherTerminalNode)) {
                        const resistiveVisited = new Set(nextVisited);
                        resistiveVisited.add(otherTerminalNode);
                        queue.push({ nodeId: otherTerminalNode, resistance: nextResistance, visited: resistiveVisited });
                    }
                }
            }
        }

        return bestResistance;
    }

    calculatePowerStats() {
        const stats = {
            totalCurrent: 0.05, // 50mA baseline
            components: [],
            thermal: {},
            isOverloaded: false
        };

        this.components.forEach(comp => {
            let current = 0;
            if (this.isType(comp, 'wokwi-led')) current = 0.02;
            if (this.isType(comp, 'wokwi-motor', 'wokwi-servo')) current = 0.2;
            if (this.isType(comp, 'wokwi-neopixel')) current = (comp.attrs?.pixels || 16) * 0.02;
            
            if (current > 0) {
                stats.totalCurrent += current;
                stats.components.push({ id: comp.id, current: current * 1000 }); // mA

                // Thermal Analysis
                const voltage = this.isType(comp, 'wokwi-led') ? 2.0 : 5.0;
                const powerWatts = voltage * current;
                stats.thermal[comp.id] = {
                    power: powerWatts,
                    estimatedTemp: 25 + (powerWatts * 60) // 60°C/W
                };
            }
        });

        stats.isOverloaded = stats.totalCurrent > 0.5;
        return stats;
    }

    calculateVoltageDrop(currentAmps) {
        // Standard jumper wire resistance
        const wireResistance = 0.01; 
        return currentAmps * wireResistance;
    }

    getComponentRegistry() {
        const registry = emulatorComponents.default || emulatorComponents.registry || emulatorComponents;
        return registry && typeof registry === 'object' ? registry : {};
    }

    isComponentDefinition(entry, component) {
        if (!entry || !component || typeof entry !== 'object') {
            return false;
        }

        const entryType = entry?.manifest?.type || entry?.type || entry?.manifest?.id || null;
        return this.normalizeType(entryType) === this.normalizeType(component.type);
    }

    getComponentDefinition(component) {
        const registry = this.getComponentRegistry();
        const candidates = Array.isArray(registry) ? registry : Object.values(registry);
        return candidates.find(entry => this.isComponentDefinition(entry, component)) || null;
    }

    normalizeRuleEntry(rule, origin, index, component = null) {
        if (!rule) return null;

        const isFunctionRule = typeof rule === 'function';
        const execute = isFunctionRule
            ? rule
            : rule.run || rule.check || rule.execute || rule.validate;

        if (typeof execute !== 'function') {
            return null;
        }

        const severity = this.normalizeSeverity(
            isFunctionRule ? 'error' : rule.severity || rule.type || 'error'
        );

        return {
            id: isFunctionRule
                ? rule.name || `${origin}-rule-${index + 1}`
                : rule.id || rule.name || execute.name || `${origin}-rule-${index + 1}`,
            severity,
            priority: Number.isFinite(Number(rule.priority)) ? Number(rule.priority) : (index + 1) * 100,
            autoFixable: Boolean(!isFunctionRule && (rule.autoFixable || rule.autoFix)),
            confidence: Number.isFinite(Number(rule.confidence)) ? Number(rule.confidence) : 1,
            requires: Array.isArray(rule.requires) ? rule.requires.map(String) : [],
            prerequisites: Array.isArray(rule.prerequisites)
                ? rule.prerequisites.filter(entry => typeof entry === 'function')
                : [],
            profiles: Array.isArray(rule.profiles) ? rule.profiles.map(entry => String(entry).toLowerCase()) : null,
            expensive: Boolean(rule.expensive || (Number.isFinite(Number(rule.cost)) && Number(rule.cost) > 5)),
            origin,
            componentId: component?.id || null,
            raw: rule,
            execute,
        };
    }

    sortRuleEntries(entries) {
        return entries.sort((left, right) => {
            const severityDelta = this.getSeverityRank(left.severity) - this.getSeverityRank(right.severity);
            if (severityDelta !== 0) return severityDelta;

            const priorityDelta = (left.priority || 0) - (right.priority || 0);
            if (priorityDelta !== 0) return priorityDelta;

            return String(left.id || '').localeCompare(String(right.id || ''));
        });
    }

    getGlobalValidationRules() {
        const exportedRules = Array.isArray(allRules.validationRules)
            ? allRules.validationRules
            : (typeof allRules.getValidationRules === 'function' ? allRules.getValidationRules() : null);

        const sourceRules = Array.isArray(exportedRules) && exportedRules.length
            ? exportedRules
            : Object.values(allRules).filter(rule => typeof rule === 'function');

        return this.sortRuleEntries(
            sourceRules
                .map((rule, index) => this.normalizeRuleEntry(rule, 'global', index))
                .filter(Boolean)
        );
    }

    getComponentValidationRules(component) {
        const inlineRules = Array.isArray(component?.validation?.rules) ? component.validation.rules : [];
        const definition = this.getComponentDefinition(component);
        const sourceRules = inlineRules.length
            ? inlineRules
            : (Array.isArray(definition?.validation?.rules) ? definition.validation.rules : []);

        return this.sortRuleEntries(
            sourceRules
                .map((rule, index) => this.normalizeRuleEntry(rule, 'component', index, component))
                .filter(Boolean)
        );
    }

    collectValidationResult(result, defaults = {}) {
        if (result === null || result === undefined || result === false || result === true) {
            return [];
        }

        const entries = Array.isArray(result) ? result : [result];
        return entries
            .map(entry => this.recordError(entry, defaults))
            .filter(Boolean);
    }

    executeValidationRule(ruleEntry, component = null) {
        const defaults = {
            id: ruleEntry.id,
            ruleId: ruleEntry.id,
            severity: ruleEntry.severity,
            type: ruleEntry.severity,
            compIds: component ? [component.id] : [],
            componentId: component ? component.id : null,
            source: ruleEntry.origin,
            autoFix: ruleEntry.autoFixable,
            priority: ruleEntry.priority,
            confidence: ruleEntry.confidence,
        };

        try {
            const result = ruleEntry.origin === 'component'
                ? ruleEntry.execute(component, this.graph, this)
                : ruleEntry.execute(this);

            return this.collectValidationResult(result, defaults);
        } catch (error) {
            return this.collectValidationResult({
                id: ruleEntry.id,
                ruleId: ruleEntry.id,
                severity: 'error',
                message: `Validation rule ${ruleEntry.id} threw: ${error?.message || error}`,
                compIds: component ? [component.id] : [],
                componentId: component ? component.id : null,
                source: ruleEntry.origin,
                remediation: 'Inspect the rule implementation.',
                details: { stack: error?.stack || null },
            }, defaults);
        }
    }

    shouldStopValidation(newEntries, options) {
        const hasError = newEntries.some(entry => this.normalizeSeverity(entry.severity || entry.type) === 'error');
        const hasWarning = newEntries.some(entry => this.normalizeSeverity(entry.severity || entry.type) === 'warn');

        return (options.stopOnFirstError && hasError) || (options.stopOnWarning && hasWarning);
    }

    getDefaultValidationOptions(options = {}) {
        const profileName = String(options.profile || 'balanced').toLowerCase();
        const profiles = this.getValidationProfiles();
        const profile = profiles[profileName] || profiles.balanced;

        return {
            profileName,
            includeGlobalValidation: options.includeGlobalValidation !== false,
            includeComponentValidation: options.includeComponentValidation !== false,
            stopOnFirstError: options.stopOnFirstError === true,
            stopOnWarning: options.stopOnWarning === true,
            includeExpensive: options.includeExpensive ?? profile.includeExpensive,
            minimumSeverity: this.normalizeSeverity(options.minimumSeverity || profile.minimumSeverity || 'warn'),
            waivers: Array.isArray(options.waivers) ? options.waivers : [],
            useCache: options.useCache === true,
            cacheKey: String(options.cacheKey || ''),
            cacheMaxEntries: Math.max(1, Number(options.cacheMaxEntries || 20)),
            failOnExecutionError: options.failOnExecutionError === true,
            incremental: options.incremental === true,
            incrementalScope: String(options.incrementalScope || 'default'),
            runtimePhase: String(options.runtimePhase || 'compile-time'),
            runtimeState: options.runtimeState && typeof options.runtimeState === 'object' ? options.runtimeState : null,
            includeTemporalValidation: options.includeTemporalValidation === true,
        };
    }

    getIncrementalStore() {
        if (!FullCircuitValidator.incrementalStore) {
            FullCircuitValidator.incrementalStore = new Map();
        }
        return FullCircuitValidator.incrementalStore;
    }

    buildRootCauseGroups(errors) {
        const groups = new Map();
        const groupedErrors = errors.map(error => ({ ...error }));

        groupedErrors.forEach(error => {
            const key = [
                String(error.ruleId || error.id || 'generic'),
                (error.compIds || []).slice().sort().join(','),
            ].join('|');

            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    rootCause: error.message,
                    ruleId: error.ruleId || error.id || null,
                    severity: error.severity || error.type || 'warn',
                    compIds: error.compIds || [],
                    children: [],
                });
                error.details = {
                    ...(error.details || {}),
                    rootCauseGroup: key,
                    rootCausePrimary: true,
                };
            } else {
                const group = groups.get(key);
                group.children.push(error.message);
                error.details = {
                    ...(error.details || {}),
                    rootCauseGroup: key,
                    rootCausePrimary: false,
                };
            }
        });

        return {
            errors: groupedErrors,
            groups: Array.from(groups.values()),
        };
    }

    scoreFixRisk(error) {
        const remediation = String(error?.remediation || '').toLowerCase();
        const message = String(error?.message || '').toLowerCase();

        let risk = 0.4;
        if (!error?.autoFix) risk += 0.3;
        if (remediation.includes('disconnect') || message.includes('fatal short')) risk += 0.2;
        if (remediation.includes('level shifting') || remediation.includes('external')) risk += 0.2;
        if (remediation.includes('add') || remediation.includes('connect')) risk -= 0.1;

        return Math.max(0, Math.min(1, risk));
    }

    rankAutoFixes(errors) {
        const fixable = (errors || []).filter(error => error && (error.autoFix || error.remediation));

        return fixable
            .map(error => {
                const risk = this.scoreFixRisk(error);
                const confidence = Number.isFinite(Number(error.confidence)) ? Number(error.confidence) : 0.6;
                const reversibility = /add|wire|connect|remove/i.test(String(error.remediation || '')) ? 0.9 : 0.5;
                const score = (confidence * 0.55) + (reversibility * 0.25) + ((1 - risk) * 0.2);

                return {
                    issueId: error.id || error.ruleId || null,
                    message: error.message,
                    remediation: error.remediation || null,
                    autoFix: Boolean(error.autoFix),
                    risk,
                    reversibility,
                    confidence,
                    score,
                };
            })
            .sort((left, right) => right.score - left.score);
    }

    collectTemporalIssues(validationOptions) {
        if (!validationOptions.includeTemporalValidation) return [];

        const runtimeState = validationOptions.runtimeState || {};
        const issues = [];

        if (validationOptions.runtimePhase === 'runtime') {
            const bootStable = runtimeState.bootStable !== false;
            const i2cReady = runtimeState.i2cReady !== false;
            const serialSeen = runtimeState.serialSeen !== false;

            if (!bootStable) {
                issues.push({
                    ruleId: 'temporal-boot-stability',
                    severity: 'warn',
                    message: 'Boot-time power rails appear unstable before peripheral initialization.',
                    remediation: 'Delay peripheral init until power rails settle.',
                });
            }

            if (!i2cReady) {
                issues.push({
                    ruleId: 'temporal-i2c-readiness',
                    severity: 'warn',
                    message: 'I2C activity expected at runtime was not observed in the configured validation window.',
                    remediation: 'Add bus init checks and ensure pull-ups are present before transactions.',
                });
            }

            if (!serialSeen) {
                issues.push({
                    ruleId: 'temporal-serial-activity',
                    severity: 'info',
                    message: 'No serial activity observed during runtime validation window.',
                    remediation: 'Emit a startup marker over serial for runtime diagnostics.',
                });
            }
        }

        return issues.map(issue => this.recordError(issue, {
            source: 'temporal',
            confidence: 0.7,
        })).filter(Boolean);
    }

    getWaiverKey(waiver) {
        if (!waiver || typeof waiver !== 'object') return '';
        const ruleId = String(waiver.ruleId || waiver.id || '').trim();
        const componentId = String(waiver.componentId || waiver.compId || '').trim();
        const messageIncludes = String(waiver.messageIncludes || '').trim();
        return `${ruleId}|${componentId}|${messageIncludes}`;
    }

    isWaivedError(error, waivers = []) {
        return waivers.some(waiver => {
            if (!waiver || typeof waiver !== 'object') return false;

            const expiresAt = waiver.expiresAt ? Date.parse(String(waiver.expiresAt)) : null;
            if (Number.isFinite(expiresAt) && Date.now() > expiresAt) return false;

            const ruleId = String(waiver.ruleId || waiver.id || '').trim();
            const componentId = String(waiver.componentId || waiver.compId || '').trim();
            const messageIncludes = String(waiver.messageIncludes || '').trim().toLowerCase();

            if (ruleId && ruleId !== String(error.ruleId || error.id || '')) return false;
            if (componentId && componentId !== String(error.componentId || '')) return false;
            if (messageIncludes && !String(error.message || '').toLowerCase().includes(messageIncludes)) return false;

            return true;
        });
    }

    applyWaivers(errors, waivers = []) {
        if (!Array.isArray(errors) || errors.length === 0 || !Array.isArray(waivers) || waivers.length === 0) {
            return {
                errors,
                ignored: [],
            };
        }

        const ignored = [];
        const filtered = errors.filter(error => {
            const waived = this.isWaivedError(error, waivers);
            if (waived) ignored.push(error);
            return !waived;
        });

        return {
            errors: filtered,
            ignored,
        };
    }

    shouldRunRule(ruleEntry, executedRuleIds, validationOptions, component = null) {
        if (!ruleEntry) return false;

        if (!this.isSeverityAtLeast(ruleEntry.severity, validationOptions.minimumSeverity)) {
            return false;
        }

        if (!validationOptions.includeExpensive && ruleEntry.expensive) {
            return false;
        }

        if (Array.isArray(ruleEntry.profiles) && ruleEntry.profiles.length > 0) {
            if (!ruleEntry.profiles.includes(validationOptions.profileName)) {
                return false;
            }
        }

        if (Array.isArray(ruleEntry.requires) && ruleEntry.requires.length > 0) {
            const requiresPassed = ruleEntry.requires.every(requiredId => executedRuleIds.has(requiredId));
            if (!requiresPassed) {
                return false;
            }
        }

        if (Array.isArray(ruleEntry.prerequisites) && ruleEntry.prerequisites.length > 0) {
            for (const prerequisite of ruleEntry.prerequisites) {
                try {
                    const passed = ruleEntry.origin === 'component'
                        ? prerequisite(component, this.graph, this)
                        : prerequisite(this);
                    if (!passed) return false;
                } catch {
                    return false;
                }
            }
        }

        return true;
    }

    getValidationCacheStore() {
        if (!FullCircuitValidator.validationCache) {
            FullCircuitValidator.validationCache = new Map();
        }
        return FullCircuitValidator.validationCache;
    }

    tryReadCache(cacheKey) {
        const cacheStore = this.getValidationCacheStore();
        return cacheStore.get(cacheKey) || null;
    }

    writeCache(cacheKey, payload, cacheMaxEntries = 20) {
        const cacheStore = this.getValidationCacheStore();
        cacheStore.set(cacheKey, payload);

        while (cacheStore.size > cacheMaxEntries) {
            const firstKey = cacheStore.keys().next().value;
            if (firstKey === undefined) break;
            cacheStore.delete(firstKey);
        }
    }

    calculateHealthScore(syncIssues = []) {
        let score = 100;
        
        // Deduct based on structured error types
        const fatalErrors = this.errors.filter(e => this.normalizeSeverity(e.severity || e.type) === 'error');
        const warnings = this.errors.filter(e => this.normalizeSeverity(e.severity || e.type) === 'warn');
        
        score -= (fatalErrors.length * 20);
        score -= (warnings.length * 5);
        score -= (syncIssues.length * 10);
        
        return Math.max(0, score);
    }

    runValidation(options = {}) {
        this.resetValidationState();
        const validationOptions = this.getDefaultValidationOptions(options);
        const fingerprint = this.computeCircuitFingerprint();
        const cacheKey = validationOptions.cacheKey || `${fingerprint}|${validationOptions.profileName}|${validationOptions.minimumSeverity}|${validationOptions.includeExpensive}`;
        const incrementalStore = this.getIncrementalStore();
        const previousIncremental = incrementalStore.get(validationOptions.incrementalScope) || null;
        const dirtyComponentIds = validationOptions.incremental && previousIncremental
            ? this.getDirtyComponentIds(previousIncremental.fingerprint, fingerprint)
            : null;

        this.lastRunMeta.profile = validationOptions.profileName;
        this.lastRunMeta.fingerprint = fingerprint;

        if (validationOptions.useCache) {
            const cached = this.tryReadCache(cacheKey);
            if (cached) {
                this.errors = this.cloneErrors(cached.errors);
                this.errorSet = new Set(this.errors.map(error => this.getErrorSignature(error)));
                this.lastRunMeta.fromCache = true;
                this.lastRunMeta.ignoredErrors = this.cloneErrors(cached.ignoredErrors || []);
                this.lastRunMeta.rootCauseGroups = this.cloneErrors(cached.rootCauseGroups || []);
                this.lastRunMeta.recommendedFixes = this.cloneErrors(cached.recommendedFixes || []);
                return cached.passed;
            }
        }

        let stoppedEarly = false;
        const executedRuleIds = new Set();

        if (validationOptions.includeGlobalValidation) {
            for (const ruleEntry of this.getGlobalValidationRules()) {
                if (!this.shouldRunRule(ruleEntry, executedRuleIds, validationOptions)) {
                    this.lastRunMeta.skippedRules.push(ruleEntry.id);
                    continue;
                }

                const beforeCount = this.errors.length;
                this.executeValidationRule(ruleEntry);
                const newEntries = this.errors.slice(beforeCount);
                executedRuleIds.add(ruleEntry.id);
                this.lastRunMeta.executedRules.push(ruleEntry.id);

                if (this.shouldStopValidation(newEntries, validationOptions)) {
                    stoppedEarly = true;
                    break;
                }
            }
        }

        if (!stoppedEarly && validationOptions.includeComponentValidation) {
            for (const comp of this.components) {
                if (dirtyComponentIds && dirtyComponentIds.size > 0 && !dirtyComponentIds.has(comp.id)) {
                    continue;
                }

                const componentRules = this.getComponentValidationRules(comp);

                for (const ruleEntry of componentRules) {
                    if (!this.shouldRunRule(ruleEntry, executedRuleIds, validationOptions, comp)) {
                        this.lastRunMeta.skippedRules.push(ruleEntry.id);
                        continue;
                    }

                    const beforeCount = this.errors.length;
                    this.executeValidationRule(ruleEntry, comp);
                    const newEntries = this.errors.slice(beforeCount);
                    executedRuleIds.add(ruleEntry.id);
                    this.lastRunMeta.executedRules.push(ruleEntry.id);

                    if (this.shouldStopValidation(newEntries, validationOptions)) {
                        stoppedEarly = true;
                        break;
                    }
                }

                if (stoppedEarly) break;
            }
        }

        this.collectTemporalIssues(validationOptions);

        const waivedResult = this.applyWaivers(this.errors, validationOptions.waivers);
        const groupedResult = this.buildRootCauseGroups(waivedResult.errors);
        this.errors = groupedResult.errors;
        this.errorSet = new Set(this.errors.map(error => this.getErrorSignature(error)));
        this.lastRunMeta.ignoredErrors = waivedResult.ignored;
        this.lastRunMeta.stoppedEarly = stoppedEarly;
        this.lastRunMeta.rootCauseGroups = groupedResult.groups;
        this.lastRunMeta.recommendedFixes = this.rankAutoFixes(this.errors).slice(0, 8);
        this.lastRunMeta.dirtyComponentIds = dirtyComponentIds ? Array.from(dirtyComponentIds) : [];

        incrementalStore.set(validationOptions.incrementalScope, { fingerprint });

        const hasFatalErrors = this.errors.some(e => this.normalizeSeverity(e.severity || e.type) === 'error');
        const passed = !hasFatalErrors;

        if (validationOptions.useCache) {
            this.writeCache(cacheKey, {
                passed,
                errors: this.cloneErrors(this.errors),
                ignoredErrors: this.cloneErrors(this.lastRunMeta.ignoredErrors),
                rootCauseGroups: this.cloneErrors(this.lastRunMeta.rootCauseGroups),
                recommendedFixes: this.cloneErrors(this.lastRunMeta.recommendedFixes),
            }, validationOptions.cacheMaxEntries);
        }

        if (passed) {
            console.log("\n✅ ALL CHECKS PASSED: Circuit is safe for code execution.");
            return true;
        } else {
            console.log("\n🛑 VALIDATION FAILED:");
            this.errors.forEach(err => console.log(err));
            return false; // Tells the UI to halt execution and show errors to the student
        }
    }
}
