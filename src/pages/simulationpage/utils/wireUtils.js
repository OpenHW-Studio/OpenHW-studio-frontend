// ─── RENDER ROUNDED PATH FROM POINT ARRAY ─────────────────────────────────
export function renderRoundedPath(pts) {
  try {
    if (!pts || pts.length < 2) return '';
    const validPts = pts.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number' && isFinite(p.x) && isFinite(p.y));
    if (validPts.length < 2) return '';
    const r = 10;
    let d = `M ${validPts[0].x} ${validPts[0].y}`;
    for (let i = 1; i < validPts.length - 1; i++) {
      const prev = validPts[i - 1], curr = validPts[i], next = validPts[i + 1];
      if (!prev || !curr || !next) { if (curr) d += ` L ${curr.x} ${curr.y}`; continue; }
      const distPrev = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      const distNext = Math.hypot(next.x - curr.x, next.y - curr.y);
      if (distPrev < 0.1 || distNext < 0.1 || !isFinite(distPrev) || !isFinite(distNext)) {
        d += ` L ${curr.x} ${curr.y}`;
        continue;
      }
      const cornerR = Math.min(r, distPrev / 2, distNext / 2);
      if (cornerR < 0.5) {
        d += ` L ${curr.x} ${curr.y}`;
        continue;
      }
      const ps = { x: curr.x + (prev.x - curr.x) * (cornerR / distPrev), y: curr.y + (prev.y - curr.y) * (cornerR / distPrev) };
      const pe = { x: curr.x + (next.x - curr.x) * (cornerR / distNext), y: curr.y + (next.y - curr.y) * (cornerR / distNext) };
      if (!isFinite(ps.x) || !isFinite(ps.y) || !isFinite(pe.x) || !isFinite(pe.y)) {
        d += ` L ${curr.x} ${curr.y}`;
        continue;
      }
      d += ` L ${ps.x} ${ps.y} Q ${curr.x} ${curr.y} ${pe.x} ${pe.y}`;
    }
    const lastPt = validPts[validPts.length - 1];
    d += ` L ${lastPt.x} ${lastPt.y}`;
    return d;
  } catch (e) {
    return '';
  }
}

function makeOrthogonal(pts) {
  if (!pts || pts.length < 2) return pts || [];
  const result = [];
  if (pts[0]) result.push(pts[0]);
  for (let i = 1; i < pts.length; i++) {
    const prev = result[result.length - 1];
    const curr = pts[i];
    if (!prev || !curr) {
      if (curr) result.push(curr);
      continue;
    }
    if (Math.abs(prev.x - curr.x) > 0.1 && Math.abs(prev.y - curr.y) > 0.1) {
      const lastSegWasVert = result.length > 1 && Math.abs(result[result.length - 2].x - prev.x) < 0.1;
      if (lastSegWasVert) {
        result.push({ x: curr.x, y: prev.y });
      } else {
        result.push({ x: prev.x, y: curr.y });
      }
    }
    result.push(curr);
  }
  return result.filter((pt, i, arr) => i === 0 || (Math.abs(pt.x - arr[i - 1].x) > 0.1 || Math.abs(pt.y - arr[i - 1].y) > 0.1));
}

// ─── COMPUTE ORTHOGONAL WIRE CORNER POINTS ─────────────────────────────────
export function computeWireOrthoPoints(p1, e1, e2, p2, waypoints = [], offset = 0) {
  try {
  if (!p1 || !e1 || !e2 || !p2) return p1 && p2 ? [p1, p2] : [];
  if (waypoints.length > 0) {
    const pts = [p1, e1, ...waypoints, e2, p2].filter((pt, i, arr) => 
      pt && (i === 0 || Math.abs(pt.x - arr[i - 1].x) > 0.1 || Math.abs(pt.y - arr[i - 1].y) > 0.1)
    );
    return makeOrthogonal(pts);
  }

  const laneIndex = offset;
  const trunkShift = (laneIndex - 3) * 7 + (laneIndex < 3 ? -10 : 10); 

  const se1 = { ...e1 }, se2 = { ...e2 };
  const sdx1 = se1.x - p1.x, sdy1 = se1.y - p1.y;
  const sdx2 = se2.x - p2.x, sdy2 = se2.y - p2.y;
  const e1Horiz = Math.abs(sdx1) >= Math.abs(sdy1);
  const e2Horiz = Math.abs(sdx2) >= Math.abs(sdy2);

  let midPts = [];

  if (e1Horiz && e2Horiz) {
    const dir1 = Math.sign(sdx1) || 1;
    const dir2 = Math.sign(sdx2) || 1;
    let midX;
    if (dir1 !== dir2) {
      midX = (se1.x + se2.x) / 2 + trunkShift;
    } else {
      const base = dir1 > 0 ? Math.max(se1.x, se2.x) : Math.min(se1.x, se2.x);
      midX = base + dir1 * (25 + Math.abs(trunkShift));
    }
    midPts = [
      { x: se1.x, y: se1.y },
      { x: midX, y: se1.y },
      { x: midX, y: se2.y },
      { x: se2.x, y: se2.y }
    ];

  } else if (!e1Horiz && !e2Horiz) {
    const dir1 = Math.sign(sdy1) || 1;
    const dir2 = Math.sign(sdy2) || 1;
    let midY;
    if (dir1 !== dir2) {
      midY = (se1.y + se2.y) / 2 + trunkShift;
    } else {
      const base = dir1 > 0 ? Math.max(se1.y, se2.y) : Math.min(se1.y, se2.y);
      midY = base + dir1 * (25 + Math.abs(trunkShift));
    }
    midPts = [
      { x: se1.x, y: se1.y },
      { x: se1.x, y: midY },
      { x: se2.x, y: midY },
      { x: se2.x, y: se2.y }
    ];

  } else if (e1Horiz && !e2Horiz) {
    const midX = se2.x + trunkShift;
    const midY = se1.y + trunkShift;
    midPts = [{ x: midX, y: se1.y }, { x: midX, y: midY }];

  } else {
    const midX = se1.x + trunkShift;
    const midY = se2.y + trunkShift;
    midPts = [{ x: se1.x, y: midY }, { x: midX, y: midY }];
  }

  return makeOrthogonal([p1, se1, ...midPts, se2, p2]);
  } catch (e) {
    return p1 && p2 ? [p1, p2] : [];
  }
}

// ─── BUILD FULL WIRE PATH STRING ───────────────────────────────────────────
export function buildWirePath(p1, e1, e2, p2, waypoints = [], pathOverride = null, offset = 0) {
  try {
    const pts = computeWireOrthoPoints(p1, e1, e2, p2, waypoints, offset);
    return renderRoundedPath(pts);
  } catch (e) {
    return '';
  }
}

export function getWirePoints(p1, e1, e2, p2, waypoints = [], offset = 0) {
  try {
    return computeWireOrthoPoints(p1, e1, e2, p2, waypoints, offset);
  } catch (e) {
    return p1 && p2 ? [p1, p2] : [];
  }
}

// ─── PREVIEW WIRE ROUTER (Drawing mode) ───────────────────────────────────
export function multiRoutePath(p1, p2, waypoints = []) {
  if (!p1 || !p2) return '';
  const hints = [p1, ...waypoints, p2];
  const pts = [];
  for (let i = 0; i < hints.length - 1; i++) {
    const a = hints[i], b = hints[i + 1];
    if (i === 0) pts.push(a);
    const midX = (a.x + b.x) / 2;
    pts.push({ x: midX, y: a.y });
    pts.push({ x: midX, y: b.y });
    pts.push(b);
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
