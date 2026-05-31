import { normalizeProjectFiles } from '../../utils/projectCompilerUtils';
import { COMPONENT_REGISTRY } from './utils/componentRegistry';
import { allocateComponentId } from './utils/simulatorUtils';
import * as hardwareUtils from './utils/hardwareUtils';
import { wireColor } from './wireUtils';

/**
 * projectUtils.js
 * Central hub for circuit editing, plan application, and geometric utilities.
 */

const HOLE_PITCH = 15;
const RAIL_MAX = 25;

export const BOARD_COLOR_PALETTE = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#14b8a6', '#eab308', '#06b6d4', '#8b5cf6'];

export function getBoardColors(boardOptions) {
  const map = { all: '#94a3b8' };
  (boardOptions || []).filter((id) => id !== 'all').forEach((id, idx) => {
    map[id] = BOARD_COLOR_PALETTE[idx % BOARD_COLOR_PALETTE.length];
  });
  return map;
}

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
      if (hardwareUtils.isBreadboardType(ac.type)) {
        x = Math.round(x / 15) * 15;
        y = Math.round(y / 15) * 15;
      }

      // Determine dimensions (with registry or manifest fallbacks)
      const defW = hardwareUtils.isResistorType(ac.type) ? 70 : (hardwareUtils.isLedType(ac.type) ? 72 : 40);
      const defH = hardwareUtils.isResistorType(ac.type) ? 32 : (hardwareUtils.isLedType(ac.type) ? 44 : 20);

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
    const from = (aw.from || '').replace('.', ':');
    const to = (aw.to || '').replace('.', ':');

    // Primary Deduplication: by ID
    const existingById = aw.id ? nextWires.find(w => w.id === aw.id) : null;
    if (existingById) {
      existingById.from = from;
      existingById.to = to;
      existingById.color = (aw.color === '#38bdf8' || !aw.color) ? 'green' : aw.color;
      existingById.waypoints = aw.waypoints || [];
      existingById.path = aw.path || null;
      existingById.isBelow = aw.isBelow || false;
      existingById.isSocket = aw.isSocket || false;
      existingById.offset = aw.lane || 0;

      const oid = aw.ownerId || defaultOwnerId;
      if (oid) {
        const ids = new Set(existingById.ownerIds || (existingById.ownerId ? [existingById.ownerId] : []));
        ids.add(oid);
        existingById.ownerIds = Array.from(ids);
      }
      return;
    }

    // Secondary Deduplication: by pin-pair match (for shared connectivity)
    const existingByPins = nextWires.find(w => (w.from === from && w.to === to) || (w.from === to && w.to === from));

    if (existingByPins) {
      // Shared Ownership: Append new owner to existing wire
      const oid = aw.ownerId || defaultOwnerId;
      if (oid) {
        const ids = new Set(existingByPins.ownerIds || (existingByPins.ownerId ? [existingByPins.ownerId] : []));
        ids.add(oid);
        existingByPins.ownerIds = Array.from(ids);
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

  // Final Deduplication Pass: Ensure no duplicate IDs reach the React state
  const uniqueWires = [];
  const seenIds = new Set();
  // Process from newest to oldest to keep the most recent updates
  for (let i = nextWires.length - 1; i >= 0; i--) {
    const w = nextWires[i];
    if (!seenIds.has(w.id)) {
      uniqueWires.unshift(w);
      seenIds.add(w.id);
    }
  }

  return { components: finalComponents, wires: uniqueWires };
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
  const skipPower = opts.skipPower ?? false;
  const bbs = components.filter(c => hardwareUtils.isBreadboardType(c.type));
  let minDist = Infinity;
  let best = null;
  for (const bb of bbs) {
    const pins = pinDefs[bb.type] || [];
    const cx = bb.x + (bb.w || 0) / 2, cy = bb.y + (bb.h || 0) / 2;
    const rot = bb.rotation || 0;
    for (const pin of pins) {
      if (skipPower && pin.type === 'power') continue;
      const pw = getRotatedPoint(bb.x + pin.x, bb.y + pin.y, rot, cx, cy);
      const d = Math.hypot(pw.x - worldX, pw.y - worldY);
      if (d < snapRadius && d < minDist) {
        minDist = d;
        best = {
          bbId: bb.id, holeId: pin.id, x: pw.x, y: pw.y,
          pinX: pin.x, pinY: pin.y, isPower: pin.type === 'power',
          isGnd: pin.id.includes('gnd'), isVcc: pin.id.includes('vcc')
        };
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
  if (!comp || hardwareUtils.isBreadboardType(comp.type))
    return { snappedWires: [], hasPerfectSnap: false, snapMatches: [] };

  const pins = pinDefs[comp.type] || [];
  const worldPins = getComponentWorldPins(comp, pins);

  const snapMatches = worldPins.map(wp => {
    const hole = findNearestBreadboardHole(wp.worldX, wp.worldY, components, pinDefs, { skipPower: true });
    const dist = hole ? Math.hypot(wp.worldX - hole.x, wp.worldY - hole.y) : Infinity;
    return { wp, hole, dist };
  });

  const hasPerfectSnap = snapMatches.some(m => m.dist < 2);
  const snappedWires = [];

  snapMatches.forEach(m => {
    if (!m.hole) return;
    const id = `w_socket_${comp.id}_${m.wp.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    if (m.dist < 3) {
      snappedWires.push({
        id, from: `${comp.id}:${m.wp.id}`, to: `${m.hole.bbId}:${m.hole.holeId}`,
        color: 'transparent', isBelow: true, isSocket: true
      });
    } else if (m.dist <= 6) {
      snappedWires.push({
        id, from: `${comp.id}:${m.wp.id}`, to: `${m.hole.bbId}:${m.hole.holeId}`,
        color: '#7f8c8d', isBelow: true, isSocket: true, isHelp: true
      });
    }
  });
  return { snappedWires, hasPerfectSnap, snapMatches };
}

export function mergeCodeSnippet(currentCode, snippet, compId, reasoning = []) {
  if (!snippet) return currentCode;

  // First, remove any existing block for this component to ensure a clean update
  let code = removeCodeSnippet(currentCode, compId);

  let globalsSnippet = snippet.globals || '';
  let setupSnippet = snippet.setup || '';
  let loopSnippet = snippet.loop || '';

  // ── Multi-Bus Renaming Layer ──
  const isI2cBus1 = reasoning.some(r => r.includes('I2C') && r.includes('Bus 1'));
  const isUartBus1 = reasoning.some(r => r.includes('UART') && r.includes('Bus 1'));

  if (isI2cBus1) {
    globalsSnippet = globalsSnippet.replace(/\bWire\./g, 'Wire1.');
    setupSnippet = setupSnippet.replace(/\bWire\./g, 'Wire1.');
    loopSnippet = loopSnippet.replace(/\bWire\./g, 'Wire1.');
  }
  if (isUartBus1) {
    globalsSnippet = globalsSnippet.replace(/\bSerial\./g, 'Serial1.');
    setupSnippet = setupSnippet.replace(/\bSerial\./g, 'Serial1.');
    loopSnippet = loopSnippet.replace(/\bSerial\./g, 'Serial1.');
  }

  if (!code || !code.trim()) {
    let base = '';
    if (globalsSnippet) base += `// autocoding for ${compId} start\n${globalsSnippet}\n// autocoding for ${compId} end\n\n`;
    base += `void setup() {\n`;
    if (setupSnippet) base += `  // autocoding for ${compId} start\n  ${setupSnippet.split('\n').join('\n  ')}\n  // autocoding for ${compId} end\n`;
    base += `}\n\nvoid loop() {\n`;
    if (loopSnippet) base += `  // autocoding for ${compId} start\n  ${loopSnippet.split('\n').join('\n  ')}\n  // autocoding for ${compId} end\n`;
    base += `}\n`;
    return base;
  }

  // 1. Inject Globals at the very top (before setup/loop)
  if (globalsSnippet) {
    const block = `// autocoding for ${compId} start\n${globalsSnippet}\n// autocoding for ${compId} end\n\n`;
    const setupIdx = code.indexOf('void setup');
    const loopIdx = code.indexOf('void loop');
    const insertIdx = [setupIdx, loopIdx].filter(i => i !== -1).sort((a, b) => a - b)[0] ?? 0;
    code = code.slice(0, insertIdx) + block + code.slice(insertIdx);
  }

  // Helper for injecting into function blocks
  const injectIntoFunction = (src, funcName, snippet) => {
    if (!snippet) return src;
    const marker = `${funcName}() {`;
    const idx = src.indexOf(marker);
    const block = `  // autocoding for ${compId} start\n  ${snippet.split('\n').join('\n  ')}\n  // autocoding for ${compId} end\n`;

    if (idx !== -1) {
      // Inject at the top of the function block
      return src.slice(0, idx + marker.length) + '\n' + block + src.slice(idx + marker.length);
    }
    // Fallback: append function if missing
    return src + `\n\n${funcName}() {\n${block}}\n`;
  };

  code = injectIntoFunction(code, 'void setup', setupSnippet);
  code = injectIntoFunction(code, 'void loop', loopSnippet);

  return code;
}

export function removeCodeSnippet(currentCode, compId) {
  if (!currentCode || !compId) return currentCode;
  // Match `// autocoding for {compId} start` ... `// autocoding for {compId} end` and any surrounding newlines
  const regex = new RegExp(`[ \\t]*\\/\\/\\s*autocoding for ${compId} start[\\s\\S]*?\\/\\/\\s*autocoding for ${compId} end\\s*\\n?`, 'g');
  return currentCode.replace(regex, '');
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
  const bbTypes = ['wokwi-breadboard', 'wokwi-breadboard-half', 'wokwi-breadboard-mini', 'openhw-breadboard', 'openhw-breadboard-half', 'openhw-breadboard-mini'];
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
        if (c.id === bb.id || c.type?.startsWith('wokwi-breadboard') || c.type?.startsWith('openhw-breadboard')) return false;
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
  updatedComponents.push({ id: pu_sda_id, type: 'openhw-resistor', label: '4.7k', x: pos1.x, y: pos1.y, w: 70, h: 32, attrs: { value: '4700' } });
  const pos2 = findFreeHelperPosition(baseX + 90, baseY, 70, 32, [...allComps, { ...pos1, w: 70, h: 32 }]);
  updatedComponents.push({ id: pu_scl_id, type: 'openhw-resistor', label: '4.7k', x: pos2.x, y: pos2.y, w: 70, h: 32, attrs: { value: '4700' } });

  updatedWires.push({ id: `w_pu_sda_in_${Date.now()}`,  from: `${compId}:SDA`, to: `${pu_sda_id}:p1`, color: '#38bdf8', isSocket: true, isHidden: true });
  updatedWires.push({ id: `w_pu_sda_out_${Date.now()}`, from: `${pu_sda_id}:p2`, to: vccRailSda, color: 'red' });
  updatedWires.push({ id: `w_pu_scl_in_${Date.now()}`,  from: `${compId}:SCL`, to: `${pu_scl_id}:p1`, color: '#38bdf8', isSocket: true, isHidden: true });
  updatedWires.push({ id: `w_pu_scl_out_${Date.now()}`, from: `${pu_scl_id}:p2`, to: vccRailScl, color: 'red' });

  if (!updatedWires.some(w => w.to === vccRailSda || w.from === vccRailSda))
    updatedWires.push({ id: `w_i2c_vcc_${Date.now()}`, from: `${boardId}:3V3`, to: vccRailSda, color: 'red' });
}
*/
export function getDefaultMainFileName(boardKind, boardId, options = {}) {
  if (boardKind === 'rp2040') {
    const rp2040Mode = hardwareUtils.normalizeRp2040Env(options?.rp2040Mode || 'native');
    if (hardwareUtils.isRp2040PythonEnv(rp2040Mode)) {
      return hardwareUtils.getRp2040PythonEntryFileName(rp2040Mode);
    }
    return `${boardId}.ino`;
  }
  return `${boardId}.ino`;
}

export function toBoardRelativePath(boardId, fullPath) {
  const prefix = `project/${boardId}/`;
  const raw = String(fullPath || '').replace(/\\/g, '/');
  if (!raw.startsWith(prefix)) {
    return String(raw.split('/').pop() || '').trim();
  }

  const relative = raw.slice(prefix.length).trim();
  const parts = relative
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part && part !== '.' && part !== '..');
  return parts.join('/');
}

export function normalizeOpenCodeTabs(tabs, projectFiles) {
  const list = Array.isArray(tabs) ? tabs : [];
  const fileIds = new Set((projectFiles || []).map((f) => f.id));
  const seen = new Set();
  const out = [];

  list.forEach((tabId) => {
    const id = String(tabId || '').trim();
    if (!id || seen.has(id) || !fileIds.has(id)) return;
    seen.add(id);
    out.push(id);
  });

  return out;
}

export function buildProjectPayload({
  name = '',
  board = 'arduino_uno',
  components = [],
  wires = [],
  code = '',
  includeCode = true,
  blocklyXml = '',
  blocklyGeneratedCode = '',
  useBlocklyCode = false,
  projectFiles = [],
  openCodeTabs = [],
  activeCodeFileId = '',
  exportedAt = ''
} = {}) {
  const componentsArray = Array.isArray(components) ? components : [];
  const detectedBoardComponent = componentsArray.find((component) => hardwareUtils.isProgrammableBoardType(component?.type));
  const resolvedBoard = detectedBoardComponent?.type || String(board || 'arduino_uno');

  const normalizedFiles = normalizeProjectFiles(projectFiles)
    .filter((file) => file.id !== 'project/diagram.json')
    .map((file) => ({
      ...file,
      content: typeof file.content === 'string' ? file.content : String(file.content ?? ''),
    }));
  const normalizedTabs = normalizeOpenCodeTabs(openCodeTabs, normalizedFiles);
  const preferredActive = String(activeCodeFileId || '').trim();
  const resolvedActiveId = normalizedFiles.some((file) => file.id === preferredActive)
    ? preferredActive
    : (normalizedTabs[0] || normalizedFiles[0]?.id || '');

  const payload = {
    schemaVersion: 'openhw-project-v2',
    board: resolvedBoard,
    components: componentsArray.map((component) => {
      const isSnapped = (Array.isArray(wires) ? wires : []).some(w => w.isSocket && (w.from.startsWith(component.id + ':') || w.to.startsWith(component.id + ':')));
      return {
        id: String(component?.id || ''),
        type: String(component?.type || ''),
        label: String(component?.label || ''),
        x: Number(component?.x ?? 0),
        y: Number(component?.y ?? 0),
        w: Number(component?.w ?? 0),
        h: Number(component?.h ?? 0),
        rotation: Number(component?.rotation ?? 0),
        attrs: component?.attrs && typeof component.attrs === 'object' ? component.attrs : {},
        snap: isSnapped || undefined,
      };
    }),
    connections: (Array.isArray(wires) ? wires : []).map((wire) => {
      const conn = {
        id: String(wire?.id || ''),
        from: String(wire?.from || ''),
        to: String(wire?.to || ''),
        color: String(wire?.color || ''),
        waypoints: Array.isArray(wire?.waypoints) ? wire.waypoints : [],
        isBelow: wire?.isBelow === true,
        isSocket: wire?.isSocket === true,
        isHidden: wire?.isHidden === true,
        isHelp: wire?.isHelp === true,
        fromLabel: String(wire?.fromLabel || ''),
        toLabel: String(wire?.toLabel || ''),
      };
      if (Array.isArray(wire?.routingInstructions) && wire.routingInstructions.length > 0) {
        conn.routingInstructions = wire.routingInstructions;
      }
      return conn;
    }),
    blocklyXml: String(blocklyXml || ''),
    blocklyGeneratedCode: String(blocklyGeneratedCode || ''),
    useBlocklyCode: !!useBlocklyCode,
    projectFiles: normalizedFiles,
    openCodeTabs: normalizedTabs,
    activeCodeFileId: resolvedActiveId,
  };

  if (includeCode) {
    payload.code = String(code || '');
  }

  if (name) payload.name = String(name);
  if (exportedAt) payload.exportedAt = String(exportedAt);
  return payload;
}

export function normalizeImportedCircuitData(rawComponents, rawConnections) {
  const componentsInput = Array.isArray(rawComponents) ? rawComponents : [];
  const wiresInput = Array.isArray(rawConnections) ? rawConnections : [];

  const usedComponentIds = new Set();
  let layoutSlot = 0;

  const normalizedComponents = componentsInput
    .map((component) => {
      if (!component || typeof component !== 'object') return null;
      let type = String(component.type || '').trim();
      if (!type) return null;
      let icModel = null;
      if (type.startsWith('wokwi-74hc')) {
        icModel = '74' + type.replace('wokwi-74hc', '');
        type = 'logic-ic-74xx';
      } else if (type.startsWith('wokwi-74lvc')) {
        icModel = '74' + type.replace('wokwi-74lvc', '');
        type = 'logic-ic-74xx';
      } else if (type === 'wokwi-raspberry-pi-pico') type = 'openhw-pico';
      else if (type === 'wokwi-raspberry-pi-pico-w') type = 'openhw-pico-w';
      else if (type === 'wokwi-pushbutton-6mm') type = 'openhw-pushbutton';
      else if (type === 'wokwi-ky-040') type = 'openhw-rotary-encoder';
      else if (type === 'wokwi-bmp180' || type === 'wokwi-bmp280') type = 'openhw-bmp180-breakout';
      else if (type === 'wokwi-ds1307' || type === 'wokwi-ds3231' || type === 'wokwi-ds1307-rtc') type = 'openhw-ds1307-rtc';
      else if (type === 'wokwi-microsd-card' || type === 'wokwi-sd-card') type = 'openhw-sd-card';
      else if (type.startsWith('wokwi-')) type = type.replace('wokwi-', 'openhw-');
      if (type === 'wokwi-arduino-uno') type = 'openhw-arduino-uno';
      if (type === 'wokwi-arduino-mega') type = 'openhw-arduino-mega';
      if (type === 'wokwi-arduino-nano') type = 'openhw-arduino-nano';
      if (type === 'wokwi-attiny85') type = 'openhw-attiny85';
      if (type === 'wokwi-led') type = 'openhw-led';
      if (type === 'wokwi-resistor') type = 'openhw-resistor';
      if (type === 'wokwi-pushbutton') type = 'openhw-pushbutton';
      if (type === 'wokwi-potentiometer') type = 'openhw-potentiometer';
      if (type === 'wokwi-slide-potentiometer') type = 'openhw-slide-potentiometer';
      if (type === 'wokwi-buzzer') type = 'openhw-buzzer';
      if (type === 'wokwi-motor') type = 'openhw-motor';
      if (type === 'wokwi-motor-driver') type = 'openhw-motor-driver';
      if (type === 'wokwi-diode') type = 'openhw-diode';
      if (type === 'wokwi-npn-transistor') type = 'openhw-npn-transistor';
      if (type === 'wokwi-photodiode') type = 'openhw-photodiode';
      if (type === 'wokwi-photoresistor') type = 'openhw-photoresistor';
      if (type === 'wokwi-ntc-thermistor') type = 'openhw-ntc-thermistor';
      if (type === 'wokwi-ntc-temperature-sensor') type = 'openhw-ntc-temperature-sensor';
      if (type === 'wokwi-power-supply') type = 'openhw-power-supply';
      if (type === 'wokwi-battery') type = 'openhw-battery';
      if (type === 'wokwi-charger') type = 'openhw-charger';
      if (type === 'wokwi-breadboard') type = 'openhw-breadboard';
      if (type === 'wokwi-breadboard-half') type = 'openhw-breadboard-half';
      if (type === 'wokwi-breadboard-mini') type = 'openhw-breadboard-mini';
      if (type === 'wokwi-neopixel-matrix') type = 'openhw-neopixel-matrix';
      if (type === 'wokwi-neopixel-ring') type = 'openhw-neopixel-ring';
      if (type === 'wokwi-arduino-sensor-shield') type = 'openhw-arduino-sensor-shield';

      // Phase 1-3 components
      if (type === 'wokwi-analog-joystick') type = 'openhw-analog-joystick';
      if (type === 'wokwi-membrane-keypad') type = 'openhw-membrane-keypad';
      if (type === 'wokwi-rotary-encoder') type = 'openhw-rotary-encoder';
      if (type === 'wokwi-rgb-led') type = 'openhw-rgb-led';
      if (type === 'wokwi-nokia-5110') type = 'openhw-nokia-5110';
      if (type === 'wokwi-soil-moisture-sensor') type = 'openhw-soil-moisture-sensor';
      if (type === 'wokwi-logic-analyzer') type = 'openhw-logic-analyzer';
      if (type === 'wokwi-sd-card') type = 'openhw-sd-card';
      if (type === 'wokwi-ldr-module') type = 'openhw-ldr-module';
      if (type === 'wokwi-tm1637-7segment') type = 'openhw-tm1637-7segment';
      if (type === 'wokwi-cd74hc4067') type = 'openhw-cd74hc4067';
      if (type === 'wokwi-7segment') type = 'openhw-7segment';
      if (type === 'wokwi-a4988') type = 'openhw-a4988';
      if (type === 'wokwi-bmp180') type = 'openhw-bmp180';
      if (type === 'wokwi-bmp180-breakout') type = 'openhw-bmp180-breakout';
      if (type === 'wokwi-ds1307-rtc') type = 'openhw-ds1307-rtc';
      if (type === 'wokwi-hc-sr04') type = 'openhw-hc-sr04';
      if (type === 'wokwi-ili9341') type = 'openhw-ili9341';
      if (type === 'wokwi-l293d') type = 'openhw-l293d';
      if (type === 'wokwi-lcd1602-i2c') type = 'openhw-lcd1602-i2c';
      if (type === 'wokwi-lcd2004-i2c') type = 'openhw-lcd2004-i2c';
      if (type === 'wokwi-max7219') type = 'openhw-max7219';
      if (type === 'wokwi-mpu6050') type = 'openhw-mpu6050';
      if (type === 'wokwi-nlsf595') type = 'openhw-nlsf595';
      if (type === 'wokwi-pca9685') type = 'openhw-pca9685';
      if (type === 'wokwi-pca9865') type = 'openhw-pca9865';
      if (type === 'wokwi-relay-module') type = 'openhw-relay-module';
      if (type === 'wokwi-servo') type = 'openhw-servo';
      if (type === 'wokwi-ssd1306-oled') type = 'openhw-ssd1306-oled';
      if (type === 'wokwi-stepper-motor') type = 'openhw-stepper-motor';
      if (type === 'wokwi-ds18b20') type = 'openhw-ds18b20';
      if (type === 'wokwi-ir-receiver') type = 'openhw-ir-receiver';
      if (type === 'wokwi-mfrc522') type = 'openhw-mfrc522';

      const regManifest = COMPONENT_REGISTRY[type]?.manifest || {};

      const rawId = String(component.id || '').trim();
      const id = rawId && !usedComponentIds.has(rawId)
        ? (usedComponentIds.add(rawId), rawId)
        : allocateComponentId(type, usedComponentIds);

      const defaultW = Number(regManifest.w ?? 80);
      const defaultH = Number(regManifest.h ?? 60);
      const width = Number(component.w);
      const height = Number(component.h);

      const hasX = Number.isFinite(Number(component.x));
      const hasY = Number.isFinite(Number(component.y));
      let x = Number(component.x);
      let y = Number(component.y);
      if (!hasX || !hasY) {
        const col = layoutSlot % 4;
        const row = Math.floor(layoutSlot / 4);
        x = 120 + col * 220;
        y = 80 + row * 170;
        layoutSlot += 1;
      }

      const attrs = component.attrs && typeof component.attrs === 'object'
        ? { ...component.attrs }
        : {};
      if (icModel) {
        attrs.icType = icModel;
      }
      if (hardwareUtils.normalizeBoardKind(type) === 'rp2040') {
        attrs.env = hardwareUtils.normalizeRp2040Env(hardwareUtils.resolveComponentAttrString(attrs, 'env', 'native'));
      }

      return {
        ...component,
        id,
        type,
        label: String(component.label || regManifest.label || type),
        x,
        y,
        w: Number.isFinite(width) && width > 0
          ? width
          : (Number.isFinite(defaultW) && defaultW > 0 ? defaultW : 80),
        h: Number.isFinite(height) && height > 0
          ? height
          : (Number.isFinite(defaultH) && defaultH > 0 ? defaultH : 60),
        rotation: Number.isFinite(Number(component.rotation))
          ? ((Number(component.rotation) % 360) + 360) % 360
          : 0,
        attrs,
      };
    })
    .filter(Boolean);

  const endpointLabel = (endpoint) => {
    const parts = String(endpoint || '').split(':');
    return parts.length > 1 ? parts.slice(1).join(':') : '';
  };

  const normalizeWaypoint = (point) => {
    if (Array.isArray(point)) {
      const x = Number(point[0]);
      const y = Number(point[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { x, y };
    }
    if (!point || typeof point !== 'object') return null;
    const x = Number(point.x);
    const y = Number(point.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y, ...(point._corner ? { _corner: true } : {}) };
  };

  const usedWireIds = new Set();
  const allocateWireId = () => {
    let idx = 1;
    let candidate = `w${idx}`;
    while (usedWireIds.has(candidate)) {
      idx += 1;
      candidate = `w${idx}`;
    }
    usedWireIds.add(candidate);
    return candidate;
  };

  const normalizedWires = wiresInput
    .map((wire) => {
      if (!wire || typeof wire !== 'object') return null;
      const mapWokwiPin = (endpoint) => {
        if (!endpoint) return endpoint;
        const idx = endpoint.indexOf(':');
        if (idx === -1) return endpoint;
        const compId = endpoint.slice(0, idx);
        let pinId = endpoint.slice(idx + 1);

        const comp = normalizedComponents.find(c => c.id === compId);
        if (comp) {
          const type = comp.type;

          if (type === 'openhw-arduino-uno') {
            if (pinId === 'GND.1') pinId = 'gnd_1';
            else if (pinId === 'GND.2') pinId = 'gnd_2';
            else if (pinId === 'GND.3') pinId = 'gnd_3';
            else if (pinId === '3.3V') pinId = '3v3';
            else if (pinId.toUpperCase() === 'VIN') pinId = 'vin';
            else if (pinId.toUpperCase() === 'RESET') pinId = 'rst';
          } else if (type === 'openhw-pico' || type === 'openhw-pico-w') {
            if (pinId === 'GND.1') pinId = 'GND';
            else if (pinId === 'GND.2') pinId = 'GND_1';
            else if (pinId === 'GND.3') pinId = 'GND_2';
            else if (pinId === 'GND.4') pinId = 'GND_3';
            else if (pinId === 'GND.5') pinId = 'GND_4';
            else if (pinId === 'GND.6') pinId = 'GND_5';
            else if (pinId === 'GND.7') pinId = 'GND_6';
            else if (pinId === 'GND.8') pinId = 'GND_6';
          } else if (type === 'openhw-resistor' || type === 'openhw-photoresistor') {
            if (pinId === '1') pinId = 'p1';
            else if (pinId === '2') pinId = 'p2';
          } else if (type === 'openhw-potentiometer') {
            if (pinId === 'GND' || pinId === '1') pinId = '1';
            else if (pinId === 'VCC' || pinId === '3') pinId = '2';
            else if (pinId === 'SIG' || pinId === '2') pinId = 'SIG';
          } else if (type === 'openhw-slide-potentiometer') {
            if (pinId === 'OUT') pinId = 'SIG';
          } else if (type === 'openhw-pushbutton') {
            if (pinId === '1.l') pinId = '1l';
            else if (pinId === '2.l') pinId = '2l';
            else if (pinId === '1.r') pinId = '1r';
            else if (pinId === '2.r') pinId = '2r';
          } else if (type === 'openhw-ldr-module') {
            if (pinId === 'A0') pinId = 'AO';
            else if (pinId === 'D0') pinId = 'DO';
          } else if (type === 'openhw-servo') {
            if (pinId === 'SIG' || pinId === '1') pinId = 'PWM';
          } else if (type === 'openhw-soil-moisture-sensor') {
            if (pinId === 'AO' || pinId === 'A0') pinId = 'SIG';
          } else if (type === 'openhw-bmp180-breakout') {
            if (pinId === 'VCC') pinId = 'VIN';
          } else if (type === 'openhw-buzzer') {
            if (pinId === '1') pinId = 'GND';
            else if (pinId === '2') pinId = 'SIG';
          } else if (type === 'openhw-led') {
            if (pinId.toUpperCase() === 'C') pinId = 'K';
          } else if (type === 'openhw-rgb-led') {
            if (pinId.toUpperCase() === 'C') pinId = 'COM';
          } else if (type === 'openhw-analog-joystick') {
            if (pinId === 'VCC') pinId = '5V';
            else if (pinId === 'VERT') pinId = 'VRX';
            else if (pinId === 'HORZ') pinId = 'VRY';
            else if (pinId === 'SEL') pinId = 'SW';
          } else if (type === 'openhw-mpu6050') {
            if (pinId === 'AD0') pinId = 'ADO';
          } else if (type === 'openhw-a4988') {
            if (pinId === 'GND.1') pinId = 'GND_MOT';
            else if (pinId === 'GND.2') pinId = 'GND_LOGIC';
          } else if (type === 'openhw-l293d') {
            if (pinId === '1,2EN') pinId = 'EN1,2';
            else if (pinId === '3,4EN') pinId = 'EN3,4';
            else if (pinId === '1A') pinId = 'IN1';
            else if (pinId === '2A') pinId = 'IN2';
            else if (pinId === '3A') pinId = 'IN3';
            else if (pinId === '4A') pinId = 'IN4';
            else if (pinId === '1Y') pinId = 'OUT1';
            else if (pinId === '2Y') pinId = 'OUT2';
            else if (pinId === '3Y') pinId = 'OUT3';
            else if (pinId === '4Y') pinId = 'OUT4';
            else if (pinId === 'GND.1') pinId = 'GND1';
            else if (pinId === 'GND.2') pinId = 'GND2';
            else if (pinId === 'GND.3') pinId = 'GND3';
            else if (pinId === 'GND.4') pinId = 'GND4';
          } else if (type === 'openhw-lcd1602') {
            if (pinId === 'LED+') pinId = 'A';
            else if (pinId === 'LED-') pinId = 'K';
          } else if (type === 'openhw-neopixel-ring') {
            if (pinId === 'VDD') pinId = 'VCC';
            else if (pinId === 'VSS') pinId = 'GND';
            else if (pinId === 'IN') pinId = 'DIN';
            else if (pinId === 'OUT') pinId = 'DOUT';
          } else if (type === 'openhw-neopixel-matrix') {
            if (pinId === 'VDD') pinId = 'VCC';
            else if (pinId === 'VSS') pinId = 'GND';
            else if (pinId === 'DI') pinId = 'DIN';
            else if (pinId === 'DO') pinId = 'DOUT';
          } else if (type === 'openhw-attiny85') {
            if (pinId === 'PB5') pinId = 'P5';
            else if (pinId === 'PB4') pinId = 'P4';
            else if (pinId === 'PB3') pinId = 'P3';
            else if (pinId === 'PB2') pinId = 'P2';
            else if (pinId === 'PB1') pinId = 'P1';
            else if (pinId === 'PB0') pinId = 'P0';
            else if (pinId === 'VCC') pinId = '5V';
          } else if (type === 'openhw-nokia-5110') {
            if (pinId === 'D/C') pinId = 'DC';
            else if (pinId === 'SDIN') pinId = 'DN';
          } else if (type === 'openhw-cd74hc4067') {
            if (pinId.startsWith('I')) {
              const num = parseInt(pinId.slice(1), 10);
              if (num >= 0 && num <= 15) {
                pinId = `C${num}`;
              }
            }
          } else if (type === 'openhw-7segment') {
            pinId = pinId.toUpperCase();
            if (pinId === 'COM.1' || pinId === 'COM.2') {
              pinId = 'DIG1';
            }
          } else if (type === 'openhw-max7219') {
            if (pinId === 'LOAD') pinId = 'CS';
          } else if (type === 'openhw-pca9685' || type === 'openhw-pca9865') {
            if (pinId === 'VCC') pinId = '3.3V';
            else if (pinId === 'V+') pinId = 'VCC_IN';
            else if (pinId.startsWith('PWM')) {
              const num = parseInt(pinId.slice(3), 10);
              if (num >= 0 && num <= 15) pinId = `S${num}`;
            } else if (pinId.startsWith('VCC') && pinId !== 'VCC_IN') {
              const num = parseInt(pinId.slice(3), 10);
              if (num >= 0 && num <= 15) pinId = `V+${num}`;
            } else if (pinId.startsWith('GND') && pinId !== 'GND_IN' && pinId !== 'GND') {
              const num = parseInt(pinId.slice(3), 10);
              if (num >= 0 && num <= 15) pinId = `G${num}`;
            }
          } else if (type === 'openhw-ntc-temperature-sensor') {
            if (pinId === '1') pinId = 'p1';
            else if (pinId === '2') pinId = 'p2';
          } else if (type === 'logic-ic-74xx') {
            const num = parseInt(pinId, 10);
            if (num >= 1 && num <= 14) {
              pinId = `p${num}`;
            }
          }
        }

        return `${compId}:${pinId}`;
      };

      const from = mapWokwiPin(String(wire.from || '').trim());
      const to = mapWokwiPin(String(wire.to || '').trim());
      if (!from || !to) return null;

      const rawWireId = String(wire.id || '').trim();
      const id = rawWireId && !usedWireIds.has(rawWireId)
        ? (usedWireIds.add(rawWireId), rawWireId)
        : allocateWireId();

      return {
        ...wire,
        id,
        from,
        to,
        color: typeof wire.color === 'string' && wire.color.trim() ? wire.color : wireColor(),
        routingInstructions: Array.isArray(wire.routingInstructions)
          ? wire.routingInstructions.filter(i => typeof i === 'string')
          : [],
        waypoints: Array.isArray(wire.waypoints)
          ? wire.waypoints.map(normalizeWaypoint).filter(Boolean)
          : [],
        isBelow: wire.isBelow === true,
        isSocket: wire.isSocket === true,
        isHidden: wire.isHidden === true,
        isHelp: wire.isHelp === true,
        fromLabel: String(wire.fromLabel || endpointLabel(from) || ''),
        toLabel: String(wire.toLabel || endpointLabel(to) || ''),
      };
    })
    .filter(Boolean);

  return { components: normalizedComponents, wires: normalizedWires };
}

export function parseWokwiDiagramJson(wokwiJson) {
  if (!wokwiJson || typeof wokwiJson !== 'object') return { components: [], wires: [] };

  const parts = Array.isArray(wokwiJson.parts) ? wokwiJson.parts : (Array.isArray(wokwiJson.components) ? wokwiJson.components : []);
  const connections = Array.isArray(wokwiJson.connections) ? wokwiJson.connections : (Array.isArray(wokwiJson.wires) ? wokwiJson.wires : []);

  const components = parts.map(p => {
    if (!p || typeof p !== 'object') return null;
    let type = String(p.type || '').trim();
    if (type === 'wokwi-raspberry-pi-pico') type = 'openhw-pico';
    else if (type === 'wokwi-raspberry-pi-pico-w') type = 'openhw-pico-w';
    else if (type.startsWith('wokwi-')) type = type.replace('wokwi-', 'openhw-');

    // Map left/top to x/y if x/y are missing, and scale by 1.5x for OpenHW grid matching
    const rawX = p.x !== undefined ? p.x : (p.left !== undefined ? p.left : 0);
    const rawY = p.y !== undefined ? p.y : (p.top !== undefined ? p.top : 0);
    const x = Number(rawX) * 1.5;
    const y = Number(rawY) * 1.5;

    return { ...p, type, x, y };
  }).filter(Boolean);

  const wires = connections.map((c, idx) => {
    if (!c) return null;
    if (Array.isArray(c)) {
      const [from = '', to = '', color = 'green', rawInstructions = []] = c;
      const instructions = Array.isArray(rawInstructions) ? rawInstructions : [];

      // Parse precise instruction waypoints into simple x/y relative diffs:
      // Note: "v10" means deltaY=10. "h-5" means deltaX=-5.
      // "*" usually denotes "auto-route here" or dynamic routing. We preserve as strings for exact parser.
      const waypoints = [];
      const extractedInstructions = [];
      for (const inst of instructions) {
        if (typeof inst !== 'string') continue;
        extractedInstructions.push(inst);
      }

      return {
        id: `w_wokwi_${idx}`,
        from: String(from).replace(/:(\d)\.([lr])$/i, ':$1$2'),
        to: String(to).replace(/:(\d)\.([lr])$/i, ':$1$2'),
        color: String(color),
        routingInstructions: extractedInstructions,
        waypoints: [], // Rely on instructions instead of precalculated absolute waypoints
        isBelow: false,
        isSocket: false,
        isHidden: false,
        isHelp: false,
        fromLabel: '',
        toLabel: '',
      };
    }
    if (typeof c === 'object') {
      const waypoints = Array.isArray(c.waypoints) ? c.waypoints.map(wp => {
        if (Array.isArray(wp)) return { x: Number(wp[0]) * 1.5, y: Number(wp[1]) * 1.5 };
        if (wp && typeof wp === 'object') return { ...wp, x: Number(wp.x) * 1.5, y: Number(wp.y) * 1.5 };
        return wp;
      }) : [];
      return {
        ...c,
        id: c.id || `w_wokwi_${idx}`,
        from: String(c.from || '').replace(/:(\d)\.([lr])$/i, ':$1$2'),
        to: String(c.to || '').replace(/:(\d)\.([lr])$/i, ':$1$2'),
        waypoints,
      };
    }
    return null;
  }).filter(Boolean);

  return { components, wires };
}
