// Tuned spacing/tolerance for bundling (aligned to 15px grid)
const WIRE_SPACING = 15;
// How far along the trunk each wire's turn point is staggered per spacing step
const STAGGER_STEP = 15;
const OVERLAP_TOLERANCE = 4;

function dedupePoints(points) {
  const out = [];
  for (const pt of points || []) {
    if (!pt) continue;
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - pt.x) < 0.1 && Math.abs(last.y - pt.y) < 0.1) continue;
    out.push({ x: pt.x, y: pt.y });
  }
  return out;
}

function orthogonalizePair(a, b, horizontalFirst) {
  if (Math.abs(a.x - b.x) < 0.1 || Math.abs(a.y - b.y) < 0.1) return [a, b];
  if (horizontalFirst) {
    return [a, { x: b.x, y: a.y }, b];
  }
  return [a, { x: a.x, y: b.y }, b];
}

function buildBaseRoutePoints(p1, e1, e2, p2, waypoints = [], offset = 0) {
  if (!p1 || !e1 || !e2 || !p2) return [];

  const cleanedWaypoints = Array.isArray(waypoints) ? waypoints.filter(Boolean) : [];
  if (cleanedWaypoints.length > 0) {
    const pts = [p1, e1, ...cleanedWaypoints, e2, p2];
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const prev = out[out.length - 1];
      const curr = pts[i];
      const horizontalFirst = Math.abs(curr.x - prev.x) >= Math.abs(curr.y - prev.y);
      out.push(...orthogonalizePair(prev, curr, horizontalFirst).slice(1));
    }
    return dedupePoints(out);
  }

  const dx = e2.x - e1.x;
  const dy = e2.y - e1.y;
  const horizontalFirst = Math.abs(dx) >= Math.abs(dy);

  let shift = 0, stagger = 0;
  if (typeof offset === 'object' && offset !== null) {
    shift = Number(offset.offset) || 0;
    stagger = Number(offset.stagger) || 0;
  } else {
    shift = Number(offset) || 0;
    stagger = (WIRE_SPACING !== 0) ? (shift / WIRE_SPACING) * STAGGER_STEP : 0;
  }
  const laneOffset = shift;

  // Whether each exit stub goes horizontally or vertically from the pin
  const e1StubHoriz = Math.abs(e1.x - p1.x) >= Math.abs(e1.y - p1.y);
  const e2StubHoriz = Math.abs(e2.x - p2.x) >= Math.abs(e2.y - p2.y);

  let route = [];

  // Helper to ensure we don't overlap the stub if forced to double back
  const getShiftX = (x, targetX) => {
      if (Math.abs(targetX - x) > 5) return targetX;
      return x + (stagger ? stagger : 15 * (Math.sign(dx) || 1));
  };
  const getShiftY = (y, targetY) => {
      if (Math.abs(targetY - y) > 5) return targetY;
      return y + (stagger ? stagger : 15 * (Math.sign(dy) || 1));
  };

  if (horizontalFirst) {
    let midX = typeof offset.bundleMidX === 'number'
        ? offset.bundleMidX + laneOffset
        : Math.round(((e1.x + e2.x) / 2) / 15) * 15 + laneOffset;

    let p1Points = [];
    let currentY1;
    if (e1StubHoriz) {
      const dirX1 = Math.sign(e1.x - p1.x) || 1;
      const turnX1 = e1.x + dirX1 * Math.abs(stagger);
      if (Math.sign(midX - turnX1) === -dirX1) {
          currentY1 = getShiftY(p1.y, e2.y);
          p1Points = [p1, { x: turnX1, y: p1.y }, { x: turnX1, y: currentY1 }];
      } else {
          currentY1 = p1.y;
          p1Points = [p1, { x: turnX1, y: p1.y }];
      }
    } else {
      const dirY1 = e1.y < p1.y ? -1 : 1;
      const turnY1 = e1.y + dirY1 * Math.abs(stagger);
      currentY1 = turnY1;
      p1Points = [p1, { x: p1.x, y: turnY1 }];
      midX = getShiftX(p1.x, midX);
    }

    let p2Points = [];
    let currentY2;
    if (e2StubHoriz) {
      const dirX2 = Math.sign(e2.x - p2.x) || 1;
      const turnX2 = e2.x + dirX2 * Math.abs(stagger);
      if (Math.sign(midX - turnX2) === -dirX2) {
          currentY2 = getShiftY(p2.y, currentY1);
          p2Points = [{ x: turnX2, y: currentY2 }, { x: turnX2, y: p2.y }, p2];
      } else {
          currentY2 = p2.y;
          p2Points = [{ x: turnX2, y: p2.y }, p2];
      }
    } else {
      const dirY2 = e2.y < p2.y ? -1 : 1;
      const turnY2 = e2.y + dirY2 * Math.abs(stagger);
      currentY2 = turnY2;
      p2Points = [{ x: p2.x, y: turnY2 }, p2];
      midX = getShiftX(p2.x, midX);
    }

    route = [...p1Points, { x: midX, y: currentY1 }, { x: midX, y: currentY2 }, ...p2Points];
  } else {
    // verticalFirst
    let midY = typeof offset.bundleMidY === 'number'
        ? offset.bundleMidY + laneOffset
        : Math.round(((e1.y + e2.y) / 2) / 15) * 15 + laneOffset;

    let p1Points = [];
    let currentX1;
    if (!e1StubHoriz) { 
      const dirY1 = Math.sign(e1.y - p1.y) || 1;
      const turnY1 = e1.y + dirY1 * Math.abs(stagger);
      if (Math.sign(midY - turnY1) === -dirY1) {
          currentX1 = getShiftX(p1.x, e2.x);
          p1Points = [p1, { x: p1.x, y: turnY1 }, { x: currentX1, y: turnY1 }];
      } else {
          currentX1 = p1.x;
          p1Points = [p1, { x: p1.x, y: turnY1 }];
      }
    } else {
      const dirX1 = Math.sign(e1.x - p1.x) || 1;
      const turnX1 = e1.x + dirX1 * Math.abs(stagger);
      currentX1 = turnX1;
      p1Points = [p1, { x: turnX1, y: p1.y }];
      midY = getShiftY(p1.y, midY);
    }

    let p2Points = [];
    let currentX2;
    if (!e2StubHoriz) {
      const dirY2 = Math.sign(e2.y - p2.y) || 1;
      const turnY2 = e2.y + dirY2 * Math.abs(stagger);
      if (Math.sign(midY - turnY2) === -dirY2) {
          currentX2 = getShiftX(p2.x, currentX1);
          p2Points = [{ x: currentX2, y: turnY2 }, { x: p2.x, y: turnY2 }, p2];
      } else {
          currentX2 = p2.x;
          p2Points = [{ x: p2.x, y: turnY2 }, p2];
      }
    } else {
      const dirX2 = Math.sign(e2.x - p2.x) || 1;
      const turnX2 = e2.x + dirX2 * Math.abs(stagger);
      currentX2 = turnX2;
      p2Points = [{ x: turnX2, y: p2.y }, p2];
      midY = getShiftY(p2.y, midY);
    }

    route = [...p1Points, { x: currentX1, y: midY }, { x: currentX2, y: midY }, ...p2Points];
  }

  return dedupePoints(route);
}

function segmentsFromPoints(points, wireId) {
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (Math.abs(a.x - b.x) < 0.1 && Math.abs(a.y - b.y) < 0.1) continue;
    const vertical = Math.abs(a.x - b.x) < Math.abs(a.y - b.y);
    segments.push({
      wireId,
      vertical,
      start: { x: a.x, y: a.y },
      end: { x: b.x, y: b.y },
      centerLine: vertical ? a.x : a.y,
    });
  }
  return segments;
}

function overlapRange(seg) {
  if (seg.vertical) {
    return [Math.min(seg.start.y, seg.end.y), Math.max(seg.start.y, seg.end.y)];
  }
  return [Math.min(seg.start.x, seg.end.x), Math.max(seg.start.x, seg.end.x)];
}

function segmentsOverlap(a, b) {
  if (a.vertical !== b.vertical) return false;
  if (Math.abs(a.centerLine - b.centerLine) > OVERLAP_TOLERANCE) return false;
  const [a0, a1] = overlapRange(a);
  const [b0, b1] = overlapRange(b);
  return !(a1 < b0 || b1 < a0);
}

export function calculateWireBundleOffsets(wires, resolveWirePoints) {
  const offsets = new Map();
  for (const wire of wires || []) {
    if (wire?.id != null) offsets.set(wire.id, { offset: 0, stagger: 0 });
  }

  const allResolved = [];
  for (const wire of wires || []) {
    const r = resolveWirePoints ? resolveWirePoints(wire) : null;
    if (!r || !r.p1 || !r.e1 || !r.e2 || !r.p2) continue;
    
    // Determine exit direction for e1
    let e1Dir = r.e1.dir;
    if (!e1Dir) {
      if (Math.abs(r.e1.y - r.p1.y) >= Math.abs(r.e1.x - r.p1.x)) {
        e1Dir = r.e1.y < r.p1.y ? 'top' : 'bottom';
      } else {
        e1Dir = r.e1.x < r.p1.x ? 'left' : 'right';
      }
    }

    // Determine exit direction for e2 (destination approach direction)
    let e2Dir = r.e2.dir;
    if (!e2Dir) {
      if (Math.abs(r.e2.y - r.p2.y) >= Math.abs(r.e2.x - r.p2.x)) {
        e2Dir = r.e2.y < r.p2.y ? 'top' : 'bottom';
      } else {
        e2Dir = r.e2.x < r.p2.x ? 'left' : 'right';
      }
    }

    const [srcCompId] = (wire.from || '').split(':');
    const [dstCompId] = (wire.to || '').split(':');

    allResolved.push({
      wire,
      p1: r.p1,
      e1: r.e1,
      e2: r.e2,
      p2: r.p2,
      srcCompId,
      dstCompId,
      e1Dir,
      e2Dir
    });
  }

  // Group by exit edge (component + direction) AND destination component
  const srcGroups = new Map();
  for (const r of allResolved) {
    const key = `${r.srcCompId}::${r.e1Dir}::${r.dstCompId}`;
    if (!srcGroups.has(key)) srcGroups.set(key, []);
    srcGroups.get(key).push(r);
  }

  for (const group of srcGroups.values()) {
    if (group.length === 0) continue;
    
    // Sort based on pin position along the exit edge
    const first = group[0];
    const isHorizontalEdge = first.e1Dir === 'top' || first.e1Dir === 'bottom';
    
    if (isHorizontalEdge) {
      // Top/Bottom edge: pins are aligned horizontally, sort by x coordinate
      group.sort((a, b) => a.p1.x - b.p1.x);
    } else {
      // Left/Right edge: pins are aligned vertically, sort by y coordinate
      group.sort((a, b) => a.p1.y - b.p1.y);
    }

    // Calculate shared midpoints for the bundle
    let sumE1X = 0, sumE2X = 0, sumE1Y = 0, sumE2Y = 0;
    group.forEach(r => {
        sumE1X += r.e1.x; sumE2X += r.e2.x;
        sumE1Y += r.e1.y; sumE2Y += r.e2.y;
    });
    const avgE1X = sumE1X / group.length;
    const avgE2X = sumE2X / group.length;
    const avgE1Y = sumE1Y / group.length;
    const avgE2Y = sumE2Y / group.length;
    
    const bundleMidX = Math.round(((avgE1X + avgE2X) / 2) / 15) * 15;
    const bundleMidY = Math.round(((avgE1Y + avgE2Y) / 2) / 15) * 15;

    const count = group.length;
    group.forEach((r, index) => {
      const cur = offsets.get(r.wire.id) || { offset: 0, stagger: 0 };
      cur.stagger = (index + 1) * STAGGER_STEP;
      cur.offset = (index - Math.floor(count / 2)) * WIRE_SPACING;
      cur.bundleMidX = bundleMidX;
      cur.bundleMidY = bundleMidY;
      offsets.set(r.wire.id, cur);
    });
  }

  // The dstGroups laneOffset assignment is no longer needed since we
  // assign laneOffset at the source group level to maintain bundle parallelism.
  // We can just keep it for cases where wires from different sources arrive at the same destination,
  // but to avoid overwriting our beautiful source bundling, we will NOT overwrite `offset`.
  const dstGroups = new Map();
  for (const r of allResolved) {
    const key = `${r.dstCompId}::${r.e2Dir}`;
    if (!dstGroups.has(key)) dstGroups.set(key, []);
    dstGroups.get(key).push(r);
  }

  for (const group of dstGroups.values()) {
    if (group.length === 0) continue;

    const first = group[0];
    const isHorizontalEdge = first.e2Dir === 'top' || first.e2Dir === 'bottom';

    if (isHorizontalEdge) {
      group.sort((a, b) => a.p2.x - b.p2.x);
    } else {
      group.sort((a, b) => a.p2.y - b.p2.y);
    }

    // Assign stagger for the destination if we want it to be independent,
    // but right now stagger is shared (assigned in srcGroup).
    // So we don't need to do anything here anymore for basic routing!
  }

  return offsets;
}

export function buildWireRoutePoints(p1, e1, e2, p2, waypoints = [], offset = 0) {
  return buildBaseRoutePoints(p1, e1, e2, p2, waypoints, offset);
}
