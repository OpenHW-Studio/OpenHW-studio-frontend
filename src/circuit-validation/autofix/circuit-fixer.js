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
    console.log('[CircuitFixer] Attempting fix for:', error.message, 'Remediation:', error.remediation);
    
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
    let newConnections = JSON.parse(JSON.stringify(connections));
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

    const result = {
        components: newComponents,
        connections: newConnections,
        applied,
        appliedFixes,
        fixCount: appliedFixes.length,
        metadata: {
            errorId: error.id || error.ruleId,
            errorMessage: error.message,
            timestamp: Date.now(),
            before: { componentCount: components.length, connectionCount: connections.length },
            after: { componentCount: newComponents.length, connectionCount: newConnections.length },
        },
    };

    // Store in history if tracking is enabled
    if (fixHistory && options.trackHistory !== false) {
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

function applyGroundConnection(components, connections, targetCompId, board) {
    if (!targetCompId || !board) return { components, connections, applied: false };

    const alreadyConnected = connections.some(c => 
        ((c.from.startsWith(targetCompId) && c.to === `${board.id}:GND`) ||
         (c.to.startsWith(targetCompId) && c.from === `${board.id}:GND`))
    );

    if (alreadyConnected) return { components, connections, applied: false };

    connections.push({ 
        from: `${board.id}:GND`, 
        to: `${targetCompId}:GND`, 
        color: 'black',
        label: 'Ground'
    });

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

    connections.push({
        from: `${board.id}:${powerRail}`,
        to: `${targetCompId}:VCC`,
        color: 'red',
        label: 'Power'
    });

    return { components, connections, applied: true, description: 'Added power connection' };
}

function applyLedResistor(components, connections, targetCompId) {
    if (!targetCompId) return { components, connections, applied: false };

    const targetComp = components.find(c => c.id === targetCompId);
    if (!targetComp) return { components, connections, applied: false };

    const resId = 'res_' + Math.random().toString(36).substr(2, 5);
    const powerWireIdx = connections.findIndex(w => 
        (w.to.startsWith(targetCompId) || w.from.startsWith(targetCompId)) &&
        (/5V|3V3|VCC/i.test(w.from) || /5V|3V3|VCC/i.test(w.to))
    );

    if (powerWireIdx === -1) return { components, connections, applied: false };

    const oldWire = connections[powerWireIdx];
    const newResistor = {
        id: resId,
        type: 'wokwi-resistor',
        x: targetComp.x - 60,
        y: targetComp.y,
        w: 40,
        h: 20,
        attrs: { value: '220' }
    };

    components.push(newResistor);

    const sourceNode = oldWire.to.startsWith(targetCompId) ? oldWire.from : oldWire.to;
    const targetNode = oldWire.to.startsWith(targetCompId) ? oldWire.to : oldWire.from;

    connections.splice(powerWireIdx, 1);
    connections.push({ from: sourceNode, to: `${resId}:1`, color: oldWire.color || 'red' });
    connections.push({ from: `${resId}:2`, to: targetNode, color: oldWire.color || 'red' });

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

        connections.push({ from: `${board.id}:${vccPin}`, to: `${resId}:1`, color: 'red' });
        connections.push({ from: `${resId}:2`, to: `${board.id}:${pin}`, color: pin === 'SDA' ? 'yellow' : 'orange' });
        added++;
    });

    return { components, connections, applied: added > 0, description: `Added ${added} I2C pull-up resistor(s)` };
}

function applyButtonPulldown(components, connections, targetCompId) {
    if (!targetCompId) return { components, connections, applied: false };

    const resId = 'btn_pull_' + Math.random().toString(36).substr(2, 5);
    const targetComp = components.find(c => c.id === targetCompId);
    if (!targetComp) return { components, connections, applied: false };

    components.push({
        id: resId,
        type: 'wokwi-resistor',
        x: targetComp.x + 30,
        y: targetComp.y,
        attrs: { value: '10000' }
    });

    connections.push({ from: `${resId}:1`, to: `${targetCompId}:1`, color: 'blue' });
    connections.push({ from: `${resId}:2`, to: 'GND', color: 'black' });

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

    connections.push({ from: `${diodeId}:cathode`, to: `${targetCompId}:1`, color: 'red' });
    connections.push({ from: `${diodeId}:anode`, to: `${targetCompId}:2`, color: 'black' });

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

    const r1Id = 'vdiv_r1_' + Math.random().toString(36).substr(2, 3);
    const r2Id = 'vdiv_r2_' + Math.random().toString(36).substr(2, 3);

    components.push({ id: r1Id, type: 'wokwi-resistor', x: targetComp.x - 80, y: targetComp.y - 20, attrs: { value: '10000' } });
    components.push({ id: r2Id, type: 'wokwi-resistor', x: targetComp.x - 80, y: targetComp.y + 20, attrs: { value: '6800' } });

    connections.push({ from: `${r1Id}:2`, to: `${r2Id}:1`, label: 'Tap point (3.3V)' });
    connections.push({ from: `${r2Id}:2`, to: 'GND', color: 'black' });

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

    connections.push({ from: `${capId}:+`, to: `${targetCompId}:VCC`, color: 'red' });
    connections.push({ from: `${capId}:-`, to: `${targetCompId}:GND`, color: 'black' });

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

    connections.push({ from: `${board.id}:5V`, to: `${resId}:1`, color: 'red' });
    connections.push({ from: `${resId}:2`, to: `${board.id}:GPIO5`, color: 'yellow' });

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

    connections.push({ from: `${board.id}:${availableGpio}`, to: `${targetCompId}:1`, color: 'green' });
    connections.push({ from: `${board.id}:${powerRail}`, to: `${targetCompId}:VCC`, color: 'red' });
    connections.push({ from: `${board.id}:GND`, to: `${targetCompId}:GND`, color: 'black' });

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
