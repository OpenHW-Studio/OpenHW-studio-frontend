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
    const pts = computeWireOrthoPoints(p1, e1, e2, p2, wire.waypoints || [], 0);
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

// ─── COMPUTE ORTHOGONAL WIRE CORNER POINTS ─────────────────────────────────
export function computeWireOrthoPoints(p1, e1, e2, p2, waypoints = [], offset = 0) {
  if (waypoints.length > 0 && waypoints[0]._corner) {
    const pts = [p1, ...waypoints, p2];
    return pts.filter((pt, i, arr) => i === 0 || pt.x !== arr[i - 1].x || pt.y !== arr[i - 1].y);
  }

  if (waypoints.length > 0) {
    const pts = [p1, e1, ...waypoints, e2, p2].filter((pt, i, arr) =>
      i === 0 || Math.abs(pt.x - arr[i - 1].x) > 2 || Math.abs(pt.y - arr[i - 1].y) > 2
    );
    return pts;
  }

  const laneIndex = typeof offset === 'number' ? offset % LANE_COUNT : 0;
  const trunkShift = laneIndexToShift(laneIndex);

  if (waypoints.length > 0) {
    const pts = [p1, e1, ...waypoints, e2, p2].filter((pt, i, arr) =>
      i === 0 || Math.abs(pt.x - arr[i - 1].x) > 2 || Math.abs(pt.y - arr[i - 1].y) > 2
    );
    return applyLaneOffsetToPoints(pts, laneIndex);
  }

  const se1 = aimStubTowardTarget(p1, { ...e1 }, p2);
  const se2 = aimStubTowardTarget(p2, { ...e2 }, p1);

  const sdx1 = se1.x - p1.x;
  const sdy1 = se1.y - p1.y;
  const sdx2 = se2.x - p2.x;
  const sdy2 = se2.y - p2.y;
  const e1Horiz = Math.abs(sdx1) >= Math.abs(sdy1);
  const e2Horiz = Math.abs(sdx2) >= Math.abs(sdy2);

  let midPts;
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

  const pts = [p1, se1, ...midPts, se2, p2];
  return pts.filter((pt, i, arr) => i === 0 || Math.abs(pt.x - arr[i - 1].x) > 2 || Math.abs(pt.y - arr[i - 1].y) > 2);
}

// ─── SINGLE SOURCE OF TRUTH: full orthogonal point list for any wire mode ──
export function getWirePoints(p1, e1, e2, p2, waypoints = [], offset = 0, pathOverride = null) {
  const laneIndex = typeof offset === 'number' ? offset % LANE_COUNT : 0;
  if (pathOverride && pathOverride.length >= 2) {
    const pts = pathOverride.map((pt, i) => {
      if (i === 0) return p1;
      if (i === pathOverride.length - 1) return p2;
      return pt;
    });
    return applyLaneOffsetToPoints(pts, laneIndex);
  }
  if (waypoints.length > 0 && waypoints[0]._corner) {
    let pts = [p1, ...waypoints, p2];
    pts = pts.filter((pt, i, arr) => i === 0 || pt.x !== arr[i - 1].x || pt.y !== arr[i - 1].y);
    return applyLaneOffsetToPoints(pts, laneIndex);
  }

  if (waypoints.length > 0) {
    const hints = [e1, ...waypoints, e2];
    let pts = [p1];
    for (let i = 0; i < hints.length - 1; i++) {
      const a = hints[i], b = hints[i + 1];
      pts.push(a);
      const midX = (a.x + b.x) / 2;
      pts.push({ x: midX, y: a.y });
      pts.push({ x: midX, y: b.y });
    }
    pts.push(e2, p2);
    pts = pts.filter((pt, i, arr) => i === 0 || pt.x !== arr[i - 1].x || pt.y !== arr[i - 1].y);
    return applyLaneOffsetToPoints(pts, laneIndex);
  }

  return computeWireOrthoPoints(p1, e1, e2, p2, [], laneIndex);
}

// Preview wire while drawing
export function multiRoutePath(p1, p2, waypoints = []) {
  if (!p1 || !p2) return '';
  const hints = [p1, ...waypoints, p2];
  let pts = [];
  for (let i = 0; i < hints.length - 1; i++) {
    const a = hints[i], b = hints[i + 1];
    if (i === 0) pts.push(a);
    const midX = (a.x + b.x) / 2;
    pts.push({ x: midX, y: a.y });
    pts.push({ x: midX, y: b.y });
    pts.push(b);
  }
  pts = pts.filter((pt, i, arr) => i === 0 || pt.x !== arr[i - 1].x || pt.y !== arr[i - 1].y);
  return renderRoundedPath(pts);
}

// Builds the SVG path string for a placed wire.
export function buildWirePath(p1, e1, e2, p2, waypoints = [], pathOverride = null, offset = 0) {
  return renderRoundedPath(getWirePoints(p1, e1, e2, p2, waypoints, offset, pathOverride));
}

export function wireColor(pinLabel) {
  if (!pinLabel) return '#2ecc71';
  const l = pinLabel.toUpperCase();
  if (l.includes('GND') || l === 'CATHODE') return '#808080';
  if (l.includes('5V') || l.includes('3.3V') || l === 'VCC' || l === 'ANODE') return '#e74c3c';
  return '#2ecc71';
}
