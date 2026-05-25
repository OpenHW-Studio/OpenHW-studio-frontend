// ─── RENDER ROUNDED PATH FROM POINT ARRAY ─────────────────────────────────
export function renderRoundedPath(pts) {
  if (!pts || pts.length < 2) return '';
  const r = 10;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1], curr = pts[i], next = pts[i + 1];
    const distPrev = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const distNext = Math.hypot(next.x - curr.x, next.y - curr.y);
    const cornerR = Math.min(r, distPrev / 2, distNext / 2);
    if (cornerR < 0.5) {
      d += ` L ${curr.x} ${curr.y}`;
      continue;
    }
    const ps = { x: curr.x + (prev.x - curr.x) * (cornerR / distPrev), y: curr.y + (prev.y - curr.y) * (cornerR / distPrev) };
    const pe = { x: curr.x + (next.x - curr.x) * (cornerR / distNext), y: curr.y + (next.y - curr.y) * (cornerR / distNext) };
    d += ` L ${ps.x} ${ps.y} Q ${curr.x} ${curr.y} ${pe.x} ${pe.y}`;
  }
  d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  return d;
}

// ─── INTERNAL: ENSURE STRICT ORTHOGONALITY ────────────────────────────────
function makeOrthogonal(pts) {
  if (pts.length < 2) return pts;
  const result = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const prev = result[result.length - 1];
    const curr = pts[i];
    if (Math.abs(prev.x - curr.x) > 2 && Math.abs(prev.y - curr.y) > 2) {
      const lastSegWasVert = result.length > 1 && Math.abs(result[result.length - 2].x - prev.x) < 2;
      if (lastSegWasVert) {
        result.push({ x: curr.x, y: prev.y });
      } else {
        result.push({ x: prev.x, y: curr.y });
      }
    }
    result.push(curr);
  }

  // Collinear and duplicate simplification
  const simplified = [result[0]];
  for (let i = 1; i < result.length - 1; i++) {
    const prev = simplified[simplified.length - 1];
    const curr = result[i];
    const next = result[i + 1];
    const isCollinearX = Math.abs(prev.x - curr.x) < 2 && Math.abs(curr.x - next.x) < 2;
    const isCollinearY = Math.abs(prev.y - curr.y) < 2 && Math.abs(curr.y - next.y) < 2;
    const isDuplicate  = Math.abs(prev.x - curr.x) < 2 && Math.abs(prev.y - curr.y) < 2;
    if (!isCollinearX && !isCollinearY && !isDuplicate) {
      simplified.push(curr);
    }
  }
  if (result.length > 1) {
    simplified.push(result[result.length - 1]);
  }
  return simplified.filter((pt, i, arr) => i === 0 || (Math.abs(pt.x - arr[i - 1].x) > 2 || Math.abs(pt.y - arr[i - 1].y) > 2));
}

const LANE_COUNT = 7;
const LANE_CENTER = 3;

export function laneIndexToShift(laneIndex) {
  return ((laneIndex % LANE_COUNT) - LANE_CENTER) * 8;
}

function getWireBucketKey(pts) {
  if (!pts || pts.length < 2) return null;
  let bestHoriz = null;
  let bestVert = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 24) continue;
    if (Math.abs(a.y - b.y) < 3) {
      if (!bestHoriz || len > bestHoriz.len) {
        bestHoriz = {
          y: Math.round((a.y + b.y) / 2 / 8) * 8,
          xMin: Math.min(a.x, b.x),
          xMax: Math.max(a.x, b.x),
          len,
        };
      }
    }
    if (Math.abs(a.x - b.x) < 3) {
      if (!bestVert || len > bestVert.len) {
        bestVert = {
          x: Math.round((a.x + b.x) / 2 / 8) * 8,
          yMin: Math.min(a.y, b.y),
          yMax: Math.max(a.y, b.y),
          len,
        };
      }
    }
  }
  if (bestHoriz) {
    return `H|${bestHoriz.y}|${Math.floor(bestHoriz.xMin / 40)}|${Math.floor(bestHoriz.xMax / 40)}`;
  }
  if (bestVert) {
    return `V|${bestVert.x}|${Math.floor(bestVert.yMin / 40)}|${Math.floor(bestVert.yMax / 40)}`;
  }
  return null;
}

/** Shift interior routing points perpendicular to the dominant trunk so parallel wires stay visible. */
export function applyLaneOffsetToPoints(pts, laneIndex) {
  if (!pts || pts.length < 2) return pts;
  const shift = laneIndexToShift(laneIndex);
  if (shift === 0) return pts;

  if (pts.length === 2) {
    const a = pts[0];
    const b = pts[1];
    if (Math.abs(a.y - b.y) < 3) {
      const bypassY = a.y + shift;
      return [a, { x: a.x, y: bypassY }, { x: b.x, y: bypassY }, b];
    }
    if (Math.abs(a.x - b.x) < 3) {
      const bypassX = a.x + shift;
      return [a, { x: bypassX, y: a.y }, { x: bypassX, y: b.y }, b];
    }
  }

  let bestHoriz = null;
  let bestVert = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 20) continue;
    if (Math.abs(a.y - b.y) < 3 && (!bestHoriz || len > bestHoriz.len)) bestHoriz = { len };
    if (Math.abs(a.x - b.x) < 3 && (!bestVert || len > bestVert.len)) bestVert = { len };
  }

  const useHoriz = bestHoriz && (!bestVert || bestHoriz.len >= bestVert.len);
  return pts.map((pt, i) => {
    if (i === 0 || i === pts.length - 1) return pt;
    if (useHoriz) return { x: pt.x, y: pt.y + shift };
    if (bestVert) return { x: pt.x + shift, y: pt.y };
    return { x: pt.x + shift * 0.5, y: pt.y + shift * 0.5 };
  });
}

/** Assign lane indices so wires that share the same trunk segment get distinct offsets. */
export function computeWireLaneOffsets(wires, getPinPos, getPinExitPoint) {
  const buckets = new Map();
  const meta = [];

  wires.forEach((wire, idx) => {
    const fromParts = wire.from.split(':');
    const toParts = wire.to.split(':');
    const fromPin = fromParts.slice(1).join(':');
    const toPin = toParts.slice(1).join(':');
    const p1 = getPinPos(fromParts[0], fromPin);
    const p2 = getPinPos(toParts[0], toPin);
    if (!p1 || !p2) {
      meta.push({ wire, idx, bucketKey: `orphan-${wire.id}` });
      return;
    }
    const e1 = getPinExitPoint(fromParts[0], fromPin, 0, p2) || p1;
    const e2 = getPinExitPoint(toParts[0], toPin, 0, p1) || p2;

    let pts;
    if (wire.path && wire.path.length >= 2) {
      pts = makeOrthogonal(wire.path.map((pt, i) => {
        if (i === 0) return p1;
        if (i === wire.path.length - 1) return p2;
        return pt;
      }));
    } else {
      pts = computeWireOrthoPoints(p1, e1, e2, p2, wire.waypoints || [], 0);
    }

    const bucketKey = getWireBucketKey(pts) || `unique-${wire.id}`;
    meta.push({ wire, idx, bucketKey });
  });

  meta.forEach(({ wire, idx, bucketKey }) => {
    if (!buckets.has(bucketKey)) buckets.set(bucketKey, []);
    buckets.get(bucketKey).push({ wire, idx });
  });

  const offsets = new Map();
  buckets.forEach((group) => {
    const spread = group.length;
    group.forEach((item, i) => {
      let lane;
      if (spread === 1) {
        lane = item.idx % LANE_COUNT;
      } else {
        lane = Math.round(LANE_CENTER + (i - (spread - 1) / 2) * 2);
        lane = ((lane % LANE_COUNT) + LANE_COUNT) % LANE_COUNT;
      }
      offsets.set(item.wire.id, lane);
    });
  });

  return offsets;
}

// Flip a stub if it initially points away from the other endpoint.
function aimStubTowardTarget(pin, stub, target) {
  const dx = stub.x - pin.x;
  const dy = stub.y - pin.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx !== 0 && (target.x - pin.x) * dx < 0) return { x: pin.x - dx, y: pin.y };
  } else if (dy !== 0 && (target.y - pin.y) * dy < 0) {
    return { x: pin.x, y: pin.y - dy };
  }
  return stub;
}

// Short skirt around a component body when a direct orthogonal path would cut through it.
function skirtAroundComponent(stub, target, box, margin = 14) {
  if (!box || !stub?.rotatedDir) return [];
  const { x: bx, y: by, w, h } = box;
  const insideY = stub.y >= by && stub.y <= by + h;
  const insideX = stub.x >= bx && stub.x <= bx + w;

  if (stub.rotatedDir === 'left' && target.x > bx + w * 0.5 && insideY) {
    const skirtY = target.y >= stub.y ? by + h + margin : by - margin;
    const skirtX = Math.max(stub.x, bx + w + margin);
    return [{ x: stub.x, y: skirtY }, { x: skirtX, y: skirtY }];
  }
  if (stub.rotatedDir === 'right' && target.x < bx + w * 0.5 && insideY) {
    const skirtY = target.y >= stub.y ? by + h + margin : by - margin;
    const skirtX = Math.min(stub.x, bx - margin);
    return [{ x: stub.x, y: skirtY }, { x: skirtX, y: skirtY }];
  }
  if (stub.rotatedDir === 'top' && target.y > by + h * 0.5 && insideX) {
    const skirtX = target.x >= stub.x ? bx + w + margin : bx - margin;
    const skirtY = Math.max(stub.y, by + h + margin);
    return [{ x: skirtX, y: stub.y }, { x: skirtX, y: skirtY }];
  }
  if (stub.rotatedDir === 'bottom' && target.y < by + h * 0.5 && insideX) {
    const skirtX = target.x >= stub.x ? bx + w + margin : bx - margin;
    const skirtY = Math.min(stub.y, by - margin);
    return [{ x: skirtX, y: stub.y }, { x: skirtX, y: skirtY }];
  }
  return [];
}

// ─── COMPUTE ORTHOGONAL WIRE CORNER POINTS ─────────────────────────────────
export function computeWireOrthoPoints(p1, e1, e2, p2, waypoints = [], offset = 0) {
  const laneIndex = typeof offset === 'number' ? offset % LANE_COUNT : 0;
  const trunkShift = laneIndexToShift(laneIndex);

  if (waypoints.length > 0) {
    const pts = [p1, e1, ...waypoints, e2, p2].filter((pt, i, arr) =>
      i === 0 || Math.abs(pt.x - arr[i - 1].x) > 2 || Math.abs(pt.y - arr[i - 1].y) > 2
    );
    return applyLaneOffsetToPoints(makeOrthogonal(pts), laneIndex);
  }

  let se1 = aimStubTowardTarget(p1, { ...e1 }, p2);
  let se2 = aimStubTowardTarget(p2, { ...e2 }, p1);

  let midPts = skirtAroundComponent(se1, p2, se1.compBox);
  if (midPts.length === 0) midPts = skirtAroundComponent(se2, p1, se2.compBox);

  if (midPts.length === 0) {
    const sdx1 = se1.x - p1.x;
    const sdy1 = se1.y - p1.y;
    const sdx2 = se2.x - p2.x;
    const sdy2 = se2.y - p2.y;
    const e1Horiz = Math.abs(sdx1) >= Math.abs(sdy1);
    const e2Horiz = Math.abs(sdx2) >= Math.abs(sdy2);

    if (e1Horiz && e2Horiz) {
      if (Math.abs(se1.y - se2.y) < 20) {
        const bypassY = (se1.y + se2.y) / 2 + trunkShift;
        midPts = [{ x: se1.x, y: bypassY }, { x: se2.x, y: bypassY }];
      } else {
        const midX = (se1.x + se2.x) / 2 + trunkShift;
        midPts = [{ x: midX, y: se1.y }, { x: midX, y: se2.y }];
      }
    } else if (!e1Horiz && !e2Horiz) {
      if (Math.abs(se1.x - se2.x) < 20) {
        const bypassX = (se1.x + se2.x) / 2 + trunkShift;
        midPts = [{ x: bypassX, y: se1.y }, { x: bypassX, y: se2.y }];
      } else {
        const midY = (se1.y + se2.y) / 2 + trunkShift;
        midPts = [{ x: se1.x, y: midY }, { x: se2.x, y: midY }];
      }
    } else if (e1Horiz && !e2Horiz) {
      midPts = [{ x: se2.x, y: se1.y }];
    } else {
      midPts = [{ x: se1.x, y: se2.y }];
    }
  }

  return makeOrthogonal([p1, se1, ...midPts, se2, p2]);
}


// ─── BUILD FULL WIRE PATH STRING ───────────────────────────────────────────

export function buildWirePath(p1, e1, e2, p2, waypoints = [], pathOverride = null, offset = 0) {
  const pts = getWirePoints(p1, e1, e2, p2, waypoints, offset, pathOverride);
  return renderRoundedPath(pts);
}

// ─── GET WIRE POINTS FOR DRAGGING ──────────────────────────────────────────
export function getWirePoints(p1, e1, e2, p2, waypoints = [], offset = 0, pathOverride = null) {
  const laneIndex = typeof offset === 'number' ? offset % LANE_COUNT : 0;
  if (pathOverride && pathOverride.length >= 2) {
    const pts = pathOverride.map((pt, i) => {
      if (i === 0) return p1;
      if (i === pathOverride.length - 1) return p2;
      return pt;
    });
    return applyLaneOffsetToPoints(makeOrthogonal(pts), laneIndex);
  }
  return computeWireOrthoPoints(p1, e1, e2, p2, waypoints, laneIndex);
}

// ─── PREVIEW WIRE ROUTER (Drawing mode) ───────────────────────────────────
// Produces a stable orthogonal preview path from a pin (with known exit direction)
// to the current mouse cursor. The exit direction is locked to the pin's edge so
// the first segment never flips while the mouse moves.
export function multiRoutePath(p1, p2, waypoints = []) {
  if (!p1 || !p2) return '';

  // p1 may carry an exit direction hint set by onPinClick / wireStart
  const exitDir = p1.exitDir || null; // 'top' | 'bottom' | 'left' | 'right' | null
  const EXIT_LEN = 24; // px — how far the wire travels straight out of the pin before turning

  // Build the exit point: a fixed point EXIT_LEN px away from p1 in the exit direction
  let e1 = p1;
  if (exitDir) {
    const offsets = { top: { x: 0, y: -EXIT_LEN }, bottom: { x: 0, y: EXIT_LEN }, left: { x: -EXIT_LEN, y: 0 }, right: { x: EXIT_LEN, y: 0 } };
    const off = offsets[exitDir] || { x: 0, y: 0 };
    e1 = { x: p1.x + off.x, y: p1.y + off.y };
  }

  // If there are intermediate waypoints, route through them
  if (waypoints && waypoints.length > 0) {
    const hints = [p1, e1, ...waypoints, p2];
    const pts = [];
    for (let i = 0; i < hints.length - 1; i++) {
      const a = hints[i], b = hints[i + 1];
      if (i === 0) pts.push(a);
      pts.push({ x: b.x, y: a.y });
      pts.push(b);
    }
    return renderRoundedPath(makeOrthogonal(pts));
  }

  // Direct route: exit straight from pin, then turn once toward the cursor
  // Determine dominant axis from exit point to cursor
  const dx = p2.x - e1.x;
  const dy = p2.y - e1.y;

  let pts;
  if (exitDir === 'left' || exitDir === 'right') {
    // Exiting horizontally → turn vertically toward cursor
    pts = [p1, e1, { x: p2.x, y: e1.y }, p2];
  } else if (exitDir === 'top' || exitDir === 'bottom') {
    // Exiting vertically → turn horizontally toward cursor
    pts = [p1, e1, { x: e1.x, y: p2.y }, p2];
  } else {
    // No exit hint — use dominant axis to decide first turn direction
    if (Math.abs(dx) >= Math.abs(dy)) {
      pts = [p1, { x: p2.x, y: p1.y }, p2];
    } else {
      pts = [p1, { x: p1.x, y: p2.y }, p2];
    }
  }

  return renderRoundedPath(makeOrthogonal(pts));
}

// ─── AUTOMATED WIRE COLORING LOGIC ────────────────────────────────────────
export function wireColor(pinLabel) {
  if (!pinLabel) return '#2ecc71';
  const l = pinLabel.toUpperCase();

  // Power & Ground (Highest priority)
  if (l === 'GND' || l.includes('.GND') || l.includes('_GND') || l === 'VSS' || l === 'CATHODE' || l === 'COM') return '#1f2937'; 
  if (l === 'VCC' || l === 'VDD' || l === '5V' || l === '3V3' || l === '3.3V' || l === 'VIN' || l === 'ANODE' || l === 'V+') return '#ef4444'; 

  // UART
  if (l.includes('RX')) return '#f97316'; // Orange
  if (l.includes('TX')) return '#ea580c'; // Deep Orange

  // I2C
  if (l.includes('SDA')) return '#3b82f6'; // Blue
  if (l.includes('SCL')) return '#eab308'; // Yellow/Amber

  // SPI - Specific Signal Separation
  if (l.includes('MOSI') || l.includes('DIN') || l.includes('SDI')) return '#8b5cf6'; // Violet
  if (l.includes('MISO') || l.includes('DOUT') || l.includes('SDO')) return '#d946ef'; // Fuchsia
  if (l === 'SCK') return '#6366f1';  // Indigo
  if (l.includes('SCLK') || l.includes('CLK')) return '#4f46e5'; // Deep Indigo
  if (l === 'CS') return '#ec4899';   // Pink
  if (l.includes('SS') || l.includes('SCE')) return '#be185d';  // Deep Pink/Maroon

  // Analog
  if ((l.startsWith('A') && !isNaN(l.substring(1))) || l.includes('ANALOG') || l.includes('ADC')) return '#10b981'; // Emerald

  // PWM / Special
  if (l.includes('PWM') || l.includes('~') || l.includes('EN')) return '#06b6d4'; // Cyan

  return '#2ecc71'; // Default Green
}
