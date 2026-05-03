/**
 * autoSetup.js
 * Utility to handle automatic component placement, wiring, and coding.
 * Improved with breadboard snapping and existing breadboard reuse.
 */

// Helper for rotation math
function getRotatedPoint(x, y, rotation, originX, originY) {
  if (!rotation) return { x, y };
  const rad = (rotation * Math.PI) / 180;
  const dx = x - originX;
  const dy = y - originY;
  return {
    x: originX + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: originY + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

// Helper to find or add a breadboard
export function findOrAddBreadboard(components, canvasCenter) {
  // Support all common breadboard types
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

  return { 
    components: [...components, newBb], 
    breadboard: newBb, 
    added: true 
  };
}

// Helper to find alternative pins if the target board pin is occupied
export function findAlternativePin(targetPin, components, wires, pinDefs) {
  const [boardId, pinId] = targetPin.split(':');
  const board = components.find(c => c.id === boardId);
  if (!board) return targetPin;

  const isOccupied = (pid) => wires.some(w => w.from === `${boardId}:${pid}` || w.to === `${boardId}:${pid}`);
  if (!isOccupied(pinId)) return targetPin;

  const pins = pinDefs[board.type] || [];
  const targetPinDef = pins.find(p => p.id === pinId);
  if (!targetPinDef) return targetPin;

  // Basic heuristic: find next available numeric pin of same type
  const pinNum = parseInt(pinId);
  if (isNaN(pinNum)) return targetPin;

  for (let i = 1; i < 8; i++) {
    const nextPin = String(pinNum - i); 
    if (nextPin >= 0 && pins.some(p => p.id === nextPin) && !isOccupied(nextPin)) {
      return `${boardId}:${nextPin}`;
    }
  }

  return targetPin;
}

// Helper to find a free row on the breadboard
function findFreeBreadboardRow(bb, components, wires, pinDefs) {
  const pins = pinDefs[bb.type] || [];
  // Extract unique numeric rows (1, 2, 3...)
  const rows = [...new Set(pins.map(p => {
    const m = p.id.match(/^(\d+)[a-j]$/);
    return m ? parseInt(m[1]) : null;
  }).filter(Boolean))].sort((a, b) => a - b);

  // Check occupancy for each row
  for (const row of rows) {
    const rowHoles = ['a','b','c','d','e','f','g','h','i','j'].map(c => `${row}${c}`);
    
    const isRowOccupiedByWire = rowHoles.some(hId => {
      const fullHoleId = `${bb.id}:${hId}`;
      return wires.some(w => w.from === fullHoleId || w.to === fullHoleId);
    });

    // Check if any component is already placed near this row
    const rowPin = pins.find(p => p.id === `${row}a`);
    const isRowOccupiedByComp = rowPin && components.some(c => {
      if (c.id === bb.id || c.type.startsWith('wokwi-breadboard')) return false;
      const rowX = bb.x + rowPin.x;
      const rowY = bb.y + rowPin.y;
      // Rough collision box for component
      return Math.abs(c.y - rowY) < 15 && Math.abs(c.x - rowX) < 30;
    });

    if (!isRowOccupiedByWire && !isRowOccupiedByComp) return row;
  }
  
  return rows[Math.floor(rows.length / 2)] || 15; // Fallback
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
    // Ensure breadboard exists
    const bbRes = findOrAddBreadboard(updatedComponents, { x: newComp.x, y: newComp.y });
    updatedComponents = bbRes.components;
    const bb = bbRes.breadboard;
    const bbPins = pinDefs[bb.type] || [];

    // Find a free row
    const row = findFreeBreadboardRow(bb, updatedComponents, updatedWires, pinDefs);
    
    // Snap finalComp to breadboard
    // Most components like LEDs align to specific columns (e.g. i and j)
    const anchorHoleId = `${row}i`;
    const anchorPinId = finalComp.attrs?.breadboard?.anchorPin || pins[0]?.id;
    const anchorPin = pins.find(p => p.id === anchorPinId) || { x: 0, y: 0 };
    const bbHole = bbPins.find(p => p.id === anchorHoleId);

    if (bbHole) {
      // Position calculation
      const bbCenterX = bb.x + (bb.w || 0) / 2;
      const bbCenterY = bb.y + (bb.h || 0) / 2;
      const bbRotation = bb.rotation || 0;
      
      const holeWorld = getRotatedPoint(bb.x + bbHole.x, bb.y + bbHole.y, bbRotation, bbCenterX, bbCenterY);
      
      finalComp.x = holeWorld.x - anchorPin.x;
      finalComp.y = holeWorld.y - anchorPin.y;
    }

    // Process connections
    autowiring.connections.forEach((conn, idx) => {
      let target = conn.to;
      
      // Board pin resolution
      if (target.startsWith('arduino:')) {
        target = target.replace('arduino:', `${boardId}:`);
        target = findAlternativePin(target, updatedComponents, updatedWires, pinDefs);
      }

      // Component pin to breadboard hole mapping
      // If we are connecting a component pin to a board pin, we usually go through the breadboard row
      // LED A (10, 40) -> Row 15, Col i
      // LED K (25, 40) -> Row 15, Col j (since 15 units apart)
      
      const pinIndex = pins.findIndex(p => p.id === conn.from);
      const holeCol = pinIndex === 0 ? 'i' : 'j'; // Simple mapping for 2-pin components
      const holeId = `${row}${holeCol}`;
      const breadboardHole = `${bb.id}:${holeId}`;

      if (conn.via) {
        // Spawn intermediate component (e.g. Resistor)
        const viaId = `${conn.via}_${Date.now()}_${idx}`;
        const viaCatalog = catalogItem; // Fallback
        
        // Find Resistor x,y (place it across the gutter or in the same row)
        // For Resistor: Row 15, Col i -> Row 15, Col f (jumps the gutter or moves columns)
        const viaTargetHoleId = `${row}f`;
        const viaHole = bbPins.find(p => p.id === viaTargetHoleId);
        
        const viaComp = {
          id: viaId,
          type: conn.via,
          label: 'Resistor',
          x: holeId === `${row}i` ? finalComp.x + 40 : finalComp.x - 40,
          y: finalComp.y,
          w: 60,
          h: 12,
          attrs: conn.attrs || {}
        };

        if (viaHole) {
           const bbCenterX = bb.x + (bb.w || 0) / 2;
           const bbCenterY = bb.y + (bb.h || 0) / 2;
           const bbRotation = bb.rotation || 0;
           const vHoleWorld = getRotatedPoint(bb.x + viaHole.x, bb.y + viaHole.y, bbRotation, bbCenterX, bbCenterY);
           viaComp.x = vHoleWorld.x - 30; // Centered
           viaComp.y = vHoleWorld.y - 6;
        }

        updatedComponents.push(viaComp);

        // Wire 1: Breadboard hole of Comp pin -> Resistor Pin 1
        updatedWires.push({
          id: `w_auto_${Date.now()}_${idx}_a`,
          from: breadboardHole,
          to: `${viaId}:p1`,
          color: 'red'
        });

        // Wire 2: Resistor Pin 2 -> Target (e.g. Arduino Pin 13)
        updatedWires.push({
          id: `w_auto_${Date.now()}_${idx}_b`,
          from: `${viaId}:p2`,
          to: target,
          color: 'blue'
        });
      } else {
        // Direct wire from breadboard hole to target
        updatedWires.push({
          id: `w_auto_${Date.now()}_${idx}`,
          from: breadboardHole,
          to: target,
          color: target.includes('GND') ? 'black' : 'green'
        });
      }
    });
  }

  // 2. Auto-Coding Logic
  if (options.autoCoding && autocoding) {
    const snippet = autocoding.arduino;
    if (snippet) {
      updatedCode = mergeCodeSnippet(updatedCode, snippet);
    }
  }

  return {
    component: finalComp,
    components: updatedComponents,
    wires: updatedWires,
    code: updatedCode
  };
}
