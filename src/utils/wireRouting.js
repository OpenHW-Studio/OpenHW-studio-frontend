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

  let route;

  if (horizontalFirst) {
    // ── Horizontal trunk ──────────────────────────────────────────────────────
    // Opposite-exit optimization: if one pin exits UP and the other DOWN,
    // put the trunk at the exit that goes AWAY from the board (farther out),
    // so both stubs travel naturally in their exit direction with no backtrack.
    let trunkY;
    const e1ExitsUp = e1.y < p1.y;
    const e2ExitsUp = e2.y < p2.y;
    if (e1ExitsUp !== e2ExitsUp) {
      // One up, one down → use the "outer" (farther from midpoint) exit level
      trunkY = Math.min(e1.y, e2.y);
    } else {
      trunkY = Math.round(((e1.y + e2.y) / 2) / 15) * 15;
    }
    trunkY += laneOffset;

    // ── Source side (p1 → trunk) ──────────────────────────────────────────────
    let p1Points;
    if (e1StubHoriz) {
      // Horizontal exit stub → stagger the x where we turn vertical
      const dirX1 = Math.sign(e1.x - p1.x) || 1;
      const staggerX1 = dirX1 * Math.abs(stagger);
      const turnX1 = e1.x + staggerX1;
      p1Points = [p1, { x: turnX1, y: p1.y }, { x: turnX1, y: trunkY }];
    } else {
      // Vertical exit stub → stagger the y where we turn horizontal
      // Direction of exit: -1 = up, +1 = down
      const exitDirY1 = e1.y < p1.y ? -1 : 1;
      const turnY1 = e1.y + exitDirY1 * Math.abs(stagger);
      const hasUTurn = Math.sign(trunkY - turnY1) === Math.sign(p1.y - turnY1);
      if (hasUTurn) {
        // Staggered turn-height is still inside the component; shift one grid sideways
        const shiftX1 = p1.x + 15 * (Math.sign(p2.x - p1.x) || 1);
        p1Points = [p1, { x: p1.x, y: turnY1 }, { x: shiftX1, y: turnY1 }, { x: shiftX1, y: trunkY }];
      } else {
        p1Points = [p1, { x: p1.x, y: turnY1 }, { x: e1.x, y: trunkY }];
      }
    }

    // ── Destination side (trunk → p2) ─────────────────────────────────────────
    let p2Points;
    if (e2StubHoriz) {
      const dirX2 = Math.sign(e2.x - p2.x) || 1;
      const staggerX2 = dirX2 * Math.abs(stagger);
      const turnX2 = e2.x + staggerX2;
      p2Points = [{ x: turnX2, y: trunkY }, { x: turnX2, y: p2.y }, p2];
    } else {
      const exitDirY2 = e2.y < p2.y ? -1 : 1;
      const turnY2 = e2.y + exitDirY2 * Math.abs(stagger);
      const hasUTurn = Math.sign(trunkY - turnY2) === Math.sign(p2.y - turnY2);
      if (hasUTurn) {
        const shiftX2 = p2.x + 15 * (Math.sign(p1.x - p2.x) || 1);
        p2Points = [{ x: shiftX2, y: trunkY }, { x: shiftX2, y: turnY2 }, { x: p2.x, y: turnY2 }, p2];
      } else {
        p2Points = [{ x: e2.x, y: trunkY }, { x: p2.x, y: turnY2 }, p2];
      }
    }

    route = [...p1Points, ...p2Points];

  } else {
    // ── Vertical trunk ────────────────────────────────────────────────────────
    let trunkX;
    const e1ExitsLeft = e1.x < p1.x;
    const e2ExitsLeft = e2.x < p2.x;
    if (e1ExitsLeft !== e2ExitsLeft) {
      trunkX = Math.min(e1.x, e2.x);
    } else {
      trunkX = Math.round(((e1.x + e2.x) / 2) / 15) * 15;
    }
    trunkX += laneOffset;

    // ── Source side (p1 → trunk) ──────────────────────────────────────────────
    let p1Points;
    if (!e1StubHoriz) {
      // Vertical exit stub → stagger the y where we turn horizontal
      const dirY1 = Math.sign(e1.y - p1.y) || 1;
      const staggerY1 = dirY1 * Math.abs(stagger);
      const turnY1 = e1.y + staggerY1;
      p1Points = [p1, { x: p1.x, y: turnY1 }, { x: trunkX, y: turnY1 }];
    } else {
      // Horizontal exit stub → stagger the x where we turn vertical
      const exitDirX1 = e1.x < p1.x ? -1 : 1;
      const turnX1 = e1.x + exitDirX1 * Math.abs(stagger);
      const hasUTurn = Math.sign(trunkX - turnX1) === Math.sign(p1.x - turnX1);
      if (hasUTurn) {
        const shiftY1 = p1.y + 15 * (Math.sign(p2.y - p1.y) || 1);
        p1Points = [p1, { x: turnX1, y: p1.y }, { x: turnX1, y: shiftY1 }, { x: trunkX, y: shiftY1 }];
      } else {
        p1Points = [p1, { x: turnX1, y: p1.y }, { x: trunkX, y: e1.y }];
      }
    }

    // ── Destination side (trunk → p2) ─────────────────────────────────────────
    let p2Points;
    if (!e2StubHoriz) {
      const dirY2 = Math.sign(e2.y - p2.y) || 1;
      const staggerY2 = dirY2 * Math.abs(stagger);
      const turnY2 = e2.y + staggerY2;
      p2Points = [{ x: trunkX, y: turnY2 }, { x: p2.x, y: turnY2 }, p2];
    } else {
      const exitDirX2 = e2.x < p2.x ? -1 : 1;
      const turnX2 = e2.x + exitDirX2 * Math.abs(stagger);
      const hasUTurn = Math.sign(trunkX - turnX2) === Math.sign(p2.x - turnX2);
      if (hasUTurn) {
        const shiftY2 = p2.y + 15 * (Math.sign(p1.y - p2.y) || 1);
        p2Points = [{ x: trunkX, y: shiftY2 }, { x: turnX2, y: shiftY2 }, { x: turnX2, y: p2.y }, p2];
      } else {
        p2Points = [{ x: trunkX, y: e2.y }, { x: turnX2, y: p2.y }, p2];
      }
    }

    route = [...p1Points, ...p2Points];
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

  // Group by exit edge (component + direction)
  const srcGroups = new Map();
  for (const r of allResolved) {
    const key = `${r.srcCompId}::${r.e1Dir}`;
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

    // Assign incremental stagger values: 15px, 30px, 45px...
    group.forEach((r, index) => {
      const cur = offsets.get(r.wire.id) || { offset: 0, stagger: 0 };
      cur.stagger = (index + 1) * STAGGER_STEP;
      offsets.set(r.wire.id, cur);
    });
  }

  // Group by destination edge (component + direction)
  const dstGroups = new Map();
  for (const r of allResolved) {
    const key = `${r.dstCompId}::${r.e2Dir}`;
    if (!dstGroups.has(key)) dstGroups.set(key, []);
    dstGroups.get(key).push(r);
  }

  for (const group of dstGroups.values()) {
    if (group.length === 0) continue;

    // Sort based on pin position along the destination edge
    const first = group[0];
    const isHorizontalEdge = first.e2Dir === 'top' || first.e2Dir === 'bottom';

    if (isHorizontalEdge) {
      group.sort((a, b) => a.p2.x - b.p2.x);
    } else {
      group.sort((a, b) => a.p2.y - b.p2.y);
    }

    const count = group.length;
    // Assign symmetric laneOffset values
    group.forEach((r, index) => {
      const cur = offsets.get(r.wire.id) || { offset: 0, stagger: 0 };
      cur.offset = (index - Math.floor(count / 2)) * WIRE_SPACING;
      offsets.set(r.wire.id, cur);
    });
  }

  return offsets;
}

export function buildWireRoutePoints(p1, e1, e2, p2, waypoints = [], offset = 0) {
  return buildBaseRoutePoints(p1, e1, e2, p2, waypoints, offset);
}
