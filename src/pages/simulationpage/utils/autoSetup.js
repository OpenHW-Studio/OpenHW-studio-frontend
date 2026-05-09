/**
 * autoSetup.js v2.0
 * Enhanced auto-setup engine with:
 *  - Footprint-aware breadboard row allocation
 *  - Correct power rail IDs (top_gnd_N / top_vcc_N, clamped to 1-25)
 *  - Analog pin support (A0-A5) in findAlternativePin
 *  - Orphaned-pin detection + auto-connect
 *  - I2C pull-up resistor injection (4.7kΩ on SDA + SCL)
 *  - Helper component collision avoidance (shift until clear)
 *  - Code snippet deduplication
 */

const HOLE_PITCH = 15;
const RAIL_MAX   = 25;  // top_gnd_1 … top_gnd_25

// ─── Rotation helper ─────────────────────────────────────────────────────────
export function getRotatedPoint(x, y, rotation, originX, originY) {
  if (!rotation) return { x, y };
  const rad = (rotation * Math.PI) / 180;
  const dx = x - originX, dy = y - originY;
  return {
    x: originX + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: originY + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

// ─── Nearest breadboard hole ──────────────────────────────────────────────────
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

// ─── World pins for a component ───────────────────────────────────────────────
export function getComponentWorldPins(comp, pins) {
  const rot = comp.rotation || 0;
  const cx = comp.x + (comp.w || 0) / 2, cy = comp.y + (comp.h || 0) / 2;
  return (pins || []).map(pin => {
    const w = getRotatedPoint(comp.x + pin.x, comp.y + pin.y, rot, cx, cy);
    return { ...pin, worldX: w.x, worldY: w.y };
  });
}

// ─── Robust snap (returns socket wires + snapMatches) ────────────────────────
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

// ─── Find or add a breadboard ─────────────────────────────────────────────────
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

// ─── Free power-rail hole (top_gnd_N or top_vcc_N) ───────────────────────────
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

// ─── Alternative board-pin resolver (digital + analog + named) ───────────────
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

  // Numeric digital pins
  if (!isNaN(pinNum)) {
    for (let i = 1; i <= 20; i++) {
      for (const cand of [String(pinNum + i), String(pinNum - i)]) {
        if (Number(cand) >= 0 && pins.some(p => p.id === cand) && !occupied(cand))
          return `${boardId}:${cand}`;
      }
    }
  }
  // Analog pins
  for (const ap of ['A0','A1','A2','A3','A4','A5']) {
    if (pins.some(p => p.id === ap) && !occupied(ap))
      return `${boardId}:${ap}`;
  }
  return targetPin;
}

// ─── Footprint-aware free-row finder ─────────────────────────────────────────
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

// ─── Collision check for helper components ────────────────────────────────────
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

// ─── Unconnected pin detector ─────────────────────────────────────────────────
export function getUnconnectedPins(comp, compPins, wires) {
  return (compPins || []).filter(pin => {
    const nc = `${comp.id}:${pin.id}`, nd = `${comp.id}.${pin.id}`;
    return !wires.some(w => w.from === nc || w.to === nc || w.from === nd || w.to === nd);
  });
}

// ─── Auto-connect floating pins ───────────────────────────────────────────────
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

// ─── Code snippet merge with deduplication ────────────────────────────────────
export function mergeCodeSnippet(currentCode, snippet) {
  if (!snippet) return currentCode;
  if (!currentCode || !currentCode.trim())
    return `void setup() {\n  ${(snippet.setup || '').split('\n').join('\n  ')}\n}\n\nvoid loop() {\n  ${(snippet.loop || '').split('\n').join('\n  ')}\n}`;

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

  if (snippet.setup) {
    const lines = snippet.setup.split('\n').map(l => l.trim()).filter(Boolean);
    code = injectIntoBlock(code, 'void setup', lines);
  }
  if (snippet.loop) {
    const lines = snippet.loop.split('\n').map(l => l.trim()).filter(Boolean);
    code = injectIntoBlock(code, 'void loop', lines);
  }
  return code;
}

// ─── I2C pull-up injector ─────────────────────────────────────────────────────
function injectI2cPullups(compId, bb, boardId, updatedComponents, updatedWires, pinDefs) {
  const allComps = updatedComponents;
  const vccRailSda = findFreePowerRail(bb, updatedWires, pinDefs, 'vcc', 8);
  const vccRailScl = findFreePowerRail(bb, updatedWires, pinDefs, 'vcc', 10);

  const pu_sda_id = `pu_sda_${compId}_${Date.now()}`;
  const pu_scl_id = `pu_scl_${compId}_${Date.now() + 1}`;
  const bbComp    = allComps.find(c => c.id === bb.id);
  const baseX     = bbComp ? bbComp.x + 30 : 200;
  const baseY     = bbComp ? bbComp.y - 50 : 100;

  const pos1 = findFreeHelperPosition(baseX,        baseY, 70, 32, allComps);
  updatedComponents.push({ id: pu_sda_id, type: 'wokwi-resistor', label: '4.7k',
                            x: pos1.x, y: pos1.y, w: 70, h: 32, attrs: { value: '4700' } });
  const pos2 = findFreeHelperPosition(baseX + 90,   baseY, 70, 32, [...allComps, { ...pos1, w: 70, h: 32 }]);
  updatedComponents.push({ id: pu_scl_id, type: 'wokwi-resistor', label: '4.7k',
                            x: pos2.x, y: pos2.y, w: 70, h: 32, attrs: { value: '4700' } });

  // SDA pull-up: SDA → pu_sda:p1, pu_sda:p2 → VCC rail → board 3V3
  updatedWires.push({ id: `w_pu_sda_in_${Date.now()}`,  from: `${compId}:SDA`,  to: `${pu_sda_id}:p1`, color: '#38bdf8', isSocket: true, isHidden: true });
  updatedWires.push({ id: `w_pu_sda_out_${Date.now()}`, from: `${pu_sda_id}:p2`, to: vccRailSda, color: 'red' });

  // SCL pull-up: SCL → pu_scl:p1, pu_scl:p2 → VCC rail
  updatedWires.push({ id: `w_pu_scl_in_${Date.now()}`,  from: `${compId}:SCL`,  to: `${pu_scl_id}:p1`, color: '#38bdf8', isSocket: true, isHidden: true });
  updatedWires.push({ id: `w_pu_scl_out_${Date.now()}`, from: `${pu_scl_id}:p2`, to: vccRailScl, color: 'red' });

  // Board 3V3 / 5V to VCC rail (if not already done)
  if (!updatedWires.some(w => w.to === vccRailSda || w.from === vccRailSda))
    updatedWires.push({ id: `w_i2c_vcc_${Date.now()}`, from: `${boardId}:3V3`, to: vccRailSda, color: 'red' });
}

// ─── Main entry point ─────────────────────────────────────────────────────────
export function handleAutoSetup({
  newComp, components, wires, code, catalogItem, pinDefs, boardId,
  options = { autoWiring: true, autoCoding: true }
}) {
  let updatedComponents = [...components];
  let updatedWires      = [...wires];
  let updatedCode       = code;
  let finalComp         = { ...newComp };

  const manifest = catalogItem?.manifest || catalogItem || {};
  const { autocoding, autowiring } = manifest;
  const compPins = pinDefs[finalComp.type] || manifest.pins || [];

  // ── 1. Auto-wiring ──────────────────────────────────────────────────────────
  if (options.autoWiring && autowiring?.connections) {
    const bbRes = findOrAddBreadboard(updatedComponents, { x: newComp.x, y: newComp.y }, updatedComponents.length);
    updatedComponents = bbRes.components;
    const bb    = bbRes.breadboard;
    const bbPins = pinDefs[bb.type] || [];

    // Board → breadboard power rails (once per session)
    const hasPwr = updatedWires.some(w =>
      w.id?.includes('bb_pwr') &&
      (w.from.startsWith(boardId) || w.to.startsWith(boardId)) &&
      (w.from.startsWith(bb.id)  || w.to.startsWith(bb.id))
    );
    if (boardId && !hasPwr) {
      const boardPinList = pinDefs[updatedComponents.find(c => c.id === boardId)?.type] || [];
      const gndPin = boardPinList.find(p => /gnd/i.test(p.id))?.id || 'GND';
      const vccPin = boardPinList.find(p => p.id === '5V' || p.id === '3V3' || p.id === 'VCC')?.id || '5V';
      const gndRail = findFreePowerRail(bb, updatedWires, pinDefs, 'gnd', 1);
      const vccRail = findFreePowerRail(bb, updatedWires, pinDefs, 'vcc', 1);
      updatedWires.push({ id: `w_auto_bb_pwr_gnd_${Date.now()}`, from: `${boardId}:${gndPin}`, to: gndRail, color: 'black' });
      updatedWires.push({ id: `w_auto_bb_pwr_vcc_${Date.now()}`, from: `${boardId}:${vccPin}`, to: vccRail, color: 'red'   });
    }

    // Free row (width = number of pins for footprint)
    const colsNeeded = Math.max(1, Math.ceil(compPins.length / 2));
    const row        = findFreeBreadboardRow(bb, updatedComponents, updatedWires, pinDefs, colsNeeded);

    // Snap finalComp anchor pin to row hole
    const anchorPinId = finalComp.attrs?.breadboard?.anchorPin || compPins[0]?.id;
    const anchorPin   = compPins.find(p => p.id === anchorPinId) || compPins[0] || { x: 0, y: 0 };
    const anchorHole  = bbPins.find(p => p.id === `${row}e`);
    if (anchorHole) {
      const bbCx = bb.x + (bb.w || 0) / 2, bbCy = bb.y + (bb.h || 0) / 2;
      const hw   = getRotatedPoint(bb.x + anchorHole.x, bb.y + anchorHole.y, bb.rotation || 0, bbCx, bbCy);
      finalComp.x = hw.x - anchorPin.x;
      finalComp.y = hw.y - anchorPin.y;
    }

    // Snap wires
    const { snappedWires, snapMatches } = robustSnapComponent(finalComp, updatedComponents, pinDefs);
    const pinToHole = {};
    snapMatches.forEach(m => { if (m.hole) pinToHole[m.wp.id] = m.hole.holeId; });
    updatedWires.push(...snappedWires);

    let i2cInjected = false;

    // Process each connection
    autowiring.connections.forEach((conn, idx) => {
      let target = conn.to || '';
      const t    = Date.now() + idx;

      // Resolve arduino:X → boardId:X with conflict avoidance
      if (target.startsWith('arduino:')) {
        const preferred = target.replace('arduino:', '');
        if (/^gnd$/i.test(preferred)) {
          target = findFreePowerRail(bb, updatedWires, pinDefs, 'gnd', Math.min(row, RAIL_MAX));
        } else if (/^5v$/i.test(preferred) || /^3v3$/i.test(preferred) || /^vcc$/i.test(preferred)) {
          target = findFreePowerRail(bb, updatedWires, pinDefs, 'vcc', Math.min(row, RAIL_MAX));
        } else {
          const resolved = findAlternativePin(`${boardId}:${preferred}`, updatedComponents, updatedWires, pinDefs);
          target = resolved;
        }
      }

      // Inject I2C pull-ups (once per component)
      if (conn.i2c && !i2cInjected) {
        injectI2cPullups(finalComp.id, bb, boardId, updatedComponents, updatedWires, pinDefs);
        i2cInjected = true;
      }

      const fromHoleId = pinToHole[conn.from] || `${row}e`;
      const bbHole     = `${bb.id}:${fromHoleId}`;

      if (conn.via) {
        // Place helper (resistor etc.) with collision avoidance
        const viaId    = `via_${conn.from}_${finalComp.id}_${t}`;
        const regM     = (pinDefs[conn.via] || []);
        const viaW     = 70, viaH = 32;
        const rawPos   = { x: finalComp.x + 80, y: finalComp.y };
        const safePos  = findFreeHelperPosition(rawPos.x, rawPos.y, viaW, viaH,
                           [...updatedComponents, finalComp]);
        updatedComponents.push({ id: viaId, type: conn.via, label: conn.attrs?.value || '',
                                 x: safePos.x, y: safePos.y, w: viaW, h: viaH,
                                 attrs: conn.attrs || {} });
        updatedWires.push({ id: `w_via_in_${t}`,  from: bbHole,          to: `${viaId}:p1`, color: 'orange', isSocket: true, isHidden: true });
        updatedWires.push({ id: `w_via_out_${t}`, from: `${viaId}:p2`,   to: target,        color: 'green' });
      } else {
        const isRailTarget = target.includes(':top_') || target.includes(':bottom_');
        updatedWires.push({ id: `w_auto_${t}`, from: bbHole, to: target,
                            color: target.includes('gnd') ? 'black' : 'green',
                            isSocket: isRailTarget });
      }
    });

    // ── 2. Orphaned-pin auto-connect ──────────────────────────────────────────
    const allCurrentWires = updatedWires;
    const unconnected = getUnconnectedPins(finalComp, compPins, allCurrentWires);
    if (unconnected.length) {
      connectUnconnectedPins(finalComp, unconnected, bb, boardId,
                             wires, updatedWires, updatedComponents, pinDefs);
    }
  }

  // ── 3. Auto-coding ───────────────────────────────────────────────────────────
  if (options.autoCoding && autocoding?.arduino) {
    updatedCode = mergeCodeSnippet(updatedCode, autocoding.arduino);
  }

  return { component: finalComp, components: updatedComponents, wires: updatedWires, code: updatedCode };
}
