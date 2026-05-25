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

// ─── COMPUTE ORTHOGONAL WIRE CORNER POINTS ─────────────────────────────────
export function computeWireOrthoPoints(p1, e1, e2, p2, waypoints = [], offset = 0) {
  if (waypoints.length > 0) {
    // If manual waypoints (canvas clicks) or interactive corners exist, 
    // we follow them strictly and skip the automatic Manhattan routing logic.
    const pts = [p1, e1, ...waypoints, e2, p2].filter((pt, i, arr) => 
      i === 0 || Math.abs(pt.x - arr[i - 1].x) > 2 || Math.abs(pt.y - arr[i - 1].y) > 2
    );
    return makeOrthogonal(pts);
  }

  const laneIndex = typeof offset === 'number' ? offset % 7 : 0;
  const trunkShift = (laneIndex - 3) * 5;

  const aimStub = (pin, stub, target) => {
    const dx = stub.x - pin.x;
    const dy = stub.y - pin.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx !== 0 && (target.x - pin.x) * dx < 0) return { x: pin.x - dx, y: pin.y };
    } else if (dy !== 0 && (target.y - pin.y) * dy < 0) {
      return { x: pin.x, y: pin.y - dy };
    }
    return stub;
  };

  let se1 = aimStub(p1, { ...e1 }, p2);
  let se2 = aimStub(p2, { ...e2 }, p1);

  let midPts = [];
  const sdx1 = se1.x - p1.x;
  const sdy1 = se1.y - p1.y;
  const sdx2 = se2.x - p2.x;
  const sdy2 = se2.y - p2.y;
  const e1Horiz = Math.abs(sdx1) >= Math.abs(sdy1);
  const e2Horiz = Math.abs(sdx2) >= Math.abs(sdy2);

  if (e1Horiz && e2Horiz) {
    const midX = (se1.x + se2.x) / 2 + trunkShift;
    midPts = [{ x: midX, y: se1.y }, { x: midX, y: se2.y }];
  } else if (!e1Horiz && !e2Horiz) {
    const midY = (se1.y + se2.y) / 2 + trunkShift;
    midPts = [{ x: se1.x, y: midY }, { x: se2.x, y: midY }];
  } else if (e1Horiz && !e2Horiz) {
    midPts = [{ x: se2.x, y: se1.y }];
  } else {
    midPts = [{ x: se1.x, y: se2.y }];
  }

  return makeOrthogonal([p1, se1, ...midPts, se2, p2]);
}

// ─── BUILD FULL WIRE PATH STRING ───────────────────────────────────────────
export function buildWirePath(p1, e1, e2, p2, waypoints = [], pathOverride = null, offset = 0) {
  if (pathOverride && pathOverride.length >= 2) {
    const pts = pathOverride.map((pt, i) => {
      if (i === 0) return p1;
      if (i === pathOverride.length - 1) return p2;
      return offset === 0 ? pt : { x: pt.x + offset, y: pt.y + offset };
    });
    return renderRoundedPath(makeOrthogonal(pts));
  }
  const pts = computeWireOrthoPoints(p1, e1, e2, p2, waypoints, offset);
  return renderRoundedPath(pts);
}

// ─── GET WIRE POINTS FOR DRAGGING ──────────────────────────────────────────
export function getWirePoints(p1, e1, e2, p2, waypoints = [], offset = 0, pathOverride = null) {
  if (pathOverride && pathOverride.length >= 2) {
    return pathOverride.map((pt, i) => {
      if (i === 0) return p1;
      if (i === pathOverride.length - 1) return p2;
      return offset === 0 ? pt : { x: pt.x + offset, y: pt.y + offset };
    });
  }
  return computeWireOrthoPoints(p1, e1, e2, p2, waypoints, offset);
}

// ─── PREVIEW WIRE ROUTER (Drawing mode) ───────────────────────────────────
// Produces a stable orthogonal preview path from a pin (with known exit direction)
// to the current mouse cursor. The exit direction is locked to the pin's edge so
// the first segment never flips while the mouse moves.
export function multiRoutePath(p1, p2, waypoints = []) {
  if (!p1 || !p2) return '';

  const exitDir = p1.exitDir || null;
  const EXIT_LEN = 24;

  let e1 = p1;
  if (exitDir) {
    const offsets = { top: { x: 0, y: -EXIT_LEN }, bottom: { x: 0, y: EXIT_LEN }, left: { x: -EXIT_LEN, y: 0 }, right: { x: EXIT_LEN, y: 0 } };
    const off = offsets[exitDir] || { x: 0, y: 0 };
    e1 = { x: p1.x + off.x, y: p1.y + off.y };
  }

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

  const dx = p2.x - e1.x;
  const dy = p2.y - e1.y;

  let pts;
  if (exitDir === 'left' || exitDir === 'right') {
    pts = [p1, e1, { x: p2.x, y: e1.y }, p2];
  } else if (exitDir === 'top' || exitDir === 'bottom') {
    pts = [p1, e1, { x: e1.x, y: p2.y }, p2];
  } else {
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
