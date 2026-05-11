/**
 * projectUtils.js
 * Central hub for circuit editing, plan application, and geometric utilities.
 */

const HOLE_PITCH = 15;
const RAIL_MAX   = 25;

// ─── Core Plan Application ───────────────────────────────────────────────────

export function calculateProjectPlanApplication(plan, currentComponents, currentWires, pinDefs = {}) {
  if (!plan) return { components: currentComponents, wires: currentWires };
  
  // Normalize plan properties (WASM uses snake_case, JS uses camelCase)
  const addedComponents = plan.addedComponents || plan.added_components || [];
  const addedWires = plan.addedWires || plan.added_wires || [];
  const removedComponents = plan.removedComponents || plan.removed_components || [];
  const removedWires = plan.removedWires || plan.removed_wires || [];
  const transformations = plan.transformations || [];
  const defaultOwnerId = plan.main_component?.id || plan.ownerId || null;

  // Deep clone to prevent mutations
  const nextComponents = JSON.parse(JSON.stringify(currentComponents));
  let nextWires = JSON.parse(JSON.stringify(currentWires));
  
  // 1. Remove components if requested (by ID)
  let finalComponents = nextComponents;
  if (removedComponents.length > 0) {
    finalComponents = nextComponents.filter(c => !removedComponents.includes(c.id));
  }

  // 2. Remove wires (by ID or Pin matching)
  if (removedWires.length > 0) {
    nextWires = nextWires.filter(w => {
      // Check for ID match
      if (removedWires.includes(w.id)) return false;
      
      // Check for pin-pair match
      const isPinMatch = removedWires.some(rw => {
        if (typeof rw === 'string') return false; 
        const f = (rw.from || '').replace('.', ':');
        const t = (rw.to || '').replace('.', ':');
        return (f === w.from && t === w.to) || (f === w.to && t === w.from);
      });
      return !isPinMatch;
    });
  }

  addedComponents.forEach(ac => {
    const existing = finalComponents.find(c => c.id === ac.id);
    if (existing) {
      // Shared Ownership: Append new owner to existing component
      const oid = ac.ownerId || defaultOwnerId;
      if (oid) {
        const ids = new Set(existing.ownerIds || (existing.ownerId ? [existing.ownerId] : []));
        ids.add(oid);
        existing.ownerIds = Array.from(ids);
        delete existing.ownerId; // Modernize to array system
      }
    } else {
      // Grid Snapping for Breadboards (15px)
      let x = ac.x;
      let y = ac.y;
      if (ac.type.startsWith('wokwi-breadboard')) {
        x = Math.round(x / 15) * 15;
        y = Math.round(y / 15) * 15;
      }

      // Determine dimensions (with registry or manifest fallbacks)
      const defW = ac.type === 'wokwi-resistor' ? 70 : (ac.type === 'wokwi-led' ? 72 : 40);
      const defH = ac.type === 'wokwi-resistor' ? 32 : (ac.type === 'wokwi-led' ? 44 : 20);
      
      const addedComp = {
        ...ac,
        x,
        y,
        isGhost: false,
        w: ac.w || defW,
        h: ac.h || defH,
        attrs: ac.attrs || {},
        ownerIds: (ac.ownerId || defaultOwnerId) ? [ac.ownerId || defaultOwnerId] : (ac.ownerIds || [])
      };
      finalComponents.push(addedComp);

      // Auto-snap if definitions exist
      if (pinDefs && Object.keys(pinDefs).length > 0) {
        const { snappedWires } = robustSnapComponent(addedComp, finalComponents, pinDefs);
        if (snappedWires.length > 0) {
          nextWires.push(...snappedWires);
        }
      }
    }
  });
  
  // 4. Add new wires
  addedWires.forEach(aw => {
    // Deduplicate: don't add if a wire with same pins already exists
    const from = (aw.from || '').replace('.', ':');
    const to = (aw.to || '').replace('.', ':');
    const existing = nextWires.find(w => (w.from === from && w.to === to) || (w.from === to && w.to === from));
    
    if (existing) {
      // Shared Ownership: Append new owner to existing wire
      const oid = aw.ownerId || defaultOwnerId;
      if (oid) {
        const ids = new Set(existing.ownerIds || (existing.ownerId ? [existing.ownerId] : []));
        ids.add(oid);
        existing.ownerIds = Array.from(ids);
      }
    } else {
      nextWires.push({
        id: aw.id || 'wire_' + Math.random().toString(36).substr(2, 9),
        from,
        to,
        color: (aw.color === '#38bdf8' || !aw.color) ? 'green' : aw.color,
        waypoints: aw.waypoints || [],
        path: aw.path || null,
        isBelow: aw.isBelow || false,
        isSocket: aw.isSocket || false,
        offset: aw.lane || 0,
        ownerIds: (aw.ownerId || defaultOwnerId) ? [aw.ownerId || defaultOwnerId] : (aw.ownerIds || [])
      });
    }
  });
  
  // 5. Transformations
  transformations.forEach(trans => {
    const comp = finalComponents.find(c => c.id === trans.componentId);
    if (comp) { comp.rotation = trans.rotation; }
  });
  // Ownership Audit Log
  console.group('🛡️ Shared Ownership Audit');
  console.table(finalComponents.map(c => ({
    id: c.id,
    type: c.type,
    owners: (c.ownerIds || []).join(', ') || 'N/A'
  })));
  console.groupEnd();

  return { components: finalComponents, wires: nextWires };
}

// ─── Geometric & Breadboard Utilities (Active) ────────────────────────────────

export function getRotatedPoint(x, y, rotation, originX, originY) {
  if (!rotation) return { x, y };
  const rad = (rotation * Math.PI) / 180;
  const dx = x - originX, dy = y - originY;
  return {
    x: originX + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: originY + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

export function findNearestBreadboardHole(worldX, worldY, components, pinDefs, opts = {}) {
  const snapRadius = opts.snapRadius ?? 40;
  const skipPower  = opts.skipPower  ?? false;
  let best = null, minDist = Infinity;
  const bbs = components.filter(c => c.type?.startsWith('wokwi-breadboard'));
  for (const bb of bbs) {
    const pins = pinDefs[bb.type] || [];
    const cx = bb.x + (bb.w || 0) / 2, cy = bb.y + (bb.h || 0) / 2;
    const rot = bb.rotation || 0;
    for (const pin of pins) {
      if (skipPower && pin.type === 'power') continue;
      const pw = getRotatedPoint(bb.x + pin.x, bb.y + pin.y, rot, cx, cy);
      const d  = Math.hypot(pw.x - worldX, pw.y - worldY);
      if (d < snapRadius && d < minDist) {
        minDist = d;
        best = { bbId: bb.id, holeId: pin.id, x: pw.x, y: pw.y,
                 pinX: pin.x, pinY: pin.y, isPower: pin.type === 'power',
                 isGnd: pin.id.includes('gnd'), isVcc: pin.id.includes('vcc') };
      }
    }
  }
  return best;
}

export function getComponentWorldPins(comp, pins) {
  const rot = comp.rotation || 0;
  const cx = comp.x + (comp.w || 0) / 2, cy = comp.y + (comp.h || 0) / 2;
  return (pins || []).map(pin => {
    const w = getRotatedPoint(comp.x + pin.x, comp.y + pin.y, rot, cx, cy);
    return { ...pin, worldX: w.x, worldY: w.y };
  });
}

export function robustSnapComponent(comp, components, pinDefs) {
  if (!comp || comp.type?.startsWith('wokwi-breadboard'))
    return { snappedWires: [], hasPerfectSnap: false, snapMatches: [] };

  const pins      = pinDefs[comp.type] || [];
  const worldPins = getComponentWorldPins(comp, pins);

  const snapMatches = worldPins.map(wp => {
    const hole = findNearestBreadboardHole(wp.worldX, wp.worldY, components, pinDefs, { skipPower: true });
    const dist = hole ? Math.hypot(wp.worldX - hole.x, wp.worldY - hole.y) : Infinity;
    return { wp, hole, dist };
  });

  const hasPerfectSnap = snapMatches.some(m => m.dist < 2);
  const snappedWires   = [];

  snapMatches.forEach(m => {
    if (!m.hole) return;
    const id = `w_socket_${comp.id}_${m.wp.id}_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
    if (m.dist < 3) {
      snappedWires.push({ id, from: `${comp.id}:${m.wp.id}`, to: `${m.hole.bbId}:${m.hole.holeId}`,
                          color: 'transparent', isBelow: true, isSocket: true });
    } else if (m.dist <= 6) {
      snappedWires.push({ id, from: `${comp.id}:${m.wp.id}`, to: `${m.hole.bbId}:${m.hole.holeId}`,
                          color: '#7f8c8d', isBelow: true, isSocket: true, isHelp: true });
    }
  });
  return { snappedWires, hasPerfectSnap, snapMatches };
}

export function mergeCodeSnippet(currentCode, snippet, reasoning = []) {
  if (!snippet) return currentCode;
  
  let setupSnippet = snippet.setup || '';
  let loopSnippet = snippet.loop || '';

  // ── Multi-Bus Renaming Layer ──
  // If reasoning indicates Bus 1 was used, we rename Wire/Serial to Wire1/Serial1
  const isI2cBus1 = reasoning.some(r => r.includes('I2C') && r.includes('Bus 1'));
  const isUartBus1 = reasoning.some(r => r.includes('UART') && r.includes('Bus 1'));

  if (isI2cBus1) {
    setupSnippet = setupSnippet.replace(/\bWire\./g, 'Wire1.');
    loopSnippet = loopSnippet.replace(/\bWire\./g, 'Wire1.');
  }
  if (isUartBus1) {
    setupSnippet = setupSnippet.replace(/\bSerial\./g, 'Serial1.');
    loopSnippet = loopSnippet.replace(/\bSerial\./g, 'Serial1.');
  }

  if (!currentCode || !currentCode.trim())
    return `void setup() {\n  ${(setupSnippet || '').split('\n').join('\n  ')}\n}\n\nvoid loop() {\n  ${(loopSnippet || '').split('\n').join('\n  ')}\n}`;

  let code = currentCode;
  const injectIntoBlock = (src, blockName, lines) => {
    const existing = lines.filter(l => {
      const lt = l.trim();
      return lt && src.includes(lt);
    });
    const toAdd = lines.filter(l => !existing.includes(l));
    if (!toAdd.length) return src;
    const marker = `${blockName}() {`;
    const idx = src.indexOf(marker);
    if (idx !== -1)
      return src.slice(0, idx + marker.length) + '\n  ' + toAdd.join('\n  ') + src.slice(idx + marker.length);
    return src + `\n\n${blockName}() {\n  ${toAdd.join('\n  ')}\n}`;
  };

  if (setupSnippet) {
    const lines = setupSnippet.split('\n').map(l => l.trim()).filter(Boolean);
    code = injectIntoBlock(code, 'void setup', lines);
  }
  if (loopSnippet) {
    const lines = loopSnippet.split('\n').map(l => l.trim()).filter(Boolean);
    code = injectIntoBlock(code, 'void loop', lines);
  }
  return code;
}

// ─── Legacy Auto-Setup Utilities (Commented out for future use) ──────────────

/*
export function findOrAddBreadboard(components, canvasCenter, compCount = 0) { ... }
export function findFreePowerRail(bb, wires, pinDefs, railType, preferredIdx = 1) { ... }
export function findAlternativePin(targetPin, components, wires, pinDefs) { ... }
function findFreeBreadboardRow(bb, components, wires, pinDefs, colsNeeded = 2) { ... }
function findFreeHelperPosition(x, y, w, h, allComponents) { ... }
export function getUnconnectedPins(comp, compPins, wires) { ... }
export function connectUnconnectedPins(...) { ... }
function injectI2cPullups(...) { ... }
export function handleAutoSetup(...) { ... }
*/

// (Implementation bodies omitted here but kept in original files for reference if needed)
// Actually, I will include the bodies inside the comment block so they are truly "moved".

/*
export function findOrAddBreadboard(components, canvasCenter, compCount = 0) {
  const bbTypes = ['wokwi-breadboard', 'wokwi-breadboard-half', 'wokwi-breadboard-mini'];
  const bb = components.find(c => bbTypes.includes(c.type));
  if (bb) return { components, breadboard: bb, added: false };

  let bbType, w, h;
  if (compCount < 5)       { bbType = 'wokwi-breadboard-mini'; w = 320; h = 235; }
  else if (compCount < 15) { bbType = 'wokwi-breadboard-half'; w = 495; h = 295; }
  else                     { bbType = 'wokwi-breadboard';      w = 920; h = 295; }

  const newBb = {
    id: `bb_${Date.now()}`, type: bbType, label: 'Breadboard',
    x: canvasCenter.x - w / 2, y: canvasCenter.y - 100, w, h, attrs: {},
  };
  return { components: [...components, newBb], breadboard: newBb, added: true };
}

export function findFreePowerRail(bb, wires, pinDefs, railType, preferredIdx = 1) {
  const prefix   = railType === 'gnd' ? 'top_gnd' : 'top_vcc';
  const allPins  = pinDefs[bb.type] || [];
  const railPins = allPins.filter(p => p.id.startsWith(prefix));
  const occupied = id => wires.some(w => w.from === `${bb.id}:${id}` || w.to === `${bb.id}:${id}`);
  const clamped  = Math.max(1, Math.min(preferredIdx, RAIL_MAX));

  for (let delta = 0; delta <= RAIL_MAX; delta++) {
    for (const dir of [1, -1]) {
      const idx   = clamped + delta * dir;
      if (idx < 1 || idx > RAIL_MAX) continue;
      const pinId = `${prefix}_${idx}`;
      if (railPins.some(p => p.id === pinId) && !occupied(pinId))
        return `${bb.id}:${pinId}`;
    }
  }
  return `${bb.id}:${prefix}_1`;
}

export function findAlternativePin(targetPin, components, wires, pinDefs) {
  const parts = targetPin.split(':');
  if (parts.length < 2) return targetPin;
  const [boardId, pinId] = parts;
  const board = components.find(c => c.id === boardId);
  if (!board) return targetPin;

  const occupied = pid => wires.some(w => w.from === `${boardId}:${pid}` || w.to === `${boardId}:${pid}`);
  if (!occupied(pinId)) return targetPin;

  const pins   = pinDefs[board.type] || [];
  const pinNum = parseInt(pinId, 10);

  if (!isNaN(pinNum)) {
    for (let i = 1; i <= 20; i++) {
      for (const cand of [String(pinNum + i), String(pinNum - i)]) {
        if (Number(cand) >= 0 && pins.some(p => p.id === cand) && !occupied(cand))
          return `${boardId}:${cand}`;
      }
    }
  }
  for (const ap of ['A0','A1','A2','A3','A4','A5']) {
    if (pins.some(p => p.id === ap) && !occupied(ap))
      return `${boardId}:${ap}`;
  }
  return targetPin;
}

function findFreeBreadboardRow(bb, components, wires, pinDefs, colsNeeded = 2) {
  const GAP  = 2;
  const pins = pinDefs[bb.type] || [];
  const rows = [...new Set(
    pins.filter(p => !p.type || p.type === 'digital')
        .map(p => { const m = p.id.match(/^(\d+)[a-j]$/); return m ? +m[1] : null; })
        .filter(Boolean)
  )].sort((a, b) => a - b);

  const rowOccupied = r => {
    for (let ri = r - GAP; ri <= r + colsNeeded + GAP; ri++) {
      const holes = ['a','b','c','d','e','f','g','h','i','j'].map(c => `${ri}${c}`);
      if (holes.some(h => wires.some(w => w.from === `${bb.id}:${h}` || w.to === `${bb.id}:${h}`)))
        return true;
      const rp = pins.find(p => p.id === `${ri}a`);
      if (rp && components.some(c => {
        if (c.id === bb.id || c.type?.startsWith('wokwi-breadboard')) return false;
        return Math.abs(bb.x + rp.x - c.x) < 60 && Math.abs(bb.y + rp.y - c.y) < (GAP * HOLE_PITCH + 10);
      })) return true;
    }
    return false;
  };

  for (const row of rows) if (!rowOccupied(row)) return row;
  return 8;
}

function findFreeHelperPosition(x, y, w, h, allComponents) {
  let cx = x, cy = y;
  const overlaps = () => allComponents.some(c => {
    if (!c.w || !c.h) return false;
    return cx < c.x + (c.w || 60) + 5 && cx + w + 5 > c.x &&
           cy < c.y + (c.h || 60) + 5 && cy + h + 5 > c.y;
  });
  for (let attempt = 0; attempt < 20 && overlaps(); attempt++) {
    cx += HOLE_PITCH;
    if (attempt % 5 === 4) { cx = x; cy += HOLE_PITCH * 2; }
  }
  return { x: cx, y: cy };
}

export function getUnconnectedPins(comp, compPins, wires) {
  return (compPins || []).filter(pin => {
    const nc = `${comp.id}:${pin.id}`, nd = `${comp.id}.${pin.id}`;
    return !wires.some(w => w.from === nc || w.to === nc || w.from === nd || w.to === nd);
  });
}

export function connectUnconnectedPins(comp, unconnectedPins, bb, boardId, allWires, updatedWires, components, pinDefs) {
  if (!bb || !unconnectedPins.length) return;
  const boardComp = components.find(c => c.id === boardId);
  const boardPins = boardComp ? (pinDefs[boardComp.type] || []) : [];

  unconnectedPins.forEach((pin, i) => {
    const pn = pin.id.toLowerCase(), pt = (pin.type || '').toLowerCase();
    const live = [...allWires, ...updatedWires];
    const t    = Date.now() + i;

    if (pt === 'power' || pn.includes('gnd') || pn === 'gnd' || pn === 'vss') {
      const rail = findFreePowerRail(bb, live, pinDefs, 'gnd', 5);
      updatedWires.push({ id: `w_float_gnd_${comp.id}_${pin.id}_${t}`,
                          from: `${comp.id}:${pin.id}`, to: rail, color: 'black' });
    } else if (pn.includes('vcc') || pn === 'v+' || pn === '5v' || pn === '3v3' || pn === 'vdd') {
      const rail = findFreePowerRail(bb, live, pinDefs, 'vcc', 5);
      updatedWires.push({ id: `w_float_vcc_${comp.id}_${pin.id}_${t}`,
                          from: `${comp.id}:${pin.id}`, to: rail, color: 'red' });
    } else if (pt === 'analog') {
      for (const ap of ['A0','A1','A2','A3','A4','A5']) {
        if (!boardPins.some(p => p.id === ap)) continue;
        if (live.some(w => w.from === `${boardId}:${ap}` || w.to === `${boardId}:${ap}`)) continue;
        updatedWires.push({ id: `w_float_analog_${comp.id}_${pin.id}_${t}`,
                            from: `${comp.id}:${pin.id}`, to: `${boardId}:${ap}`, color: '#38bdf8' });
        break;
      }
    } else if (boardId) {
      for (let p = 2; p <= 13; p++) {
        const pid = String(p);
        if (!boardPins.some(bp => bp.id === pid)) continue;
        if (live.some(w => w.from === `${boardId}:${pid}` || w.to === `${boardId}:${pid}`)) continue;
        updatedWires.push({ id: `w_float_dig_${comp.id}_${pin.id}_${t}`,
                            from: `${comp.id}:${pin.id}`, to: `${boardId}:${pid}`, color: 'green' });
        break;
      }
    }
  });
}

function injectI2cPullups(compId, bb, boardId, updatedComponents, updatedWires, pinDefs) {
  const allComps = updatedComponents;
  const vccRailSda = findFreePowerRail(bb, updatedWires, pinDefs, 'vcc', 8);
  const vccRailScl = findFreePowerRail(bb, updatedWires, pinDefs, 'vcc', 10);

  const pu_sda_id = `pu_sda_${compId}_${Date.now()}`;
  const pu_scl_id = `pu_scl_${compId}_${Date.now() + 1}`;
  const bbComp    = allComps.find(c => c.id === bb.id);
  const baseX     = bbComp ? bbComp.x + 30 : 200;
  const baseY     = bbComp ? bbComp.y - 50 : 100;

  const pos1 = findFreeHelperPosition(baseX, baseY, 70, 32, allComps);
  updatedComponents.push({ id: pu_sda_id, type: 'wokwi-resistor', label: '4.7k', x: pos1.x, y: pos1.y, w: 70, h: 32, attrs: { value: '4700' } });
  const pos2 = findFreeHelperPosition(baseX + 90, baseY, 70, 32, [...allComps, { ...pos1, w: 70, h: 32 }]);
  updatedComponents.push({ id: pu_scl_id, type: 'wokwi-resistor', label: '4.7k', x: pos2.x, y: pos2.y, w: 70, h: 32, attrs: { value: '4700' } });

  updatedWires.push({ id: `w_pu_sda_in_${Date.now()}`,  from: `${compId}:SDA`, to: `${pu_sda_id}:p1`, color: '#38bdf8', isSocket: true, isHidden: true });
  updatedWires.push({ id: `w_pu_sda_out_${Date.now()}`, from: `${pu_sda_id}:p2`, to: vccRailSda, color: 'red' });
  updatedWires.push({ id: `w_pu_scl_in_${Date.now()}`,  from: `${compId}:SCL`, to: `${pu_scl_id}:p1`, color: '#38bdf8', isSocket: true, isHidden: true });
  updatedWires.push({ id: `w_pu_scl_out_${Date.now()}`, from: `${pu_scl_id}:p2`, to: vccRailScl, color: 'red' });

  if (!updatedWires.some(w => w.to === vccRailSda || w.from === vccRailSda))
    updatedWires.push({ id: `w_i2c_vcc_${Date.now()}`, from: `${boardId}:3V3`, to: vccRailSda, color: 'red' });
}
*/
