/**
 * autoSetup.js
 * Utility to handle automatic component placement, wiring, and coding.
 * Collision-aware row allocation and flexible pin-to-hole snapping.
 * Handles visible vs hidden socket wires based on snapping distance.
 */

// Helper for rotation math
export function getRotatedPoint(x, y, rotation, originX, originY) {
  if (!rotation) return { x, y };
  const rad = (rotation * Math.PI) / 180;
  const dx = x - originX;
  const dy = y - originY;
  return {
    x: originX + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: originY + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

// User-provided snapping logic
export function findNearestBreadboardHole(worldX, worldY, components, pinDefs) {
  const snapRadius = 15;
  let best = null;
  let minDist = Infinity;
  const breadboards = components.filter(c => c.type.startsWith('wokwi-breadboard'));
  
  for (const bb of breadboards) {
    const pins = pinDefs[bb.type] || [];
    const bbCenterX = bb.x + (bb.w || 0) / 2;
    const bbCenterY = bb.y + (bb.h || 0) / 2;
    const bbRotation = bb.rotation || 0;
    for (const pin of pins) {
      const pinWorld = getRotatedPoint(bb.x + pin.x, bb.y + pin.y, bbRotation, bbCenterX, bbCenterY);
      const dist = Math.hypot(pinWorld.x - worldX, pinWorld.y - worldY);
      if (dist < snapRadius && dist < minDist) {
        minDist = dist;
        best = { bbId: bb.id, holeId: pin.id, x: pinWorld.x, y: pinWorld.y, pinX: pin.x, pinY: pin.y };
      }
    }
  }
  return best;
}

export function getComponentWorldPins(comp, pins) {
  const rotation = comp.rotation || 0;
  const centerX = comp.x + (comp.w || 0) / 2;
  const centerY = comp.y + (comp.h || 0) / 2;

  return (pins || []).map(pin => {
    const world = getRotatedPoint(comp.x + pin.x, comp.y + pin.y, rotation, centerX, centerY);
    return { ...pin, worldX: world.x, worldY: world.y };
  });
}

/**
 * Robustly snaps a component to available breadboards.
 * Returns an object with { snappedWires, hasPerfectSnap, snapMatches }
 */
export function robustSnapComponent(comp, components, pinDefs) {
  if (!comp || comp.type.startsWith('wokwi-breadboard')) {
    return { snappedWires: [], hasPerfectSnap: false, snapMatches: [] };
  }

  const pins = pinDefs[comp.type] || [];
  const worldPins = getComponentWorldPins(comp, pins);
  
  const snapMatches = worldPins.map(wp => {
    const hole = findNearestBreadboardHole(wp.worldX, wp.worldY, components, pinDefs);
    const dist = hole ? Math.hypot(wp.worldX - hole.x, wp.worldY - hole.y) : Infinity;
    return { wp, hole, dist };
  });

  const hasPerfectSnap = snapMatches.some(m => m.dist < 2);
  const newSocketWires = [];

  if (hasPerfectSnap) {
    snapMatches.forEach(m => {
      if (m.dist < 2) {
        newSocketWires.push({
          id: `w_socket_${comp.id}_${m.wp.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          from: `${comp.id}:${m.wp.id}`,
          to: `${m.hole.bbId}:${m.hole.holeId}`,
          color: 'transparent',
          isBelow: true,
          isSocket: true
        });
      } else if (m.dist <= 5) {
        newSocketWires.push({
          id: `socket_help_${comp.id}_${m.wp.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          from: `${comp.id}:${m.wp.id}`,
          to: `${m.hole.bbId}:${m.hole.holeId}`,
          color: '#7f8c8d',
          isBelow: true,
          isSocket: true,
          isHelp: true
        });
      }
    });
  }

  return { snappedWires: newSocketWires, hasPerfectSnap, snapMatches };
}

// Helper to find or add a breadboard
export function findOrAddBreadboard(components, canvasCenter) {
  const bbTypes = ['wokwi-breadboard', 'wokwi-breadboard-half', 'wokwi-breadboard-mini'];
  let bb = components.find(c => bbTypes.includes(c.type));
  if (bb) return { components, breadboard: bb, added: false };

  const newBb = {
    id: `bb_${Date.now()}`,
    type: 'wokwi-breadboard-half',
    label: 'Breadboard',
    x: canvasCenter.x - 240,
    y: canvasCenter.y - 150,
    w: 495,
    h: 295,
    attrs: {}
  };

  return { components: [...components, newBb], breadboard: newBb, added: true };
}

// Helper to find alternative board pins
export function findAlternativePin(targetPin, components, wires, pinDefs) {
  const [boardId, pinId] = targetPin.split(':');
  const board = components.find(c => c.id === boardId);
  if (!board) return targetPin;

  const isOccupied = (pid) => wires.some(w => w.from === `${boardId}:${pid}` || w.to === `${boardId}:${pid}`);
  if (!isOccupied(pinId)) return targetPin;

  const pins = pinDefs[board.type] || [];
  const targetPinDef = pins.find(p => p.id === pinId);
  if (!targetPinDef) return targetPin;

  const pinNum = parseInt(pinId);
  if (isNaN(pinNum)) return targetPin;

  for (let i = 1; i < 12; i++) {
    const nextPin = String(pinNum - i); 
    if (nextPin >= 0 && pins.some(p => p.id === nextPin) && !isOccupied(nextPin)) {
      return `${boardId}:${nextPin}`;
    }
  }
  return targetPin;
}

// Helper to find a free row with PADDING to avoid messy overlaps
function findFreeBreadboardRow(bb, components, wires, pinDefs) {
  const ROW_PADDING = 3; 
  const pins = pinDefs[bb.type] || [];
  const rows = [...new Set(pins.map(p => {
    const m = p.id.match(/^(\d+)[a-j]$/);
    return m ? parseInt(m[1]) : null;
  }).filter(Boolean))].sort((a, b) => a - b);

  for (const row of rows) {
    const rowRange = [];
    for (let i = -ROW_PADDING; i <= ROW_PADDING; i++) rowRange.push(row + i);

    const isRangeOccupied = rowRange.some(r => {
      const rowHoles = ['a','b','c','d','e','f','g','h','i','j'].map(c => `${r}${c}`);
      return rowHoles.some(hId => {
        const fullHoleId = `${bb.id}:${hId}`;
        return wires.some(w => w.from === fullHoleId || w.to === fullHoleId);
      });
    });

    const rowPin = pins.find(p => p.id === `${row}a`);
    const isRangeOccupiedByComp = rowPin && components.some(c => {
      if (c.id === bb.id || c.type.startsWith('wokwi-breadboard')) return false;
      return Math.abs(c.y - (bb.y + rowPin.y)) < (ROW_PADDING * 15) && Math.abs(c.x - (bb.x + rowPin.x)) < 50;
    });

    if (!isRangeOccupied && !isRangeOccupiedByComp) return row;
  }
  return 15;
}

// Helper to merge code snippets
export function mergeCodeSnippet(currentCode, snippet) {
  if (!snippet) return currentCode;
  if (!currentCode || currentCode.trim() === '') return `void setup() {\n  ${snippet.setup || ''}\n}\n\nvoid loop() {\n  ${snippet.loop || ''}\n}`;
  let newCode = currentCode;
  if (snippet.setup) {
    if (newCode.includes('void setup() {')) {
      newCode = newCode.replace('void setup() {', `void setup() {\n  ${snippet.setup}`);
    } else {
      newCode = `void setup() {\n  ${snippet.setup}\n}\n\n` + newCode;
    }
  }
  if (snippet.loop) {
    if (newCode.includes('void loop() {')) {
      newCode = newCode.replace('void loop() {', `void loop() {\n  ${snippet.loop}`);
    } else {
      newCode += `\n\nvoid loop() {\n  ${snippet.loop}\n}`;
    }
  }
  return newCode;
}

/**
 * Main entry point for auto setup
 */
export function handleAutoSetup({
  newComp,
  components,
  wires,
  code,
  catalogItem,
  pinDefs,
  boardId,
  options = { autoWiring: true, autoCoding: true }
}) {
  let updatedComponents = [...components];
  let updatedWires = [...wires];
  let updatedCode = code;
  let finalComp = { ...newComp };

  const manifest = catalogItem.manifest || catalogItem;
  const { autocoding, autowiring } = manifest;
  const pins = manifest.pins || [];

  // 1. Auto-Wiring Logic
  if (options.autoWiring && autowiring && autowiring.connections) {
    const bbRes = findOrAddBreadboard(updatedComponents, { x: newComp.x, y: newComp.y });
    updatedComponents = bbRes.components;
    const bb = bbRes.breadboard;
    const bbPins = pinDefs[bb.type] || [];

    // Ensure board power rails are connected
    const hasPowerWires = updatedWires.some(w => (w.from.startsWith(boardId) || w.to.startsWith(boardId)) && (w.from.startsWith(bb.id) || w.to.startsWith(bb.id)) && w.id.includes('bb_pwr'));
    if (boardId && !hasPowerWires) {
      const gndPin = pinDefs[boardId.split(':')[0]]?.find(p => p.id.toLowerCase().includes('gnd'))?.id || 'GND';
      const vccPin = pinDefs[boardId.split(':')[0]]?.find(p => p.id === '5V' || p.id === '3V3' || p.id === 'VCC')?.id || '5V';

      updatedWires.push({ id: `w_auto_bb_pwr_gnd_${Date.now()}`, from: `${boardId}:${gndPin}`, to: `${bb.id}:top_gnd_1`, color: 'black' });
      updatedWires.push({ id: `w_auto_bb_pwr_vcc_${Date.now()}`, from: `${boardId}:${vccPin}`, to: `${bb.id}:top_vcc_1`, color: 'red' });
    }

    const row = findFreeBreadboardRow(bb, updatedComponents, updatedWires, pinDefs);
    
    // POSITIONING & SNAPPING
    const anchorPinId = finalComp.attrs?.breadboard?.anchorPin || pins[0]?.id;
    const anchorPin = pins.find(p => p.id === anchorPinId) || { x: 0, y: 0 };
    const anchorHoleId = `${row}i`;
    const bbHole = bbPins.find(p => p.id === anchorHoleId);

    if (bbHole) {
      const bbCenterX = bb.x + (bb.w || 0) / 2;
      const bbCenterY = bb.y + (bb.h || 0) / 2;
      const holeWorld = getRotatedPoint(bb.x + bbHole.x, bb.y + bbHole.y, bb.rotation || 0, bbCenterX, bbCenterY);
      finalComp.x = holeWorld.x - anchorPin.x;
      finalComp.y = holeWorld.y - anchorPin.y;
    }

    // MAP EACH PIN TO NEAREST HOLE USING ROBUST LOGIC
    const { snappedWires, snapMatches } = robustSnapComponent(finalComp, updatedComponents, pinDefs);
    const pinToHoleMap = {};
    snapMatches.forEach(m => {
      if (m.hole) pinToHoleMap[m.wp.id] = m.hole.holeId;
    });
    updatedWires.push(...snappedWires);

    // PROCESS CONNECTIONS
    autowiring.connections.forEach((conn, idx) => {
      let target = conn.to;
      const breadboardHole = `${bb.id}:${pinToHoleMap[conn.from] || (idx === 0 ? row+'i' : row+'j')}`;

      if (target.startsWith('arduino:')) {
        target = target.replace('arduino:', `${boardId}:`);
        const [bId, pId] = target.split(':');
        const bPins = pinDefs[updatedComponents.find(c => c.id === bId)?.type] || [];
        const match = bPins.find(p => p.id.toLowerCase().startsWith(pId.toLowerCase()));
        if (match) target = `${bId}:${match.id}`;
        target = findAlternativePin(target, updatedComponents, updatedWires, pinDefs);
      }

      if (target.toLowerCase().includes('gnd')) target = `${bb.id}:top_gnd_${row}`;
      else if (target.toLowerCase().includes('5v') || target.toLowerCase().includes('3v3') || target.toLowerCase().includes('vcc')) target = `${bb.id}:top_vcc_${row}`;

      if (conn.via) {
        const viaId = `${conn.via}_${Date.now()}_${idx}`;
        const viaComp = {
          id: viaId, type: conn.via, label: 'Resistor',
          x: finalComp.x + 60, y: finalComp.y, w: 60, h: 12, attrs: conn.attrs || {}
        };
        const viaTargetHoleId = `${row}f`;
        const viaHole = bbPins.find(p => p.id === viaTargetHoleId);
        if (viaHole) {
           const vWorld = getRotatedPoint(bb.x + viaHole.x, bb.y + viaHole.y, bb.rotation || 0, bb.x + bb.w/2, bb.y + bb.h/2);
           viaComp.x = vWorld.x - 30;
           viaComp.y = vWorld.y - 6;
        }
        updatedComponents.push(viaComp);

        // Visibility Check for Via (Resistor)
        // Usually resistors in auto-setup are aligned perfectly
        updatedWires.push({ 
          id: `w_via_in_socket_direct_${Date.now()}_${idx}`, 
          from: breadboardHole, 
          to: `${viaId}:p1`, 
          color: 'red', 
          isSocket: true,
          isHidden: true // Resistor pin is usually directly over hole
        });
        
        updatedWires.push({ id: `w_via_out_${Date.now()}_${idx}`, from: `${viaId}:p2`, to: target, color: target.includes('gnd') ? 'black' : 'blue', isSocket: target.includes(bb.id + ':') });
      } else {
        updatedWires.push({ id: `w_direct_${Date.now()}_${idx}`, from: breadboardHole, to: target, color: target.includes('gnd') ? 'black' : 'green', isSocket: target.includes(bb.id + ':') });
      }
    });
  }

  if (options.autoCoding && autocoding) {
    const snippet = autocoding.arduino;
    if (snippet) updatedCode = mergeCodeSnippet(updatedCode, snippet);
  }

  return { component: finalComp, components: updatedComponents, wires: updatedWires, code: updatedCode };
}
