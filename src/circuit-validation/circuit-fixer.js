/**
 * Circuit Fixer Engine
 * Universally handles automated repairs for common circuit design errors.
 * Used by Web UI, CLI, and MCP.
 */

export function applyCircuitFix(projectData, error) {
    console.log('[CircuitFixer] Attempting fix for:', error.message, 'Remediation:', error.remediation);
    const { components = [], connections = [] } = projectData;
    if (!error.remediation) return { components, connections, applied: false };

    const rem = error.remediation.toLowerCase();
    let newComponents = [...components];
    let newConnections = [...connections];
    let applied = false;

    // Helper to find a specific component's power connection
    const findPowerWire = (compId) => {
        return newConnections.findIndex(w => {
            const isRelated = w.to.startsWith(compId) || w.from.startsWith(compId);
            const isPower = /5V|3V3|VCC|VIN/i.test(w.from) || /5V|3V3|VCC|VIN/i.test(w.to);
            return isRelated && isPower;
        });
    };

    // --- FIX 1: Missing Series Resistor ---
    if (rem.includes('resistor')) {
        const targetCompId = error.compIds?.[0];
        if (targetCompId) {
            const powerWireIdx = findPowerWire(targetCompId);
            const targetComp = components.find(c => c.id === targetCompId);

            if (powerWireIdx !== -1 && targetComp) {
                const oldWire = newConnections[powerWireIdx];
                const resId = 'res_' + Math.random().toString(36).substr(2, 5);
                
                newComponents.push({
                    id: resId, type: 'wokwi-resistor',
                    x: targetComp.x - 60, y: targetComp.y,
                    w: 40, h: 20, attrs: { value: '220' }
                });

                // Re-route wires
                const sourceNode = (oldWire.to.startsWith(targetCompId)) ? oldWire.from : oldWire.to;
                const targetNode = (oldWire.to.startsWith(targetCompId)) ? oldWire.to : oldWire.from;

                newConnections.splice(powerWireIdx, 1);
                newConnections.push({ from: sourceNode, to: `${resId}:1`, color: oldWire.color || 'red' });
                newConnections.push({ from: `${resId}:2`, to: targetNode, color: oldWire.color || 'red' });
                applied = true;
            }
        }
    }

    // --- FIX 2: Missing Ground Connection ---
    if (rem.includes('ground') || rem.includes('gnd')) {
        const targetCompId = error.compIds?.[0];
        const board = components.find(c => c.type.includes('arduino') || c.type.includes('pico') || c.type.includes('uno'));
        if (targetCompId && board) {
            newConnections.push({ from: `${board.id}:GND`, to: `${targetCompId}:GND`, color: 'black' });
            applied = true;
        }
    }

    // --- FIX 3: I2C Pull-up Resistors ---
    if (rem.includes('i2c pull-up')) {
        const board = components.find(c => c.type.includes('arduino') || c.type.includes('pico') || c.type.includes('uno'));
        if (board) {
            const vccPin = board.type.includes('pico') ? '3V3' : '5V';
            ['SDA', 'SCL'].forEach((pin, i) => {
                const resId = `i2c_pull_${pin.toLowerCase()}_${Math.random().toString(36).substr(2, 3)}`;
                newComponents.push({
                    id: resId, type: 'wokwi-resistor',
                    x: board.x + 100 + (i * 50), y: board.y - 40,
                    attrs: { value: '4700' }
                });
                newConnections.push({ from: `${board.id}:${vccPin}`, to: `${resId}:1`, color: 'red' });
                newConnections.push({ from: `${board.id}:${pin}`, to: `${resId}:2`, color: 'orange' });
            });
            applied = true;
        }
    }

    // --- FIX 4: Flip Component Polarity ---
    if (rem.includes('flip') || rem.includes('polarity')) {
        const targetCompId = error.compIds?.[0];
        const idx = newComponents.findIndex(c => c.id === targetCompId);
        if (idx !== -1) {
            const comp = newComponents[idx];
            newComponents[idx] = { ...comp, rotation: (comp.rotation || 0) + 180 };
            applied = true;
        }
    }

    // --- FIX 5: Voltage Divider (Logic Level) ---
    if (rem.includes('voltage divider')) {
        const targetCompId = error.compIds?.[0];
        const targetComp = components.find(c => c.id === targetCompId);
        if (targetComp) {
            const wireIdx = newConnections.findIndex(w => w.to.startsWith(targetCompId) && !w.from.includes('GND'));
            if (wireIdx !== -1) {
                const oldWire = newConnections[wireIdx];
                const r1Id = 'vdiv_r1_' + Math.random().toString(36).substr(2, 3);
                const r2Id = 'vdiv_r2_' + Math.random().toString(36).substr(2, 3);
                
                newComponents.push({ id: r1Id, type: 'wokwi-resistor', x: targetComp.x - 80, y: targetComp.y - 20, attrs: { value: '1000' } });
                newComponents.push({ id: r2Id, type: 'wokwi-resistor', x: targetComp.x - 80, y: targetComp.y + 20, rotation: 90, attrs: { value: '2000' } });
                
                newConnections.splice(wireIdx, 1);
                newConnections.push({ from: oldWire.from, to: `${r1Id}:1`, color: oldWire.color });
                newConnections.push({ from: `${r1Id}:2`, to: oldWire.to, color: oldWire.color });
                newConnections.push({ from: `${r1Id}:2`, to: `${r2Id}:1`, color: 'blue' });
                newConnections.push({ from: `${r2Id}:2`, to: 'GND', color: 'black' });
                applied = true;
            }
        }
    }

    // --- FIX 6: I2C Address Resolver ---
    if (rem.includes('address attribute')) {
        const targetCompId = error.compIds?.[0];
        const idx = newComponents.findIndex(c => c.id === targetCompId);
        if (idx !== -1) {
            const comp = newComponents[idx];
            const currentAddr = parseInt(comp.attrs?.i2cAddress || '0x27', 16);
            newComponents[idx] = { ...comp, attrs: { ...comp.attrs, i2cAddress: '0x' + (currentAddr + 1).toString(16) } };
            applied = true;
        }
    }

    return {
        components: newComponents,
        connections: newConnections,
        applied
    };
}
