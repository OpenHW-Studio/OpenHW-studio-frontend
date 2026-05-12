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
    const ps = {
      x: curr.x + (prev.x - curr.x) * (cornerR / distPrev),
      y: curr.y + (prev.y - curr.y) * (cornerR / distPrev),
    };
    const pe = {
      x: curr.x + (next.x - curr.x) * (cornerR / distNext),
      y: curr.y + (next.y - curr.y) * (cornerR / distNext),
    };
    d += ` L ${ps.x} ${ps.y} Q ${curr.x} ${curr.y} ${pe.x} ${pe.y}`;
  }
  d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  return d;
}

export function computeWireOrthoPoints(p1, e1, e2, p2, waypoints = []) {
  if (waypoints.length > 0 && waypoints[0]._corner) {
    const pts = [p1, ...waypoints, p2];
    return pts.filter((pt, i, arr) => i === 0 || pt.x !== arr[i - 1].x || pt.y !== arr[i - 1].y);
  }

  const dx1 = e1.x - p1.x, dy1 = e1.y - p1.y;
  const dx2 = e2.x - p2.x, dy2 = e2.y - p2.y;
  const e1IsVert = Math.abs(dy1) > Math.abs(dx1);
  const e2IsVert = Math.abs(dy2) > Math.abs(dx2);

  let se1 = e1, se2 = e2;
  if (e1IsVert) {
    if (dy1 !== 0 && (p2.y - p1.y) * dy1 < 0) se1 = { x: p1.x, y: p1.y - dy1 };
  } else {
    if (dx1 !== 0 && (p2.x - p1.x) * dx1 < 0) se1 = { x: p1.x - dx1, y: p1.y };
  }
  if (e2IsVert) {
    if (dy2 !== 0 && (p1.y - p2.y) * dy2 < 0) se2 = { x: p2.x, y: p2.y - dy2 };
  } else {
    if (dx2 !== 0 && (p1.x - p2.x) * dx2 < 0) se2 = { x: p2.x - dx2, y: p2.y };
  }

  const sdx1 = se1.x - p1.x, sdy1 = se1.y - p1.y;
  const sdx2 = se2.x - p2.x, sdy2 = se2.y - p2.y;
  const e1Horiz = Math.abs(sdx1) >= Math.abs(sdy1);
  const e2Horiz = Math.abs(sdx2) >= Math.abs(sdy2);

  let midPts;
  if (e1Horiz && e2Horiz) {
    const midX = (se1.x + se2.x) / 2;
    midPts = [{ x: midX, y: se1.y }, { x: midX, y: se2.y }];
  } else if (!e1Horiz && !e2Horiz) {
    const midY = (se1.y + se2.y) / 2;
    midPts = [{ x: se1.x, y: midY }, { x: se2.x, y: midY }];
  } else if (e1Horiz && !e2Horiz) {
    midPts = [{ x: se2.x, y: se1.y }];
  } else {
    midPts = [{ x: se1.x, y: se2.y }];
  }

  const pts = [p1, se1, ...midPts, se2, p2];
  return pts.filter((pt, i, arr) => i === 0 || pt.x !== arr[i - 1].x || pt.y !== arr[i - 1].y);
}

export function getWirePoints(p1, e1, e2, p2, waypoints = []) {
  if (waypoints.length > 0 && waypoints[0]._corner) {
    const pts = [p1, ...waypoints, p2];
    return pts.filter((pt, i, arr) => i === 0 || pt.x !== arr[i - 1].x || pt.y !== arr[i - 1].y);
  }

  if (waypoints.length > 0) {
    const hints = [e1, ...waypoints, e2];
    const pts = [p1];
    for (let i = 0; i < hints.length - 1; i++) {
      const a = hints[i], b = hints[i + 1];
      pts.push(a);
      const midX = (a.x + b.x) / 2;
      pts.push({ x: midX, y: a.y });
      pts.push({ x: midX, y: b.y });
    }
    pts.push(e2, p2);
    return pts.filter((pt, i, arr) => i === 0 || pt.x !== arr[i - 1].x || pt.y !== arr[i - 1].y);
  }

  return computeWireOrthoPoints(p1, e1, e2, p2, []);
}

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
  const filtered = pts.filter((pt, i, arr) => i === 0 || pt.x !== arr[i - 1].x || pt.y !== arr[i - 1].y);
  return renderRoundedPath(filtered);
}

export function buildWirePath(p1, e1, e2, p2, waypoints = []) {
  return renderRoundedPath(getWirePoints(p1, e1, e2, p2, waypoints));
}

export function wireColor(pinLabel) {
  if (!pinLabel) return '#2ecc71';
  const l = pinLabel.toUpperCase();
  if (l.includes('GND') || l === 'CATHODE') return '#808080';
  if (l.includes('5V') || l.includes('3.3V') || l === 'VCC' || l === 'ANODE') return '#e74c3c';
  return '#2ecc71';
}
