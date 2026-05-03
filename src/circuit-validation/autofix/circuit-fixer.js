/**
 * Circuit Fixer Engine - ENHANCED VERSION (moved to autofix/)
 * Universally handles automated repairs for common circuit design errors.
 * Used by Web UI, CLI, and MCP.
 */

import { fixPatternsCatalog, findApplicablePatterns } from './fix-patterns-catalog.js';
import { CircuitFixValidator } from './circuit-fix-validator.js';
import { CircuitFixHistory } from './circuit-fix-history.js';

let fixValidator = null;
let fixHistory = null;

export function initializeCircuitFixEngine(validator) {
    fixValidator = new CircuitFixValidator(validator);
    fixHistory = new CircuitFixHistory();
    return { fixValidator, fixHistory };
}

export function applyCircuitFix(projectData, error, options = {}) {
    const { quiet = false, verbose = false, appliedBy = 'unknown', dryRun = false } = options;
    
    if (!quiet) {
        console.log('[CircuitFixer] Attempting fix for:', error.message, 'Remediation:', error.remediation);
    }
    
    const { components = [], connections = [] } = projectData;
    if (!error.remediation && !error.ruleId) {
        return { 
            components, 
            connections, 
            applied: false,
            reason: 'No remediation or rule ID found',
        };
    }

    let newComponents = JSON.parse(JSON.stringify(components));
    let newConnections = JSON.parse(JSON.stringify(connections)).map((w) => ({
        ...w,
        from: normalizeEndpoint(w?.from),
        to: normalizeEndpoint(w?.to),
    }));
    let applied = false;
    let appliedFixes = [];
    const board = findBoard(newComponents);

    // Try to find applicable patterns from catalog
    const patterns = findApplicablePatterns(error, { components: newComponents, connections: newConnections });
    
    // Apply the best matching pattern
    if (patterns.length > 0) {
        const pattern = patterns[0]; // Use highest confidence match
        const fixResult = applyPatternFix(newComponents, newConnections, pattern, error, board);
        if (fixResult.applied) {
            newComponents = fixResult.components;
            newConnections = fixResult.connections;
            applied = true;
            appliedFixes.push({
                patternId: pattern.id,
                description: pattern.description,
                confidence: pattern.confidence,
            });
        }
    }

    // Fallback to legacy simple fixes if no pattern matched
    if (!applied) {
        const legacyResult = applyLegacyFixes(newComponents, newConnections, error, board);
        newComponents = legacyResult.components;
        newConnections = legacyResult.connections;
        applied = legacyResult.applied;
        if (applied) {
            appliedFixes.push({
                patternId: 'legacy',
                description: legacyResult.description,
                confidence: 0.70,
            });
        }
    }

    // compute a changeSet by comparing ids before/after
    const beforeComponentIds = new Set((components || []).map(c => c.id));
    const afterComponentIds = new Set((newComponents || []).map(c => c.id));
    const addedComponents = (newComponents || []).filter(c => !beforeComponentIds.has(c.id));
    const removedComponents = (components || []).filter(c => !afterComponentIds.has(c.id));

    const beforeConnIds = new Set((connections || []).map(c => c.id));
    const afterConnIds = new Set((newConnections || []).map(c => c.id));
    const addedConnections = (newConnections || []).filter(c => !beforeConnIds.has(c.id));
    const removedConnections = (connections || []).filter(c => !afterConnIds.has(c.id));

    const result = {
        components: newComponents,
        connections: newConnections,
        applied,
        appliedFixes,
        fixCount: appliedFixes.length,
        changeSet: {
            addedComponents,
            removedComponents,
            addedConnections,
            removedConnections,
        },
        metadata: {
            errorId: error.id || error.ruleId,
            errorMessage: error.message,
            timestamp: Date.now(),
            before: { componentCount: components.length, connectionCount: connections.length },
            after: { componentCount: newComponents.length, connectionCount: newConnections.length },
        },
    };

    // Store in history if tracking is enabled and not a dry run
    if (!dryRun && fixHistory && options.trackHistory !== false) {
        fixHistory.recordFix({
            error,
            strategy: appliedFixes,
            patternId: patterns.length > 0 ? patterns[0].id : 'legacy',
            description: appliedFixes[0]?.description || 'Unknown fix',
            circuitBefore: { components, connections },
            circuitAfter: { components: newComponents, connections: newConnections },
            reversible: true,
            appliedBy: options.appliedBy || 'user',
        });
    }

    return result;
}

function normalizeEndpoint(endpoint) {
    const raw = String(endpoint || '');
    const m = raw.match(/^([^:.]+)[:.](.+)$/);
    if (!m) return raw;
    return `${m[1]}:${m[2]}`;
}

function applyPatternFix(components, connections, pattern, error, board) {
    let applied = false;
    const targetCompId = error.compIds?.[0];
    const targetComp = targetCompId ? components.find(c => c.id === targetCompId) : null;

    const handlers = {
        missing_ground_connection: () => applyGroundConnection(components, connections, targetCompId, board),
        missing_power_connection: () => applyPowerConnection(components, connections, targetCompId, board),
        led_series_resistor: () => applyLedResistor(components, connections, targetCompId),
        i2c_pull_up_resistors: () => applyI2cPullups(components, connections, board),
        button_pull_down_resistor: () => applyButtonPulldown(components, connections, targetCompId),
        motor_flywheel_diode: () => applyMotorFlywheel(components, connections, targetCompId),
        diode_polarity_flip: () => flipComponentPolarity(components, targetCompId),
        electrolytic_capacitor_polarity: () => flipComponentPolarity(components, targetCompId),
        led_polarity_flip: () => flipComponentPolarity(components, targetCompId),
        servo_power_capacitor: () => applyServoCapacitor(components, connections, targetCompId),
        ds18b20_pull_up: () => applyDs18b20Pullup(components, connections, board),
        unconnected_component: () => applyComponentWiring(components, connections, targetCompId, board),
    };

    const handler = handlers[pattern.id];
    if (handler) {
        const result = handler();
        if (result && result.applied) {
            return result;
        }
    }

    return { components, connections, applied: false };
}

function applyLegacyFixes(components, connections, error, board) {
    const rem = (error.remediation || '').toLowerCase();
    const targetCompId = error.compIds?.[0];

    if (rem.includes('series resistor') || rem.includes('resistor')) {
        return applyLedResistor(components, connections, targetCompId);
    }

    if (rem.includes('ground') || rem.includes('gnd')) {
        return applyGroundConnection(components, connections, targetCompId, board);
    }

    if (rem.includes('i2c pull-up') || rem.includes('pull-up')) {
        return applyI2cPullups(components, connections, board);
    }

    if (rem.includes('flip') || rem.includes('polarity') || rem.includes('orientation')) {
        return flipComponentPolarity(components, targetCompId);
    }

    if (rem.includes('voltage divider') || rem.includes('level shift')) {
        return applyVoltageDivider(components, connections, targetCompId);
    }

    if (rem.includes('address')) {
        return applyI2cAddressFix(components, targetCompId);
    }

    return { components, connections, applied: false, description: 'No matching fix pattern' };
}

function findBoard(components) {
    return components.find(c => 
        c.type?.includes('arduino') || 
        c.type?.includes('pico') || 
        c.type?.includes('uno') ||
        c.type?.includes('esp32') ||
        c.type?.includes('microcontroller')
    );
}

function findBoardGND(connections) {
    return connections.find(c => 
        c.from?.includes('GND') || 
        c.from?.includes('GND') ||
        c.to?.includes('GND')
    );
}

function nextWireId(connections) {
    let max = 0;
    connections.forEach((w) => {
        const m = String(w?.id || '').match(/^w(\d+)$/i);
        if (m) {
            const n = Number(m[1]);
            if (Number.isFinite(n) && n > max) max = n;
        }
    });
    return `w${max + 1}`;
}

function addWire(connections, from, to, color = 'green', label = undefined) {
    if (!String(from || '').includes(':') || !String(to || '').includes(':')) return false;
    connections.push({ id: nextWireId(connections), from, to, color, label });
    return true;
}

function boardGroundEndpoint(board) {
    if (!board?.id) return null;
    return `${board.id}:GND`;
}

function isGroundEndpoint(ep) {
    return /(^|:)(gnd|ground|-)$/i.test(String(ep || ''));
}

function pickTargetPinEndpoint(targetCompId, connections) {
    const targetPrefix = `${targetCompId}:`;
    const nonGround = connections.find((w) => {
        const a = String(w.from || '');
        const b = String(w.to || '');
        if (a.startsWith(targetPrefix) && !isGroundEndpoint(a)) return true;
        if (b.startsWith(targetPrefix) && !isGroundEndpoint(b)) return true;
        return false;
    });
    if (nonGround) {
        return String(nonGround.from || '').startsWith(targetPrefix) ? nonGround.from : nonGround.to;
    }
    return `${targetCompId}:1`;
}

function applyGroundConnection(components, connections, targetCompId, board) {
    if (!targetCompId || !board) return { components, connections, applied: false };

    const alreadyConnected = connections.some(c => 
        ((c.from.startsWith(targetCompId) && c.to === `${board.id}:GND`) ||
         (c.to.startsWith(targetCompId) && c.from === `${board.id}:GND`))
    );

    if (alreadyConnected) return { components, connections, applied: false };

    addWire(connections, `${board.id}:GND`, `${targetCompId}:GND`, 'black', 'Ground');

    return { components, connections, applied: true, description: 'Added ground connection' };
}

function applyPowerConnection(components, connections, targetCompId, board) {
    if (!targetCompId || !board) return { components, connections, applied: false };

    const powerRail = board.type?.includes('pico') ? '3V3' : '5V';
    const alreadyConnected = connections.some(c => 
        (c.from === `${board.id}:${powerRail}` && c.to.startsWith(targetCompId)) ||
        (c.to === `${board.id}:${powerRail}` && c.from.startsWith(targetCompId))
    );

    if (alreadyConnected) return { components, connections, applied: false };

    addWire(connections, `${board.id}:${powerRail}`, `${targetCompId}:VCC`, 'red', 'Power');

    return { components, connections, applied: true, description: 'Added power connection' };
}

function applyLedResistor(components, connections, targetCompId) {
    if (!targetCompId) return { components, connections, applied: false };

    const targetComp = components.find(c => c.id === targetCompId);
    if (!targetComp) return { components, connections, applied: false };

    const resId = 'res_' + Math.random().toString(36).substr(2, 5);
    const targetPrefix = `${targetCompId}:`;

    const preferredWireIdx = connections.findIndex((w) => {
        const from = String(w.from || '');
        const to = String(w.to || '');
        const touchesTarget = from.startsWith(targetPrefix) || to.startsWith(targetPrefix);
        if (!touchesTarget) return false;
        return !isGroundEndpoint(from) && !isGroundEndpoint(to);
    });

    const fallbackWireIdx = connections.findIndex((w) => {
        const from = String(w.from || '');
        const to = String(w.to || '');
        return from.startsWith(targetPrefix) || to.startsWith(targetPrefix);
    });

    const wireIdx = preferredWireIdx !== -1 ? preferredWireIdx : fallbackWireIdx;
    if (wireIdx === -1) return { components, connections, applied: false };

    const oldWire = connections[wireIdx];
    const newResistor = {
        id: resId,
        type: 'wokwi-resistor',
        x: Number(targetComp.x || 0) - 60,
        y: Number(targetComp.y || 0),
        w: 40,
        h: 20,
        attrs: { value: '220' }
    };

    components.push(newResistor);

    const sourceNode = oldWire.to.startsWith(targetCompId) ? oldWire.from : oldWire.to;
    const targetNode = oldWire.to.startsWith(targetCompId) ? oldWire.to : oldWire.from;

    connections.splice(wireIdx, 1);
    const wireColor = oldWire.color || 'red';
    const addedA = addWire(connections, sourceNode, `${resId}:1`, wireColor, oldWire.label);
    const addedB = addWire(connections, `${resId}:2`, targetNode, wireColor, oldWire.label);
    if (!addedA || !addedB) {
        return { components, connections, applied: false };
    }

    return { components, connections, applied: true, description: 'Added LED series resistor (220Ω)' };
}

function applyI2cPullups(components, connections, board) {
    if (!board) return { components, connections, applied: false };

    const vccPin = board.type?.includes('pico') ? '3V3' : '5V';
    let added = 0;

    ['SDA', 'SCL'].forEach((pin, i) => {
        const resId = `i2c_pull_${pin.toLowerCase()}_${Math.random().toString(36).substr(2, 3)}`;
        
        const alreadyExists = connections.some(c => c.to === `${board.id}:${pin}` && /47|4700/i.test(c.from));
        if (alreadyExists) return;

        components.push({
            id: resId,
            type: 'wokwi-resistor',
            x: board.x + 100 + (i * 50),
            y: board.y - 40,
            attrs: { value: '4700' }
        });

        addWire(connections, `${board.id}:${vccPin}`, `${resId}:1`, 'red');
        addWire(connections, `${resId}:2`, `${board.id}:${pin}`, pin === 'SDA' ? 'yellow' : 'orange');
        added++;
    });

    return { components, connections, applied: added > 0, description: `Added ${added} I2C pull-up resistor(s)` };
}

function applyButtonPulldown(components, connections, targetCompId) {
    if (!targetCompId) return { components, connections, applied: false };

    const resId = 'btn_pull_' + Math.random().toString(36).substr(2, 5);
    const targetComp = components.find(c => c.id === targetCompId);
    if (!targetComp) return { components, connections, applied: false };
    const board = findBoard(components);
    const gndEndpoint = boardGroundEndpoint(board);
    if (!gndEndpoint) return { components, connections, applied: false };
    const targetPin = pickTargetPinEndpoint(targetCompId, connections);

    components.push({
        id: resId,
        type: 'wokwi-resistor',
        x: targetComp.x + 30,
        y: targetComp.y,
        attrs: { value: '10000' }
    });

    addWire(connections, `${resId}:1`, targetPin, 'blue');
    addWire(connections, `${resId}:2`, gndEndpoint, 'black');

    return { components, connections, applied: true, description: 'Added button pull-down resistor' };
}

function applyMotorFlywheel(components, connections, targetCompId) {
    if (!targetCompId) return { components, connections, applied: false };

    const diodeId = 'diode_flywheel_' + Math.random().toString(36).substr(2, 5);
    const targetComp = components.find(c => c.id === targetCompId);
    if (!targetComp) return { components, connections, applied: false };

    components.push({
        id: diodeId,
        type: 'wokwi-diode',
        x: targetComp.x + 40,
        y: targetComp.y,
        attrs: { }
    });

    addWire(connections, `${diodeId}:cathode`, `${targetCompId}:1`, 'red');
    addWire(connections, `${diodeId}:anode`, `${targetCompId}:2`, 'black');

    return { components, connections, applied: true, description: 'Added motor flywheel diode (back-EMF protection)' };
}

function flipComponentPolarity(components, targetCompId) {
    if (!targetCompId) return { components, connections: [], applied: false };

    const idx = components.findIndex(c => c.id === targetCompId);
    if (idx === -1) return { components, connections: [], applied: false };

    const comp = components[idx];
    components[idx] = { ...comp, rotation: ((comp.rotation || 0) + 180) % 360 };

    return { components, connections: [], applied: true, description: 'Flipped component polarity (180°)' };
}

function applyVoltageDivider(components, connections, targetCompId) {
    if (!targetCompId) return { components, connections, applied: false };

    const targetComp = components.find(c => c.id === targetCompId);
    if (!targetComp) return { components, connections, applied: false };
    const board = findBoard(components);
    const gndEndpoint = boardGroundEndpoint(board);
    if (!gndEndpoint) return { components, connections, applied: false };

    const targetPin = pickTargetPinEndpoint(targetCompId, connections);
    const inputWire = connections.find((w) => {
        const from = String(w.from || '');
        const to = String(w.to || '');
        return (from === targetPin || to === targetPin) && !isGroundEndpoint(from) && !isGroundEndpoint(to);
    });
    const inputNode = inputWire ? (inputWire.from === targetPin ? inputWire.to : inputWire.from) : `${board.id}:5V`;

    const r1Id = 'vdiv_r1_' + Math.random().toString(36).substr(2, 3);
    const r2Id = 'vdiv_r2_' + Math.random().toString(36).substr(2, 3);

    components.push({ id: r1Id, type: 'wokwi-resistor', x: targetComp.x - 80, y: targetComp.y - 20, attrs: { value: '10000' } });
    components.push({ id: r2Id, type: 'wokwi-resistor', x: targetComp.x - 80, y: targetComp.y + 20, attrs: { value: '6800' } });

    addWire(connections, inputNode, `${r1Id}:1`, 'red');
    addWire(connections, `${r1Id}:2`, `${r2Id}:1`, 'green', 'Tap point (3.3V)');
    addWire(connections, `${r1Id}:2`, targetPin, 'blue');
    addWire(connections, `${r2Id}:2`, gndEndpoint, 'black');

    return { components, connections, applied: true, description: 'Added voltage divider (5V→3.3V)' };
}

function applyI2cAddressFix(components, targetCompId) {
    if (!targetCompId) return { components, connections: [], applied: false };

    const idx = components.findIndex(c => c.id === targetCompId);
    if (idx === -1) return { components, connections: [], applied: false };

    const comp = components[idx];
    const currentAddr = parseInt((comp.attrs?.i2cAddress || '0x27'), 16);
    components[idx] = { ...comp, attrs: { ...comp.attrs, i2cAddress: '0x' + (currentAddr + 1).toString(16).toUpperCase() } };

    return { components, connections: [], applied: true, description: `Changed I2C address from 0x${currentAddr.toString(16)} to 0x${(currentAddr + 1).toString(16)}` };
}

function applyServoCapacitor(components, connections, targetCompId) {
    if (!targetCompId) return { components, connections, applied: false };

    const capId = 'servo_cap_' + Math.random().toString(36).substr(2, 5);
    const targetComp = components.find(c => c.id === targetCompId);
    if (!targetComp) return { components, connections, applied: false };

    components.push({
        id: capId,
        type: 'wokwi-capacitor',
        x: targetComp.x + 30,
        y: targetComp.y,
        attrs: { value: '47µF' }
    });

    addWire(connections, `${capId}:+`, `${targetCompId}:VCC`, 'red');
    addWire(connections, `${capId}:-`, `${targetCompId}:GND`, 'black');

    return { components, connections, applied: true, description: 'Added servo power smoothing capacitor (47µF)' };
}

function applyDs18b20Pullup(components, connections, board) {
    if (!board) return { components, connections, applied: false };

    const resId = 'ds18b20_pull_' + Math.random().toString(36).substr(2, 5);
    components.push({
        id: resId,
        type: 'wokwi-resistor',
        x: board.x + 60,
        y: board.y - 50,
        attrs: { value: '4700' }
    });

    addWire(connections, `${board.id}:5V`, `${resId}:1`, 'red');
    addWire(connections, `${resId}:2`, `${board.id}:GPIO5`, 'yellow');

    return { components, connections, applied: true, description: 'Added DS18B20 1-Wire pull-up resistor' };
}

function applyComponentWiring(components, connections, targetCompId, board) {
    if (!targetCompId || !board) return { components, connections, applied: false };

    const targetComp = components.find(c => c.id === targetCompId);
    if (!targetComp) return { components, connections, applied: false };

    const powerRail = board.type?.includes('pico') ? '3V3' : '5V';
    const gpioPins = ['GPIO0', 'GPIO1', 'GPIO2', 'GPIO3'];
    const availableGpio = gpioPins.find(p => 
        !connections.some(c => c.to.includes(p))
    ) || gpioPins[0];

    addWire(connections, `${board.id}:${availableGpio}`, `${targetCompId}:1`, 'green');
    addWire(connections, `${board.id}:${powerRail}`, `${targetCompId}:VCC`, 'red');
    addWire(connections, `${board.id}:GND`, `${targetCompId}:GND`, 'black');

    return { components, connections, applied: true, description: 'Wired component to board (GPIO + Power + Ground)' };
}

export function getFixHistory() {
    return fixHistory;
}

export function getFixValidator() {
    return fixValidator;
}

export function getLastAppliedFix() {
    return fixHistory?.getLastFix() || null;
}

export function undoLastFix() {
    return fixHistory?.undo() || null;
}

export function redoLastFix() {
    return fixHistory?.redo() || null;
}
