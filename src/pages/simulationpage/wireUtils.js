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
  if (waypoints.length > 0) {
    // If manual waypoints (canvas clicks) or interactive corners exist, 
    // we follow them strictly and skip the automatic Manhattan routing logic.
    const pts = [p1, e1, ...waypoints, e2, p2].filter((pt, i, arr) => 
      i === 0 || Math.abs(pt.x - arr[i - 1].x) > 0.1 || Math.abs(pt.y - arr[i - 1].y) > 0.1
    );
    return makeOrthogonal(pts);
  }

  // offset is now a laneIndex (0-6). trunkShift centres the bundle symmetrically.
  // 5px inter-wire spacing with a 10px "Safety Offset" to prevent overlaps with pin centers.
  const laneIndex = offset;
  const trunkShift = (laneIndex - 3) * 5 + (laneIndex < 3 ? -10 : 10); 

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
    // We add extra points to ensure the "trunk" is staggered away from the pin X
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
    // We add extra points to ensure the "trunk" is staggered away from the pin Y
    midPts = [
      { x: se1.x, y: se1.y },
      { x: se1.x, y: midY },
      { x: se2.x, y: midY },
      { x: se2.x, y: se2.y }
    ];

  } else if (e1Horiz && !e2Horiz) {
    // Mixed: E1 Horiz, E2 Vert. 
    const midX = se2.x + trunkShift;
    const midY = se1.y + trunkShift;
    midPts = [{ x: midX, y: se1.y }, { x: midX, y: midY }];

  } else {
    // Mixed: E1 Vert, E2 Horiz.
    const midX = se1.x + trunkShift;
    const midY = se2.y + trunkShift;
    midPts = [{ x: se1.x, y: midY }, { x: midX, y: midY }];
  }

  return makeOrthogonal([p1, se1, ...midPts, se2, p2]);
}


// ─── BUILD FULL WIRE PATH STRING ───────────────────────────────────────────

export function buildWirePath(p1, e1, e2, p2, waypoints = [], pathOverride = null, offset = 0) {
  // If we have a pathOverride (from Autowiring), we still want to apply staggering 
  // to prevent overlapping. We do this by passing it through our computeWireOrthoPoints
  // unless it's a completely freeform custom path.
  const pts = computeWireOrthoPoints(p1, e1, e2, p2, waypoints, offset);
  return renderRoundedPath(pts);
}

// ─── GET WIRE POINTS FOR DRAGGING ──────────────────────────────────────────
export function getWirePoints(p1, e1, e2, p2, waypoints = [], offset = 0) {
  return computeWireOrthoPoints(p1, e1, e2, p2, waypoints, offset);
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
