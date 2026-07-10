// ─── RENDER ROUNDED PATH FROM POINT ARRAY ─────────────────────────────────
export function renderRoundedPath(pts) {
  try {
    if (!pts || pts.length < 2) return '';
    // Filter out any null/undefined/NaN points before processing
    const validPts = pts.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number' && isFinite(p.x) && isFinite(p.y));
    if (validPts.length < 2) return '';
    const r = 6;
    const p0 = validPts[0];
    let d = `M ${p0.x} ${p0.y}`;
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

// ─── INTERNAL: ENSURE STRICT ORTHOGONALITY ────────────────────────────────
export function snapPointsToHalfPixel(pts) {
  return (pts || []).filter(Boolean).map(p => ({ x: Math.round((p.x || 0) * 2) / 2, y: Math.round((p.y || 0) * 2) / 2, _corner: p._corner }));
}

export function makeOrthogonal(pts) {
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
        result.push({ x: curr.x, y: prev.y, _corner: true });
      } else {
        result.push({ x: prev.x, y: curr.y, _corner: true });
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
  if (waypoints.length > 0 && waypoints[0]._corner) {
    let pts = [p1, ...waypoints, p2];
    pts = pts.filter((pt, i, arr) => pt && (i === 0 || Math.abs(pt.x - arr[i - 1].x) > 0.1 || Math.abs(pt.y - arr[i - 1].y) > 0.1));
    if (offset !== 0 && pts.length > 2) {
      const newPts = [p1];
      for (let i = 1; i < pts.length - 1; i++) {
        newPts.push({ x: pts[i].x + offset, y: pts[i].y + offset });
      }
      newPts.push(p2);
      return makeOrthogonal(newPts);
    }
    return makeOrthogonal(pts);
  }

  // --- STRICT MANHATTAN ROUTING ---
  let se1 = { ...e1 }, se2 = { ...e2 };
  const sdx1 = se1.x - p1.x, sdy1 = se1.y - p1.y;
  const sdx2 = se2.x - p2.x, sdy2 = se2.y - p2.y;
  const e1Horiz = Math.abs(sdx1) >= Math.abs(sdy1);
  const e2Horiz = Math.abs(sdx2) >= Math.abs(sdy2);

  let midPts = [];
  if (e1Horiz && e2Horiz) {
    const midX = (se1.x + se2.x) / 2 + (offset * 2);
    if (Math.abs(se1.y - se2.y) < 20) {
      const bypassY = se1.y + (offset >= 0 ? 35 + offset : -35 + offset);
      midPts = [{ x: se1.x, y: bypassY }, { x: se2.x, y: bypassY }];
    } else {
      midPts = [{ x: midX, y: se1.y }, { x: midX, y: se2.y }];
    }
  } else if (!e1Horiz && !e2Horiz) {
    const midY = (se1.y + se2.y) / 2 + (offset * 2);
    if (Math.abs(se1.x - se2.x) < 20) {
      const bypassX = se1.x + (offset >= 0 ? 35 + offset : -35 + offset);
      midPts = [{ x: bypassX, y: se1.y }, { x: bypassX, y: se2.y }];
    } else {
      midPts = [{ x: se1.x, y: midY }, { x: se2.x, y: midY }];
    }
  } else if (e1Horiz && !e2Horiz) {
    midPts = [{ x: se2.x + offset, y: se1.y + offset }];
  } else {
    midPts = [{ x: se1.x + offset, y: se2.y + offset }];
  }

  let rawPts = [p1, se1, ...midPts, se2, p2];
  if (offset === 0) return makeOrthogonal(rawPts);

  const finalPts = [p1];
  if (e1Horiz) finalPts.push({ x: p1.x, y: p1.y + offset });
  else finalPts.push({ x: p1.x + offset, y: p1.y });

  for (let i = 1; i < rawPts.length - 1; i++) {
    finalPts.push({ x: rawPts[i].x + offset, y: rawPts[i].y + offset });
  }

  if (e2Horiz) finalPts.push({ x: p2.x, y: p2.y + offset });
  else finalPts.push({ x: p2.x + offset, y: p2.y });

  finalPts.push(p2);
  return makeOrthogonal(finalPts);
  } catch (e) {
    return p1 && p2 ? [p1, p2] : [];
  }
}

// ─── BUILD FULL WIRE PATH STRING ───────────────────────────────────────────
export function buildWirePath(p1, e1, e2, p2, waypoints = [], pathOverride = null, offset = 0) {
  try {
    if (pathOverride && pathOverride.length >= 2) {
      const pts = offset === 0 ? pathOverride : pathOverride.map((pt, i) => (i === 0 || i === pathOverride.length - 1) ? pt : { x: pt.x + offset, y: pt.y + offset });
      return renderRoundedPath(makeOrthogonal(pts));
    }
    const pts = computeWireOrthoPoints(p1, e1, e2, p2, waypoints, offset);
    return renderRoundedPath(pts);
  } catch (e) {
    return '';
  }
}

// ─── GET WIRE POINTS FOR DRAGGING ──────────────────────────────────────────
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
  if (l === 'GND' || l.includes('.GND') || l.includes('_GND') || l === 'VSS' || l === 'CATHODE' || l === 'COM') return 'black';
  if (l.includes('5V') || l.includes('3.3V') || l === 'VCC' || l === 'ANODE') return '#e74c3c';
  if (l.includes('SDA')) return '#3498db';
  if (l.includes('SCL')) return '#f1c40f';
  if (l.includes('RX')) return '#e67e22';
  if (l.includes('TX')) return '#d35400';
  if (l.includes('MOSI') || l.includes('MISO') || l.includes('SCK') || l.includes('SCLK') || l.includes('CS') || l.includes('SS')) return '#9b59b6';
  if (l.includes('PWM') || l.includes('~')) return '#1abc9c';
  if (l.startsWith('A') && !isNaN(l.substring(1))) return '#27ae60';
  if (l.includes('ANALOG')) return '#27ae60';
  return '#2ecc71';
}
